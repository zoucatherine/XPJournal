import { Router, type Response } from "express";
import type pg from "pg";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  RequestStickerUploadBody, FinalizeStickerParams, UpdateStickerParams,
  UpdateStickerBody, DeleteStickerParams, GetStickerImageParams,
  FinalizeStickerResponse, ListStickersResponse,
} from "@workspace/api-zod";
import {
  stickerPaths, signAttachmentUpload, readAttachmentObject,
  writeVerifiedAttachment, StorageUnavailable,
} from "../lib/attachmentStorage.js";
import { lockAccount, AttachmentError } from "../lib/attachments.js";
import { StickerError, type StickerRow, stickerMetadata, verifyStickerPng } from "../lib/desktopStickers.js";

const router = Router();
const MAX_STICKERS = 50;
const MAX_BYTES = 25 * 1048576;

async function inAccount<T>(userId: string, action: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockAccount(client, userId);
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

function fail(res: Response, error: unknown) {
  if (error instanceof StickerError || error instanceof AttachmentError) {
    res.status(error.status).json({ error: error.message });
  } else {
    res.status(503).json({ error: error instanceof StorageUnavailable
      ? error.message : "Cannot save or load stickers right now. Check your connection and retry." });
  }
}

async function owned(client: pg.PoolClient, id: string, userId: string) {
  const result = await client.query<StickerRow>(
    `SELECT * FROM desktop_stickers WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL
     AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE`, [id, userId],
  );
  if (!result.rows[0]) throw new StickerError("Sticker not found or upload expired.", 404);
  return result.rows[0];
}

router.get("/stickers", async (req, res) => {
  const result = await pool.query<StickerRow>(
    `SELECT * FROM desktop_stickers WHERE user_id=$1 AND status='ready' AND deleted_at IS NULL
     ORDER BY created_at, id`, [req.userId],
  );
  res.set("Cache-Control", "private, no-store").json(ListStickersResponse.parse(result.rows.map(stickerMetadata)));
});

router.post("/stickers/uploads", async (req, res) => {
  // Orval's numeric bounds do not currently enforce OpenAPI integer types.
  const parsed = RequestStickerUploadBody.strict().refine(input => Number.isInteger(input.size)).safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "Choose a named PNG sticker up to 1 MiB." }); return;
  }
  try {
    const result = await inAccount(req.userId as string, async client => {
      const usage = await client.query<{ bytes: number; count: number }>(
        `SELECT COALESCE(SUM(size),0)::int AS bytes, COUNT(*)::int AS count FROM desktop_stickers
         WHERE user_id=$1 AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())`, [req.userId],
      );
      if (usage.rows[0].count >= MAX_STICKERS || usage.rows[0].bytes + parsed.data.size > MAX_BYTES) {
        throw new StickerError("Sticker storage limit reached (50 stickers or 25 MiB). Remove a sticker first.", 413);
      }
      const id = randomUUID();
      const paths = stickerPaths(id);
      const uploadURL = await signAttachmentUpload(paths.uploadPath, "image/png");
      await client.query(
        `INSERT INTO desktop_stickers(id,user_id,name,size,upload_size,object_path,upload_path,upload_expires_at,expires_at)
         VALUES($1,$2,$3,$4,$4,$5,$6,NOW()+INTERVAL '15 minutes',NOW()+INTERVAL '24 hours')`,
        [id, req.userId, parsed.data.name.trim().replace(/[\x00-\x1f\x7f/\\]/g, "_"),
          parsed.data.size, paths.objectPath, paths.uploadPath],
      );
      return { id, uploadURL };
    });
    res.status(201).json(result);
  } catch (error) { fail(res, error); }
});

