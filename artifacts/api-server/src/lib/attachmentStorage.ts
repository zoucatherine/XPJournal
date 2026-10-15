import { Storage } from "@google-cloud/storage";
import { objectStorageClient } from "./objectStorageClient.js";

export class StorageUnavailable extends Error {}

function storage() {
  if (process.env.ATTACHMENT_STORAGE_PROVIDER === "gcs" || process.env.VERCEL) {
    // External deployments need their own bucket and service account. Secrets
    // are read by the server only; never sent to clients or included in logs.
    if (!process.env.ATTACHMENT_BUCKET || !process.env.ATTACHMENT_GCS_CREDENTIALS) {
      throw new StorageUnavailable("Private image storage is not configured for this host.");
    }
    return {
      client: new Storage({ credentials: JSON.parse(process.env.ATTACHMENT_GCS_CREDENTIALS) }),
      dir: `/${process.env.ATTACHMENT_BUCKET}/journal-private`,
      external: true,
    };
  }
  if (!process.env.PRIVATE_OBJECT_DIR) throw new StorageUnavailable("Private image storage is not configured.");
  return { client: objectStorageClient, dir: process.env.PRIVATE_OBJECT_DIR, external: false };
}

function file(path: string) {
  const { client } = storage();
  const [bucket, ...parts] = path.replace(/^\/+/, "").split("/");
  if (!bucket || !parts.length) throw new StorageUnavailable("Invalid private storage path.");
  return client.bucket(bucket).file(parts.join("/"));
}

export function attachmentPaths(id: string) {
  const { dir } = storage();
  return { uploadPath: `${dir}/journal-uploads/${id}`, objectPath: `${dir}/journal-images/${id}` };
}

export function stickerPaths(id: string) {
  const { dir } = storage();
  return { uploadPath: `${dir}/sticker-uploads/${id}`, objectPath: `${dir}/desktop-stickers/${id}` };
}

export async function signAttachmentUpload(path: string, contentType: string) {
  if (storage().external) {
    const [url] = await file(path).getSignedUrl({
      version: "v4", action: "write", expires: Date.now() + 15 * 60_000, contentType,
    });
    return url;
  }
  const [bucketName, ...parts] = path.replace(/^\/+/, "").split("/");
  const response = await fetch("http://127.0.0.1:1106/object-storage/signed-object-url", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName, object_name: parts.join("/"), method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new StorageUnavailable("Cannot prepare a private image upload.");
  const result = await response.json() as { signed_url: string };
  return result.signed_url;
}

export async function readAttachmentObject(path: string, maxSize = 1048576): Promise<Buffer> {
  const object = file(path);
  const chunks: Buffer[] = [];
  let size = 0;
  // Enforce the bound while streaming; metadata alone is not trusted.
  for await (const part of object.createReadStream()) {
    const chunk = Buffer.from(part);
    size += chunk.length;
    if (size > maxSize) throw new Error("Image exceeds the 1 MiB upload limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function writeVerifiedAttachment(path: string, bytes: Buffer, contentType: string) {
  // Only the server can write this immutable, validated object. The signed
  // upload URL points to a different key and cannot replace the final image.
  await file(path).save(bytes, {
    resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType, cacheControl: "private, no-store" },
  });
}

export async function deleteAttachmentObject(path: string) {
  await file(path).delete({ ignoreNotFound: true });
}
