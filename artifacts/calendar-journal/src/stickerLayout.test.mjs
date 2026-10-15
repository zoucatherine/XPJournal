import assert from "node:assert/strict";
import { test } from "node:test";
import { displayDims, clampLayout, clampSize } from "./stickerLayout.ts";
import { LatestWins } from "./stickerQueue.ts";
import { belowFloor, parsePng, parsePngHeader, targetScale, scaledSize, stickerName } from "./stickerCompress.ts";

function chunk(type, data = []) {
  const b = new Uint8Array(12 + data.length);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) b[4 + i] = type.charCodeAt(i);
  b.set(data, 8);
  return b;
}
function png(w, h, extra = []) {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), ...extra.map(t => chunk(t)), chunk("IDAT", [1]), chunk("IEND")];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

test("layout keeps proportions and clamps above taskbar", () => {
  assert.deepEqual(displayDims(200, 100, 100), { w: 100, h: 50 });
  assert.deepEqual(clampLayout({ x: 9999, y: 9999, size: 100 }, 100, 100, 800, 600), { x: 692, y: 462, size: 100 });
  assert.equal(clampSize(900, 800, 600), 512);
  assert.equal(clampSize(1, 800, 600), 24);
});
test("png validation", () => {
  assert.deepEqual(parsePng(png(10, 20)), { width: 10, height: 20, animated: false });
  assert.throws(() => parsePng(png(10, 20, ["acTL"])), /Animated/);
  assert.throws(() => parsePngHeader(new Uint8Array(40)), /not a PNG/);
  assert.throws(() => parsePngHeader(new Uint8Array(0)), /empty/);
  assert.throws(() => parsePngHeader(png(10000, 10000)), /megapixels/);
});
test("scaling never upscales", () => {
  assert.equal(targetScale(500, 300), 1);
  assert.deepEqual(scaledSize(2048, 1024, targetScale(2048, 1024)), { width: 1024, height: 512 });
  assert.equal(stickerName("cat.PNG"), "cat.png");
});

test("controls stay on screen at the top edge", () => {
  assert.equal(clampLayout({ x: 0, y: 0, size: 100 }, 100, 100, 800, 600).y, 26);
});
test("png chunk bounds are validated", () => {
  const ok = png(4, 4);
  assert.throws(() => parsePng(ok.slice(0, ok.length - 3)), /damaged/);
  const trailing = new Uint8Array(ok.length + 4); trailing.set(ok);
  assert.throws(() => parsePng(trailing), /damaged/);
  const badLen = ok.slice(); new DataView(badLen.buffer).setUint32(33, 9999);
  assert.throws(() => parsePng(badLen), /damaged/);
  const iend = ok.slice(); new DataView(iend.buffer).setUint32(iend.length - 12, 1);
  assert.throws(() => parsePng(iend), /damaged/);
});
test("only the longest side is floored", () => {
  assert.equal(belowFloor(1024, 4), false);
  assert.equal(belowFloor(10, 8), true);
});
test("latest-wins: older ack never reports as latest; failures keep latest", async () => {
  const sent = []; const acks = []; const fails = [];
  const gates = [];
  const q = new LatestWins(
    v => new Promise((res, rej) => { sent.push(v); gates.push({ res, rej }); }),
    (a, b) => a === b,
    (v, _s, latest) => acks.push([v, latest]),
    (v, _e, latest) => fails.push([v, latest]),
  );
  q.set(1); q.set(2); q.set(3);
  assert.deepEqual(sent, [1]);
  gates[0].res("a"); await new Promise(r => setTimeout(r));
  assert.deepEqual(acks, [[1, false]]);
  assert.deepEqual(sent, [1, 3]);
  gates[1].rej(new Error("x")); await new Promise(r => setTimeout(r));
  assert.deepEqual(fails, [[3, true]]);
  assert.equal(q.latest, 3);
  q.retry();
  assert.deepEqual(sent, [1, 3, 3]);
});
