import assert from "node:assert/strict";
import { test } from "node:test";
import { docFromEntry, docBody, docRefs, insertAt, removeAt, replaceAt, captionAt, CAPTION_LIMIT, wordCount } from "./bodyModel.ts";

const image = (id) => ({ id, name: `${id}.png`, size: 123, contentType: "image/png" });
test("captions round-trip independently from writing, offsets and caret segments", () => {
  const body = "A walk 😊\nRemember this";
  const original = docFromEntry(body, [
    { ...image("first"), offset: 9 },
    { ...image("second"), offset: 9, caption: null },
  ]);
  const doc = captionAt(original, 0, "Photo from today’s walk");
  assert.equal(doc.texts, original.texts);
  assert.equal(docBody(doc), body);
  assert.deepEqual(docRefs(doc), [
    { id: "first", offset: 9, caption: "Photo from today’s walk" },
    { id: "second", offset: 9, caption: null },
  ]);
  assert.deepEqual(docFromEntry(body, doc.imgs.map((a, i) => ({ ...a, ...docRefs(doc)[i] }))), doc);
  assert.equal(replaceAt(doc, 0, image("replacement")).imgs[0].caption, doc.imgs[0].caption);
  assert.equal(captionAt(doc, 0, "").imgs[0].caption, "");
  assert.equal(captionAt(doc, 0, "x".repeat(300)).imgs[0].caption.length, CAPTION_LIMIT);
  assert.equal(original.imgs[0].caption, undefined);
});
test("legacy text is unchanged", () => {
  const body = "Dear diary...\nA new day.";
  const doc = docFromEntry(body);
  assert.equal(docBody(doc), body);
  assert.deepEqual(docRefs(doc), []);
});
test("insertions keep UTF-16 offsets and text, including equal-position images", () => {
  const body = "Walk 😊 today\nAnother paragraph";
  let doc = docFromEntry(body);
  doc = insertAt(doc, { seg: 0, pos: 7 }, image("first"));
  doc = insertAt(doc, { seg: 1, pos: 0 }, image("second"));
  assert.equal(docBody(doc), body);
  assert.deepEqual(docRefs(doc), [{ id: "first", offset: 7 }, { id: "second", offset: 7 }]);
  assert.deepEqual(docFromEntry(body, doc.imgs.map((a,i) => ({...a, ...docRefs(doc)[i]}))), doc);
});
test("text edits move subsequent buttons; replace/remove preserve surrounding writing", () => {
  let doc = docFromEntry("beforeafter", [{ ...image("a"), offset: 6 }]);
  doc.texts[0] = "longer before";
  assert.deepEqual(docRefs(doc), [{ id: "a", offset: 13 }]);
  doc = replaceAt(doc, 0, image("b"));
  assert.deepEqual(docRefs(doc), [{ id: "b", offset: 13 }]);
  assert.equal(docBody(removeAt(doc, 0)), "longer beforeafter");
  assert.equal(wordCount("one two"), 2);
});
