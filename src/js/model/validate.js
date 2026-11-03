import {
  DOCUMENT_FIELDS,
  DOCUMENT_FORMAT,
  DIRECTION,
  LIMITS,
  NODE_FIELDS,
  RELATIONSHIP_FIELDS,
  SCHEMA_VERSION,
} from "./schema.js";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
function codePointLength(value, stopAfter = Number.POSITIVE_INFINITY) {
  let count = 0;
  for (const _character of value) {
    count += 1;
    if (count > stopAfter) return count;
  }
  return count;
}
const isControlCharacter = (value) => /[\u0000-\u001f\u007f-\u009f]/u.test(value);

function addError(errors, code, path, message, entityId, extra = {}) {
  const error = { code, path, message };
  if (entityId !== undefined) error.entityId = entityId;
  Object.assign(error, extra);
  errors.push(error);
}

function checkFields(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      addError(
        errors,
        "UNKNOWN_FIELD",
        path + "." + key,
        "Field is not defined by schema version " + SCHEMA_VERSION + ".",
      );
    }
  }
}

function validId(value) {
  return typeof value === "string"
    && value.length > 0
    && value.trim() === value
    && codePointLength(value, LIMITS.idCodePoints) <= LIMITS.idCodePoints
    && !isControlCharacter(value);
}

function checkLabel(value, maximum, path, codePrefix, entityId, errors) {
  if (typeof value !== "string") {
    addError(errors, codePrefix + "_INVALID", path, "Label must be a string.", entityId);
    return null;
  }
  if (value.trim().length === 0) {
    addError(errors, codePrefix + "_EMPTY", path, "Label must contain non-whitespace text.", entityId);
    return null;
  }
  if (codePointLength(value, maximum) > maximum) {
    addError(
      errors,
      codePrefix + "_TOO_LONG",
      path,
      "Label exceeds the " + maximum + " Unicode code point limit.",
      entityId,
    );
    return null;
  }
  return value.normalize("NFC").trim();
}

