import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand, createCommandHistory } from "../src/js/commands/index.js";
import { validateDocument } from "../src/js/model/index.js";

function fixture() {
  return {
    format: "lfcfoundry.mindmap",
    schemaVersion: 1,
    document: {
      id: "doc",
      title: "Command test",
      rootId: "root",
      nodes: [
        { id: "root", parentId: null, order: 0, label: "Root" },
        { id: "a", parentId: "root", order: 0, label: "A" },
        { id: "a1", parentId: "a", order: 0, label: "A1" },
        { id: "a2", parentId: "a1", order: 0, label: "A2" },
        { id: "b", parentId: "root", order: 1, label: "B" },
        { id: "b1", parentId: "b", order: 0, label: "B1" },
      ],
      relationships: [
        { id: "link-a1-b", sourceId: "a1", targetId: "b", direction: "directed", label: "supports" },
        { id: "link-a2-b1", sourceId: "a2", targetId: "b1", direction: "undirected", label: "related" },
        { id: "link-root-b", sourceId: "root", targetId: "b", direction: "directed", label: "mentions" },
      ],
    },
  };
}

function execute(document, command, options) {
  const result = applyCommand(document, command, options);
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.document;
}

function node(document, id) {
  return document.document.nodes.find((item) => item.id === id);
}

function sortedChildren(document, parentId) {
  return document.document.nodes
    .filter((item) => item.parentId === parentId)
    .sort((left, right) => left.order - right.order)
    .map((item) => item.id);
}

function commandResult(command, document = fixture(), options) {
  return applyCommand(document, command, options);
}

test("accepts the fixture under the unchanged v1 document validator", () => {
  assert.deepEqual(validateDocument(fixture()), { valid: true, errors: [] });
});

test("adds a child at an explicit sibling index and shifts later siblings", () => {
  const original = fixture();
  const before = structuredClone(original);
  const updated = execute(original, { type: "node.addChild", id: "c", parentId: "root", index: 1, label: "C" });
  assert.deepEqual(sortedChildren(updated, "root"), ["a", "c", "b"]);
  assert.deepEqual([node(updated, "a").order, node(updated, "c").order, node(updated, "b").order], [0, 1, 2]);
  assert.deepEqual(original, before);
  assert.notEqual(updated, original);
  assert.equal(validateDocument(updated).valid, true);
});

test("child insertion defaults to append and requires an explicit generator when ID is omitted", () => {
  const missingGenerator = commandResult({ type: "node.addChild", parentId: "root", label: "C" });
  assert.equal(missingGenerator.ok, false);
  assert.equal(missingGenerator.error.code, "ID_GENERATOR_REQUIRED");

  const generated = commandResult(
    { type: "node.addChild", parentId: "root", label: "C" },
    fixture(),
    { idFactory: (kind) => `${kind}-generated` },
  );
  assert.equal(generated.ok, true);
  assert.deepEqual(sortedChildren(generated.document, "root"), ["a", "b", "node-generated"]);
});

test("generated IDs are collision-checked and identical inputs with the same generator are deterministic", () => {
  const command = { type: "node.addChild", parentId: "root", label: "Generated" };
  const collision = commandResult(command, fixture(), { idFactory: () => "a" });
  assert.equal(collision.ok, false);
  assert.equal(collision.error.code, "DUPLICATE_ID");

  const idFactory = () => "generated";
  const first = commandResult(command, fixture(), { idFactory });
  const second = commandResult(command, fixture(), { idFactory });
  assert.deepEqual(first, second);
});

test("renames nodes while preserving the supplied label verbatim", () => {
  const updated = execute(fixture(), { type: "node.rename", nodeId: "a", label: "  New label  " });
  assert.equal(node(updated, "a").label, "  New label  ");
});

test("deletes a subtree, removes all incident relationships, and closes the sibling gap", () => {
  const original = fixture();
  const updated = execute(original, { type: "node.deleteSubtree", nodeId: "a" });
  assert.deepEqual(updated.document.nodes.map((item) => item.id), ["root", "b", "b1"]);
  assert.deepEqual(sortedChildren(updated, "root"), ["b"]);
  assert.deepEqual(updated.document.relationships.map((item) => item.id), ["link-root-b"]);
  assert.deepEqual(original.document.nodes.map((item) => item.id), ["root", "a", "a1", "a2", "b", "b1"]);
});

test("reparents a whole subtree and preserves internal links and node identity", () => {
  const updated = execute(fixture(), { type: "node.reparent", nodeId: "a1", parentId: "b", index: 0 });
  assert.deepEqual(sortedChildren(updated, "a"), []);
  assert.deepEqual(sortedChildren(updated, "b"), ["a1", "b1"]);
  assert.equal(node(updated, "a1").parentId, "b");
  assert.equal(node(updated, "a2").parentId, "a1");
  assert.equal(updated.document.relationships.length, 3);
  assert.equal(validateDocument(updated).valid, true);
});

