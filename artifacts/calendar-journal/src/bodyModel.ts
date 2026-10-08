export interface AttItem { id: string; name: string; size: number; contentType: string }
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
    imgs.push({ id: a.id, name: a.name, size: a.size, contentType: a.contentType });
    last = o;
  }
  texts.push(body.slice(last));
  return { texts, imgs };
}

export const docBody = (d: Doc) => d.texts.join("");

export function docRefs(d: Doc): { id: string; offset: number }[] {
  let off = 0;
  return d.imgs.map((a, i) => {
    off += d.texts[i].length;
    return { id: a.id, offset: off };
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
  imgs[i] = a;
  return { texts: d.texts, imgs };
};

export const wordCount = (body: string) => (body.trim() === "" ? 0 : body.trim().split(/\s+/).length);