router.post("/stickers/:id/finalize", async (req, res) => {
  const parsed = FinalizeStickerParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sticker ID." }); return; }
  try {
    const row = await inAccount(req.userId as string, async client => {
      const row = await owned(client, parsed.data.id, req.userId as string);
      if (row.status === "ready") return row;
      let bytes: Buffer;
      try { bytes = await readAttachmentObject(row.upload_path); }
      catch (error) {
        if ((error as { code?: number }).code === 404) throw new StickerError("Upload has not finished. Try uploading again.");
        if (error instanceof Error && error.message.includes("1 MiB")) throw new StickerError("Sticker PNGs must be at most 1 MiB.");
        throw error;
      }
      if (bytes.length !== row.upload_size) throw new StickerError("Uploaded file size does not match its reservation.");
      const image = await verifyStickerPng(bytes);
      const usage = await client.query<{ bytes: number }>(
        `SELECT COALESCE(SUM(size),0)::int AS bytes FROM desktop_stickers WHERE user_id=$1 AND id<>$2
         AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())`, [req.userId, row.id],
      );
      if (usage.rows[0].bytes + image.bytes.length > MAX_BYTES) throw new StickerError("Sticker storage is full. Remove a sticker first.", 413);
      try { await writeVerifiedAttachment(row.object_path, image.bytes, "image/png"); }
      catch (error) {
        // Recover an immutable write that succeeded before a DB commit failed.
        if ((error as { code?: number }).code !== 412) throw error;
        if (!(await readAttachmentObject(row.object_path)).equals(image.bytes)) throw new StickerError("This upload was finalized with different content.");
      }
      const result = await client.query<StickerRow>(
        `UPDATE desktop_stickers SET status='ready', expires_at=NULL, size=$2,
         image_width=$3, image_height=$4, display_size=$5 WHERE id=$1 RETURNING *`,
        [row.id, image.bytes.length, image.width, image.height, Math.max(24, Math.min(160, Math.max(image.width, image.height)))],
      );
      return result.rows[0];
    });
    res.json(FinalizeStickerResponse.parse(stickerMetadata(row)));
  } catch (error) { fail(res, error); }
});

router.patch("/stickers/:id", async (req, res) => {
  const params = UpdateStickerParams.safeParse(req.params);
  const body = UpdateStickerBody.strict().refine(input =>
    Number.isInteger(input.posX) && Number.isInteger(input.posY) && Number.isInteger(input.displaySize),
  ).safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid sticker position or size." }); return; }
  try {
    const row = await inAccount(req.userId as string, async client => {
      const current = await owned(client, params.data.id, req.userId as string);
      if (current.status !== "ready") throw new StickerError("Sticker is not ready.", 409);
      const result = await client.query<StickerRow>(
        `UPDATE desktop_stickers SET pos_x=$2, pos_y=$3, display_size=$4 WHERE id=$1 RETURNING *`,
        [current.id, body.data.posX, body.data.posY, body.data.displaySize],
      );
      return result.rows[0];
    });
    res.json(FinalizeStickerResponse.parse(stickerMetadata(row)));
  } catch (error) { fail(res, error); }
});

router.delete("/stickers/:id", async (req, res) => {
  const parsed = DeleteStickerParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sticker ID." }); return; }
  try {
    await inAccount(req.userId as string, async client => {
      // Idempotent removal handles a lost successful response safely.
      const result = await client.query("UPDATE desktop_stickers SET deleted_at=COALESCE(deleted_at,NOW()) WHERE id=$1 AND user_id=$2 RETURNING id", [parsed.data.id, req.userId]);
      if (!result.rowCount) throw new StickerError("Sticker not found.", 404);
    });
    res.status(204).end();
  } catch (error) { fail(res, error); }
});

router.get("/stickers/:id/image", async (req, res) => {
  const parsed = GetStickerImageParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sticker ID." }); return; }
  try {
    const result = await pool.query<StickerRow>(
      "SELECT * FROM desktop_stickers WHERE id=$1 AND user_id=$2 AND status='ready' AND deleted_at IS NULL",
      [parsed.data.id, req.userId],
    );
    if (!result.rows[0]) throw new StickerError("Sticker not found.", 404);
    const bytes = await readAttachmentObject(result.rows[0].object_path);
    res.set({
      "Content-Type": "image/png", "Cache-Control": "private, no-store",
      "Vary": "Authorization, Cookie", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    }).send(bytes);
  } catch (error) { fail(res, error); }
});

export default router;
