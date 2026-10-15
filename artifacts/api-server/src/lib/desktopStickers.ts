import sharp from "sharp";
import { pool } from "@workspace/db";
import { deleteAttachmentObject } from "./attachmentStorage.js";
import { logger } from "./logger.js";

export class StickerError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type StickerRow = {
  id: string; user_id: string | null; name: string; size: number; upload_size: number;
  image_width: number | null; image_height: number | null;
  pos_x: number; pos_y: number; display_size: number;
  object_path: string; upload_path: string; status: string;
};

export function stickerMetadata(row: StickerRow) {
  return {
    id: row.id, name: row.name, size: row.size,
    imageWidth: row.image_width!, imageHeight: row.image_height!,
    posX: row.pos_x, posY: row.pos_y, displaySize: row.display_size,
  };
}

export async function verifyStickerPng(bytes: Buffer) {
  if (!bytes.length || bytes.length > 1048576) throw new StickerError("Sticker PNGs must be at most 1 MiB.");
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature) ||
      bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(8) !== 13) {
    throw new StickerError("Choose a valid PNG image.");
  }
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 1024 || height > 1024) throw new StickerError("Stickers must fit within 1024 × 1024 pixels.");
  let ended = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) throw new StickerError("This PNG is incomplete.");
    const length = bytes.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new StickerError("This PNG is incomplete.");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (["acTL", "fcTL", "fdAT"].includes(type)) throw new StickerError("Animated PNG stickers are not supported.");
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.length) throw new StickerError("Invalid PNG ending.");
      ended = true;
      break;
    }
    offset = end;
  }
  if (!ended) throw new StickerError("This PNG is incomplete.");
  try {
    // Decode every pixel, then re-encode to strip untrusted ancillary metadata.
    // PNG remains lossless and alpha is never flattened.
    const decoded = await sharp(bytes, { limitInputPixels: 1024 * 1024, failOn: "warning" })
      .raw().toBuffer({ resolveWithObject: true });
    const output = await sharp(decoded.data, { raw: decoded.info })
      .png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    if (output.length > 1048576) throw new StickerError("This PNG is too complex. Resize it smaller and try again.");
    return { bytes: output, width, height };
  } catch (error) {
    if (error instanceof StickerError) throw error;
    throw new StickerError("This PNG could not be decoded. Choose an undamaged image.");
  }
}

// Dedicated sticker tombstones are deliberately independent of entry cleanup.
export async function cleanupStickers() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<StickerRow & { removable: boolean }>(
      `SELECT *, (deleted_at IS NOT NULL OR user_id IS NULL OR expires_at<NOW()) AS removable
       FROM desktop_stickers WHERE upload_expires_at<NOW() AND
         (deleted_at IS NOT NULL OR user_id IS NULL OR expires_at<NOW() OR (status='ready' AND NOT upload_cleaned))
       ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED`,
    );
    for (const row of result.rows) {
      try {
        if (row.upload_path) await deleteAttachmentObject(row.upload_path);
        if (row.removable) {
          await deleteAttachmentObject(row.object_path);
          await client.query("DELETE FROM desktop_stickers WHERE id=$1", [row.id]);
        } else {
          // Live stickers keep only the verified PNG after signed PUT expiry.
          await client.query("UPDATE desktop_stickers SET upload_cleaned=TRUE WHERE id=$1", [row.id]);
        }
      } catch { logger.warn("Desktop sticker cleanup deferred; storage is unavailable"); }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

let cleanupAfter = 0;
export async function maybeCleanupStickers() {
  if (Date.now() < cleanupAfter) return;
  cleanupAfter = Date.now() + 60_000;
  try { await cleanupStickers(); }
  catch { logger.warn("Desktop sticker cleanup will retry"); }
}