test("same-parent reparenting moves to a final sibling index and omitted index appends", () => {
  const initial = fixture();
  const moved = execute(initial, { type: "node.reparent", nodeId: "a", parentId: "root" });
  assert.deepEqual(sortedChildren(moved, "root"), ["b", "a"]);
  const history = createCommandHistory(initial);
  history.execute({ type: "node.reparent", nodeId: "a", parentId: "root" });
  assert.deepEqual(history.undo().document, initial);
});

test("reordering siblings changes order values without changing identity or parentage", () => {
  const original = fixture();
  const updated = execute(original, { type: "node.reorderSibling", nodeId: "b", index: 0 });
  assert.deepEqual(sortedChildren(updated, "root"), ["b", "a"]);
  assert.equal(node(updated, "a").parentId, "root");
  assert.equal(node(updated, "b").parentId, "root");
  assert.equal(updated.document.nodes.length, original.document.nodes.length);
  assert.deepEqual(original.document.nodes.map((item) => item.order), [0, 0, 0, 0, 1, 0]);
});

test("relationship add, update, and remove leave hierarchy unchanged", () => {
  const original = fixture();
  const afterAdd = execute(original, {
    type: "relationship.add",
    id: "link-new",
    sourceId: "a",
    targetId: "b1",
    direction: "undirected",
    label: "connects",
  });
  assert.deepEqual(afterAdd.document.nodes, original.document.nodes);
  const afterDirection = execute(afterAdd, {
    type: "relationship.update",
    relationshipId: "link-new",
    direction: "directed",
  });
  assert.deepEqual(afterDirection.document.nodes, original.document.nodes);
  assert.equal(afterDirection.document.relationships.at(-1).label, "connects");
  const afterLabel = execute(afterDirection, {
    type: "relationship.update",
    relationshipId: "link-new",
    label: "  leads to  ",
  });
  assert.deepEqual(afterLabel.document.nodes, original.document.nodes);
  assert.deepEqual(afterLabel.document.relationships.at(-1), {
    id: "link-new", sourceId: "a", targetId: "b1", direction: "directed", label: "  leads to  ",
  });
  const afterRemove = execute(afterLabel, { type: "relationship.remove", relationshipId: "link-new" });
  assert.deepEqual(afterRemove.document.nodes, original.document.nodes);
  assert.equal(afterRemove.document.relationships.some((item) => item.id === "link-new"), false);
});

