import { parseDocument, serializeDocument } from '../model/index.js';

export const AUTOSAVE_KEY = 'mind-mapper:autosave:v1';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Safe download name from the map title: letters, digits, dash, underscore; never empty.
export function fileNameFor(title) {
  const base = String(title ?? '').normalize('NFKD').replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
  return `${base || 'mind-map'}.mindmap.json`;
}

// Turns file text into a document, or a plain-words error.
export function loadFromText(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, message: 'That file is empty.' };
  const result = parseDocument(text);
  if (!result.ok) return { ok: false, message: `That file is not a valid Mind Mapper map (${result.errors[0]?.message ?? 'unreadable'}).` };
  return { ok: true, document: result.document };
}

export function toFileText(document) {
  const result = serializeDocument(document);
  return result.ok ? { ok: true, text: result.json } : { ok: false, message: 'This map cannot be saved: ' + result.errors[0].message };
}

export function readAutosave(storage) {
  try { const text = storage.getItem(AUTOSAVE_KEY); return text ? loadFromText(text) : null; } catch { return null; }
}
export function writeAutosave(storage, document) {
  const out = toFileText(document); if (!out.ok) return false;
  try { storage.setItem(AUTOSAVE_KEY, out.text); return true; } catch { return false; }
}
