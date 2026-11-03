import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocument } from '../src/js/model/create.js';
import { createEditor } from '../src/js/browser/controller.js';
import { measureLabel } from '../src/js/browser/measurement.js';
import { worldToViewport, viewportToWorld, screenToViewport, pan, zoomAt, fitView, resetView, canvasSize, hitTest, MIN_ZOOM, MAX_ZOOM } from '../src/js/browser/viewport.js';
const initial = () => createDocument({ id: 'doc', rootId: 'root', rootLabel: 'Root' });
function editor() { let id = 0; return createEditor(initial(), (s) => Array.from(s).length * 8, () => `child-${++id}`); }
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`); }

test('world, viewport and screen coordinates convert independently of DPR', () => {
  const view = { x: 120, y: -35, scale: 1.7 }, point = { x: -12, y: 45 };
  const screen = worldToViewport(point, view), world = viewportToWorld(screen, view);
  close(world.x, point.x); close(world.y, point.y);
  assert.deepEqual(screenToViewport({ x: 150, y: 210 }, { left: 30, top: 80 }), { x: 120, y: 130 });
});
test('pan is immutable and pointer zoom preserves its world anchor with limits', () => {
  const view = { x: 10, y: 20, scale: 1 }, anchor = { x: 75, y: 66 };
  assert.deepEqual(pan(view, 5, -2), { x: 15, y: 18, scale: 1 });
  assert.deepEqual(view, { x: 10, y: 20, scale: 1 });
  const before = viewportToWorld(anchor, view), after = viewportToWorld(anchor, zoomAt(view, anchor, 2));
  close(before.x, after.x); close(before.y, after.y);
  assert.equal(zoomAt(view, anchor, 1e8).scale, MAX_ZOOM);
  assert.equal(zoomAt(view, anchor, 1e-8).scale, MIN_ZOOM);
});
test('fit and responsive backing sizes handle narrow, wide and high DPR viewports', () => {
  for (const [w, h, dpr] of [[320, 420, 3], [1600, 900, 1], [700, 550, 1.5]]) {
    const size = canvasSize(w, h, dpr);
    assert.equal(size.pixelWidth, Math.round(w * dpr));
    assert.equal(size.pixelHeight, Math.round(h * dpr));
    const view = fitView({ x: -100, y: -50, width: 200, height: 100 }, w, h);
    const center = worldToViewport({ x: 0, y: 0 }, view);
    close(center.x, w / 2); close(center.y, h / 2);
    assert.deepEqual(resetView(w, h), { scale: 1, x: w / 2, y: h / 2 });
  }
});
test('hit testing follows transformed rectangles and last drawn overlap wins', () => {
  const layout = { nodesById: { a: { id: 'a', x: 0, y: 0, width: 50, height: 30 }, b: { id: 'b', x: 10, y: 10, width: 50, height: 30 } } };
  const snapshot = structuredClone(layout), view = { x: 100, y: 200, scale: 2 };
  assert.equal(hitTest(layout, worldToViewport({ x: 20, y: 20 }, view), view), 'b');
  assert.equal(hitTest(layout, worldToViewport({ x: 2, y: 2 }, view), view), 'a');
  assert.equal(hitTest(layout, { x: 0, y: 0 }, view), null);
  assert.deepEqual(layout, snapshot);
});
test('selection and all layout switches preserve document and command history', () => {
  const model = editor(); model.addChild(); const snapshot = model.document;
  for (const mode of ['left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top', 'radial']) {
    assert.equal(model.setLayout(mode), true); assert.deepEqual(model.document, snapshot); assert.equal(model.canUndo, true);
  }
  model.select('absent'); assert.equal(model.selectedId, null);
  model.select('root'); assert.equal(model.selectedId, 'root');
  model.undo(); assert.equal(model.document.document.nodes.length, 1);
});
test('label edit commit uses commands, cancellation is inert, invalid edits stay open', () => {
  const model = editor(), snapshot = model.document;
  model.beginEdit(); model.cancelEdit(); assert.deepEqual(model.document, snapshot); assert.equal(model.canUndo, false);
  model.beginEdit(); assert.equal(model.commitEdit('  ').ok, false); assert.ok(model.editing); assert.deepEqual(model.document, snapshot);
  assert.equal(model.commitEdit('New root').ok, true); assert.equal(model.editing, null);
  assert.equal(model.document.document.nodes[0].label, 'New root');
  model.undo(); assert.deepEqual(model.document, snapshot);
  model.redo(); assert.equal(model.document.document.nodes[0].label, 'New root');
});
test('add/delete integrate history, protect root and preserve surviving selection', () => {
  const model = editor(); assert.equal(model.deleteSelected().ok, false);
  assert.equal(model.addChild().ok, true); assert.equal(model.selectedId, 'child-1');
  model.beginEdit(); model.commitEdit('Child');
  assert.equal(model.deleteSelected().ok, true); assert.equal(model.selectedId, 'root');
  model.undo(); assert.equal(model.document.document.nodes.length, 2);
  model.redo(); assert.equal(model.document.document.nodes.length, 1);
});
test('text changes recompute dimensions/layout while layout switches reuse cached measurements', () => {
  let calls = 0;
  const model = createEditor(initial(), (text) => { calls += 1; return text.length * 8; }, () => 'child');
  const measured = calls, generation = model.generation;
  model.setLayout('radial'); assert.equal(calls, measured);
  const oldHeight = model.layout.nodesById.root.height;
  model.beginEdit(); model.commitEdit('A long label that wraps into several lines '.repeat(5));
  assert.ok(calls > measured); assert.ok(model.generation > generation);
  assert.ok(model.layout.nodesById.root.height > oldHeight);
  assert.equal(model.selectedId, 'root');
});
test('multiline and long words are wrapped using the supplied measurement function', () => {
  const measured = measureLabel('First line\n' + 'x'.repeat(100), (s) => s.length * 8, 80);
  assert.ok(measured.lines.length > 3);
  assert.ok(measured.lines.every((s) => s.length * 8 <= 80));
});
test('keyboard hierarchy navigation follows explicit order and parent/child relationships', () => {
  const model = editor(); model.addChild(); model.select('root');
  assert.equal(model.navigate('ArrowRight'), 'child-1');
  assert.equal(model.navigate('ArrowLeft'), 'root');
  assert.equal(model.navigate('ArrowDown'), 'child-1');
  assert.equal(model.navigate('Home'), 'root');
});

test('Canvas renderer uses supplied geometry and DPR without changing layout or document', async () => {
  const { renderMap } = await import('../src/js/browser/renderer.js');
  const model = editor(), before = JSON.stringify(model.layout), prototype = Object.getPrototypeOf(model.layout.nodesById), document = model.document, calls = [];
  const context = Object.fromEntries(['setTransform','clearRect','translate','scale','beginPath','moveTo','lineTo','stroke','fillRect','strokeRect','fillText','setLineDash'].map(name => [name, (...args) => calls.push([name,...args])]));
  renderMap(context, model, { scale: 1, x: 150, y: 150 }, canvasSize(300, 300, 2));
  assert.deepEqual(calls[0], ['setTransform',2,0,0,2,0,0]);
  assert.ok(calls.some(([name]) => name === 'fillText'));
  assert.equal(JSON.stringify(model.layout), before); assert.equal(Object.getPrototypeOf(model.layout.nodesById), prototype); assert.deepEqual(model.document, document);
});

test('outline follows application selection across pages while explicit paging remains available', async () => {
  const { outlinePage } = await import('../src/js/browser/controller.js');
  const ordered = Array.from({ length: 161 }, (_, i) => ({ node: { id: String(i) } }));
  assert.equal(outlinePage(ordered, '160', 0, 80, true), 2);
  assert.equal(outlinePage(ordered, '160', 0, 80, false), 0);
  assert.equal(outlinePage(ordered, null, 99, 80, true), 2);
});

test('semantic palette meets text and meaningful-boundary contrast requirements', async () => {
  const { VISUAL_TOKENS: tokens } = await import('../src/js/browser/visual-tokens.js');
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((n) => parseInt(n, 16) / 255)
      .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => { const x = luminance(tokens[a]), y = luminance(tokens[b]); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for (const foreground of ['ink', 'muted', 'error']) for (const background of ['surface', 'canvas', 'rootSurface', 'accentSurface']) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground}/${background}`);
  }
  assert.ok(contrast('surface', 'accent') >= 4.5, 'primary action label');
  for (const foreground of ['border', 'connector', 'accent']) for (const background of ['surface', 'canvas', 'rootSurface', 'accentSurface']) {
    assert.ok(contrast(foreground, background) >= 3, `${foreground}/${background}`);
  }
});

