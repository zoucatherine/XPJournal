import type pg from "pg";
import { pool } from "@workspace/db";
import sharp from "sharp";
import { deleteAttachmentObject } from "./attachmentStorage.js";
import { logger } from "./logger.js";

export class AttachmentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type AttachmentRef = { id: string; offset: number; caption?: string | null };
export type AttachmentRow = {
  id: string; user_id: string | null; date: string; name: string; caption: string | null; size: number;
  content_type: string; object_path: string; upload_path: string;
  status: string; expires_at: Date | null; deleted_at: Date | null;
};

export function attachmentMetadata(row: AttachmentRow) {
  return { id: row.id, name: row.name, caption: row.caption ?? null, size: row.size, contentType: row.content_type };
}

export async function validateImage(bytes: Buffer, contentType: string) {
  if (!bytes.length || bytes.length > 1048576) throw new AttachmentError("Images must be at most 1 MiB.");
  try {
    const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: "warning", animated: true });
    const metadata = await image.metadata();
    const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[contentType];
    if (!expected || metadata.format !== expected) throw new Error("File content does not match its image type.");
    if ((metadata.pages ?? 1) !== 1) throw new Error("Animated images are not supported.");
    if (!metadata.width || !metadata.height || metadata.width > 2048 || metadata.height > 2048) {
      throw new Error("Images must fit within 2048 × 2048 pixels.");
    }
    // Force a full pixel decode, not only a magic-byte or header check.
    await sharp(bytes, { limitInputPixels: 4_000_000, failOn: "warning" }).raw().toBuffer();
    return bytes;
  } catch (error) {
    throw new AttachmentError(error instanceof Error ? error.message : "Unreadable image.");
  }
}

export async function lockAccount(client: pg.PoolClient, userId: string) {
  const result = await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]);
  if (!result.rowCount) throw new AttachmentError("Account no longer exists.", 401);
}

export async function validateReferences(client: pg.PoolClient, userId: string, date: string, body: string, refs: AttachmentRef[]) {
  if (refs.length > 10 || new Set(refs.map(r => r.id)).size !== refs.length) {
    throw new AttachmentError("An entry can contain up to 10 different images.");
  }
  if (refs.some((ref, i) => ref.offset > body.length || ref.offset < 0 || (i > 0 && ref.offset < refs[i - 1].offset))) {
    throw new AttachmentError("Invalid attachment positions.");
  }
  if (!refs.length) return;
  const result = await client.query<AttachmentRow>(
    `SELECT * FROM journal_attachments WHERE id=ANY($1::uuid[]) AND user_id=$2 AND date=$3
      AND status='ready' AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE`,
    [refs.map(r => r.id), userId, date],
  );
  if (result.rows.length !== refs.length) throw new AttachmentError("An attachment is missing, expired, or belongs to another entry.");
}

export async function commitReferences(client: pg.PoolClient, userId: string, date: string, previous: AttachmentRef[], next: AttachmentRef[]) {
  const ids = next.map(r => r.id);
  if (ids.length) await client.query(
    "UPDATE journal_attachments SET expires_at=NULL WHERE user_id=$1 AND id=ANY($2::uuid[])",
    [userId, ids],
  );
  // Caption edits participate in the entry transaction, never an unsaved
  // preview edit. Old clients that omit this field preserve existing labels.
  for (const ref of next) {
    if (ref.caption !== undefined) await client.query(
      "UPDATE journal_attachments SET caption=$1 WHERE user_id=$2 AND date=$3 AND id=$4",
      [ref.caption?.trim() || null, userId, date, ref.id],
    );
  }
  const removed = previous.filter(r => !ids.includes(r.id)).map(r => r.id);
  if (removed.length) await client.query(
    "UPDATE journal_attachments SET deleted_at=NOW() WHERE user_id=$1 AND date=$2 AND id=ANY($3::uuid[])",
    [userId, date, removed],
  );
}

// Durable tombstones keep failed object deletions retryable. Upload keys are
// not removed until every signed PUT URL has expired, avoiding late recreation.
export async function cleanupAttachments() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<AttachmentRow>(
      `SELECT * FROM journal_attachments
       WHERE upload_expires_at<NOW() AND
         (deleted_at IS NOT NULL OR user_id IS NULL OR expires_at<NOW())
       ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED`,
    );
    for (const row of result.rows) {
      try {
        await deleteAttachmentObject(row.upload_path);
        await deleteAttachmentObject(row.object_path);
        await client.query("DELETE FROM journal_attachments WHERE id=$1", [row.id]);
      } catch {
        // Do not log object names or signed URLs. Retry on the next sweep.
        logger.warn("Private attachment cleanup deferred; storage is unavailable");
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

let cleanupAfter = 0;
export async function maybeCleanupAttachments() {
  if (Date.now() < cleanupAfter) return;
  cleanupAfter = Date.now() + 60_000;
  try { await cleanupAttachments(); }
  catch { logger.warn("Private attachment cleanup will retry"); }
}
