import assert from "node:assert/strict";
import test from "node:test";
import {
  createDocument,
  DIRECTION,
  parseDocument,
  SCHEMA_VERSION,
  serializeDocument,
  validateDocument,
} from "../src/js/model/index.js";

function validDocument() {
  return {
    format: "lfcfoundry.mindmap",
    schemaVersion: SCHEMA_VERSION,
    document: {
      id: "doc-1",
      title: "Example",
      rootId: "root",
      nodes: [
        { id: "root", parentId: null, order: 0, label: "Central topic" },
      ],
      relationships: [],
    },
  };
}

function addChild(document, id, parentId, order, label = id) {
  document.document.nodes.push({ id, parentId, order, label });
}

function addRelationship(document, id, sourceId, targetId, label, direction = DIRECTION.UNDIRECTED) {
  document.document.relationships.push({ id, sourceId, targetId, direction, label });
}

function codes(document) {
  return validateDocument(document).errors.map((error) => error.code);
}

test("accepts a valid minimal one-root document", () => {
  assert.deepEqual(validateDocument(validDocument()), { valid: true, errors: [] });
});

test("accepts a valid nested hierarchy and explicit sibling order", () => {
  const document = validDocument();
  addChild(document, "second", "root", 1);
  addChild(document, "first", "root", 0);
  addChild(document, "leaf", "first", 0);
  assert.equal(validateDocument(document).valid, true);
  assert.deepEqual(document.document.nodes.map((node) => [node.id, node.order]), [
    ["root", 0],
    ["second", 1],
    ["first", 0],
    ["leaf", 0],
  ]);
});

test("document creation provides stable entity IDs and a valid root", () => {
  const ids = ["document-id", "root-id"];
  const document = createDocument({
    idFactory: () => ids.shift(),
    title: "Created",
    rootLabel: "Root",
  });
  assert.equal(document.document.id, "document-id");
  assert.equal(document.document.rootId, "root-id");
  assert.equal(document.document.nodes[0].id, "root-id");
  assert.equal(validateDocument(document).valid, true);
});

test("document creation rejects an ID factory that collides across entities", () => {
  assert.throws(() => createDocument({ idFactory: () => "duplicate-id" }), /DUPLICATE_ENTITY_ID/);
});

test("rejects duplicate roots", () => {
  const document = validDocument();
  addChild(document, "other-root", null, 0);
  assert.ok(codes(document).includes("MULTIPLE_ROOTS"));
});

test("reports a missing declared root", () => {
  const document = validDocument();
  document.document.rootId = "not-present";
  assert.ok(codes(document).includes("ROOT_NOT_FOUND"));
});

test("reports a missing root ID", () => {
  const document = validDocument();
  delete document.document.rootId;
  assert.ok(codes(document).includes("ROOT_ID_MISSING"));
});

test("reports an empty node collection as having no root", () => {
  const document = validDocument();
  document.document.nodes = [];
  assert.ok(codes(document).includes("ROOT_COUNT_INVALID"));
  assert.ok(codes(document).includes("ROOT_NOT_FOUND"));
});

test("reports missing document identity and invalid title", () => {
  const document = validDocument();
  delete document.document.id;
  document.document.title = "  ";
  const found = codes(document);
  assert.ok(found.includes("DOCUMENT_ID_MISSING"));
  assert.ok(found.includes("DOCUMENT_TITLE_INVALID"));
});

test("collects independent node errors in a single validation pass", () => {
  const document = validDocument();
  const node = document.document.nodes[0];
  node.id = "";
  node.label = "  ";
  node.order = -1;
  node.future = true;
  const errors = validateDocument(document).errors;
  assert.ok(errors.some((error) => error.code === "NODE_ID_INVALID"));
  assert.ok(errors.some((error) => error.code === "NODE_LABEL_EMPTY"));
  assert.ok(errors.some((error) => error.code === "SIBLING_ORDER_INVALID"));
  assert.ok(errors.some((error) => error.code === "UNKNOWN_FIELD"));
});

test("rejects a root that has a parent", () => {
  const document = validDocument();
  addChild(document, "parent", "root", 0);
  document.document.nodes[0].parentId = "parent";
  assert.ok(codes(document).includes("ROOT_PARENT_INVALID"));
});

test("reports a missing parent", () => {
  const document = validDocument();
  addChild(document, "orphan", "absent", 0);
  assert.ok(codes(document).includes("MISSING_PARENT"));
});

test("reports hierarchy cycles", () => {
  const document = validDocument();
  addChild(document, "a", "b", 0);
  addChild(document, "b", "a", 0);
  const result = validateDocument(document);
  const cycle = result.errors.find((error) => error.code === "HIERARCHY_CYCLE");
  assert.ok(cycle);
  assert.deepEqual(new Set(cycle.cycleIds), new Set(["a", "b"]));
});

