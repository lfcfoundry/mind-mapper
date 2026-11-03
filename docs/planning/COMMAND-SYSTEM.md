# Mind Mapper Command System

This reference describes the implemented rendering-independent v1 document commands and in-memory undo/redo layer. Commands do not touch the DOM, layout, renderer, view state, or persistence.

## API and results

```js
import { applyCommand, createCommandHistory } from "../../src/js/commands/index.js";

const result = applyCommand(document, command, { idFactory });
const history = createCommandHistory(document, { idFactory });
history.execute(command);
history.undo();
history.redo();
```

`applyCommand` returns `{ ok: true, document, changed }` or `{ ok: false, error }`. Errors contain a stable `code`, a readable `message`, and relevant `nodeId`, `relationshipId`, `entityId`, `path`, or `field` details. Validation failures also include `validationErrors`. Ordinary invalid operations return errors; they do not throw. Supplying an invalid initial document to `createCommandHistory`, an invalid generator option, or throwing from the generator is a programmer/configuration error and throws.

The command layer validates its input document, checks command preconditions, builds a separate candidate document, validates the candidate with the v1 validator, and only then returns it. It never mutates the caller's document. `createCommandHistory` also clones the initial document and returns clones from `getDocument`, `execute`, `undo`, and `redo`; caller changes to one returned result cannot alter history's internal state or other returned documents.

## Supported command payloads

| Type | Fields | Behavior |
|---|---|---|
| `node.addChild` | `parentId`, `label`, optional `id`, optional `index` | Adds one child. An omitted index appends. |
| `node.rename` | `nodeId`, `label` | Changes the plain-text label; the root may be renamed. |
| `node.deleteSubtree` | `nodeId` | Deletes a non-root node, all descendants, and every relationship incident to those nodes. |
| `node.reparent` | `nodeId`, `parentId`, optional `index` | Moves the whole non-root subtree; rejects self/descendant targets. |
| `node.reorderSibling` | `nodeId`, final `index` | Reorders within the existing parent without changing parentage or IDs. |
| `relationship.add` | `sourceId`, `targetId`, `direction`, `label`, optional `id` | Adds an independent relationship; v1 endpoint, label, direction, self-link, and duplicate rules apply. |
| `relationship.update` | `relationshipId`, at least one of `label` or `direction` | Updates only the supplied fields. |
| `relationship.remove` | `relationshipId` | Removes that relationship only. |

Unknown command fields are rejected to catch misspellings. Node and relationship IDs share the v1 document-wide uniqueness namespace. A supplied ID is never overwritten. If an add command omits its ID, `options.idFactory(kind)` must synchronously return one (`kind` is `"node"` or `"relationship"`). Without an ID or factory, the command fails with `ID_GENERATOR_REQUIRED`. The command layer has no ambient random generator, so callers control and can test ID generation.

## Sibling ordering

Indexes refer to the final position in the sibling list, starting at zero. For add and reparent, a valid insertion index ranges from zero through the destination sibling count; for same-parent reparenting, count after removing the moved node. Omission appends. Insertion shifts existing destination siblings right. Moving/reordering removes the node from its source list, inserts it at the requested final index, and compacts the remaining source siblings. Reparent without an index appends to the destination. Node collection array positions are not identity and are not used as sibling positions.

## Error codes

Command/precondition codes are `COMMAND_INVALID`, `UNKNOWN_COMMAND`, `COMMAND_FIELD_UNKNOWN`, `INVALID_DOCUMENT`, `INVALID_ID`, `ID_GENERATOR_REQUIRED`, `DUPLICATE_ID`, `PARENT_NOT_FOUND`, `NODE_NOT_FOUND`, `RELATIONSHIP_NOT_FOUND`, `ROOT_DELETE_DISALLOWED`, `ROOT_REPARENT_DISALLOWED`, `CYCLE_DETECTED`, `INVALID_SIBLING_INDEX`, and `RELATIONSHIP_UPDATE_EMPTY`. Candidate validation returns the existing model codes, including `NODE_LABEL_INVALID`, `NODE_LABEL_EMPTY`, `NODE_LABEL_TOO_LONG`, `SOURCE_NODE_NOT_FOUND`, `TARGET_NODE_NOT_FOUND`, `RELATIONSHIP_DIRECTION_INVALID`, `SELF_LINK_DISALLOWED`, and `DUPLICATE_RELATIONSHIP`; see [Document Model](DOCUMENT-MODEL.md) for the complete validator code list. Undo/redo with no available entry returns `NOTHING_TO_UNDO` or `NOTHING_TO_REDO`. `HISTORY_CONFLICT` indicates an internal inverse no longer matches the state it should restore.

## Undo and redo

History stores inverse and forward actions, not full document snapshots. Rename, reorder, reparent, and relationship updates store the prior fields/position. Adding a record stores its corresponding removal; removing a relationship stores the removed record and array position. Subtree deletion stores only the deleted nodes and incident relationships with original array positions plus the surviving sibling orders needed to restore the exact document. Every undo and redo result is validated before history state advances.

Only changed, successful commands enter history. Failed commands leave the document and both stacks unchanged. A changed successful command after undo clears redo. Valid no-op commands return `changed: false`, create no history entry, and leave redo available. Undo/redo never mutate earlier documents returned to callers.

History exists only in memory and has no persistence, coalescing, selection hints, view-state operations, or configured entry cap. Its inverse data is proportional to the affected records for ordinary edits, but deleting a large subtree retains those records while that operation remains undoable. Commands currently clone and validate the complete document; incremental command/validation performance remains unmeasured.