test('all layout views distinguish root, selection and editing through geometry/pattern as well as color', async () => {
  const { renderMap } = await import('../src/js/browser/renderer.js');
  const model = editor(); model.addChild();
  const capture = () => {
    const strokes = [], context = { dash: [] };
    for (const method of ['setTransform','clearRect','translate','scale','beginPath','moveTo','lineTo','stroke','fillRect','fillText']) context[method] = () => {};
    context.setLineDash = (dash) => { context.dash = [...dash]; };
    context.strokeRect = (...rect) => strokes.push({ rect, width: context.lineWidth, dash: [...context.dash] });
    renderMap(context, model, { x: 500, y: 500, scale: 1 }, canvasSize(2000, 2000));
    return strokes;
  };
  for (const mode of ['left-to-right','right-to-left','top-to-bottom','bottom-to-top','radial']) {
    model.setLayout(mode); model.select(null);
    const normal = capture(); assert.equal(normal.length, 2);
    assert.equal(normal[0].width, 2); assert.equal(normal[1].width, 1);
    model.select('child-1'); const selected = capture();
    assert.equal(selected.length, 3); assert.deepEqual(selected.at(-1).dash, []);
    model.beginEdit(); const editing = capture();
    assert.ok(editing.some((stroke) => stroke.dash.length > 0), mode);
    model.cancelEdit();
  }
});