test("relationship duplicate rules are enforced by the unchanged v1 validator", () => {
  const result = commandResult({
    type: "relationship.add",
    id: "link-duplicate",
    sourceId: "a1",
    targetId: "b",
    direction: "directed",
    label: "  supports  ",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "DUPLICATE_RELATIONSHIP");
  assert.equal(result.error.entityId, "link-duplicate");
});

test("every operation can be undone and redone to its exact document state", async (t) => {
  const cases = [
    ["add child", { type: "node.addChild", id: "new-node", parentId: "root", index: 1, label: "New" }],
    ["rename", { type: "node.rename", nodeId: "a", label: "Renamed" }],
    ["delete subtree", { type: "node.deleteSubtree", nodeId: "a" }],
    ["reparent", { type: "node.reparent", nodeId: "a1", parentId: "b", index: 0 }],
    ["reorder siblings", { type: "node.reorderSibling", nodeId: "b", index: 0 }],
    ["add relationship", {
      type: "relationship.add", id: "new-link", sourceId: "a", targetId: "b1", direction: "directed", label: "points to",
    }],
    ["update relationship label", { type: "relationship.update", relationshipId: "link-root-b", label: "refers to" }],
    ["update relationship direction", { type: "relationship.update", relationshipId: "link-root-b", direction: "undirected" }],
    ["remove relationship", { type: "relationship.remove", relationshipId: "link-a1-b" }],
  ];

  for (const [name, command] of cases) {
    await t.test(name, () => {
      const initial = fixture();
      const history = createCommandHistory(initial);
      const applied = history.execute(command);
      assert.equal(applied.ok, true, JSON.stringify(applied.error));
      assert.notDeepEqual(applied.document, initial);
      const after = structuredClone(applied.document);
      const undone = history.undo();
      assert.equal(undone.ok, true, JSON.stringify(undone.error));
      assert.deepEqual(undone.document, initial);
      assert.equal(history.canRedo, true);
      const redone = history.redo();
      assert.equal(redone.ok, true, JSON.stringify(redone.error));
      assert.deepEqual(redone.document, after);
      assert.equal(validateDocument(redone.document).valid, true);
    });
  }
});

test("undoing subtree deletion restores all records, sibling orders, links, and array order exactly", () => {
  const initial = fixture();
  const history = createCommandHistory(initial);
  const deleted = history.execute({ type: "node.deleteSubtree", nodeId: "a" });
  assert.equal(deleted.ok, true);
  const undo = history.undo();
  assert.deepEqual(undo.document, initial);
  assert.deepEqual(history.redo().document, deleted.document);
});

test("mixed command sequence can be fully undone and redone without semantic loss", () => {
  const initial = fixture();
  const history = createCommandHistory(initial);
  const commands = [
    { type: "node.addChild", id: "c", parentId: "root", index: 1, label: "C" },
    { type: "node.reparent", nodeId: "a1", parentId: "b", index: 0 },
    { type: "node.rename", nodeId: "a2", label: "Renamed leaf" },
    { type: "relationship.add", id: "link-new", sourceId: "c", targetId: "a2", direction: "undirected", label: "connects" },
    { type: "node.deleteSubtree", nodeId: "a1" },
  ];
  for (const command of commands) {
    const result = history.execute(command);
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(validateDocument(result.document).valid, true);
  }
  const finalDocument = history.getDocument();
  while (history.canUndo) {
    const result = history.undo();
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(validateDocument(result.document).valid, true);
  }
  assert.deepEqual(history.getDocument(), initial);
  while (history.canRedo) {
    const result = history.redo();
    assert.equal(result.ok, true, JSON.stringify(result.error));
    assert.equal(validateDocument(result.document).valid, true);
  }
  assert.deepEqual(history.getDocument(), finalDocument);
});

test("reparent undo restores the original parent, sibling order, and entire subtree", () => {
  const initial = fixture();
  const history = createCommandHistory(initial);
  history.execute({ type: "node.reparent", nodeId: "a1", parentId: "b", index: 0 });
  assert.deepEqual(history.undo().document, initial);
});

test("a new successful command after undo clears redo history", () => {
  const history = createCommandHistory(fixture());
  history.execute({ type: "node.rename", nodeId: "a", label: "Changed" });
  assert.equal(history.undo().ok, true);
  assert.equal(history.canRedo, true);
  history.execute({ type: "node.rename", nodeId: "b", label: "Another change" });
  assert.equal(history.canRedo, false);
  assert.equal(history.redo().error.code, "NOTHING_TO_REDO");
});

test("failed commands are atomic and do not enter or clear history", () => {
  const initial = fixture();
  const history = createCommandHistory(initial);
  const failure = history.execute({ type: "node.deleteSubtree", nodeId: "root" });
  assert.equal(failure.ok, false);
  assert.equal(failure.error.code, "ROOT_DELETE_DISALLOWED");
  assert.deepEqual(history.getDocument(), initial);
  assert.equal(history.canUndo, false);

  history.execute({ type: "node.rename", nodeId: "a", label: "Changed" });
  history.undo();
  const redoBefore = history.getDocument();
  const rejected = history.execute({ type: "node.rename", nodeId: "missing", label: "No" });
  assert.equal(rejected.ok, false);
  assert.equal(history.canRedo, true);
  assert.deepEqual(history.getDocument(), redoBefore);
});

test("no-op commands do not create history or invalidate redo", () => {
  const history = createCommandHistory(fixture());
  history.execute({ type: "node.rename", nodeId: "a", label: "Changed" });
  history.undo();
  const noop = history.execute({ type: "node.rename", nodeId: "a", label: "A" });
  assert.equal(noop.ok, true);
  assert.equal(noop.changed, false);
  assert.equal(history.canRedo, true);
});

test("previously returned documents and getDocument results cannot mutate history state", () => {
  const history = createCommandHistory(fixture());
  const first = history.execute({ type: "node.rename", nodeId: "a", label: "Changed" }).document;
  const second = history.execute({ type: "node.rename", nodeId: "b", label: "Changed B" }).document;
  second.document.nodes[0].label = "Caller mutation";
  history.getDocument().document.nodes[0].label = "Another caller mutation";
  assert.equal(node(first, "a").label, "Changed");
  assert.equal(node(first, "b").label, "B");
  assert.equal(node(history.getDocument(), "root").label, "Root");
});

test("history uses the explicit ID generator and records generated IDs for redo", () => {
  const generated = [];
  const history = createCommandHistory(fixture(), {
    idFactory: (kind) => {
      generated.push(kind);
      return "generated-child";
    },
  });
  const result = history.execute({ type: "node.addChild", parentId: "root", label: "Generated" });
  assert.equal(result.ok, true);
  assert.deepEqual(generated, ["node"]);
  assert.equal(node(result.document, "generated-child").label, "Generated");
  history.undo();
  assert.equal(node(history.redo().document, "generated-child").label, "Generated");
  assert.deepEqual(generated, ["node"]);
});

test("rejected command cases report stable failures without mutating input", async (t) => {
  const cases = [
    ["invalid command", { type: 17 }, "COMMAND_INVALID"],
    ["unknown command", { type: "node.move" }, "UNKNOWN_COMMAND"],
    ["prototype property is not a command", { type: "constructor" }, "UNKNOWN_COMMAND"],
    ["prototype key is not a command", { type: "__proto__" }, "UNKNOWN_COMMAND"],
    ["unknown command field", { type: "node.rename", nodeId: "a", label: "A", typo: true }, "COMMAND_FIELD_UNKNOWN"],
    ["invalid node ID", { type: "node.rename", nodeId: " ", label: "A" }, "INVALID_ID"],
    ["missing node", { type: "node.rename", nodeId: "missing", label: "A" }, "NODE_NOT_FOUND"],
    ["invalid parent ID", { type: "node.addChild", parentId: " ", id: "x", label: "X" }, "INVALID_ID"],
    ["missing parent", { type: "node.addChild", parentId: "missing", id: "x", label: "X" }, "PARENT_NOT_FOUND"],
    ["duplicate node ID", { type: "node.addChild", parentId: "root", id: "a", label: "X" }, "DUPLICATE_ID"],
    ["root delete", { type: "node.deleteSubtree", nodeId: "root" }, "ROOT_DELETE_DISALLOWED"],
    ["root reparent", { type: "node.reparent", nodeId: "root", parentId: "a" }, "ROOT_REPARENT_DISALLOWED"],
    ["self-parent cycle", { type: "node.reparent", nodeId: "a", parentId: "a" }, "CYCLE_DETECTED"],
    ["descendant cycle", { type: "node.reparent", nodeId: "a", parentId: "a2" }, "CYCLE_DETECTED"],
    ["invalid insertion position", { type: "node.addChild", parentId: "root", id: "x", label: "X", index: 4 }, "INVALID_SIBLING_INDEX"],
    ["invalid reorder position", { type: "node.reorderSibling", nodeId: "a", index: 2 }, "INVALID_SIBLING_INDEX"],
    ["invalid node label", { type: "node.rename", nodeId: "a", label: "  " }, "NODE_LABEL_EMPTY"],
    ["duplicate relationship ID", {
      type: "relationship.add", id: "link-a1-b", sourceId: "root", targetId: "b", direction: "directed", label: "other",
    }, "DUPLICATE_ID"],
    ["missing relationship source", {
      type: "relationship.add", id: "new-link", sourceId: "missing", targetId: "b", direction: "directed", label: "new",
    }, "SOURCE_NODE_NOT_FOUND"],
    ["missing relationship target", {
      type: "relationship.add", id: "new-link", sourceId: "a", targetId: "missing", direction: "directed", label: "new",
    }, "TARGET_NODE_NOT_FOUND"],
    ["self-link", {
      type: "relationship.add", id: "new-link", sourceId: "a", targetId: "a", direction: "directed", label: "self",
    }, "SELF_LINK_DISALLOWED"],
    ["invalid direction", {
      type: "relationship.add", id: "new-link", sourceId: "a", targetId: "b", direction: "sideways", label: "new",
    }, "RELATIONSHIP_DIRECTION_INVALID"],
    ["invalid relationship label", {
      type: "relationship.add", id: "new-link", sourceId: "a", targetId: "b", direction: "directed", label: "  ",
    }, "RELATIONSHIP_LABEL_EMPTY"],
    ["missing relationship", { type: "relationship.remove", relationshipId: "missing" }, "RELATIONSHIP_NOT_FOUND"],
    ["empty relationship update", { type: "relationship.update", relationshipId: "link-a1-b" }, "RELATIONSHIP_UPDATE_EMPTY"],
  ];

  for (const [name, command, code] of cases) {
    await t.test(name, () => {
      const document = fixture();
      const before = structuredClone(document);
      const result = commandResult(command, document);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, code);
      assert.deepEqual(document, before);
    });
  }
});

test("relationship update rejects a duplicate atomically", () => {
  const document = fixture();
  document.document.relationships.push({
    id: "link-a1-b-alt",
    sourceId: "a1",
    targetId: "b",
    direction: "directed",
    label: "alternate",
  });
  assert.equal(validateDocument(document).valid, true);
  const before = structuredClone(document);
  const result = applyCommand(document, {
    type: "relationship.update",
    relationshipId: "link-a1-b",
    label: "alternate",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "DUPLICATE_RELATIONSHIP");
  assert.deepEqual(document, before);
});

test("invalid undo and redo requests return structured failures", () => {
  const history = createCommandHistory(fixture());
  assert.equal(history.undo().error.code, "NOTHING_TO_UNDO");
  assert.equal(history.redo().error.code, "NOTHING_TO_REDO");
});
