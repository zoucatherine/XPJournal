import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import {
  RequestAttachmentUploadBody, FinalizeAttachmentParams, DiscardAttachmentParams,
  GetAttachmentImageParams, FinalizeAttachmentResponse,
} from "@workspace/api-zod";
import {
  attachmentPaths, signAttachmentUpload, readAttachmentObject,
  writeVerifiedAttachment, StorageUnavailable,
} from "../lib/attachmentStorage.js";
import {
  AttachmentError, type AttachmentRow, attachmentMetadata, lockAccount, validateImage,
  maybeCleanupAttachments,
} from "../lib/attachments.js";

const router = Router();
router.use(async (_req, _res, next) => { await maybeCleanupAttachments(); next(); });

router.post("/attachments/uploads", async (req, res) => {
  const parsed = RequestAttachmentUploadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a JPEG, PNG, or WebP image up to 1 MiB with a valid filename and entry date." }); return; }
  const client = await pool.connect();
  try {
    const id = randomUUID();
    const paths = attachmentPaths(id);
    await client.query("BEGIN");
    await lockAccount(client, req.userId as string);
    const usage = await client.query(
      `SELECT COALESCE(SUM(size),0)::int AS bytes, COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE date=$2 AND expires_at IS NOT NULL)::int AS drafts
       FROM journal_attachments WHERE user_id=$1 AND deleted_at IS NULL`,
      [req.userId, parsed.data.date],
    );
    if (usage.rows[0].bytes + parsed.data.size > 50 * 1048576 || usage.rows[0].count >= 500 || usage.rows[0].drafts >= 20) {
      throw new AttachmentError("Image storage limit reached (50 MiB per account; up to 20 pending images per entry). Remove unused images first.", 413);
    }
    const uploadURL = await signAttachmentUpload(paths.uploadPath, parsed.data.contentType);
    await client.query(
      `INSERT INTO journal_attachments(id,user_id,date,name,size,content_type,object_path,upload_path,upload_expires_at,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW()+INTERVAL '15 minutes',NOW()+INTERVAL '24 hours')`,
      [id, req.userId, parsed.data.date, parsed.data.name.replace(/[\x00-\x1f\x7f/\\]/g, "_"),
        parsed.data.size, parsed.data.contentType, paths.objectPath, paths.uploadPath],
    );
    await client.query("COMMIT");
    res.status(201).json({ id, uploadURL });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error instanceof AttachmentError ? error.status : 503).json({
      error: error instanceof AttachmentError || error instanceof StorageUnavailable ? error.message : "Private image storage is unavailable. Please try again.",
    });
  } finally { client.release(); }
});

router.post("/attachments/:id/finalize", async (req, res) => {
  const parsed = FinalizeAttachmentParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid attachment ID." }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockAccount(client, req.userId as string);
    const result = await client.query<AttachmentRow>(
      `SELECT * FROM journal_attachments WHERE id=$1 AND user_id=$2
       AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW()) FOR UPDATE`,
      [parsed.data.id, req.userId],
    );
    const row = result.rows[0];
    if (!row) throw new AttachmentError("Upload not found or expired.", 404);
    if (row.status !== "ready") {
      const bytes = await readAttachmentObject(row.upload_path);
      if (bytes.length !== row.size) throw new AttachmentError("Uploaded file size does not match its reservation.");
      await validateImage(bytes, row.content_type);
      try { await writeVerifiedAttachment(row.object_path, bytes, row.content_type); }
      catch (error) {
        // A previous finalize may have written the immutable object before a
        // DB outage. Retry is safe only if the existing bytes match exactly.
        if ((error as { code?: number }).code !== 412) throw error;
        const existing = await readAttachmentObject(row.object_path);
        if (!existing.equals(bytes)) throw new AttachmentError("Upload already finalized with different content.");
      }
      await client.query("UPDATE journal_attachments SET status='ready' WHERE id=$1", [row.id]);
    }
    await client.query("COMMIT");
    res.json(FinalizeAttachmentResponse.parse(attachmentMetadata(row)));
  } catch (error) {
    await client.query("ROLLBACK");
    const code = error instanceof AttachmentError ? error.status : (error as { code?: number }).code === 404 ? 400 : 503;
    res.status(code).json({ error: error instanceof AttachmentError ? error.message : "Cannot verify this upload. Check that uploading finished and try again." });
  } finally { client.release(); }
});

router.get("/attachments/:id/image", async (req, res) => {
  const parsed = GetAttachmentImageParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid attachment ID." }); return; }
  const result = await pool.query<AttachmentRow>(
    `SELECT * FROM journal_attachments WHERE id=$1 AND user_id=$2 AND status='ready'
     AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at>NOW())`,
    [parsed.data.id, req.userId],
  );
  const row = result.rows[0];
  if (!row) { res.status(404).json({ error: "Image not found." }); return; }
  try {
    const bytes = await readAttachmentObject(row.object_path);
    res.set({
      "Content-Type": row.content_type, "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Vary": "Authorization",
      "Content-Disposition": "inline",
    }).send(bytes);
  } catch { res.status(503).json({ error: "Cannot load this private image right now. Please retry." }); }
});

router.delete("/attachments/:id", async (req, res) => {
  const parsed = DiscardAttachmentParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: "Invalid attachment ID." }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockAccount(client, req.userId as string);
    const result = await client.query<AttachmentRow>(
      "SELECT * FROM journal_attachments WHERE id=$1 AND user_id=$2 FOR UPDATE", [parsed.data.id, req.userId],
    );
    const row = result.rows[0];
    if (!row) throw new AttachmentError("Upload not found.", 404);
    if (row.expires_at === null && row.deleted_at === null) throw new AttachmentError("Save the entry without this attachment before deleting its image.", 409);
    await client.query("UPDATE journal_attachments SET deleted_at=COALESCE(deleted_at,NOW()) WHERE id=$1", [row.id]);
    await client.query("COMMIT");
    res.status(204).end();
  } catch (error) {
    await client.query("ROLLBACK");
    if (!(error instanceof AttachmentError)) throw error;
    res.status(error.status).json({ error: error.message });
  } finally { client.release(); }
});

export default router;
