# Mind Mapper v1 Document Model

This reference describes the implemented, version 1 data model. It is independent of rendering, layout, editing commands, persistence, and browser state.

## Schema shape

```json
{
  "format": "lfcfoundry.mindmap",
  "schemaVersion": 1,
  "document": {
    "id": "map-1",
    "title": "Example",
    "rootId": "n-root",
    "nodes": [
      { "id": "n-root", "parentId": null, "order": 0, "label": "Central topic" },
      { "id": "n-child", "parentId": "n-root", "order": 0, "label": "A branch" }
    ],
    "relationships": [
      { "id": "r-1", "sourceId": "n-root", "targetId": "n-child", "direction": "directed", "label": "supports" }
    ]
  }
}
```

The document body has no optional metadata fields in v1. Nodes and relationships are flat records; array position is not identity. The node array and relationship array retain their serialized order, while sibling sequence is defined by `order`.

## Identity and hierarchy

- Document, node, and relationship IDs are non-empty strings, at most 128 Unicode code points, with no outer whitespace or control characters.
- All IDs are unique across the whole document, including its document ID.
- `rootId` identifies the only node whose `parentId` is `null`. That root has sibling `order: 0`.
- Every other node has one `parentId` that identifies an existing node.
- The hierarchy is acyclic and every node is reachable from `rootId`.
- Sibling order is a non-negative integer, unique within a parent, and contiguous from zero. Root order is zero.
- Node labels and document titles are non-empty plain text. Node labels are limited to 10,000 Unicode code points; titles to 200. Display text is preserved as supplied; validation does not trim or normalize it.

The model validates hierarchy but does not perform reparenting, deletion, or sibling reordering. Future commands must preserve these invariants atomically.

## Cross-links

Each relationship has a globally unique `id`, existing `sourceId` and `targetId`, a plain-text `label`, and semantic `direction` equal to `directed` or `undirected`. Arrow drawing is presentation and cannot change `direction`. Self-links are rejected in v1. A relationship label must contain non-whitespace text and be at most 200 Unicode code points. The original label remains unchanged for display.

Duplicate detection uses this key:

1. Normalize the label to Unicode NFC, then trim outer whitespace. Keep comparison case-sensitive.
2. Include direction mode in the key.
3. For directed relationships, preserve source and target order. Reversing endpoints is a distinct relationship.
4. For undirected relationships, sort endpoint IDs lexically before comparison. Reversing endpoints is therefore a duplicate.
5. Include the normalized label. Different labels between the same endpoints remain valid.

Self-links are rejected before duplicate comparison. Validation does not rewrite relationship labels or endpoint order.

## Validation result

`validateDocument(value)` returns `{ valid, errors }` and does not repair or mutate input. Success has an empty `errors` array. Each error contains a stable `code`, a JSON-path-like `path`, and a human-readable `message`; `entityId` and rule-specific details such as `parentId`, `cycleIds`, `expectedOrder`, `actualOrder`, or `duplicateOf` are included when useful. Errors are collected deterministically in document traversal order. Unsupported schema versions are rejected before interpreting the body.

Implemented error codes:

- Envelope/identity: `DOCUMENT_INVALID`, `DOCUMENT_FORMAT_INVALID`, `SCHEMA_VERSION_INVALID`, `UNSUPPORTED_SCHEMA_VERSION`, `DOCUMENT_BODY_INVALID`, `DOCUMENT_ID_MISSING`, `DOCUMENT_ID_INVALID`, `DOCUMENT_TITLE_INVALID`, `ROOT_ID_MISSING`, `ROOT_ID_INVALID`, `ROOT_NOT_FOUND`, `ROOT_PARENT_INVALID`, `ROOT_COUNT_INVALID`, `MULTIPLE_ROOTS`.
- Fields and hierarchy: `UNKNOWN_FIELD`, `NODES_INVALID`, `NODE_LIMIT_EXCEEDED`, `NODE_INVALID`, `NODE_ID_INVALID`, `DUPLICATE_NODE_ID`, `DUPLICATE_ENTITY_ID`, `NODE_LABEL_INVALID`, `NODE_LABEL_EMPTY`, `NODE_LABEL_TOO_LONG`, `PARENT_ID_MISSING`, `PARENT_ID_INVALID`, `MISSING_PARENT`, `HIERARCHY_CYCLE`, `UNREACHABLE_NODE`, `SIBLING_ORDER_INVALID`, `DUPLICATE_SIBLING_ORDER`, `SIBLING_ORDER_GAP`.
- Relationships: `RELATIONSHIPS_INVALID`, `RELATIONSHIP_LIMIT_EXCEEDED`, `RELATIONSHIP_INVALID`, `RELATIONSHIP_ID_INVALID`, `DUPLICATE_RELATIONSHIP_ID`, `SOURCE_NODE_NOT_FOUND`, `TARGET_NODE_NOT_FOUND`, `RELATIONSHIP_DIRECTION_INVALID`, `RELATIONSHIP_LABEL_INVALID`, `RELATIONSHIP_LABEL_EMPTY`, `RELATIONSHIP_LABEL_TOO_LONG`, `SELF_LINK_DISALLOWED`, `DUPLICATE_RELATIONSHIP`.
- JSON API: `JSON_INPUT_INVALID`, `MALFORMED_JSON`.

Schema limits are 100,000 nodes and 500,000 relationships. Unknown fields are rejected instead of silently discarded. Validation returns errors; it never repairs malformed documents.

## JSON serialization and evolution

`serializeDocument(value)` validates before producing pretty-printed JSON with stable object property order. It preserves collection order and display labels. It returns `{ ok, json, errors }`; invalid input returns `ok: false`, `json: null`, and validation errors. `parseDocument(json)` parses and validates, returning `{ ok, document, errors }`; malformed JSON and invalid documents return `ok: false` and `document: null`.

Only schema version 1 is supported. No migration is implemented yet; unsupported versions fail explicitly and are never guessed or silently downgraded. Adding rich text, styles, metadata, or other semantic fields requires a versioned schema decision and migration tests. The model has no rendering, layout, persistence, or browser dependencies.

## Deliberate v1 limits

- Node content is a single plain-text `label`; rich text is future work.
- Document title is the only document metadata.
- There are no node, branch, or relationship style fields.
- Self-links are disallowed.
- There is no migration chain or unknown-field preservation.
- This layer has no editing commands, deletion behavior, indexes exposed to callers, or storage mechanism.
