import assert from "node:assert/strict";
import test from "node:test";
import { layoutDocument } from "../src/js/layout/index.js";
import { validateDocument } from "../src/js/model/index.js";

function generatedTree(size, shape = "mixed") {
  const nodes = [{ id: "root", parentId: null, order: 0, label: "Root" }];
  const childCount = new Map([["root", 0]]);
  for (let index = 1; index < size; index += 1) {
    const id = `n${String(index).padStart(5, "0")}`;
    let parentId;
    if (shape === "wide") parentId = "root";
    else if (shape === "deep") parentId = index === 1 ? "root" : nodes[index - 1].id;
    else if (shape === "unbalanced") parentId = index < 4 ? "root" : `n${String(index - 3).padStart(5, "0")}`;
    else parentId = index < 10 ? "root" : nodes[Math.floor((index - 1) / 3)].id;
    const order = childCount.get(parentId) ?? 0;
    childCount.set(parentId, order + 1);
    childCount.set(id, 0);
    nodes.push({ id, parentId, order, label: id });
  }
  return {
    format: "lfcfoundry.mindmap",
    schemaVersion: 1,
    document: { id: "layout-doc", title: "Layout", rootId: "root", nodes, relationships: [] },
  };
}

function dimensionsFor(document, override = {}) {
  const dimensions = {};
  document.document.nodes.forEach((node, index) => {
    dimensions[node.id] = override[node.id] ?? {
      width: 24 + (index * 13 % 61),
      height: 18 + (index * 17 % 43),
    };
  });
  return dimensions;
}

function run(document, type, direction, options) {
  const config = { type, dimensions: dimensionsFor(document) };
  if (direction !== undefined) config.direction = direction;
  if (options !== undefined) config.options = options;
  const result = layoutDocument(document, config);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.layout;
}

function overlaps(left, right, epsilon = 1e-8) {
  return left.x < right.x + right.width - epsilon
    && left.x + left.width > right.x + epsilon
    && left.y < right.y + right.height - epsilon
    && left.y + left.height > right.y + epsilon;
}

function assertNoNodeOverlaps(layout) {
  const nodes = Object.values(layout.nodesById);
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      assert.equal(overlaps(nodes[left], nodes[right]), false, `${nodes[left].id} overlaps ${nodes[right].id}`);
    }
  }
}

function assertFiniteLayout(layout) {
  assert.ok(Number.isFinite(layout.bounds.x));
  assert.ok(Number.isFinite(layout.bounds.y));
  assert.ok(Number.isFinite(layout.bounds.width) && layout.bounds.width > 0);
  assert.ok(Number.isFinite(layout.bounds.height) && layout.bounds.height > 0);
  for (const node of Object.values(layout.nodesById)) {
    assert.ok([node.x, node.y, node.width, node.height, node.depth].every(Number.isFinite));
    assert.ok(node.width > 0 && node.height > 0);
    assert.ok(node.x >= layout.bounds.x);
    assert.ok(node.y >= layout.bounds.y);
    assert.ok(node.x + node.width <= layout.bounds.x + layout.bounds.width);
    assert.ok(node.y + node.height <= layout.bounds.y + layout.bounds.height);
  }
  for (const edge of layout.structuralEdges) {
    assert.ok([edge.from.x, edge.from.y, edge.to.x, edge.to.y].every(Number.isFinite));
  }
}

test("supports all four deterministic directional orientations", () => {
  const document = generatedTree(24, "mixed");
  const left = run(document, "tree", "left-to-right");
  const right = run(document, "tree", "right-to-left");
  const down = run(document, "tree", "top-to-bottom");
  const up = run(document, "tree", "bottom-to-top");
  for (const layout of [left, right, down, up]) {
    assertFiniteLayout(layout);
    assert.equal(layout.structuralEdges.length, document.document.nodes.length - 1);
    assertNoNodeOverlaps(layout);
  }
  assert.ok(left.nodesById.n00001.x > left.nodesById.root.x);
  assert.ok(right.nodesById.n00001.x < right.nodesById.root.x);
  assert.ok(down.nodesById.n00001.y > down.nodesById.root.y);
  assert.ok(up.nodesById.n00001.y < up.nodesById.root.y);
  assert.deepEqual(left, run(document, "tree", "left-to-right"));
});

test("handles a root with no children and a root with one child", () => {
  const empty = generatedTree(1);
  const rootOnly = run(empty, "tree", "left-to-right");
  assert.equal(Object.keys(rootOnly.nodesById).length, 1);
  assert.equal(rootOnly.structuralEdges.length, 0);
  assert.equal(rootOnly.nodesById.root.x + rootOnly.nodesById.root.width / 2, 0);

  const singleChild = generatedTree(2, "wide");
  const treeLayout = run(singleChild, "tree", "left-to-right");
  const radialLayout = run(singleChild, "radial");
  assert.equal(treeLayout.structuralEdges.length, 1);
  assert.equal(radialLayout.structuralEdges.length, 1);
  assertFiniteLayout(treeLayout);
  assertFiniteLayout(radialLayout);
  assertNoNodeOverlaps(treeLayout);
  assertNoNodeOverlaps(radialLayout);
});