function validateNodes(nodes, documentId, rootId, errors) {
  const byId = new Map();
  const indexById = new Map();
  const seenEntities = new Map();
  if (validId(documentId)) seenEntities.set(documentId, "$.document.id");

  if (!Array.isArray(nodes)) {
    addError(errors, "NODES_INVALID", "$.document.nodes", "Nodes must be an array.");
    return { byId, indexById, children: new Map(), roots: [] };
  }
  if (nodes.length > LIMITS.nodes) {
    addError(
      errors,
      "NODE_LIMIT_EXCEEDED",
      "$.document.nodes",
      "Document exceeds the " + LIMITS.nodes + " node limit.",
    );
  }

  const children = new Map();
  const roots = [];
  const orders = new Map();

  nodes.forEach((node, index) => {
    const path = "$.document.nodes[" + index + "]";
    if (!isRecord(node)) {
      addError(errors, "NODE_INVALID", path, "Node must be an object.");
      return;
    }
    checkFields(node, NODE_FIELDS, path, errors);

    const id = node.id;
    const idValid = hasOwn(node, "id") && validId(id);
    if (!idValid) {
      addError(errors, "NODE_ID_INVALID", path + ".id", "Node ID must be a non-empty stable identifier.");
    }
    if (idValid && byId.has(id)) {
      addError(errors, "DUPLICATE_NODE_ID", path + ".id", "Node ID is already used.", id);
    } else if (idValid) {
      byId.set(id, node);
      indexById.set(id, index);
      if (seenEntities.has(id)) {
        addError(
          errors,
          "DUPLICATE_ENTITY_ID",
          path + ".id",
          "Entity ID is already used by " + seenEntities.get(id) + ".",
          id,
        );
      } else {
        seenEntities.set(id, path + ".id");
      }
    }

    checkLabel(
      node.label,
      LIMITS.nodeLabelCodePoints,
      path + ".label",
      "NODE_LABEL",
      idValid ? id : undefined,
      errors,
    );

    if (!hasOwn(node, "parentId")) {
      addError(errors, "PARENT_ID_MISSING", path + ".parentId", "Node must declare its parent ID or null.", idValid ? id : undefined);
    } else if (node.parentId === null) {
      if (idValid) roots.push({ id, node, index });
      if (idValid) {
        const list = orders.get(null) ?? [];
        list.push({ id, order: node.order, index });
        orders.set(null, list);
      }
    } else if (!validId(node.parentId)) {
      addError(errors, "PARENT_ID_INVALID", path + ".parentId", "Parent ID must be a valid ID or null.", idValid ? id : undefined);
    } else {
      if (idValid) {
        const list = orders.get(node.parentId) ?? [];
        list.push({ id, order: node.order, index });
        orders.set(node.parentId, list);
        const childList = children.get(node.parentId) ?? [];
        childList.push(id);
        children.set(node.parentId, childList);
      }
    }

    if (!Number.isInteger(node.order) || node.order < 0) {
      addError(errors, "SIBLING_ORDER_INVALID", path + ".order", "Sibling order must be a non-negative integer.", idValid ? id : undefined);
    }
  });

  for (const [parentId, siblings] of orders) {
    const valid = siblings.filter((item) => Number.isInteger(item.order) && item.order >= 0);
    const seen = new Set();
    let duplicate = false;
    for (const sibling of valid) {
      if (seen.has(sibling.order)) {
        duplicate = true;
        addError(
          errors,
          "DUPLICATE_SIBLING_ORDER",
          "$.document.nodes[" + sibling.index + "].order",
          "Sibling order is already used under this parent.",
          sibling.id,
          { parentId },
        );
      }
      seen.add(sibling.order);
    }
    if (!duplicate && valid.length === siblings.length) {
      const sorted = valid.slice().sort((left, right) => left.order - right.order);
      const misplaced = sorted.find((sibling, order) => sibling.order !== order);
      if (misplaced) {
        addError(
          errors,
          "SIBLING_ORDER_GAP",
          "$.document.nodes[" + misplaced.index + "].order",
          "Sibling order values must be contiguous starting at zero.",
          misplaced.id,
          { parentId, expectedOrder: sorted.indexOf(misplaced), actualOrder: misplaced.order },
        );
      }
    }
  }

  if (roots.length > 1) {
    for (const root of roots) {
      addError(
        errors,
        "MULTIPLE_ROOTS",
        "$.document.nodes[" + root.index + "].parentId",
        "A document must have exactly one root node.",
        root.id,
      );
    }
  }
  if (roots.length === 0) {
    addError(errors, "ROOT_COUNT_INVALID", "$.document.nodes", "A document must have exactly one root node.");
  }

  if (validId(rootId)) {
    const declaredRoot = byId.get(rootId);
    if (!declaredRoot) {
      addError(errors, "ROOT_NOT_FOUND", "$.document.rootId", "Root ID does not identify a node.", rootId);
    } else if (declaredRoot.parentId !== null) {
      addError(
        errors,
        "ROOT_PARENT_INVALID",
        "$.document.nodes[" + indexById.get(rootId) + "].parentId",
        "The declared root must have a null parent ID.",
        rootId,
      );
    }
  }

  for (const [id, node] of byId) {
    if (id === rootId || node.parentId === null || !validId(node.parentId)) continue;
    if (!byId.has(node.parentId)) {
      addError(
        errors,
        "MISSING_PARENT",
        "$.document.nodes[" + indexById.get(id) + "].parentId",
        "Parent ID does not identify a node.",
        id,
        { parentId: node.parentId },
      );
    }
  }

  detectCycles(byId, indexById, errors);
  detectUnreachable(byId, children, indexById, rootId, errors);
  return { byId, indexById, children, roots };
}

