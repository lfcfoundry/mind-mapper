import { DIRECTION, LIMITS } from "../model/schema.js";
import { validateDocument } from "../model/validate.js";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const COMMAND_FIELDS = Object.freeze({
  "node.addChild": ["type", "parentId", "id", "label", "index"],
  "node.rename": ["type", "nodeId", "label"],
  "node.deleteSubtree": ["type", "nodeId"],
  "node.reparent": ["type", "nodeId", "parentId", "index"],
  "node.reorderSibling": ["type", "nodeId", "index"],
  "relationship.add": ["type", "id", "sourceId", "targetId", "direction", "label"],
  "relationship.update": ["type", "relationshipId", "label", "direction"],
  "relationship.remove": ["type", "relationshipId"],
});

function failure(code, message, details = {}) {
  return { ok: false, error: { code, message, ...details } };
}

export function cloneDocument(document) {
  return {
    format: document.format,
    schemaVersion: document.schemaVersion,
    document: {
      id: document.document.id,
      title: document.document.title,
      rootId: document.document.rootId,
      nodes: document.document.nodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        order: node.order,
        label: node.label,
      })),
      relationships: document.document.relationships.map((relationship) => ({
        id: relationship.id,
        sourceId: relationship.sourceId,
        targetId: relationship.targetId,
        direction: relationship.direction,
        label: relationship.label,
      })),
    },
  };
}

function validId(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value
      || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) return false;
  let count = 0;
  for (const _character of value) {
    count += 1;
    if (count > LIMITS.idCodePoints) return false;
  }
  return true;
}

function entityExists(document, id) {
  return document.document.id === id
    || document.document.nodes.some((node) => node.id === id)
    || document.document.relationships.some((relationship) => relationship.id === id);
}

function validateInputDocument(document) {
  const validation = validateDocument(document);
  if (validation.valid) return null;
  return failure("INVALID_DOCUMENT", "Command input is not a valid v1 document.", {
    validationErrors: validation.errors,
  });
}

function validateCommand(command) {
  if (!isRecord(command) || !hasOwn(command, "type") || typeof command.type !== "string") {
    return failure("COMMAND_INVALID", "Command must be an object with a string type.");
  }
  if (!hasOwn(COMMAND_FIELDS, command.type)) {
    return failure("UNKNOWN_COMMAND", "Command type is not supported.", { commandType: command.type });
  }
  const allowed = COMMAND_FIELDS[command.type];
  for (const key of Object.keys(command)) {
    if (!allowed.includes(key)) {
      return failure("COMMAND_FIELD_UNKNOWN", "Command contains an unsupported field.", { field: key });
    }
  }
  return null;
}

function checkId(value, field, entityName) {
  if (!validId(value)) {
    return failure("INVALID_ID", field + " must be a valid stable ID.", { [field]: value, entityType: entityName });
  }
  return null;
}

function chooseId(document, command, kind, options) {
  let id = command.id;
  if (id === undefined) {
    if (typeof options.idFactory !== "function") {
      return { error: failure("ID_GENERATOR_REQUIRED", "Supply an ID or an explicit idFactory.", { entityType: kind }) };
    }
    id = options.idFactory(kind);
  }
  const invalid = checkId(id, "id", kind);
  if (invalid) return { error: invalid };
  if (entityExists(document, id)) {
    return { error: failure("DUPLICATE_ID", "ID is already used by this document.", { entityId: id, entityType: kind }) };
  }
  return { id };
}

function firstValidationFailure(candidate) {
  const validation = validateDocument(candidate);
  if (validation.valid) return null;
  const first = validation.errors[0];
  const details = { path: first.path };
  if (first.entityId !== undefined) details.entityId = first.entityId;
  return failure(first.code, first.message, { ...details, validationErrors: validation.errors });
}

function succeed(candidate, undoAction, redoAction, changed = true) {
  const invalid = firstValidationFailure(candidate);
  if (invalid) return invalid;
  return { ok: true, document: candidate, changed, undoAction, redoAction };
}

function findNode(document, nodeId) {
  return document.document.nodes.find((node) => node.id === nodeId);
}

function findRelationshipIndex(document, relationshipId) {
  return document.document.relationships.findIndex((relationship) => relationship.id === relationshipId);
}

function siblings(document, parentId) {
  return document.document.nodes
    .filter((node) => node.parentId === parentId)
    .sort((left, right) => left.order - right.order);
}

function setSiblingOrder(nodes, siblingIds) {
  const orderById = new Map(siblingIds.map((id, order) => [id, order]));
  for (const node of nodes) {
    if (orderById.has(node.id)) node.order = orderById.get(node.id);
  }
}

function checkIndex(index, length, allowEnd = true) {
  const upperBound = allowEnd ? length : length - 1;
  return Number.isInteger(index) && index >= 0 && index <= upperBound;
}

