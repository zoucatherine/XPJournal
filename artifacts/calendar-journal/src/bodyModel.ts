export const CAPTION_LIMIT = 200;
export interface AttItem { id: string; name: string; size: number; contentType: string; caption?: string | null }
/** texts.length === imgs.length + 1; imgs[i] sits between texts[i] and texts[i+1]. */
export interface Doc { texts: string[]; imgs: AttItem[] }
export interface Caret { seg: number; pos: number }

export function docFromEntry(body: string, atts?: (AttItem & { offset: number })[]): Doc {
  const list = (atts ?? []).map((a, i) => ({ a, i })).sort((x, y) => x.a.offset - y.a.offset || x.i - y.i);
  const texts: string[] = [];
  const imgs: AttItem[] = [];
  let last = 0;
  for (const { a } of list) {
    const o = Math.min(Math.max(a.offset, last), body.length);
    texts.push(body.slice(last, o));
    imgs.push({ id: a.id, name: a.name, size: a.size, contentType: a.contentType, ...(a.caption !== undefined ? { caption: a.caption } : {}) });
    last = o;
  }
  texts.push(body.slice(last));
  return { texts, imgs };
}

export const docBody = (d: Doc) => d.texts.join("");

export function docRefs(d: Doc): { id: string; offset: number; caption?: string | null }[] {
  let off = 0;
  return d.imgs.map((a, i) => {
    off += d.texts[i].length;
    return { id: a.id, offset: off, ...(a.caption !== undefined ? { caption: a.caption } : {}) };
  });
}

export function insertAt(d: Doc, c: Caret, a: AttItem): Doc {
  const seg = Math.min(c.seg, d.texts.length - 1);
  const t = d.texts[seg];
  const pos = Math.min(c.pos, t.length);
  const texts = [...d.texts];
  texts.splice(seg, 1, t.slice(0, pos), t.slice(pos));
  const imgs = [...d.imgs];
  imgs.splice(seg, 0, a);
  return { texts, imgs };
}

export function removeAt(d: Doc, i: number): Doc {
  const texts = [...d.texts];
  texts.splice(i, 2, d.texts[i] + d.texts[i + 1]);
  const imgs = [...d.imgs];
  imgs.splice(i, 1);
  return { texts, imgs };
}

export const replaceAt = (d: Doc, i: number, a: AttItem): Doc => {
  const imgs = [...d.imgs];
  imgs[i] = { ...a, ...(d.imgs[i].caption !== undefined ? { caption: d.imgs[i].caption } : {}) };
  return { texts: d.texts, imgs };
};

export const captionAt = (d: Doc, i: number, caption: string): Doc => ({
  texts: d.texts,
  imgs: d.imgs.map((a, k) => k === i ? { ...a, caption: caption.slice(0, CAPTION_LIMIT) } : a),
});

export const wordCount = (body: string) => (body.trim() === "" ? 0 : body.trim().split(/\s+/).length);