test("reports nodes not reachable from the declared root", () => {
  const document = validDocument();
  addChild(document, "island-root", null, 0);
  addChild(document, "island-child", "island-root", 0);
  const unreachable = validateDocument(document).errors
    .filter((error) => error.code === "UNREACHABLE_NODE")
    .map((error) => error.entityId);
  assert.deepEqual(unreachable, ["island-root", "island-child"]);
});

test("reports duplicate node IDs with the later node location", () => {
  const document = validDocument();
  addChild(document, "root", "root", 0);
  const duplicate = validateDocument(document).errors
    .find((error) => error.code === "DUPLICATE_NODE_ID");
  assert.equal(duplicate.path, "$.document.nodes[1].id");
  assert.equal(duplicate.entityId, "root");
});

test("rejects blank, non-string, and over-limit node labels", () => {
  const blank = validDocument();
  blank.document.nodes[0].label = "  ";
  assert.ok(codes(blank).includes("NODE_LABEL_EMPTY"));

  const nonString = validDocument();
  nonString.document.nodes[0].label = 17;
  assert.ok(codes(nonString).includes("NODE_LABEL_INVALID"));

  const tooLong = validDocument();
  tooLong.document.nodes[0].label = "x".repeat(10_001);
  assert.ok(codes(tooLong).includes("NODE_LABEL_TOO_LONG"));
});

test("rejects invalid sibling order values, duplicates, and gaps", () => {
  const invalid = validDocument();
  invalid.document.nodes[0].order = -1;
  assert.ok(codes(invalid).includes("SIBLING_ORDER_INVALID"));

  const duplicate = validDocument();
  addChild(duplicate, "a", "root", 0);
  addChild(duplicate, "b", "root", 0);
  assert.ok(codes(duplicate).includes("DUPLICATE_SIBLING_ORDER"));

  const gap = validDocument();
  addChild(gap, "a", "root", 2);
  assert.ok(codes(gap).includes("SIBLING_ORDER_GAP"));
});

test("reports invalid relationship source and target endpoints independently", () => {
  const document = validDocument();
  addRelationship(document, "link-1", "missing-source", "missing-target", "related");
  const errors = validateDocument(document).errors;
  assert.ok(errors.some((error) => error.code === "SOURCE_NODE_NOT_FOUND"));
  assert.ok(errors.some((error) => error.code === "TARGET_NODE_NOT_FOUND"));
  assert.ok(errors.every((error) => typeof error.path === "string" && typeof error.code === "string"));
});

test("accepts directed and undirected relationships as explicit semantics", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "directed-link", "root", "child", "causes", DIRECTION.DIRECTED);
  addRelationship(document, "undirected-link", "root", "child", "related", DIRECTION.UNDIRECTED);
  assert.equal(validateDocument(document).valid, true);
});

test("rejects unknown relationship direction modes", () => {
  const document = validDocument();
  addRelationship(document, "link-1", "root", "root-2", "related", "arrow-only");
  addChild(document, "root-2", "root", 0);
  assert.ok(codes(document).includes("RELATIONSHIP_DIRECTION_INVALID"));
});

test("directed endpoint reversal has distinct duplicate semantics", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "forward", "root", "child", "causes", DIRECTION.DIRECTED);
  addRelationship(document, "reverse", "child", "root", "causes", DIRECTION.DIRECTED);
  assert.equal(validateDocument(document).valid, true);
});

test("direction mode is part of relationship duplicate identity", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "directed", "root", "child", "related", DIRECTION.DIRECTED);
  addRelationship(document, "undirected", "child", "root", "related", DIRECTION.UNDIRECTED);
  assert.equal(validateDocument(document).valid, true);

  addRelationship(document, "duplicate-directed", "root", "child", "related", DIRECTION.DIRECTED);
  assert.ok(codes(document).includes("DUPLICATE_RELATIONSHIP"));
});

test("undirected endpoint reversal is a duplicate", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "link-a", "root", "child", "related");
  addRelationship(document, "link-b", "child", "root", "related");
  assert.ok(codes(document).includes("DUPLICATE_RELATIONSHIP"));
});

test("same endpoints with different labels remain valid", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "link-a", "root", "child", "related");
  addRelationship(document, "link-b", "child", "root", "supports");
  assert.equal(validateDocument(document).valid, true);
});

test("duplicate comparison uses Unicode NFC without rewriting display labels", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "link-a", "root", "child", "\u00e9");
  addRelationship(document, "link-b", "child", "root", "e\u0301");
  assert.ok(codes(document).includes("DUPLICATE_RELATIONSHIP"));
  assert.equal(document.document.relationships[1].label, "e\u0301");
});

test("duplicate comparison trims outer whitespace but preserves original labels", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "link-a", "root", "child", "related");
  addRelationship(document, "link-b", "child", "root", "  related \t");
  assert.ok(codes(document).includes("DUPLICATE_RELATIONSHIP"));
  assert.equal(document.document.relationships[1].label, "  related \t");
});

