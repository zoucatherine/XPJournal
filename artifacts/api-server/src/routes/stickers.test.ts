import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import sharp from "sharp";

const objects = vi.hoisted(() => new Map<string, Buffer>());
const storageState = vi.hoisted(() => ({ failDelete: false, failSign: false }));
vi.mock("../lib/attachmentStorage.js", () => ({
  StorageUnavailable: class extends Error {},
  attachmentPaths: (id: string) => ({ uploadPath: `/test/journal-uploads/${id}`, objectPath: `/test/journal-images/${id}` }),
  stickerPaths: (id: string) => ({ uploadPath: `/test/sticker-uploads/${id}`, objectPath: `/test/stickers/${id}` }),
  signAttachmentUpload: async () => {
    if (storageState.failSign) throw new Error("Storage unavailable");
    return "https://test.invalid/upload";
  },
  readAttachmentObject: async (path: string) => {
    const data = objects.get(path);
    if (!data) throw Object.assign(new Error("Missing object"), { code: 404 });
    if (data.length > 1048576) throw new Error("Image exceeds the 1 MiB upload limit.");
    return data;
  },
  writeVerifiedAttachment: async (path: string, data: Buffer) => {
    if (objects.has(path)) throw Object.assign(new Error("Already exists"), { code: 412 });
    objects.set(path, data);
  },
  deleteAttachmentObject: async (path: string) => {
    if (storageState.failDelete) throw new Error("Deletion unavailable");
    objects.delete(path);
  },
}));

const originalUrl = process.env.DATABASE_URL!;
const schema = `test_stickers_${Date.now()}`;
let admin: pg.Pool;
let pool: typeof import("@workspace/db").pool;
let cleanup: typeof import("../lib/desktopStickers.js").cleanupStickers;
let verify: typeof import("../lib/desktopStickers.js").verifyStickerPng;
let server: http.Server;
let base: string;
let owner: string, other: string, ownerId: string;
let image: Buffer;

