import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocument } from '../src/js/model/create.js';
import { fileNameFor, loadFromText, toFileText, readAutosave, writeAutosave, AUTOSAVE_KEY } from '../src/js/browser/files.js';

const doc = () => createDocument({ id: 'm', rootId: 'root', rootLabel: 'Root', title: 'Trip plan' });
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

test('file names are safe and never empty', () => {
  assert.equal(fileNameFor('Trip plan'), 'Trip-plan.mindmap.json');
  assert.equal(fileNameFor('../../etc/passwd'), 'etcpasswd.mindmap.json');
  assert.equal(fileNameFor('日本語'), 'mind-map.mindmap.json');
  assert.equal(fileNameFor(undefined), 'mind-map.mindmap.json');
});
test('save then open round-trips the document', () => {
  const out = toFileText(doc()); assert.ok(out.ok);
  const back = loadFromText(out.text); assert.ok(back.ok);
  assert.deepEqual(back.document, doc());
});
test('bad files give plain-words errors', () => {
  for (const text of ['', '   ', 'not json', '{"format":"other"}']) {
    const r = loadFromText(text); assert.equal(r.ok, false); assert.match(r.message, /empty|not a valid/);
  }
});
test('autosave round-trips and tolerates missing or broken storage', () => {
  const s = fakeStorage(); assert.equal(readAutosave(s), null);
  assert.ok(writeAutosave(s, doc())); assert.deepEqual(readAutosave(s).document, doc());
  s.setItem(AUTOSAVE_KEY, 'garbage'); assert.equal(readAutosave(s).ok, false);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(readAutosave(broken), null); assert.equal(writeAutosave(broken, doc()), false);
});
