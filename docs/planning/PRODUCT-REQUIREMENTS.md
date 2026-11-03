# Mind Mapper — Product Requirements

**Status:** proposed blueprint based on approved product direction. **Ingestion:** deferred.

## Product statement

LFCFoundry Mind Mapper is an offline-capable, self-contained browser app for creating, organizing, and presenting structured mind maps and knowledge maps. The visualization is the primary editing surface. A semantic HTML outline complements it for navigation and accessible operation.

A document has one root and a parent-child hierarchy: every non-root node has exactly one parent. Separately identified, labeled relationships may connect nodes but never change hierarchy, branch movement, or subtree membership. This is a mind mapper, not unrestricted diagramming software.

## Approved direction

- Desktop and Android mobile browsers are first-class targets.
- No required server, account, cloud service, or runtime network request.
- Automatic local browser recovery plus explicit native JSON open, save, download, and backup.
- Direct editing, branch reorganization, folding, undo/redo, keyboard and touch workflows, and formatting.
- Initial views: balanced radial and directional hierarchical tree.
- Canvas 2D for dense map drawing; HTML overlays for editors, controls, and semantic navigation.
- Modular source and reproducible build to one self-contained HTML file.
- No ingestion pipeline in this milestone.

## Users and workflows

Assume an individual organizing ideas or related knowledge, editing on desktop or phone. Team collaboration and synchronization are excluded initially.

Open/create a map; add and edit nodes; reorganize and fold branches; add optional cross-links; change layout and basic style; undo/redo; recover locally; download native JSON. A later phase may add visual exports and hierarchy interchange.

## Functional requirements

### Structure and editing
- One root, acyclic fully connected parent hierarchy, explicit sibling order.
- Cross-links have independent IDs, endpoint IDs, labels, optional style; they do not affect hierarchy.
- Create child, edit content, delete node/subtree, reparent/reorder, create/edit/delete relationship, fold/unfold, and undo/redo.
- Deleting a subtree removes all incident cross-links atomically.
- Reparenting moves the whole subtree and rejects self/descendant targets.
- Preserve selection/focus after edits when possible; define a fallback after deletion/folding.
- Desktop supports mouse, keyboard shortcuts, and contextual controls. Android supports touch-first pan, zoom, selection, and branch editing.
- Semantic outline supports equivalent navigation and essential actions.

### Layout, style, persistence
- Radial and configurable directional tree layouts; preserve sibling order and derive position from semantics.
- Theme defaults, branch/group inheritance, and node exceptions. Core controls may expose only a subset.
- Automatic browser recovery; visible failure state and native JSON backup always available.
- One-file HTML build with assets embedded and no runtime network dependencies.

## Nonfunctional requirements

- Validate at open and command boundaries; invalid commands do not partially mutate.
- Local storage failures never silently discard work or claim data was saved.
- Measure layout, render frame time, input latency, hit test, text measuring, and memory separately.
- Provide visible keyboard focus and a semantic route through the canvas content.
- Keep document/edit/layout/render contracts independently testable.
- Delivered artifact runs offline.

## Mind Mapper Core scope

Rooted hierarchy, optional cross-links, direct visual editing, child creation, branch reorganization, fold/unfold, undo/redo, radial and directional views, pan/zoom, basic inherited styles, local recovery, native JSON backup, desktop and Android interaction, semantic outline, and a single-file build.

### Deferred
Ingestion from websites, PDFs, office files, text, AI output, or external knowledge bases; cloud sync/collaboration; arbitrary diagram shapes; manual/freeform positioning; mixed per-branch layouts; timeline and force views; rich text beyond the initial content representation; broad third-party interchange; plugin systems; AI generation.

## Proposed success criteria

- A 1,000-node document with 1,000 cross-links can be edited, folded, laid out, saved, reopened, and backed up without semantic data loss.
- A 10,000-node stress fixture opens and navigates without a DOM element per node. This is not a product size promise until mobile measurements pass.
- Undo/redo of scripted edits restores canonical document and expected view state.
- Layout is deterministic for equal inputs and preserves sibling order.
- Android gesture tests distinguish tap/select, branch drag, background pan, and pinch zoom.
- Release HTML and readable build work offline, have no external runtime references, and behave equivalently.

## Assumptions and open points

- One editor at a time; multiple tabs must detect a newer revision rather than silently overwrite.
- Plain text is initial node content; v1 stores it directly in each node's `label` field. A future rich-text model requires a versioned schema change.
- Relationship direction modes and duplicate comparison are implemented in v1 as documented in [Document Model](DOCUMENT-MODEL.md). Fold/layout defaults in JSON, final performance gates, and minimum browser matrix remain open in [contracts](CONTRACTS.md) and [implementation plan](IMPLEMENTATION-PLAN.md).
