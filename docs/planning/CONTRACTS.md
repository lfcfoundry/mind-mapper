# Mind Mapper — Data and Module Contracts

The v1 document shape and validator behavior are specified in [Document Model](DOCUMENT-MODEL.md). The transactional document command API and in-memory history implemented in Increment 2 are specified in [Command System](COMMAND-SYSTEM.md). Layout, rendering, style, view-state commands, and persistence contracts below remain proposals unless stated otherwise.

## Proposed future native JSON workflow

The v1 native JSON envelope is defined in [Document Model](DOCUMENT-MODEL.md). Do not use the following earlier sketch as the current schema; it records future product concepts that may require a later versioned extension.

    {
      "format": "lfcfoundry.mindmap",
      "schemaVersion": 1,
      "document": {
        "id": "opaque stable id",
        "title": "Untitled map",
        "createdAt": "ISO-8601 UTC",
        "updatedAt": "ISO-8601 UTC",
        "rootId": "node id",
        "nodes": [],
        "relationships": [],
        "presentation": {}
      }
    }

Document identity remains stable across autosave. Duplicate creates a new document ID and remaps node/relation IDs consistently. IDs are UUID-like opaque identifiers, not secrets: prefer crypto.randomUUID, fall back to injected ID factory plus collision check. Timestamps are metadata, not semantic order.

### Future node extensions

    {
      "id": "node id",
      "parentId": null,
      "order": 0,
      "content": { "kind": "plain", "text": "Central topic" },
      "branchStyle": {},
      "styleOverrides": {},
      "metadata": {}
    }

The implemented v1 node stores plain text in `label`; it does not yet store `content`, styles, or metadata. Future rich text, style inheritance, and metadata require an explicitly versioned schema extension. The v1 hierarchy invariants and sibling ordering rules are documented in [Document Model](DOCUMENT-MODEL.md).

Root cannot be deleted or reparented. Deleting non-root removes entire subtree plus all links touching deleted IDs. Reparenting to self/descendant is rejected; moving a branch preserves internal order and links.

### Future relationship presentation fields

    {
      "id": "relationship id",
      "sourceId": "node id",
      "targetId": "node id",
      "direction": "undirected",
      "label": "related to",
      "styleOverrides": {}
    }

The implemented v1 relationship uses `direction` (`directed` or `undirected`) for semantic direction and has no visual style field. Its endpoint, self-link, and duplicate rules are documented in [Document Model](DOCUMENT-MODEL.md). Presentation arrows remain a separate future renderer choice. Deleting a node with commands will remove incident links; reparenting does not alter links.

## Validation and migration

The implemented validator reports structured errors without mutating input and rejects unknown fields, unsupported schema versions, invalid IDs, hierarchy faults, invalid labels, and relationship faults. Style tokens, metadata, migration, and warning behavior are future concerns. Never guess a repaired hierarchy.

Only schema version 1 is currently supported; no migration registry exists yet. Parsing rejects malformed JSON and invalid documents. Serialization validates first, rejects unknown fields, and emits stable property order without changing display labels or collection order. Unknown fields are not silently discarded. Future migrations must be deterministic and validate each result.

## View and selection state

Keep active layout/direction, folded IDs, viewport, selection, focus, layout hints, and transient gesture in view state, separate from structural document. Selection and gestures are not persisted in native JSON. Whether presentation defaults (folds/layout) travel with the JSON is open. Fold/unfold is undoable view state; pan/zoom/hover/selection are not. Deleting a node cleans its IDs from folds/selection. If selection is hidden by a fold, retain selected ID and focus fold control.

## Future dispatcher and view-command integration

The implemented document command API accepts intent payloads and produces immutable candidate documents. It does not assign document revisions, emit application events, schedule rendering/persistence, or manage selection. Those concerns belong in a later dispatcher. Its exact interface, operations, errors, and history behavior are specified in [Command System](COMMAND-SYSTEM.md).

The later app dispatcher may wrap results with revision and focus/selection hints after it composes document and view-state operations.

The following are implemented document command names; payload shapes are defined in [Command System](COMMAND-SYSTEM.md).

| Command | Semantics | Undo/focus |
|---|---|---|
| `node.addChild` | Insert under an existing parent; shift siblings at/after the insertion index. | Remove the inserted branch on undo. |
| `node.rename` | Replace a node's plain-text label; equal label is a no-op. | Restore previous label. |
| `node.deleteSubtree` | Delete a non-root subtree and every incident relationship; compact old siblings. | Restore deleted records, links, array positions, and sibling orders. |
| `node.reparent` | Move a whole non-root subtree; reject self/descendant/missing targets; compact/insert sibling sequences. | Restore original parent and order. |
| `node.reorderSibling` | Move a node to a final index under the same parent. | Restore prior index. |
| `relationship.add` | Add a unique-ID relationship with valid endpoints and v1 semantics. | Remove the added relationship. |
| `relationship.update` | Update label and/or semantic direction without changing hierarchy. | Restore previous relationship fields. |
| `relationship.remove` | Remove one relationship without changing hierarchy. | Restore the record at its original array position. |

