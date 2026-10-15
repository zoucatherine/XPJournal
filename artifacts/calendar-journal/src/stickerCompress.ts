// Sticker-only PNG validation and compression. Journal attachment compression lives in imageCompress.ts.
export const STICKER_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const STICKER_MAX_ORIGINAL_PIXELS = 40_000_000;
export const STICKER_MAX_BYTES = 1024 * 1024;
export const STICKER_MAX_EDGE = 1024;
const MIN_EDGE = 16;

export class StickerError extends Error {}

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngInfo { width: number; height: number; animated: boolean }

/** Validate signature + IHDR from the first 33 bytes. Throws StickerError. */
export function parsePngHeader(b: Uint8Array): { width: number; height: number } {
  if (b.length === 0) throw new StickerError("That file is empty.");
  if (b.length < 33 || !SIG.every((v, i) => b[i] === v)) throw new StickerError("That file is not a PNG image.");
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const type = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (dv.getUint32(8) !== 13 || type !== "IHDR") throw new StickerError("This PNG is damaged (missing header).");
  const width = dv.getUint32(16), height = dv.getUint32(20);
  if (width < 1 || height < 1) throw new StickerError("This PNG has invalid dimensions.");
  if (width * height > STICKER_MAX_ORIGINAL_PIXELS) throw new StickerError("This image is over 40 megapixels. Choose a smaller PNG.");
  return { width, height };
}

/** Walk and bounds-check every chunk before any bitmap decode. */
export function parsePng(b: Uint8Array): PngInfo {
  const { width, height } = parsePngHeader(b);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const damaged = () => new StickerError("This PNG is damaged or incomplete.");
  let p = 8, sawIdat = false, sawEnd = false;
  while (p < b.length) {
    if (p + 12 > b.length) throw damaged();
    const len = dv.getUint32(p);
    if (len > b.length - p - 12) throw damaged();
    const t = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    if (t === "acTL" || t === "fcTL" || t === "fdAT") throw new StickerError("Animated PNGs are not supported. Choose a still PNG.");
    if (t === "IDAT") sawIdat = true;
    if (t === "IEND") {
      if (len !== 0 || p + 12 !== b.length) throw damaged();
      sawEnd = true;
      break;
    }
    p += 12 + len;
  }
  if (!sawIdat || !sawEnd) throw damaged();
  return { width, height, animated: false };
}

/** Only the longest side is floored, so thin images stay compressible. */
export function belowFloor(w: number, h: number): boolean {
  return Math.max(w, h) < MIN_EDGE;
}

export function targetScale(w: number, h: number): number {
  return Math.min(1, STICKER_MAX_EDGE / Math.max(w, h));
}

export function scaledSize(w: number, h: number, scale: number) {
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export interface StickerFile { blob: Blob; name: string; width: number; height: number }

export function stickerName(fileName: string): string {
  const base = fileName.replace(/\.png$/i, "").trim().slice(0, 116) || "Sticker";
  return `${base}.png`;
}

export async function compressSticker(file: File): Promise<StickerFile> {
  if (file.size === 0) throw new StickerError("That file is empty.");
  if (file.size > STICKER_MAX_ORIGINAL_BYTES) throw new StickerError("That file is over 20 MB. Choose a smaller PNG.");
  parsePngHeader(new Uint8Array(await file.slice(0, 33).arrayBuffer()));
  const info = parsePng(new Uint8Array(await file.arrayBuffer()));
  const name = stickerName(file.name);
  const compliant = file.size <= STICKER_MAX_BYTES && Math.max(info.width, info.height) <= STICKER_MAX_EDGE;

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new StickerError("This PNG could not be decoded. It may be damaged."); }
  try {
    let scale = targetScale(info.width, info.height);
    for (let i = 0; i < 12; i++) {
      const { width, height } = scaledSize(info.width, info.height, scale);
      if (i > 0 && belowFloor(width, height)) break;
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      const ctx = c.getContext("2d");
      if (!ctx) throw new StickerError("Your browser could not process this image.");
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/png"));
      if (blob && blob.size <= STICKER_MAX_BYTES) {
        if (compliant && file.size <= blob.size) return { blob: file.slice(0, file.size, "image/png"), name, width: info.width, height: info.height };
        return { blob, name, width, height };
      }
      scale *= 0.8;
    }
  } finally { bitmap.close(); }
  throw new StickerError("This image could not be compressed under 1 MB. Try a simpler or smaller PNG.");
}