test("directional layout handles variable sizes, an unbalanced tree, and preserves sibling order", () => {
  const document = generatedTree(57, "unbalanced");
  const dimensions = dimensionsFor(document);
  dimensions.root = { width: 130, height: 91 };
  dimensions.n00001 = { width: 37, height: 85 };
  const layout = layoutDocument(document, { type: "tree", direction: "top-to-bottom", dimensions });
  assert.equal(layout.ok, true, JSON.stringify(layout.errors));
  assertFiniteLayout(layout.layout);
  assertNoNodeOverlaps(layout.layout);
  const rootChildren = document.document.nodes.filter((node) => node.parentId === "root")
    .sort((left, right) => left.order - right.order);
  assert.deepEqual(rootChildren.map((node) => node.id), ["n00001", "n00002", "n00003"]);
  assert.ok(layout.layout.nodesById.n00001.x < layout.layout.nodesById.n00002.x);
});

test("radial layout spaces unequal branches according to subtree size and keeps sibling order", () => {
  const document = generatedTree(9, "unbalanced");
  const layout = run(document, "radial");
  assertFiniteLayout(layout);
  assertNoNodeOverlaps(layout);
  assert.equal(layout.nodesById.root.x + layout.nodesById.root.width / 2, 0);
  assert.equal(layout.nodesById.root.y + layout.nodesById.root.height / 2, 0);
  const angle = (node) => Math.atan2(
    node.y + node.height / 2,
    node.x + node.width / 2,
  );
  const a = angle(layout.nodesById.n00001);
  const b = angle(layout.nodesById.n00002);
  const c = angle(layout.nodesById.n00003);
  const gapAB = (b - a + Math.PI * 2) % (Math.PI * 2);
  const gapBC = (c - b + Math.PI * 2) % (Math.PI * 2);
  assert.ok(gapAB > gapBC, "larger first branch receives more angular space");
});

test("radial geometry has deterministic finite connectors and no rectangle overlaps", () => {
  const document = generatedTree(40, "mixed");
  const layout = run(document, "radial");
  assertFiniteLayout(layout);
  assertNoNodeOverlaps(layout);
  assert.deepEqual(layout, run(document, "radial"));
  assert.equal(layout.structuralEdges.length, document.document.nodes.length - 1);
  assert.equal(layout.direction, null);
});

test("layout ignores document array order and dimensions object property order", () => {
  const document = generatedTree(18, "mixed");
  const dimensions = dimensionsFor(document);
  const reversedDimensions = Object.fromEntries(Object.entries(dimensions).reverse());
  const reversedDocument = structuredClone(document);
  reversedDocument.document.nodes.reverse();
  const original = layoutDocument(document, { type: "tree", direction: "right-to-left", dimensions });
  const reordered = layoutDocument(reversedDocument, {
    type: "tree",
    direction: "right-to-left",
    dimensions: reversedDimensions,
  });
  assert.deepEqual(reordered, original);
});

test("cross-links do not affect hierarchy geometry and input document is immutable", () => {
  const document = generatedTree(12, "mixed");
  const before = structuredClone(document);
  const dimensions = dimensionsFor(document);
  const withoutLinks = layoutDocument(document, { type: "radial", dimensions });
  document.document.relationships.push({
    id: "cross-link",
    sourceId: "n00001",
    targetId: "n00004",
    direction: "undirected",
    label: "related",
  });
  assert.equal(validateDocument(document).valid, true);
  const withLinks = layoutDocument(document, { type: "radial", dimensions });
  assert.deepEqual(withLinks, withoutLinks);
  document.document.relationships.pop();
  assert.deepEqual(document, before);
});

test("rejects missing, malformed, unknown, and non-positive dimensions", () => {
  const document = generatedTree(3);
  const validDimensions = dimensionsFor(document);
  const missing = { ...validDimensions };
  delete missing.n00001;
  assert.equal(layoutDocument(document, { type: "tree", dimensions: missing }).errors[0].code, "DIMENSION_MISSING");

  for (const value of [null, {}, { width: 0, height: 10 }, { width: -1, height: 10 },
    { width: Number.NaN, height: 10 }, { width: 10, height: Number.POSITIVE_INFINITY }]) {
    const dimensions = { ...validDimensions, n00001: value };
    const result = layoutDocument(document, { type: "tree", dimensions });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "DIMENSION_INVALID");
    assert.equal(result.errors[0].nodeId, "n00001");
  }

  const unknown = { ...validDimensions, absent: { width: 10, height: 10 } };
  assert.equal(layoutDocument(document, { type: "tree", dimensions: unknown }).errors[0].code, "DIMENSION_NODE_NOT_FOUND");
});

