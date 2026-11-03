export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;
export function worldToViewport(point, view) {
  return { x: point.x * view.scale + view.x, y: point.y * view.scale + view.y };
}
export function viewportToWorld(point, view) {
  return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
}
export function screenToViewport(point, rect) {
  return { x: point.x - rect.left, y: point.y - rect.top };
}
export function pan(view, dx, dy) { return { ...view, x: view.x + dx, y: view.y + dy }; }
export function zoomAt(view, point, factor) {
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.scale * factor));
  const world = viewportToWorld(point, view);
  return { scale, x: point.x - world.x * scale, y: point.y - world.y * scale };
}
export function resetView(width, height) { return { scale: 1, x: width / 2, y: height / 2 }; }
export function fitView(bounds, width, height) {
  const scale = Math.max(MIN_ZOOM, Math.min(1.5, (width - 32) / bounds.width, (height - 32) / bounds.height));
  return { scale, x: width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: height / 2 - (bounds.y + bounds.height / 2) * scale };
}
export function canvasSize(width, height, dpr = 1) {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return { width: Math.max(1, width), height: Math.max(1, height), dpr: ratio,
    pixelWidth: Math.max(1, Math.round(width * ratio)), pixelHeight: Math.max(1, Math.round(height * ratio)) };
}
export function hitTest(layout, point, view) {
  const world = viewportToWorld(point, view);
  const nodes = Object.values(layout.nodesById);
  // Last drawn rectangle wins, including shared boundaries.
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (world.x >= node.x && world.x <= node.x + node.width && world.y >= node.y && world.y <= node.y + node.height) return node.id;
  }
  return null;
}