test("duplicate comparison is case-sensitive", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0);
  addRelationship(document, "link-a", "root", "child", "Related");
  addRelationship(document, "link-b", "child", "root", "related");
  assert.equal(validateDocument(document).valid, true);
});

test("self-links are rejected consistently", () => {
  const document = validDocument();
  addRelationship(document, "self", "root", "root", "refers to");
  assert.ok(codes(document).includes("SELF_LINK_DISALLOWED"));
});

test("duplicate relationship IDs and global entity ID collisions are reported", () => {
  const document = validDocument();
  addRelationship(document, "same", "root", "root", "one");
  addRelationship(document, "same", "root", "root", "two");
  addRelationship(document, "root", "root", "root", "three");
  const found = codes(document);
  assert.ok(found.includes("DUPLICATE_RELATIONSHIP_ID"));
  assert.ok(found.includes("DUPLICATE_ENTITY_ID"));
});

test("invalid document and node identities are reported", () => {
  const document = validDocument();
  document.document.id = " ";
  document.document.nodes[0].id = " ";
  const found = codes(document);
  assert.ok(found.includes("DOCUMENT_ID_INVALID"));
  assert.ok(found.includes("NODE_ID_INVALID"));
});

test("IDs count Unicode code points and reject control characters", () => {
  const document = validDocument();
  document.document.nodes[0].id = "😀".repeat(128);
  document.document.rootId = document.document.nodes[0].id;
  assert.equal(validateDocument(document).valid, true);

  document.document.nodes[0].id = "bad\u0000id";
  document.document.rootId = document.document.nodes[0].id;
  assert.ok(codes(document).includes("NODE_ID_INVALID"));
});

test("relationship labels must be non-empty strings within the limit", () => {
  const blank = validDocument();
  addChild(blank, "child", "root", 0);
  addRelationship(blank, "link", "root", "child", " \t");
  assert.ok(codes(blank).includes("RELATIONSHIP_LABEL_EMPTY"));

  const nonString = validDocument();
  addChild(nonString, "child", "root", 0);
  addRelationship(nonString, "link", "root", "child", "related");
  nonString.document.relationships[0].label = 4;
  assert.ok(codes(nonString).includes("RELATIONSHIP_LABEL_INVALID"));

  const tooLong = validDocument();
  addChild(tooLong, "child", "root", 0);
  addRelationship(tooLong, "link", "root", "child", "x".repeat(201));
  assert.ok(codes(tooLong).includes("RELATIONSHIP_LABEL_TOO_LONG"));
});

test("unknown fields fail validation instead of being silently discarded", () => {
  const document = validDocument();
  document.document.nodes[0].futureField = true;
  const serialized = serializeDocument(document);
  assert.equal(serialized.ok, false);
  assert.ok(serialized.errors.some((error) => error.code === "UNKNOWN_FIELD"));
});

test("malformed JSON returns a structured failure", () => {
  const result = parseDocument("{");
  assert.equal(result.ok, false);
  assert.equal(result.document, null);
  assert.equal(result.errors[0].code, "MALFORMED_JSON");
  assert.equal(result.errors[0].path, "$");
});

test("parsed invalid documents return validation errors", () => {
  const document = validDocument();
  document.document.rootId = "absent";
  const result = parseDocument(JSON.stringify(document));
  assert.equal(result.ok, false);
  assert.equal(result.document, null);
  assert.ok(result.errors.some((error) => error.code === "ROOT_NOT_FOUND"));
});

test("serialization round trip is valid and preserves original display labels", () => {
  const document = validDocument();
  addChild(document, "child", "root", 0, "  Child  ");
  addRelationship(document, "link", "root", "child", "  connected to  ", DIRECTION.DIRECTED);
  const encoded = serializeDocument(document);
  assert.equal(encoded.ok, true);
  const decoded = parseDocument(encoded.json);
  assert.equal(decoded.ok, true);
  assert.deepEqual(decoded.document, document);
});

test("serialization uses stable schema field order", () => {
  const document = validDocument();
  const reversed = {
    schemaVersion: document.schemaVersion,
    document: {
      relationships: [],
      nodes: document.document.nodes,
      rootId: document.document.rootId,
      title: document.document.title,
      id: document.document.id,
    },
    format: document.format,
  };
  const left = serializeDocument(document);
  const right = serializeDocument(reversed);
  assert.equal(left.ok, true);
  assert.equal(right.json, left.json);
});

test("unsupported schema versions fail explicitly", () => {
  const document = validDocument();
  document.schemaVersion = SCHEMA_VERSION + 1;
  const result = validateDocument(document);
  const versionError = result.errors.find((error) => error.code === "UNSUPPORTED_SCHEMA_VERSION");
  assert.ok(versionError);
  assert.equal(versionError.schemaVersion, SCHEMA_VERSION + 1);
});

test("non-string JSON input returns a structured failure", () => {
  const result = parseDocument(null);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "JSON_INPUT_INVALID");
});
