import { createDocument } from './model/create.js';
import { createEditor, hierarchy, outlinePage } from './browser/controller.js';
import { FONT } from './browser/measurement.js';
import { renderMap } from './browser/renderer.js';
import { worldToViewport, screenToViewport, zoomAt, pan, fitView, resetView, canvasSize, hitTest } from './browser/viewport.js';

const $ = (id) => document.getElementById(id);
const canvas = $('map'), stage = $('stage'), context = canvas.getContext('2d');
if (!context) throw new Error('Canvas 2D is required.');
const measureContext = document.createElement('canvas').getContext('2d');
measureContext.font = FONT;
const initial = createDocument({ id: 'session-map', rootId: 'root', rootLabel: 'My mind map' });
let sequence = 0;
const editor = createEditor(initial, (label) => measureContext.measureText(label).width, () => `node-${++sequence}`);
let view = resetView(1, 1), size, frame = null, page = 0;
const pageSize = 80;
function announce(message) { $('app-status').textContent = message; }
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
  frame = null; renderMap(context, editor, view, size); positionEditor();
  $('zoom-label').textContent = `${Math.round(view.scale * 100)}%`;
}
function invalidate() { if (frame === null) frame = requestAnimationFrame(draw); }
function refreshOutline(focusSelected = false, followSelection = false) {
  const ordered = hierarchy(editor.document);
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
  $('delete').disabled = !editor.selectedId || editor.selectedId === editor.document.document.rootId;
  refreshOutline(focusOutline, true); invalidate();
}
function reveal() {
  const node = editor.layout.nodesById[editor.selectedId]; if (!node) return;
  const point = worldToViewport({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, view);
  if (point.x < 24 || point.x > size.width - 24 || point.y < 24 || point.y > size.height - 24) view = pan(view, size.width / 2 - point.x, size.height / 2 - point.y);
  invalidate();
}
function finishEdit() { $('editor').hidden = true; $('edit-error').textContent = ''; $('label-input').removeAttribute('aria-invalid'); canvas.focus(); update(); }
function cancelEdit() { editor.cancelEdit(); finishEdit(); }
function beginEdit() {
  if (editor.editing) return;
  const edit = editor.beginEdit(); if (!edit) return;
  $('editor').hidden = false; $('label-input').value = edit.label; positionEditor(); invalidate();
  $('label-input').focus(); $('label-input').select();
}
function action(method) {
  if (editor.editing) { announce('Save or cancel the current label edit first.'); return; }
  const result = editor[method]();
  if (!result.ok) announce(result.error.message);
  else { announce(`${method === 'deleteSelected' ? 'Branch deleted' : method === 'addChild' ? 'Child added' : method === 'undo' ? 'Undone' : 'Redone'}. Changes are only in this session.`); update(); reveal(); }
  return result;
}
$('editor').onsubmit = (event) => {
  event.preventDefault(); const result = editor.commitEdit($('label-input').value);
  if (!result.ok) { $('edit-error').textContent = result.error.message; $('label-input').setAttribute('aria-invalid', 'true'); $('label-input').focus(); return; }
  finishEdit(); reveal(); announce('Label updated. Changes are only in this session.');
};
$('cancel').onclick = cancelEdit;
$('label-input').onkeydown = (event) => {
  if (event.key === 'Escape') { event.preventDefault(); cancelEdit(); }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $('editor').requestSubmit(); }
};
$('add').onclick = () => { if (action('addChild')?.ok) beginEdit(); };
$('edit').onclick = beginEdit;
function deleteBranch() {
  if (editor.editing || !editor.selectedId || editor.selectedId === editor.document.document.rootId) return;
  if (window.confirm('Delete this topic and all its children? You can undo this change.')) action('deleteSelected');
}
$('delete').onclick = deleteBranch;
$('undo').onclick = () => action('undo'); $('redo').onclick = () => action('redo');
$('layout').onchange = () => { editor.setLayout($('layout').value); view = fitView(editor.layout.bounds, size.width, size.height); update(); announce('Layout changed.'); };
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
  canvas.focus(); canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, local(event));
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
