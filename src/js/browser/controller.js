import { createCommandHistory } from '../commands/history.js';
import { layoutDocument } from '../layout/layout.js';
import { measureLabel } from './measurement.js';
export function hierarchy(document) {
  const children = new Map(document.document.nodes.map((node) => [node.id, []]));
  for (const node of document.document.nodes) if (node.parentId !== null) children.get(node.parentId).push(node);
  for (const list of children.values()) list.sort((a, b) => a.order - b.order);
  const result = [], stack = [{ node: document.document.nodes.find((n) => n.id === document.document.rootId), depth: 0 }];
  while (stack.length) {
    const item = stack.pop(); result.push(item);
    const list = children.get(item.node.id);
    for (let i = list.length - 1; i >= 0; i -= 1) stack.push({ node: list[i], depth: item.depth + 1 });
  }
  return result;
}
// Explicit paging stays possible; application selection updates reveal the selected item.
export function outlinePage(ordered, selectedId, page, pageSize, followSelection = false) {
  const index = ordered.findIndex(({ node }) => node.id === selectedId);
  const requested = followSelection && index >= 0 ? Math.floor(index / pageSize) : page;
  return Math.max(0, Math.min(requested, Math.ceil(ordered.length / pageSize) - 1));
}
export function createEditor(document, measure, idFactory) {
  const history = createCommandHistory(document, { idFactory });
  let current = history.getDocument(), selectedId = current.document.rootId, editing = null, mode = 'left-to-right';
  let layout, generation = 0;
  const measurements = new Map();
  function relayout() {
    const dimensions = Object.create(null), ids = new Set();
    for (const node of current.document.nodes) {
      ids.add(node.id);
      if (measurements.get(node.id)?.label !== node.label) measurements.set(node.id, { label: node.label, ...measureLabel(node.label, measure) });
      const size = measurements.get(node.id); dimensions[node.id] = { width: size.width, height: size.height };
    }
    for (const id of measurements.keys()) if (!ids.has(id)) measurements.delete(id);
    const result = layoutDocument(current, mode === 'radial' ? { type: 'radial', dimensions }
      : { type: 'tree', direction: mode, dimensions });
    if (!result.ok) throw new Error(result.errors.map((e) => e.message).join(' '));
    layout = result.layout; generation += 1;
  }
  function accept(result) {
    if (result.ok && result.changed) {
      current = result.document;
      if (!current.document.nodes.some((n) => n.id === selectedId)) selectedId = current.document.rootId;
      relayout();
    }
    return result;
  }
  relayout();
  return {
    get document() { return history.getDocument(); }, get layout() { return layout; },
    get selectedId() { return selectedId; }, get editing() { return editing && { ...editing }; },
    get mode() { return mode; }, get generation() { return generation; },
    get canUndo() { return history.canUndo; }, get canRedo() { return history.canRedo; },
    measurement(id) { return measurements.get(id); },
    select(id) { selectedId = current.document.nodes.some((n) => n.id === id) ? id : null; },
    setLayout(value) {
      if (!['left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top', 'radial'].includes(value)) return false;
      mode = value; relayout(); return true;
    },
    beginEdit() {
      const node = current.document.nodes.find((n) => n.id === selectedId);
      if (!node) return null;
      editing = { id: node.id, label: node.label }; return { ...editing };
    },
    commitEdit(label) {
      if (!editing) return { ok: false, error: { message: 'No label is being edited.' } };
      const result = accept(history.execute({ type: 'node.rename', nodeId: editing.id, label }));
      if (result.ok) editing = null;
      return result;
    },
    cancelEdit() { editing = null; },
    addChild() {
      if (!selectedId) return { ok: false, error: { message: 'Select a parent node first.' } };
      const result = accept(history.execute({ type: 'node.addChild', parentId: selectedId, label: 'New idea' }));
      if (result.ok) selectedId = result.document.document.nodes.at(-1).id;
      return result;
    },
    deleteSelected() {
      const node = current.document.nodes.find((n) => n.id === selectedId);
      const result = accept(history.execute({ type: 'node.deleteSubtree', nodeId: selectedId }));
      if (result.ok) selectedId = node.parentId;
      return result;
    },
    undo() { return accept(history.undo()); }, redo() { return accept(history.redo()); },
    navigate(key) {
      const ordered = hierarchy(current), index = ordered.findIndex(({ node }) => node.id === selectedId);
      const item = ordered[index];
      if (key === 'Home' || !item) selectedId = current.document.rootId;
      else if (key === 'ArrowUp') selectedId = ordered[Math.max(0, index - 1)].node.id;
      else if (key === 'ArrowDown') selectedId = ordered[Math.min(ordered.length - 1, index + 1)].node.id;
      else if (key === 'ArrowLeft') selectedId = item.node.parentId ?? item.node.id;
      else if (key === 'ArrowRight') selectedId = ordered[index + 1]?.depth > item.depth ? ordered[index + 1].node.id : item.node.id;
      return selectedId;
    },
  };
}
