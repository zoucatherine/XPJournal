export const TASKBAR_H = 30;
export const SIZE_MIN = 24;
/** Room kept around artwork so the Remove toolbar (top) and resize handle (right/bottom) stay on screen. */
export const MARGIN_TOP = 26;
export const MARGIN_SIDE = 8;
export const SIZE_MAX = 512;

export interface Layout { x: number; y: number; size: number }

export function displayDims(imgW: number, imgH: number, size: number) {
  const k = size / Math.max(imgW, imgH);
  return { w: Math.max(1, Math.round(imgW * k)), h: Math.max(1, Math.round(imgH * k)) };
}

export function clampSize(size: number, vw: number, vh: number): number {
  const cap = Math.max(SIZE_MIN, Math.min(SIZE_MAX, vw - MARGIN_SIDE, vh - TASKBAR_H - MARGIN_TOP - MARGIN_SIDE));
  return Math.round(Math.max(SIZE_MIN, Math.min(size, cap)));
}

/** Clamp a layout so the whole sticker stays inside the viewport above the taskbar. */
export function clampLayout(l: Layout, imgW: number, imgH: number, vw: number, vh: number): Layout {
  const size = clampSize(l.size, vw, vh);
  const { w, h } = displayDims(imgW, imgH, size);
  const x = Math.round(Math.max(0, Math.min(l.x, Math.max(0, vw - w - MARGIN_SIDE))));
  const y = Math.round(Math.max(MARGIN_TOP, Math.min(l.y, Math.max(MARGIN_TOP, vh - TASKBAR_H - MARGIN_SIDE - h))));
  return { x, y, size };
}