function collectSubtree(document, rootId) {
  const childIds = new Map();
  for (const node of document.document.nodes) {
    if (node.parentId === null) continue;
    const list = childIds.get(node.parentId) ?? [];
    list.push(node.id);
    childIds.set(node.parentId, list);
  }
  const result = new Set([rootId]);
  const queue = [rootId];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const childId of childIds.get(queue[cursor]) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }
  return result;
}

function executePublicCommand(document, command, options = {}, trustedInput = false) {
  const inputFailure = trustedInput ? null : validateInputDocument(document);
  if (inputFailure) return inputFailure;
  const commandFailure = validateCommand(command);
  if (commandFailure) return commandFailure;

  const body = document.document;
  const candidate = cloneDocument(document);
  const nodes = candidate.document.nodes;
  const relationships = candidate.document.relationships;

  switch (command.type) {
    case "node.addChild": {
      const parentFailure = checkId(command.parentId, "parentId", "node");
      if (parentFailure) return parentFailure;
      if (!findNode(document, command.parentId)) {
        return failure("PARENT_NOT_FOUND", "Parent node does not exist.", { nodeId: command.parentId });
      }
      const currentSiblings = siblings(document, command.parentId);
      const index = command.index === undefined ? currentSiblings.length : command.index;
      if (!checkIndex(index, currentSiblings.length, true)) {
        return failure("INVALID_SIBLING_INDEX", "Child insertion index must be between zero and the sibling count.", {
          parentId: command.parentId,
          index,
        });
      }
      const idResult = chooseId(document, command, "node", options);
      if (idResult.error) return idResult.error;
      const orderedIds = currentSiblings.map((node) => node.id);
      orderedIds.splice(index, 0, idResult.id);
      nodes.push({ id: idResult.id, parentId: command.parentId, order: index, label: command.label });
      setSiblingOrder(nodes, orderedIds);
      return succeed(
        candidate,
        { type: "node.deleteSubtree", nodeId: idResult.id },
        { type: "node.addChild", id: idResult.id, parentId: command.parentId, index, label: command.label },
      );
    }

    case "node.rename": {
      const idFailure = checkId(command.nodeId, "nodeId", "node");
      if (idFailure) return idFailure;
      const node = findNode(document, command.nodeId);
      if (!node) return failure("NODE_NOT_FOUND", "Node does not exist.", { nodeId: command.nodeId });
      if (node.label === command.label) return succeed(candidate, null, null, false);
      findNode(candidate, command.nodeId).label = command.label;
      return succeed(
        candidate,
        { type: "node.rename", nodeId: command.nodeId, label: node.label },
        { type: "node.rename", nodeId: command.nodeId, label: command.label },
      );
    }

    case "node.deleteSubtree": {
      const idFailure = checkId(command.nodeId, "nodeId", "node");
      if (idFailure) return idFailure;
      const root = findNode(document, command.nodeId);
      if (!root) return failure("NODE_NOT_FOUND", "Node does not exist.", { nodeId: command.nodeId });
      if (root.id === body.rootId) {
        return failure("ROOT_DELETE_DISALLOWED", "The document root cannot be deleted.", { nodeId: root.id });
      }

      const deletedIds = collectSubtree(document, root.id);
      const deletedNodes = document.document.nodes
        .map((node, index) => ({ index, record: node }))
        .filter(({ record }) => deletedIds.has(record.id));
      const deletedRelationships = document.document.relationships
        .map((relationship, index) => ({ index, record: relationship }))
        .filter(({ record }) => deletedIds.has(record.sourceId) || deletedIds.has(record.targetId));
      const oldSiblings = siblings(document, root.parentId).filter((node) => node.id !== root.id);
      const siblingOrders = oldSiblings.map((node) => ({ id: node.id, order: node.order }));

      candidate.document.nodes = nodes.filter((node) => !deletedIds.has(node.id));
      candidate.document.relationships = relationships.filter((relationship) =>
        !deletedIds.has(relationship.sourceId) && !deletedIds.has(relationship.targetId));
      setSiblingOrder(candidate.document.nodes, oldSiblings.map((node) => node.id));

      return succeed(
        candidate,
        {
          type: "internal.restoreSubtree",
          nodes: deletedNodes,
          relationships: deletedRelationships,
          siblingOrders,
        },
        { type: "node.deleteSubtree", nodeId: root.id },
      );
    }

    case "node.reparent": {
      const nodeFailure = checkId(command.nodeId, "nodeId", "node");
      if (nodeFailure) return nodeFailure;
      const parentFailure = checkId(command.parentId, "parentId", "node");
      if (parentFailure) return parentFailure;
      const node = findNode(document, command.nodeId);
      if (!node) return failure("NODE_NOT_FOUND", "Node does not exist.", { nodeId: command.nodeId });
      if (node.id === body.rootId) {
        return failure("ROOT_REPARENT_DISALLOWED", "The document root cannot be reparented.", { nodeId: node.id });
      }
      const newParent = findNode(document, command.parentId);
      if (!newParent) return failure("PARENT_NOT_FOUND", "Parent node does not exist.", { nodeId: command.parentId });
      if (newParent.id === node.id || collectSubtree(document, node.id).has(newParent.id)) {
        return failure("CYCLE_DETECTED", "A node cannot be moved under itself or one of its descendants.", {
          nodeId: node.id,
          parentId: newParent.id,
        });
      }

      const oldParentId = node.parentId;
      const oldIndex = node.order;
      const oldSiblings = siblings(document, oldParentId).filter((sibling) => sibling.id !== node.id);
      const targetSiblings = oldParentId === newParent.id
        ? oldSiblings
        : siblings(document, newParent.id);
      const index = command.index === undefined ? targetSiblings.length : command.index;
      if (!checkIndex(index, targetSiblings.length, true)) {
        return failure("INVALID_SIBLING_INDEX", "Move index must be between zero and the destination sibling count.", {
          parentId: newParent.id,
          index,
        });
      }
      const targetIds = targetSiblings.map((sibling) => sibling.id);
      targetIds.splice(index, 0, node.id);
      const candidateNode = findNode(candidate, node.id);
      candidateNode.parentId = newParent.id;
      setSiblingOrder(nodes, targetIds);
      if (oldParentId !== newParent.id) {
        setSiblingOrder(nodes, oldSiblings.map((sibling) => sibling.id));
      }
      if (oldParentId === newParent.id && index === oldIndex) {
        return succeed(candidate, null, null, false);
      }
      return succeed(
        candidate,
        { type: "node.reparent", nodeId: node.id, parentId: oldParentId, index: oldIndex },
        { type: "node.reparent", nodeId: node.id, parentId: newParent.id, index },
      );
    }

    case "node.reorderSibling": {
      const idFailure = checkId(command.nodeId, "nodeId", "node");
      if (idFailure) return idFailure;
      const node = findNode(document, command.nodeId);
      if (!node) return failure("NODE_NOT_FOUND", "Node does not exist.", { nodeId: command.nodeId });
      const currentSiblings = siblings(document, node.parentId);
      if (!checkIndex(command.index, currentSiblings.length, false)) {
        return failure("INVALID_SIBLING_INDEX", "Reorder index must identify a final sibling position.", {
          nodeId: node.id,
          index: command.index,
        });
      }
      if (node.order === command.index) return succeed(candidate, null, null, false);
      const orderedIds = currentSiblings.map((sibling) => sibling.id);
      orderedIds.splice(node.order, 1);
      orderedIds.splice(command.index, 0, node.id);
      setSiblingOrder(nodes, orderedIds);
      return succeed(
        candidate,
        { type: "node.reorderSibling", nodeId: node.id, index: node.order },
        { type: "node.reorderSibling", nodeId: node.id, index: command.index },
      );
    }

    case "relationship.add": {
      for (const field of ["sourceId", "targetId"]) {
        const endpointFailure = checkId(command[field], field, "node");
        if (endpointFailure) return endpointFailure;
        if (!findNode(document, command[field])) {
          return failure(field === "sourceId" ? "SOURCE_NODE_NOT_FOUND" : "TARGET_NODE_NOT_FOUND",
            field === "sourceId" ? "Source node does not exist." : "Target node does not exist.",
            { nodeId: command[field] });
        }
      }
      if (command.sourceId === command.targetId) {
        return failure("SELF_LINK_DISALLOWED", "Self-links are not allowed in schema version 1.", {
          nodeId: command.sourceId,
        });
      }
      if (command.direction !== DIRECTION.DIRECTED && command.direction !== DIRECTION.UNDIRECTED) {
        return failure("RELATIONSHIP_DIRECTION_INVALID", "Direction must be directed or undirected.");
      }
      const idResult = chooseId(document, command, "relationship", options);
      if (idResult.error) return idResult.error;
      relationships.push({
        id: idResult.id,
        sourceId: command.sourceId,
        targetId: command.targetId,
        direction: command.direction,
        label: command.label,
      });
      return succeed(
        candidate,
        { type: "relationship.remove", relationshipId: idResult.id },
        {
          type: "relationship.add",
          id: idResult.id,
          sourceId: command.sourceId,
          targetId: command.targetId,
          direction: command.direction,
          label: command.label,
        },
      );
    }

    case "relationship.update": {
      const idFailure = checkId(command.relationshipId, "relationshipId", "relationship");
      if (idFailure) return idFailure;
      const index = findRelationshipIndex(document, command.relationshipId);
      if (index < 0) {
        return failure("RELATIONSHIP_NOT_FOUND", "Relationship does not exist.", { relationshipId: command.relationshipId });
      }
      const hasLabel = hasOwn(command, "label");
      const hasDirection = hasOwn(command, "direction");
      if (!hasLabel && !hasDirection) {
        return failure("RELATIONSHIP_UPDATE_EMPTY", "Supply a label, direction, or both.", {
          relationshipId: command.relationshipId,
        });
      }
      const previous = document.document.relationships[index];
      const next = {
        ...previous,
        ...(hasLabel ? { label: command.label } : {}),
        ...(hasDirection ? { direction: command.direction } : {}),
      };
      if (next.label === previous.label && next.direction === previous.direction) {
        return succeed(candidate, null, null, false);
      }
      relationships[index] = next;
      return succeed(
        candidate,
        { type: "relationship.update", relationshipId: previous.id, label: previous.label, direction: previous.direction },
        { type: "relationship.update", relationshipId: previous.id, label: next.label, direction: next.direction },
      );
    }

    case "relationship.remove": {
      const idFailure = checkId(command.relationshipId, "relationshipId", "relationship");
      if (idFailure) return idFailure;
      const index = findRelationshipIndex(document, command.relationshipId);
      if (index < 0) {
        return failure("RELATIONSHIP_NOT_FOUND", "Relationship does not exist.", { relationshipId: command.relationshipId });
      }
      const removed = document.document.relationships[index];
      relationships.splice(index, 1);
      return succeed(
        candidate,
        { type: "internal.restoreRelationship", index, record: removed },
        { type: "relationship.remove", relationshipId: removed.id },
      );
    }

    default:
      return failure("UNKNOWN_COMMAND", "Command type is not supported.", { commandType: command.type });
  }
}

