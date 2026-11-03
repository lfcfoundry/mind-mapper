import { FONT, LINE_HEIGHT } from './measurement.js';
import { VISUAL_TOKENS } from './visual-tokens.js';
import { viewportToWorld } from './viewport.js';
export function renderMap(context, editor, view, size) {
  context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  context.fillStyle = VISUAL_TOKENS.canvas;
  context.fillRect(0, 0, size.width, size.height);
  context.translate(view.x, view.y); context.scale(view.scale, view.scale);
  context.lineWidth = 1.5 / view.scale; context.strokeStyle = VISUAL_TOKENS.connector;
  context.beginPath();
  for (const edge of editor.layout.structuralEdges) { context.moveTo(edge.from.x, edge.from.y); context.lineTo(edge.to.x, edge.to.y); }
  context.stroke();
  const top = viewportToWorld({ x: 0, y: 0 }, view), bottom = viewportToWorld({ x: size.width, y: size.height }, view);
  context.font = FONT; context.textBaseline = 'top';
  for (const node of Object.values(editor.layout.nodesById)) {
    if (node.x + node.width < top.x || node.y + node.height < top.y || node.x > bottom.x || node.y > bottom.y) continue;
    const selected = node.id === editor.selectedId, editing = node.id === editor.editing?.id;
    context.fillStyle = node.depth === 0 ? VISUAL_TOKENS.rootSurface : VISUAL_TOKENS.surface;
    context.fillRect(node.x, node.y, node.width, node.height);
    context.setLineDash([]);
    context.strokeStyle = VISUAL_TOKENS.border;
    context.lineWidth = (node.depth === 0 ? 2 : 1) / view.scale;
    context.strokeRect(node.x, node.y, node.width, node.height);
    if (selected || editing) {
      const inset = Math.min(4 / view.scale, node.width / 4, node.height / 4);
      context.strokeStyle = VISUAL_TOKENS.accent;
      context.lineWidth = 2 / view.scale;
      context.setLineDash(editing ? [5 / view.scale, 3 / view.scale] : []);
      context.strokeRect(node.x + inset, node.y + inset, node.width - inset * 2, node.height - inset * 2);
      context.setLineDash([]);
    }
    context.fillStyle = VISUAL_TOKENS.ink;
    editor.measurement(node.id).lines.forEach((line, index) => context.fillText(line, node.x + 16, node.y + 14 + index * LINE_HEIGHT));
  }
}