function detectCycles(byId, indexById, errors) {
  const complete = new Set();
  for (const startId of byId.keys()) {
    if (complete.has(startId)) continue;
    const chain = [];
    const positions = new Map();
    let currentId = startId;
    while (byId.has(currentId) && !complete.has(currentId)) {
      if (positions.has(currentId)) {
        const cycleIds = chain.slice(positions.get(currentId));
        addError(
          errors,
          "HIERARCHY_CYCLE",
          "$.document.nodes[" + indexById.get(currentId) + "].parentId",
          "Parent links contain a cycle.",
          currentId,
          { cycleIds },
        );
        break;
      }
      positions.set(currentId, chain.length);
      chain.push(currentId);
      const parentId = byId.get(currentId).parentId;
      if (!validId(parentId)) break;
      currentId = parentId;
    }
    for (const id of chain) complete.add(id);
  }
}

function detectUnreachable(byId, children, indexById, rootId, errors) {
  if (!byId.has(rootId)) return;
  const reached = new Set([rootId]);
  const queue = [rootId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const childId of children.get(queue[cursor]) ?? []) {
      if (!reached.has(childId)) {
        reached.add(childId);
        queue.push(childId);
      }
    }
  }
  for (const id of byId.keys()) {
    if (!reached.has(id)) {
      addError(
        errors,
        "UNREACHABLE_NODE",
        "$.document.nodes[" + indexById.get(id) + "]",
        "Node is not reachable from the declared root.",
        id,
      );
    }
  }
}

function validateRelationships(relationships, nodes, documentId, errors) {
  const relationshipIds = new Set();
  const entities = new Map();
  if (validId(documentId)) entities.set(documentId, "$.document.id");
  for (const [id, node] of nodes.byId) {
    entities.set(id, "$.document.nodes[" + nodes.indexById.get(id) + "].id");
  }
  const duplicateKeys = new Map();

  if (!Array.isArray(relationships)) {
    addError(
      errors,
      "RELATIONSHIPS_INVALID",
      "$.document.relationships",
      "Relationships must be an array.",
    );
    return;
  }
  if (relationships.length > LIMITS.relationships) {
    addError(
      errors,
      "RELATIONSHIP_LIMIT_EXCEEDED",
      "$.document.relationships",
      "Document exceeds the " + LIMITS.relationships + " relationship limit.",
    );
  }

  relationships.forEach((relationship, index) => {
    const path = "$.document.relationships[" + index + "]";
    if (!isRecord(relationship)) {
      addError(errors, "RELATIONSHIP_INVALID", path, "Relationship must be an object.");
      return;
    }
    checkFields(relationship, RELATIONSHIP_FIELDS, path, errors);

    const id = relationship.id;
    if (!validId(id)) {
      addError(errors, "RELATIONSHIP_ID_INVALID", path + ".id", "Relationship ID must be a non-empty stable identifier.");
    } else if (relationshipIds.has(id)) {
      addError(errors, "DUPLICATE_RELATIONSHIP_ID", path + ".id", "Relationship ID is already used.", id);
    } else {
      relationshipIds.add(id);
      if (entities.has(id)) {
        addError(
          errors,
          "DUPLICATE_ENTITY_ID",
          path + ".id",
          "Entity ID is already used by " + entities.get(id) + ".",
          id,
        );
      } else {
        entities.set(id, path + ".id");
      }
    }

    const sourceValid = validId(relationship.sourceId) && nodes.byId.has(relationship.sourceId);
    const targetValid = validId(relationship.targetId) && nodes.byId.has(relationship.targetId);
    if (!sourceValid) {
      addError(
        errors,
        "SOURCE_NODE_NOT_FOUND",
        path + ".sourceId",
        "Source ID must identify an existing node.",
        validId(id) ? id : undefined,
      );
    }
    if (!targetValid) {
      addError(
        errors,
        "TARGET_NODE_NOT_FOUND",
        path + ".targetId",
        "Target ID must identify an existing node.",
        validId(id) ? id : undefined,
      );
    }
    const directionValid = relationship.direction === DIRECTION.DIRECTED
      || relationship.direction === DIRECTION.UNDIRECTED;
    if (!directionValid) {
      addError(
        errors,
        "RELATIONSHIP_DIRECTION_INVALID",
        path + ".direction",
        "Direction must be directed or undirected.",
        validId(id) ? id : undefined,
      );
    }

    const normalizedLabel = checkLabel(
      relationship.label,
      LIMITS.relationshipLabelCodePoints,
      path + ".label",
      "RELATIONSHIP_LABEL",
      validId(id) ? id : undefined,
      errors,
    );
    if (!sourceValid || !targetValid || !directionValid || normalizedLabel === null) return;

    if (relationship.sourceId === relationship.targetId) {
      addError(
        errors,
        "SELF_LINK_DISALLOWED",
        path + ".targetId",
        "Self-links are not allowed in schema version " + SCHEMA_VERSION + ".",
        validId(id) ? id : undefined,
      );
      return;
    }

    let sourceId = relationship.sourceId;
    let targetId = relationship.targetId;
    if (relationship.direction === DIRECTION.UNDIRECTED && targetId < sourceId) {
      [sourceId, targetId] = [targetId, sourceId];
    }
    const duplicateKey = JSON.stringify([
      relationship.direction,
      sourceId,
      targetId,
      normalizedLabel,
    ]);
    if (duplicateKeys.has(duplicateKey)) {
      addError(
        errors,
        "DUPLICATE_RELATIONSHIP",
        path,
        "Relationship duplicates " + duplicateKeys.get(duplicateKey) + " after label normalization.",
        validId(id) ? id : undefined,
        { duplicateOf: duplicateKeys.get(duplicateKey) },
      );
    } else {
      duplicateKeys.set(duplicateKey, validId(id) ? id : path);
    }
  });
}

