import { DOCUMENT_FORMAT, SCHEMA_VERSION } from "./schema.js";
import { validateDocument } from "./validate.js";

function canonicalDocument(value) {
  return {
    format: DOCUMENT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    document: {
      id: value.document.id,
      title: value.document.title,
      rootId: value.document.rootId,
      nodes: value.document.nodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        order: node.order,
        label: node.label,
      })),
      relationships: value.document.relationships.map((relationship) => ({
        id: relationship.id,
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
        direction: relationship.direction,
        label: relationship.label,
      })),
    },
  };
}

export function serializeDocument(value) {
  const validation = validateDocument(value);
  if (!validation.valid) {
    return { ok: false, json: null, errors: validation.errors };
  }
  return {
    ok: true,
    json: JSON.stringify(canonicalDocument(value), null, 2),
    errors: [],
  };
}

export function parseDocument(json) {
  if (typeof json !== "string") {
    return {
      ok: false,
      document: null,
      errors: [{
        code: "JSON_INPUT_INVALID",
        path: "$",
        message: "JSON input must be a string.",
      }],
    };
  }

  let value;
  try {
    value = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      document: null,
      errors: [{
        code: "MALFORMED_JSON",
        path: "$",
        message: error instanceof Error ? error.message : "JSON could not be parsed.",
      }],
    };
  }

  const validation = validateDocument(value);
  if (!validation.valid) {
    return { ok: false, document: null, errors: validation.errors };
  }
  return { ok: true, document: value, errors: [] };
}
