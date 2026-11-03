export const FONT = '16px system-ui, sans-serif';
export const LINE_HEIGHT = 22;
export function measureLabel(label, measure, maxWidth = 220) {
  const lines = [];
  for (const paragraph of label.split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && measure(line + character) > maxWidth) {
        const split = line.lastIndexOf(' ');
        if (split > 0) {
          lines.push(line.slice(0, split));
          line = line.slice(split + 1) + character;
        } else { lines.push(line); line = character; }
      } else line += character;
    }
    lines.push(line);
  }
  return { lines, width: Math.max(100, ...lines.map((line) => measure(line))) + 32,
    height: Math.max(1, lines.length) * LINE_HEIGHT + 28 };
}