function applyInternalAction(document, action, trustedInput = false) {
  const invalidInput = trustedInput ? null : validateInputDocument(document);
  if (invalidInput) return invalidInput;
  const candidate = cloneDocument(document);

  if (action.type === "internal.restoreRelationship") {
    if (entityExists(document, action.record.id)) {
      return failure("HISTORY_CONFLICT", "Cannot restore a relationship whose ID is already present.", {
        relationshipId: action.record.id,
      });
    }
    if (!checkIndex(action.index, candidate.document.relationships.length, true)) {
      return failure("HISTORY_CONFLICT", "Relationship restore position is invalid.", {
        relationshipId: action.record.id,
      });
    }
    candidate.document.relationships.splice(action.index, 0, { ...action.record });
    return succeed(candidate, null, null);
  }

  if (action.type === "internal.restoreSubtree") {
    const restoredIds = new Set(action.nodes.map(({ record }) => record.id));
    for (const { record } of action.nodes) {
      if (entityExists(document, record.id) || record.id === document.document.id) {
        return failure("HISTORY_CONFLICT", "Cannot restore a node whose ID is already present.", { nodeId: record.id });
      }
    }
    for (const { record } of action.relationships) {
      if (entityExists(document, record.id) || restoredIds.has(record.id)) {
        return failure("HISTORY_CONFLICT", "Cannot restore a relationship whose ID is already present.", {
          relationshipId: record.id,
        });
      }
    }

    for (const { index, record } of action.nodes.slice().sort((left, right) => left.index - right.index)) {
      if (!checkIndex(index, candidate.document.nodes.length, true)) {
        return failure("HISTORY_CONFLICT", "Node restore position is invalid.", { nodeId: record.id });
      }
      candidate.document.nodes.splice(index, 0, { ...record });
    }
    for (const { index, record } of action.relationships.slice().sort((left, right) => left.index - right.index)) {
      if (!checkIndex(index, candidate.document.relationships.length, true)) {
        return failure("HISTORY_CONFLICT", "Relationship restore position is invalid.", { relationshipId: record.id });
      }
      candidate.document.relationships.splice(index, 0, { ...record });
    }
    for (const { id, order } of action.siblingOrders) {
      const node = findNode(candidate, id);
      if (!node) return failure("HISTORY_CONFLICT", "Sibling to restore does not exist.", { nodeId: id });
      node.order = order;
    }
    return succeed(candidate, null, null);
  }

  return executePublicCommand(document, action, {}, trustedInput);
}

/** Execute one immutable document command. ID generation is opt-in via options.idFactory(kind). */
export function applyCommand(document, command, options = {}) {
  const result = executePublicCommand(document, command, options);
  if (!result.ok) return result;
  return { ok: true, document: cloneDocument(result.document), changed: result.changed };
}

// History uses the prepared inverse/forward actions but keeps those details out of the public result.
// The history owns `document` and validated it when it was created or last changed, so it is not re-validated per edit.
export function executeCommandForHistory(document, command, options = {}) {
  return executePublicCommand(document, command, options, true);
}

export function applyHistoryAction(document, action) {
  return applyInternalAction(document, action, true);
}
