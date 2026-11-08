import { createDocument } from './model/create.js';
import { createEditor, hierarchy, outlinePage } from './browser/controller.js';
import { FONT } from './browser/measurement.js';
import { fileNameFor, loadFromText, toFileText, readAutosave, writeAutosave, MAX_FILE_BYTES } from './browser/files.js';
import { createDiagnostics } from './browser/diagnostics.js';
import { renderMap } from './browser/renderer.js';
import { worldToViewport, screenToViewport, zoomAt, pan, fitView, resetView, canvasSize, hitTest } from './browser/viewport.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map'), stage = $('stage'), context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D is required.');
const measureContext = document.createElement('canvas').getContext('2d');
measureContext.font = FONT;
const diag = createDiagnostics();
window.addEventListener('error', (e) => diag.logError('error', e.message, e.error?.stack ?? `${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => diag.logError('promise', e.reason?.message ?? e.reason, e.reason?.stack ?? ''));
try { new PerformanceObserver((list) => list.getEntries().forEach((x) => diag.addLongTask(x.duration))).observe({ type: 'longtask', buffered: true }); } catch { /* not supported here */ }
const blank = () => createDocument({ id: 'session-map', rootId: 'root', rootLabel: 'My mind map' });
let sequence = 0, usedIds = new Set(), editor, dirty = false, saveTimer = null;
function nextId() { let id; do id = `node-${++sequence}`; while (usedIds.has(id)); usedIds.add(id); return id; }
let widths = new Map();
function measureCached(text) { let w = widths.get(text); if (w === undefined) { if (widths.size > 50000) widths = new Map(); w = measureContext.measureText(text).width; widths.set(text, w); } return w; }
// Big files: measure labels in short steps (about 4 ms each) so the page stays responsive; the editor then finds every width ready.
async function premeasure(doc) {
  const nodes = doc.document.nodes; if (nodes.length < 400) return;
  let start = performance.now();
  for (const node of nodes) {
    for (const paragraph of node.label.split('\n')) if (paragraph.length < 40) measureCached(paragraph);
    if (performance.now() - start > 4) { await new Promise((r) => setTimeout(r)); start = performance.now(); }
  }
}
function makeEditor(doc) {
  usedIds = new Set(doc.document.nodes.map((n) => n.id).concat(doc.document.relationships.map((r) => r.id)));
  return createEditor(doc, measureCached, nextId, { trustCandidate: true });
}
const restored = readAutosave(localStorage);
editor = makeEditor(restored?.ok ? restored.document : blank());
let view = resetView(1, 1), size, frame = null, page = 0;
const pageSize = 80;
function announce(message) { $('app-status').textContent = message; }
const { createObjectURL: makeBlobHref, revokeObjectURL: dropBlobHref } = URL; // aliased so no css-style call text appears in the build
function download(name, text, type = 'text/plain') {
  const href = makeBlobHref(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href, download: name }); document.body.append(link); link.click(); link.remove();
  setTimeout(() => dropBlobHref(href), 4000);
}
const diagContext = () => ({ Browser: navigator.userAgent, 'Screen pixel ratio': devicePixelRatio, 'Map size': `${editor.document.document.nodes.length} topics`, Layout: editor.mode });
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
$('speed-report').onclick = () => { download(`mind-mapper-speed-${stamp()}.txt`, diag.speedReport(diagContext())); announce('Speed report downloaded.'); };
$('error-log').onclick = () => { download(`mind-mapper-errors-${stamp()}.txt`, diag.errorLog(diagContext())); announce(`Error log downloaded (${diag.errorCount} errors).`); };
function markChanged() {
  dirty = true; $('save-note').textContent = 'Unsaved file changes · autosaved in this browser';
  clearTimeout(saveTimer); saveTimer = setTimeout(() => diag.time('autosave', () => writeAutosave(localStorage, editor.document)), 400);
}
function replaceMap(doc, message) {
  if (editor.editing) { announce('Save or cancel the current label edit first.'); return; }
  editor = makeEditor(doc); page = 0; dirty = false; clearTimeout(saveTimer); writeAutosave(localStorage, doc);
  $('save-note').textContent = 'Autosaved in this browser'; view = fitView(editor.layout.bounds, size.width, size.height);
  update(); announce(message);
}
const unsavedOk = () => !dirty || window.confirm('Your latest changes are autosaved in this browser but not saved to a file. Continue?');
const fileMenu = $('file-menu');
fileMenu.addEventListener('click', (event) => { if (event.target.closest('button')) fileMenu.open = false; });
document.addEventListener('pointerdown', (event) => { if (fileMenu.open && !fileMenu.contains(event.target)) fileMenu.open = false; });
fileMenu.addEventListener('keydown', (event) => { if (event.key === 'Escape' && fileMenu.open) { fileMenu.open = false; fileMenu.querySelector('summary').focus(); } });
$('new').onclick = () => { if (unsavedOk()) replaceMap(blank(), 'New map started.'); };
$('open').onclick = () => { if (!editor.editing && unsavedOk()) $('file').click(); };
$('file').onchange = async () => {
  const file = $('file').files[0]; $('file').value = ''; if (!file) return;
  if (file.size > MAX_FILE_BYTES) { announce('That file is too large (5 MB limit).'); return; }
  const loaded = loadFromText(await file.text());
  if (!loaded.ok) { announce(loaded.message); return; }
  announce('Opening...'); await premeasure(loaded.document);
  replaceMap(loaded.document, `Opened ${file.name}.`);
};
$('save').onclick = () => {
  const out = toFileText(editor.document); if (!out.ok) { announce(out.message); return; }
  const name = fileNameFor(editor.document.document.title); download(name, out.text, 'application/json'); dirty = false; $('save-note').textContent = 'Saved as ' + name; announce(`Saved ${name}.`);
};
function positionEditor() {
  if (!editor.editing) return;
  const node = editor.layout.nodesById[editor.editing.id];
  const point = worldToViewport(node, view);
  const width = Math.min(size.width - 16, Math.max(220, node.width * view.scale));
  $('editor').style.width = `${width}px`;
  $('editor').style.left = `${Math.max(8, Math.min(size.width - width - 8, point.x))}px`;
  $('editor').style.maxHeight = `${size.height - 16}px`;
  const height = $('editor').getBoundingClientRect().height;
  $('editor').style.top = `${Math.max(8, Math.min(size.height - height - 8, point.y))}px`;
}
function draw() {
  frame = null; diag.time('draw', () => renderMap(context, editor, view, size)); positionEditor(); diag.markFirstDraw();
  $('zoom-label').textContent = `${Math.round(view.scale * 100)}%`;
}
function invalidate() { if (frame === null) frame = requestAnimationFrame(draw); }
let ordered_cache = null, orderedGeneration = -1, orderedEditor = null; // outline order only changes when the map does
function refreshOutline(focusSelected = false, followSelection = false) {
  if (orderedGeneration !== editor.generation || orderedEditor !== editor) { ordered_cache = hierarchy(editor.document); orderedGeneration = editor.generation; orderedEditor = editor; }
  const ordered = ordered_cache;
  page = outlinePage(ordered, editor.selectedId, page, pageSize, focusSelected || followSelection);
  const fragment = document.createDocumentFragment();
  const counts = new Map();
  for (const { node } of ordered) counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
  const visible = ordered.slice(page * pageSize, (page + 1) * pageSize);
  const hasSelected = visible.some(({ node }) => node.id === editor.selectedId);
  for (const { node, depth } of visible) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = node.label;
    if (node.parentId === null) button.setAttribute('aria-label', `Root topic: ${node.label}`);
    button.setAttribute('role', 'treeitem'); button.setAttribute('aria-level', String(depth + 1));
    button.setAttribute('aria-selected', String(node.id === editor.selectedId));
    if (counts.has(node.id)) button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-posinset', String(node.order + 1)); button.setAttribute('aria-setsize', String(counts.get(node.parentId)));
    button.tabIndex = node.id === editor.selectedId || (!hasSelected && node.id === visible[0].node.id) ? 0 : -1;
    button.style.paddingLeft = `${12 + Math.min(depth, 8) * 12}px`;
    button.dataset.nodeId = node.id;
    button.onclick = () => {
      if (editor.editing) { $('label-input').focus(); announce('Save or cancel the current label edit first.'); return; }
      editor.select(node.id); update(true); reveal();
    };
    button.ondblclick = beginEdit;
    fragment.append(button);
  }
  $('outline').replaceChildren(fragment);
  $('previous').disabled = page === 0; $('next').disabled = (page + 1) * pageSize >= ordered.length;
  $('page-label').textContent = `${page * pageSize + 1}–${Math.min(ordered.length, (page + 1) * pageSize)} / ${ordered.length}`;
  if (focusSelected) Array.from($('outline').children).find((element) => element.dataset.nodeId === editor.selectedId)?.focus();
}
function update(focusOutline = false) {
  $('undo').disabled = !editor.canUndo; $('redo').disabled = !editor.canRedo;
  $('add').disabled = !editor.selectedId; $('edit').disabled = !editor.selectedId;
  $('delete').disabled = !editor.selectedId || editor.selectedId === editor.rootId;
  refreshOutline(focusOutline, true); invalidate();
}
function reveal() {
  const node = editor.layout.nodesById[editor.selectedId]; if (!node) return;
  const point = worldToViewport({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, view);
  if (point.x < 24 || point.x > size.width - 24 || point.y < 24 || point.y > size.height - 24) view = pan(view, size.width / 2 - point.x, size.height / 2 - point.y);
  invalidate();
}
function finishEdit() { $('editor').hidden = true; $('edit-error').textContent = ''; $('label-input').removeAttribute('aria-invalid'); canvas.focus({ preventScroll: true }); update(); }
function cancelEdit() { editor.cancelEdit(); finishEdit(); }
function beginEdit() {
  if (editor.editing) return;
  const edit = editor.beginEdit(); if (!edit) return;
  $('editor').hidden = false; $('label-input').value = edit.label; positionEditor(); invalidate();
  $('label-input').focus(); $('label-input').select();
}
function action(method) {
  if (editor.editing) { announce('Save or cancel the current label edit first.'); return; }
  const result = diag.time(`edit ${method}`, () => editor[method]());
  if (!result.ok) announce(result.error.message);
  else { announce(`${method === 'deleteSelected' ? 'Branch deleted' : method === 'addChild' ? 'Child added' : method === 'undo' ? 'Undone' : 'Redone'}. Autosaved in this browser.`); markChanged(); update(); reveal(); }
  return result;
}
$('editor').onsubmit = (event) => {
  event.preventDefault(); const result = diag.time('edit commit', () => editor.commitEdit($('label-input').value));
  if (!result.ok) { $('edit-error').textContent = result.error.message; $('label-input').setAttribute('aria-invalid', 'true'); $('label-input').focus(); return; }
  finishEdit(); reveal(); markChanged(); announce('Label updated. Autosaved in this browser.');
};
$('cancel').onclick = cancelEdit;
$('label-input').onkeydown = (event) => {
  if (event.key === 'Escape') { event.preventDefault(); cancelEdit(); }
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('editor').requestSubmit(); }
};
$('add').onclick = () => { if (action('addChild')?.ok) beginEdit(); };
$('edit').onclick = beginEdit;
function deleteBranch() {
  if (editor.editing || !editor.selectedId || editor.selectedId === editor.rootId) return;
  if (window.confirm('Delete this topic and all its children? You can undo this change.')) action('deleteSelected');
}
$('delete').onclick = deleteBranch;
$('undo').onclick = () => action('undo'); $('redo').onclick = () => action('redo');
$('layout').onchange = () => { diag.time('layout switch', () => editor.setLayout($('layout').value)); view = fitView(editor.layout.bounds, size.width, size.height); update(); announce('Layout changed.'); };
$('fit').onclick = () => { view = fitView(editor.layout.bounds, size.width, size.height); invalidate(); };
$('reset').onclick = () => { view = resetView(size.width, size.height); invalidate(); };
for (const [id, factor] of [['zoom-in', 1.25], ['zoom-out', .8]]) $(id).onclick = () => { view = zoomAt(view, { x: size.width / 2, y: size.height / 2 }, factor); invalidate(); };
$('previous').onclick = () => { page -= 1; refreshOutline(); };
$('next').onclick = () => { page += 1; refreshOutline(); };
$('app').addEventListener('keydown', (event) => {
  if (event.target.closest('textarea, input, select') || editor.editing) return;
  if ((event.ctrlKey || event.metaKey) && !event.altKey && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault(); action(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo'); return;
  }
  if (!(event.target === canvas || event.target.closest('#outline'))) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) {
    event.preventDefault(); editor.navigate(event.key); update(); reveal();
    if (event.target !== canvas) refreshOutline(true);
  } else if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); beginEdit(); }
  else if (event.key === 'Insert') { event.preventDefault(); if (action('addChild')?.ok) beginEdit(); }
  else if (event.key === 'Delete') { event.preventDefault(); deleteBranch(); }
});
const pointers = new Map(); let gesture = null;
function local(event) { return screenToViewport({ x: event.clientX, y: event.clientY }, canvas.getBoundingClientRect()); }
function pair() { const points = Array.from(pointers.values()); return { center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) }; }
canvas.onpointerdown = (event) => {
  if (editor.editing || (event.pointerType === 'mouse' && event.button !== 0)) return;
  canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, local(event));
  if (pointers.size === 1) gesture = { start: local(event), base: { ...view }, moved: false, pinch: false };
  if (pointers.size === 2) { const info = pair(); gesture = { ...gesture, pinch: true, base: { ...view }, ...info }; }
};
canvas.onpointermove = (event) => {
  if (!pointers.has(event.pointerId) || !gesture) return;
  const point = local(event); pointers.set(event.pointerId, point);
  if (pointers.size === 2) {
    const info = pair(); view = pan(zoomAt(gesture.base, gesture.center, info.distance / Math.max(1, gesture.distance)), info.center.x - gesture.center.x, info.center.y - gesture.center.y); invalidate();
  } else if (!gesture.pinch) {
    const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
    if (Math.hypot(dx, dy) > 8) gesture.moved = true;
    if (gesture.moved) { view = pan(gesture.base, dx, dy); invalidate(); }
  }
};
function release(event, cancel = false) {
  if (!pointers.has(event.pointerId)) return;
  if (!cancel && pointers.size === 1 && gesture && !gesture.pinch && !gesture.moved) {
    editor.select(hitTest(editor.layout, local(event), view)); update();
    const selected = editor.document.document.nodes.find((n) => n.id === editor.selectedId);
    announce(selected ? `Selected ${selected.label}` : 'Selection cleared.');
  }
  pointers.delete(event.pointerId); if (!pointers.size) gesture = null;
}
canvas.onpointerup = (event) => release(event);
canvas.onpointercancel = (event) => release(event, true);
canvas.onlostpointercapture = (event) => release(event, true);
canvas.ondblclick = (event) => { if (editor.editing) return; editor.select(hitTest(editor.layout, local(event), view)); update(); beginEdit(); };
canvas.addEventListener('wheel', (event) => { event.preventDefault(); if (editor.editing) return; view = zoomAt(view, local(event), Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * .005)); invalidate(); }, { passive: false });
function resize() {
  const rect = stage.getBoundingClientRect(); const next = canvasSize(rect.width, rect.height, window.devicePixelRatio);
  if (size && next.pixelWidth === size.pixelWidth && next.pixelHeight === size.pixelHeight && next.dpr === size.dpr && next.width === size.width && next.height === size.height) return;
  const old = size; size = next; canvas.width = size.pixelWidth; canvas.height = size.pixelHeight;
  view = old ? pan(view, (size.width - old.width) / 2, (size.height - old.height) / 2) : fitView(editor.layout.bounds, size.width, size.height);
  invalidate();
}
new ResizeObserver(resize).observe(stage); window.addEventListener('resize', resize);
function watchDpr() { const media = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`); media.addEventListener('change', () => { resize(); watchDpr(); }, { once: true }); }
watchDpr(); resize(); update();