export function validateDocument(value) {
  const errors = [];
  if (!isRecord(value)) {
    addError(errors, "DOCUMENT_INVALID", "$", "Document must be a JSON object.");
    return { valid: false, errors };
  }
  checkFields(value, ["format", "schemaVersion", "document"], "$", errors);
  if (value.format !== DOCUMENT_FORMAT) {
    addError(errors, "DOCUMENT_FORMAT_INVALID", "$.format", "Document format is not recognized.");
  }
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    addError(errors, "SCHEMA_VERSION_INVALID", "$.schemaVersion", "Schema version must be a positive integer.");
  } else if (value.schemaVersion !== SCHEMA_VERSION) {
    addError(
      errors,
      "UNSUPPORTED_SCHEMA_VERSION",
      "$.schemaVersion",
      "Schema version " + value.schemaVersion + " is not supported; current version is " + SCHEMA_VERSION + ".",
      undefined,
      { schemaVersion: value.schemaVersion },
    );
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    return { valid: false, errors };
  }

  if (!isRecord(value.document)) {
    addError(errors, "DOCUMENT_BODY_INVALID", "$.document", "Document body must be an object.");
    return { valid: false, errors };
  }

  const document = value.document;
  checkFields(document, DOCUMENT_FIELDS, "$.document", errors);
  if (!hasOwn(document, "id")) {
    addError(errors, "DOCUMENT_ID_MISSING", "$.document.id", "Document ID is required.");
  } else if (!validId(document.id)) {
    addError(errors, "DOCUMENT_ID_INVALID", "$.document.id", "Document ID must be a non-empty stable identifier.");
  }
  if (typeof document.title !== "string"
      || document.title.trim().length === 0
      || codePointLength(document.title, LIMITS.titleCodePoints) > LIMITS.titleCodePoints) {
    addError(
      errors,
      "DOCUMENT_TITLE_INVALID",
      "$.document.title",
      "Document title must contain text and be at most " + LIMITS.titleCodePoints + " Unicode code points.",
    );
  }
  if (!hasOwn(document, "rootId")) {
    addError(errors, "ROOT_ID_MISSING", "$.document.rootId", "Root ID is required.");
  } else if (!validId(document.rootId)) {
    addError(errors, "ROOT_ID_INVALID", "$.document.rootId", "Root ID must be a valid identifier.");
  }

  const nodes = validateNodes(document.nodes, document.id, document.rootId, errors);
  validateRelationships(document.relationships, nodes, document.id, errors);
  return { valid: errors.length === 0, errors };
}