test("rejects invalid documents, layouts, directions, options, and configurations", () => {
  const document = generatedTree(2);
  const dimensions = dimensionsFor(document);
  const invalidDocument = structuredClone(document);
  invalidDocument.document.nodes[1].parentId = "missing";
  assert.equal(layoutDocument(invalidDocument, { type: "tree", dimensions }).errors[0].code, "INVALID_DOCUMENT");
  assert.equal(layoutDocument(document, { type: "force", dimensions }).errors[0].code, "LAYOUT_TYPE_INVALID");
  assert.equal(layoutDocument(document, { type: "tree", direction: "diagonal", dimensions }).errors[0].code,
    "LAYOUT_DIRECTION_INVALID");
  assert.equal(layoutDocument(document, { type: "radial", direction: "left-to-right", dimensions }).errors[0].code,
    "LAYOUT_DIRECTION_NOT_APPLICABLE");
  assert.equal(layoutDocument(document, { type: "tree", dimensions, options: { parentGap: -1 } }).errors[0].code,
    "LAYOUT_OPTION_INVALID");
  assert.equal(layoutDocument(document, { type: "tree", dimensions, options: { radialGap: 10 } }).errors[0].code,
    "LAYOUT_OPTION_UNKNOWN");
});

test("supports deep and wide generated trees without recursive traversal", () => {
  const deep = generatedTree(3_000, "deep");
  const deepLayout = layoutDocument(deep, { type: "tree", dimensions: dimensionsFor(deep) });
  assert.equal(deepLayout.ok, true, JSON.stringify(deepLayout.errors));
  assert.equal(Object.keys(deepLayout.layout.nodesById).length, 3_000);
  assertFiniteLayout(deepLayout.layout);

  const wide = generatedTree(1_200, "wide");
  const wideLayout = layoutDocument(wide, { type: "tree", direction: "bottom-to-top", dimensions: dimensionsFor(wide) });
  assert.equal(wideLayout.ok, true, JSON.stringify(wideLayout.errors));
  assert.deepEqual(
    [wideLayout.layout.nodesById.n00001.depth, wideLayout.layout.nodesById.n01199.depth],
    [1, 1],
  );
  assertFiniteLayout(wideLayout.layout);
});

test("lays out a deterministic 5,000-node generated document", () => {
  const document = generatedTree(5_000, "mixed");
  const result = layoutDocument(document, { type: "tree", dimensions: dimensionsFor(document) });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(Object.keys(result.layout.nodesById).length, 5_000);
  assert.equal(result.layout.structuralEdges.length, 4_999);
  assertFiniteLayout(result.layout);
});

test('trusted sizes give exactly the same layout as validated dimensions, in every mode', async () => {
  const { layoutDocument, layoutValidatedDocument, prepareLayoutTree } = await import('../src/js/layout/layout.js');
  const nodes = [{ id: 'r', parentId: null, order: 0, label: 'Root' }]; const kids = {};
  for (let i = 1; i < 300; i++) { const p = nodes[(i * 7919) % nodes.length]; const o = (kids[p.id] = kids[p.id] ?? 0); kids[p.id] += 1; nodes.push({ id: 'n' + i, parentId: p.id, order: o, label: 'T' + i }); }
  const doc = { format: 'lfcfoundry.mindmap', schemaVersion: 1, document: { id: 'd', title: 'D', rootId: 'r', nodes, relationships: [] } };
  const dimensions = Object.create(null), sizes = new Map();
  for (const n of nodes) { const size = { width: 100 + (n.id.length * 13) % 70, height: 50 + (n.id.length * 7) % 30 }; dimensions[n.id] = size; sizes.set(n.id, { ...size, label: n.label, lines: [n.label] }); }
  const configs = [{ type: 'radial' }, ...['left-to-right', 'right-to-left', 'top-to-bottom', 'bottom-to-top'].map((direction) => ({ type: 'tree', direction }))];
  for (const config of configs) {
    const a = layoutDocument(doc, { ...config, dimensions }), b = layoutValidatedDocument(doc, { ...config, trustedSizes: sizes, preparedTree: prepareLayoutTree(doc) });
    assert.ok(a.ok && b.ok); assert.deepEqual(b.layout, a.layout);
  }
  assert.equal(layoutDocument(doc, { type: 'radial', trustedSizes: sizes }).ok, false);
  assert.equal(layoutDocument(doc, { type: 'radial', dimensions, preparedTree: prepareLayoutTree(doc) }).ok, false);
});

test('editor layouts after rename, add, undo and layout switches equal a fresh editor on the same map', async () => {
  const { createEditor } = await import('../src/js/browser/controller.js');
  const { createDocument } = await import('../src/js/model/create.js');
  const measure = (t) => t.length * 9; let n = 0;
  const e = createEditor(createDocument({ id: 'd', rootId: 'root', rootLabel: 'Root' }), measure, () => 'n' + (++n));
  const same = (label) => { const f = createEditor(e.document, measure, () => 'x'); f.setLayout(e.mode); assert.deepEqual(e.layout.nodesById, f.layout.nodesById, label); };
  for (let i = 0; i < 6; i++) { e.addChild(); e.beginEdit(); e.commitEdit('Topic number ' + i + ' with words'); same('rename ' + i); }
  e.undo(); same('undo'); e.redo(); same('redo');
  for (const m of ['radial', 'top-to-bottom', 'right-to-left', 'bottom-to-top', 'left-to-right']) { e.setLayout(m); same(m); }
  e.select(e.document.document.nodes[1].id); e.beginEdit(); e.commitEdit('x'); same('rename after switch');
});