No-op commands do not enter history. Failed commands do not mutate the document or either history stack. Typing coalescing, fold/style commands, selection hints, durable history, and application revision events remain future work. Presentation-only rendering work is not document content.

## Layout contract

The implemented v1 layout API, dimension validation, result/error shapes, orientations, and spacing defaults are specified in [Layout Engine](LAYOUT-ENGINE.md). It accepts the validated document and a separate dimensions object keyed by node ID; it returns deterministic node rectangles, structural connector endpoints, bounds, and warnings. Cross-links are excluded.

The earlier `visible`, `previous`, `invalidatedIds`, `generation`, and `reusedNodeIds` sketch is a future adapter direction, not part of the current engine. Fold filtering, prior-layout stabilization, incremental reflow, and layout statistics remain unimplemented.

## Current browser contracts

The browser controller, measured label sizing, viewport transformation, renderer, and HTML interaction contracts implemented in Increment 4 are documented in [Browser editor](BROWSER-EDITOR.md). The renderer currently consumes immutable layout geometry plus cached text lines directly. The generic scene contract below is a future proposal; no scene generation/index abstraction has been introduced yet.

## Measurement, scene and renderer contracts

    TextMeasure.measure(content, resolvedStyle, maxWidth)
      -> {width,height,lines}
    TextMeasure.invalidateNode(id)
    TextMeasure.invalidateFont(fontKey?)

    Scene = {
      generation,
      nodes: [{id,rect,text,style,drawOrder}],
      structuralEdges: [{id,fromId,toId,path,style}],
      relationships: [{id,fromId,toId,label,path,style}],
      bounds
    }

    Renderer.render(scene, viewport, dirtyIds?)
    Renderer.hitTest(screenPoint, viewport) -> {kind,id,worldPoint} | null
    Renderer.destroy()

Paths are serializable move/line/cubic/close commands. Text edit overlay receives ID, world rect, resolved style, and viewport; commit calls EditLabel for v1 plain-text nodes. Hit test index is generation-bound and exact-geometry checked. Outline is keyed projection, never second mutable tree. Coordinate transform: screen CSS point = scale × world point + CSS translation; canvas backing uses DPR. Resolve inverse before hit test.

## Style contract

Proposed v1 sparse allowlist: font token, size, weight, alignment, emphasis; node shape, fill token/color, border color/width, radius, padding; connector color, width, dash/arrow; relation label typography. Resolution order: theme defaults, root-to-node branchStyle, node styleOverrides. Relationship style resolves independently. Clamp values and fallback unknown tokens with warning; never execute document CSS. Presets are later catalog data.

## Persistence contract

    DocumentStore.list() -> Promise<DocumentSummary[]>
    DocumentStore.load(id) -> Promise<StoredDocument|null>
    DocumentStore.commit(id, revision, document) -> Promise<SaveResult>
    DocumentStore.duplicate(id, newId) -> Promise<void>
    DocumentStore.remove(id) -> Promise<void>
    DocumentStore.recover(id) -> Promise<RecoveryCandidate|null>
    DocumentStore.status() -> Promise<{available,error?}>

IndexedDB writes are ordered per document revision. Store last valid snapshot, revision/timestamp/size, and recovery candidate. Newer pending recovery is offered explicitly. On failure preserve memory state and prior valid record; show unsaved state and JSON backup. Storage exceptions do not reject editing commands. Native open validates/migrates before active replacement; ID collision prompts open-as-copy or replace-after-backup. Download is user initiated and uses Blob. Browser storage is recovery, not durable backup.

## Export contract

    Exporter = {
      id, label,
      capability: "semantic" | "visual" | "interactive",
      supports(document, options) -> {ok, losses?},
      export(document, layout, options)
        -> Promise<{filename,mimeType,blob,warnings[]}>
    }

Native JSON preserves supported semantics. OPML and FreeMind are semantic hierarchy exchange but lossy for unsupported links/styles/content; report losses. SVG/PNG/JPEG/PDF are visual only. Standalone HTML is interactive and embeds document/runtime version. Exporters consume document and layout, never canvas pixels or live DOM. Core exports native JSON first; add SVG next. PNG/JPEG rasterize vector/controlled export scene. PDF approach (print vs dependency) is deferred.