async function request(path: string, token?: string, method = "GET", data?: unknown) {
  return fetch(`${base}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function reserve(bytes = image) {
  const response = await request("/stickers/uploads", owner, "POST", { name: "transparent.png", size: bytes.length });
  expect(response.status).toBe(201);
  const { id } = await response.json() as { id: string };
  objects.set(`/test/sticker-uploads/${id}`, bytes);
  return id;
}
const finalize = (id: string, token = owner) => request(`/stickers/${id}/finalize`, token, "POST");

beforeAll(async () => {
  if (!originalUrl) throw new Error("DATABASE_URL is required for isolated sticker tests");
  admin = new pg.Pool({ connectionString: originalUrl });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const isolated = new URL(originalUrl);
  isolated.searchParams.set("options", `-c search_path=${schema},public`);
  process.env.DATABASE_URL = isolated.toString();
  const { default: app } = await import("../app.js");
  pool = (await import("@workspace/db")).pool;
  const lib = await import("../lib/desktopStickers.js");
  cleanup = lib.cleanupStickers;
  verify = lib.verifyStickerPng;
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const signup = async (username: string) => {
    const response = await request("/auth/signup", undefined, "POST", { username, password: "sticker-test-only-password" });
    expect(response.status).toBe(201);
    return (await response.json() as { token: string }).token;
  };
  owner = await signup("sticker-owner");
  other = await signup("sticker-other");
  ownerId = (await pool.query("SELECT id FROM users WHERE username='sticker-owner'")).rows[0].id;
  image = await sharp({ create: { width: 80, height: 40, channels: 4, background: { r: 120, g: 160, b: 200, alpha: 0.5 } } }).png().toBuffer();
});

afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
  process.env.DATABASE_URL = originalUrl;
});

describe("private desktop PNG stickers", () => {
  it("requires authentication and bounded upload and layout metadata", async () => {
    expect((await request("/stickers", undefined)).status).toBe(401);
    expect((await request("/stickers/uploads", undefined, "POST", {})).status).toBe(401);
    for (const input of [{ name: "", size: 1 }, { name: "x", size: 0 }, { name: "x", size: 1048577 }, { name: "x", size: 1.5 }]) {
      expect((await request("/stickers/uploads", owner, "POST", input)).status).toBe(400);
    }
    expect((await request("/stickers/not-a-uuid", owner, "PATCH", {})).status).toBe(400);
  });

  it("fully validates PNGs, rejects APNG and preserves alpha without flattening", async () => {
    const verified = await verify(image);
    expect([verified.width, verified.height]).toEqual([80, 40]);
    expect((await sharp(verified.bytes).metadata()).format).toBe("png");
    const pixels = await sharp(verified.bytes).raw().toBuffer({ resolveWithObject: true });
    expect(pixels.info.channels).toBe(4);
    expect(pixels.data[3]).toBe(128);
    await expect(verify(Buffer.from("not png"))).rejects.toThrow("PNG");
    await expect(verify(image.subarray(0, 40))).rejects.toThrow("incomplete");
    await expect(verify(await sharp(image).jpeg().toBuffer())).rejects.toThrow("PNG");
    const tooWide = await sharp({ create: { width: 1025, height: 1, channels: 3, background: "#000" } }).png().toBuffer();
    await expect(verify(tooWide)).rejects.toThrow("1024");
    // The chunk walker rejects animation even if a decoder ignores APNG.
    const animationChunk = Buffer.alloc(20);
    animationChunk.writeUInt32BE(8);
    animationChunk.write("acTL", 4, "ascii");
    const animated = Buffer.concat([image.subarray(0, 33), animationChunk, image.subarray(33)]);
    await expect(verify(animated)).rejects.toThrow("Animated");
    const invalid = await reserve(Buffer.from("not png"));
    expect((await finalize(invalid)).status).toBe(400);
    expect((await request("/stickers", owner)).status).toBe(200);
    expect(await (await request("/stickers", owner)).json()).toEqual([]);
  });

  it("saves layouts and isolates files, mutations and lists from other accounts", async () => {
    const id = await reserve();
    expect((await request(`/stickers/${id}/image`, owner)).status).toBe(404);
    expect((await finalize(id)).status).toBe(200);
    const record = await (await finalize(id)).json();
    expect(record).toMatchObject({ id, imageWidth: 80, imageHeight: 40, displaySize: 80 });
    expect(record).not.toHaveProperty("object_path");
    expect((await finalize(id, other)).status).toBe(404);
    expect((await request(`/stickers/${id}/image`, other)).status).toBe(404);
    expect((await request(`/stickers/${id}`, other, "DELETE")).status).toBe(404);
    const layout = { posX: 45, posY: 67, displaySize: 220 };
    expect((await request(`/stickers/${id}`, other, "PATCH", layout)).status).toBe(404);
    const updated = await request(`/stickers/${id}`, owner, "PATCH", layout);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject(layout);
    expect((await request(`/stickers/${id}`, owner, "PATCH", { ...layout, displaySize: 513 })).status).toBe(400);
    expect((await request(`/stickers/${id}`, owner, "PATCH", { ...layout, displaySize: 60.5 })).status).toBe(400);
    expect((await request(`/stickers/${id}`, owner, "PATCH", { ...layout, posX: -1 })).status).toBe(400);
    expect(await (await request("/stickers", other)).json()).toEqual([]);
    expect(await (await request("/stickers", owner)).json()).toEqual([expect.objectContaining({ id, ...layout })]);
    const file = await request(`/stickers/${id}/image`, owner);
    expect(file.headers.get("content-type")).toContain("image/png");
    expect(file.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await file.arrayBuffer())).toEqual((await verify(image)).bytes);
    // Signed staging URLs can never alter a finalized sticker.
    objects.set(`/test/sticker-uploads/${id}`, Buffer.from("tampered"));
    expect((await finalize(id)).status).toBe(200);
    expect(Buffer.from(await (await request(`/stickers/${id}/image`, owner)).arrayBuffer())).toEqual((await verify(image)).bytes);
    expect((await request(`/stickers/${id}`, owner, "DELETE")).status).toBe(204);
    await cleanup();
    expect(objects.has(`/test/stickers/${id}`)).toBe(true);
    expect((await request(`/stickers/${id}`, owner, "DELETE")).status).toBe(204);
    expect((await request(`/stickers/${id}/image`, owner)).status).toBe(404);
  });

  it("does not couple sticker cleanup to journal images and retries failed deletion", async () => {
    const live = await reserve();
    const removed = await reserve();
    const abandoned = await reserve();
    await finalize(live);
    await finalize(removed);
    await request(`/stickers/${removed}`, owner, "DELETE");
    objects.set("/test/journal-images/untouched", image);
    await pool.query("UPDATE desktop_stickers SET upload_expires_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1", [ownerId]);
    await pool.query("UPDATE desktop_stickers SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [abandoned]);
    storageState.failDelete = true;
    await cleanup();
    expect((await pool.query("SELECT id FROM desktop_stickers WHERE id=$1", [removed])).rowCount).toBe(1);
    storageState.failDelete = false;
    await cleanup();
    expect((await pool.query("SELECT id FROM desktop_stickers WHERE id=ANY($1::uuid[])", [[removed, abandoned]])).rowCount).toBe(0);
    expect(objects.has(`/test/sticker-uploads/${live}`)).toBe(false);
    expect(objects.has(`/test/stickers/${live}`)).toBe(true);
    expect(objects.has("/test/journal-images/untouched")).toBe(true);
    // Cleaning multiple live staging files must not collide on a UNIQUE key.
    const second = await reserve();
    await finalize(second);
    await pool.query("UPDATE desktop_stickers SET upload_expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [second]);
    await cleanup();
    expect(objects.has(`/test/sticker-uploads/${second}`)).toBe(false);
  });

  it("enforces per-account quotas and reports storage errors without a broken reservation", async () => {
    storageState.failSign = true;
    expect((await request("/stickers/uploads", owner, "POST", { name: "x.png", size: image.length })).status).toBe(503);
    storageState.failSign = false;
    const [{ count }] = (await pool.query("SELECT COUNT(*)::int AS count FROM desktop_stickers WHERE user_id=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())", [ownerId])).rows;
    await pool.query(
      `INSERT INTO desktop_stickers(id,user_id,name,size,upload_size,object_path,upload_path,upload_expires_at,expires_at)
       SELECT gen_random_uuid(),$1,'quota.png',1,1,'/quota/image/'||g,'/quota/upload/'||g,NOW()+INTERVAL '15 minutes',NOW()+INTERVAL '24 hours'
       FROM generate_series(1,$2::int) g`, [ownerId, 50 - count],
    );
    expect((await request("/stickers/uploads", owner, "POST", { name: "x.png", size: 1 })).status).toBe(413);
  });

  it("makes deleted-account files inaccessible and cleans them after signed PUT expiry", async () => {
    const rows = (await pool.query("SELECT id,object_path,upload_path FROM desktop_stickers WHERE user_id=$1", [ownerId])).rows;
    await pool.query("DELETE FROM users WHERE id=$1", [ownerId]);
    expect((await pool.query("SELECT id FROM desktop_stickers WHERE user_id=$1", [ownerId])).rowCount).toBe(0);
    expect(await (await request("/stickers", owner)).json()).toEqual([]);
    for (const row of rows.slice(0, 2)) {
      expect((await request(`/stickers/${row.id}/image`, owner)).status).toBe(404);
    }
    // Rows are retained until all outstanding upload URLs have expired.
    await pool.query("UPDATE desktop_stickers SET upload_expires_at=NOW()-INTERVAL '1 minute' WHERE user_id IS NULL");
    for (let sweep = 0; sweep < 4; sweep++) await cleanup();
    expect((await pool.query("SELECT id FROM desktop_stickers WHERE user_id IS NULL")).rowCount).toBe(0);
    for (const row of rows) {
      expect(objects.has(row.object_path)).toBe(false);
      expect(objects.has(row.upload_path)).toBe(false);
    }
  });
});
