import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import pg from "pg";
import sharp from "sharp";

const objects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("../lib/attachmentStorage.js", () => ({
  StorageUnavailable: class extends Error {},
  attachmentPaths: (id: string) => ({ uploadPath: `/test/uploads/${id}`, objectPath: `/test/images/${id}` }),
  signAttachmentUpload: async () => "https://test.invalid/upload",
  readAttachmentObject: async (path: string) => {
    const data = objects.get(path);
    if (!data) throw Object.assign(new Error("Missing object"), { code: 404 });
    if (data.length > 1048576) throw new Error("Too large");
    return data;
  },
  writeVerifiedAttachment: async (path: string, data: Buffer) => {
    if (objects.has(path)) throw Object.assign(new Error("Already exists"), { code: 412 });
    objects.set(path, data);
  },
  deleteAttachmentObject: async (path: string) => { objects.delete(path); },
}));

const originalUrl = process.env.DATABASE_URL!;
const schema = `test_images_${Date.now()}`;
let admin: pg.Pool;
let pool: typeof import("@workspace/db").pool;
let cleanup: typeof import("../lib/attachments.js").cleanupAttachments;
let server: http.Server;
let base: string;
let owner: string;
let other: string;
let userId: string;
let image: Buffer;

async function request(path: string, token?: string, method = "GET", data?: unknown) {
  return fetch(`${base}/api${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}
async function reserve(bytes = image, date = "2026-10-08", contentType = "image/png") {
  const response = await request("/attachments/uploads", owner, "POST", { date, name: "memory.png", size: bytes.length, contentType });
  expect(response.status).toBe(201);
  const { id } = await response.json() as { id: string };
  objects.set(`/test/uploads/${id}`, bytes);
  return id as string;
}
async function finalize(id: string) {
  return request(`/attachments/${id}/finalize`, owner, "POST");
}
beforeAll(async () => {
  if (!originalUrl) throw new Error("DATABASE_URL is required for isolated image tests");
  admin = new pg.Pool({ connectionString: originalUrl });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const isolated = new URL(originalUrl);
  isolated.searchParams.set("options", `-c search_path=${schema},public`);
  process.env.DATABASE_URL = isolated.toString();
  const { default: app } = await import("../app.js");
  pool = (await import("@workspace/db")).pool;
  cleanup = (await import("../lib/attachments.js")).cleanupAttachments;
  server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const signup = async (username: string) => {
    const response = await request("/auth/signup", undefined, "POST", { username, password: "attachment-test-only-password" });
    expect(response.status).toBe(201);
    return (await response.json() as { token: string }).token;
  };
  owner = await signup("image-owner");
  other = await signup("image-other");
  userId = (await pool.query("SELECT id FROM users WHERE username='image-owner'")).rows[0].id;
  image = await sharp({ create: { width: 40, height: 30, channels: 4, background: { r: 120, g: 160, b: 200, alpha: 0.5 } } }).png().toBuffer();
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

describe("private inline journal attachments", () => {
  it("rejects unauthenticated uploads, invalid metadata and oversized reservations", async () => {
    expect((await request("/attachments/uploads", undefined, "POST", {})).status).toBe(401);
    expect((await request("/attachments/uploads", owner, "POST", { date: "2026-10-08", name: "x", size: 1048577, contentType: "image/png" })).status).toBe(400);
    expect((await request("/attachments/uploads", owner, "POST", { date: "2026-10-08", name: "x", size: 123, contentType: "image/svg+xml" })).status).toBe(400);
  });
  it("validates content, dimensions, and content type before accepting an image", async () => {
    const invalid = await reserve(Buffer.from("not an image"));
    expect((await finalize(invalid)).status).toBe(400);
    const mismatched = await reserve(image, "2026-10-08", "image/jpeg");
    expect((await finalize(mismatched)).status).toBe(400);
    const large = await sharp({ create: { width: 2049, height: 1, channels: 3, background: "#000" } }).png().toBuffer();
    expect((await finalize(await reserve(large))).status).toBe(400);
    const truncated = image.subarray(0, 45);
    expect((await finalize(await reserve(truncated))).status).toBe(400);
  });
  it("preserves positions, isolates accounts and protects saved images during unsaved removal", async () => {
    const id = await reserve();
    const second = await reserve();
    expect((await finalize(id)).status).toBe(200);
    expect((await finalize(second)).status).toBe(200);
    // Retrying finalize is idempotent, and overwriting staging cannot change
    // the verified image or the already-ready metadata.
    objects.set(`/test/uploads/${id}`, Buffer.from("changed"));
    expect((await finalize(id)).status).toBe(200);
    expect((await request(`/attachments/${id}/image`, other)).status).toBe(404);
    expect((await request(`/attachments/${id}/finalize`, other, "POST")).status).toBe(404);
    expect((await request(`/attachments/${id}`, other, "DELETE")).status).toBe(404);
    const body = "A walk 😊\nRemember this";
    const attachments = [{ id, offset: 9 }, { id: second, offset: 9 }];
    expect((await request("/entries", owner, "POST", { date: "2026-10-08", title: "Memories", body, attachments })).status).toBe(201);
    const entry = await (await request("/entries/2026-10-08", owner)).json() as { body: string; attachments: {id: string; offset: number}[] };
    expect(entry.body).toBe(body);
    expect(entry.attachments.map((a: { id: string; offset: number }) => ({ id: a.id, offset: a.offset }))).toEqual(attachments);
    const privateImage = await request(`/attachments/${id}/image`, owner);
    expect(privateImage.headers.get("cache-control")).toBe("private, no-store");
    expect(Buffer.from(await privateImage.arrayBuffer())).toEqual(image);
    expect((await request(`/attachments/${id}`, owner, "DELETE")).status).toBe(409);
    expect((await request("/entries/2026-10-08", owner, "PUT", { title: "Mobile update", body })).status).toBe(409);
    expect((await request("/entries/2026-10-08", owner, "PUT", { title: "Bad position", body, attachments: [{id, offset: 900}] })).status).toBe(400);
    expect((await request("/entries", other, "POST", { date: "2026-10-08", title: "Stolen", body, attachments })).status).toBe(400);
    expect((await request("/entries", owner, "POST", { date: "2026-10-09", title: "Wrong day", body, attachments })).status).toBe(400);
    const matches = await (await request("/entries/search?q=memory.png", owner)).json();
    expect(matches).toEqual([]);
    const matchesText = await (await request("/entries/search?q=walk", owner)).json();
    expect(matchesText).toHaveLength(1);
    expect((await request("/entries/2026-10-08", owner, "PUT", {title:"Updated",body:"before after",attachments:[{id:second,offset:6}]})).status).toBe(200);
    expect((await request(`/attachments/${id}/image`, owner)).status).toBe(404);
    expect((await request(`/attachments/${second}/image`, owner)).status).toBe(200);
    expect((await request("/entries/2026-10-08", owner, "DELETE")).status).toBe(204);
    expect((await request(`/attachments/${second}/image`, owner)).status).toBe(404);
  });
  it("discards drafts safely and cleans expired uploads and ownerless files", async () => {
    const id = await reserve();
    expect((await request(`/attachments/${id}`, owner, "DELETE")).status).toBe(204);
    await cleanup();
    // Signed PUT still valid: do not delete staging prematurely.
    expect(objects.has(`/test/uploads/${id}`)).toBe(true);
    await pool.query("UPDATE journal_attachments SET upload_expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [id]);
    await cleanup();
    expect(objects.has(`/test/uploads/${id}`)).toBe(false);
    const expired = await reserve();
    await pool.query("UPDATE journal_attachments SET expires_at=NOW()-INTERVAL '1 day',upload_expires_at=NOW()-INTERVAL '1 day' WHERE id=$1", [expired]);
    await cleanup();
    expect(objects.has(`/test/uploads/${expired}`)).toBe(false);
    const orphan = await reserve();
    expect((await finalize(orphan)).status).toBe(200);
    await pool.query("UPDATE journal_attachments SET upload_expires_at=NOW()-INTERVAL '1 day' WHERE id=$1", [orphan]);
    await pool.query("DELETE FROM users WHERE id=$1", [userId]);
    expect((await request(`/attachments/${orphan}/image`, owner)).status).toBe(404);
    await cleanup();
    expect(objects.has(`/test/uploads/${orphan}`)).toBe(false);
    expect(objects.has(`/test/images/${orphan}`)).toBe(false);
  });
});
