export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const MAX_ORIGINAL_PIXELS = 40_000_000;
export const MAX_UPLOAD_BYTES = 1024 * 1024;
export const MAX_DIM = 2048;
export const MAX_PIXELS = 4_000_000;
export const MAX_IMAGES = 10;
export type ImgType = "image/jpeg" | "image/png" | "image/webp";
const OK: ImgType[] = ["image/jpeg", "image/png", "image/webp"];

export interface Compressed { blob: Blob; name: string; contentType: ImgType; width: number; height: number }

export function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob | null> {
  return new Promise(res => c.toBlob(b => res(b), type, q));
}

export async function compressImage(file: File): Promise<Compressed> {
  const type = file.type as ImgType;
  if (!OK.includes(type)) throw new Error("Only JPEG, PNG and WebP images can be attached.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("That file is over 20 MB. Choose a smaller image.");
  if (!file.size) throw new Error("This image is empty.");
  // Reject animation before bitmap decoding can silently flatten its first
  // frame. Walk container chunks rather than searching inside pixel data.
  if (type !== "image/jpeg") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const chunkName = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (type === "image/png") {
      for (let offset = 8; offset + 12 <= bytes.length;) {
        if (chunkName(offset + 4) === "acTL") throw new Error("Animated images are not supported.");
        const size = view.getUint32(offset);
        offset += size + 12;
      }
    } else {
      for (let offset = 12; offset + 8 <= bytes.length;) {
        if (chunkName(offset) === "ANIM" || chunkName(offset) === "ANMF") throw new Error("Animated images are not supported.");
        const size = view.getUint32(offset + 4, true);
        offset += size + 8 + (size % 2);
      }
    }
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image could not be read. It may be damaged.");
  }
  try {
    const w = bmp.width, h = bmp.height;
    if (w * h > MAX_ORIGINAL_PIXELS) throw new Error("That image is over 40 megapixels. Choose a smaller one.");
    const fit = Math.min(1, MAX_DIM / Math.max(w, h), Math.sqrt(MAX_PIXELS / (w * h)));
    const needsResize = fit < 1;
    const name = (file.name || "image").slice(0, 120);
    const render = async (scale: number, t: ImgType, q?: number) => {
      const cw = Math.max(1, Math.floor(w * scale)), ch = Math.max(1, Math.floor(h * scale));
      const c = document.createElement("canvas");
      c.width = cw; c.height = ch;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Image processing is not available in this browser.");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, cw, ch);
      const b = await toBlob(c, t, q);
      return b && b.type === t ? { blob: b, width: cw, height: ch } : null;
    };
    // Original is usable only if no resize needed and already small; re-encode must be smaller to win.
    const originalOk = !needsResize && file.size <= MAX_UPLOAD_BYTES;
    const qualities = type === "image/png" ? [undefined] : [0.9, 0.8, 0.7, 0.6, 0.5];
    let scale = fit;
    let formats: ImgType[] = type === "image/png" ? ["image/png", "image/webp"] : [type];
    for (let round = 0; round < 8; round++) {
      for (const t of formats) {
        for (const q of t === "image/png" ? [undefined] : (type === "image/png" ? [0.9, 0.75, 0.6] : qualities)) {
          const r = await render(scale, t, q);
          if (!r) continue;
          if (originalOk && round === 0 && file.size <= r.blob.size) {
            return { blob: file, name, contentType: type, width: w, height: h };
          }
          if (r.blob.size <= MAX_UPLOAD_BYTES) return { ...r, name, contentType: t };
        }
      }
      scale *= 0.8;
      if (Math.max(w, h) * scale < 160) break;
    }
    if (originalOk) return { blob: file, name, contentType: type, width: w, height: h };
    formats = [];
    throw new Error("Could not shrink this image under 1 MB. Try a simpler image.");
  } finally {
    bmp.close();
  }
}
