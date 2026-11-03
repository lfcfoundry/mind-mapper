# Mind Mapper — Proposed Architecture

Technical choices below are proposals; approved product direction is captured in [Product Requirements](PRODUCT-REQUIREMENTS.md).

## Rules

1. The serialized document, not canvas pixels or positions, is the source of truth.
2. Parent hierarchy and cross-links have distinct rules and types.
3. Layout is a pure transformation of structure, measured boxes, options, and optional prior-layout hints.
4. Commands validate and commit changes. Rendering observes committed state and cannot mutate it.
5. Begin with browser APIs and a small number of modules. Add worker/GPU machinery only after measurement.
6. HTML is a build artifact; development code remains modular.

## Runtime boundaries

Intent from pointer/touch, keyboard, outline, and contextual controls flows to a command dispatcher. The dispatcher updates the document or view state, emits a revision event, and schedules persistence and render work. The document plus measurement cache feed layout; layout plus resolved styles feed a scene; Canvas draws it and a spatial index serves hit tests. Exporters consume structured data and layout, never scrape the live canvas.

### Separate modules immediately
- **Document model:** schema, validation, migration, ID and hierarchy indexes.
- **Commands/history:** command preconditions, atomic patch application, inverses, typing coalescing.
- **Layout:** radial/tree algorithms behind one contract.
- **View state:** active layout, viewport, folds, selection/focus, transient gestures.
- **Scene/rendering:** document/layout to scene, Canvas drawing, transform and hit-test adapter.
- **Persistence/serialization:** IndexedDB and native JSON adapters.
- **Interaction/app shell:** outline, controls, pointer/touch and keyboard.
- **Build:** deterministic bundling and HTML assembly.

These are seams, not a mandate for many packages. Avoid plugin registries, generic event-bus infrastructure, and a framework until a second real implementation needs them.

### Keep initially simple
One Canvas renderer; one text measurement cache; one command dispatcher; one compact inverse-patch history; a plain IndexedDB adapter; a small exporter interface. No general transaction framework beyond concrete command atomicity.

## Data, editing, history

Use flat node records keyed by stable ID: parentId and sibling order are explicit. Derive children/depth indexes; discard and rebuild them as needed. Cross-links are separate records, excluded from tree layout. The implemented v1 document currently has no style fields; a later version can add allowlisted formatting tokens. Resolve theme defaults, ancestor branch styles, then node overrides. Connector/relation styles resolve separately.

The implemented document command layer validates preconditions, builds a separate candidate, validates its resulting invariants, and returns it without mutating input. In-memory history stores inverse actions; subtree deletion retains only removed records, original array positions, and sibling orders needed for exact restoration. Failed commands do not change the document or history. Typing coalescing and UI/view-state history remain future work; fold/unfold is presentation state, while pan, zoom, hover, and selection are not document changes. User-facing undo can later present document and view commands in one order.

## Layout and geometry

The implemented layout module accepts a valid v1 document, explicit dimensions keyed by node ID, and tree/radial options. It derives children in stable sibling order, computes geometry without measuring text, and returns node rectangles, structural connector endpoints, and bounds. It excludes cross-links, canvas pixels, selection, and styling. Details and defaults are in [Layout Engine](LAYOUT-ENGINE.md).

- **Radial:** center the root and recursively allocate sibling sectors by subtree mass, reserving angular clearance for variable node footprints. Prior-layout stabilization is future work.
- **Directional tree:** use variable-size subtree breadth spans and per-depth primary-axis extents for left/right/top/bottom directions; preserve sibling order and prevent box overlap.
- **Future force/organic:** uses cross-links and prior positions but may be unstable; remains a view.
- **Future freeform:** saves positions in a named presentation layout; hierarchy remains unchanged.

Layout is deterministic for equal document semantics, dimensions, and options. The current engine recomputes fully and is iterative for deep trees. Incremental reflow is an optimization only after correctness and movement tests. Text measurement remains a separate component; a future Canvas 2D measurer can cache by text and resolved typography.

## Current browser integration

Increment 4 composes the engines through a testable editor controller, cached Canvas text measurement, pure viewport functions, and a Canvas renderer that consumes layout geometry directly. HTML provides inline editing, controls, and an outline capped at 80 nodes per page. Hit testing initially scans rectangles in reverse drawing order; a grid index remains deferred until measurement. See [Browser editor](BROWSER-EDITOR.md) for current behavior and verification limitations. The scene/index design below remains a future boundary, not a claim of implemented features.

## Scene, renderer, coordinates

Scene nodes and paths retain semantic IDs, geometry, resolved style tokens, text, and draw order. Use serializable path commands (move, line, cubic, close), not Path2D as the only representation. World coordinates are layout units. Viewport is scale and translation in CSS pixels; Canvas backing size is CSS dimensions times devicePixelRatio. Input points convert from client CSS coordinates to world coordinates using the inverse transform.

Start with a uniform grid spatial index for node boxes; filter candidates with exact geometry and reverse draw order. Tie index to scene generation and reject stale queries. Add edge index or R-tree only if measured at 10k. Coalesce motion to requestAnimationFrame. Redraw visible scene at first; optimize dirty layers only when evidence supports it.

Canvas needs an equivalent semantic route. The HTML outline is a projection of document and fold state keyed by node IDs, not a second tree that is edited independently. Essential actions work from it, with visible focus and predictable selection synchronization. The HTML Standard calls for equivalent focusable areas for interactive canvas regions: [Canvas fallback content](https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element). SVG guidance likewise says not to depend on mouse listeners alone: [SVG 2 interaction](https://www.w3.org/TR/SVG/interact.html).

## Interaction

### Desktop
Click selects; Enter/double-click edits; visible plus/context controls create nodes. Drag a selected node and drop on a node to reparent or between sibling anchors to reorder. Arbitrary positions are out of scope. Background drag pans. Wheel/trackpad zoom anchors to pointer. Modifier selection is supported; multi-select style/fold is safe, but branch reparent acts on one root at a time. Shortcuts are listed in menus.

### Android touch
Tap selects; contextual action sheet exposes edit/add/reparent/fold. One-finger drag on an unselected node only selects. After explicit selection, drag past threshold starts branch move. Empty-canvas drag pans. Two-finger pinch zooms. Second pointer cancels pending one-finger action. Stationary long-press may open context actions, but is cancelled once movement crosses pan/drag threshold. Highlight target before committing; invalid drop has no effect. Use large controls (target roughly 44 CSS px where feasible), system keyboard, and Done/Cancel with viewport correction.

Implement explicit gesture states: idle, pending tap, node drag, pan, pinch, long press, editing. Handle pointercancel, lost capture, second pointer, and app interruption. Verify on physical Android device; emulation is not evidence of phone ergonomics.

## Formatting

Sparse allowlisted values: font family/size/weight/alignment/emphasis; shape/fill/border/corners/padding; connector color/width/dash/arrow; relationship label typography. Branch style affects descendants; node overrides win; reset removes an override. Values are clamped and never interpreted as arbitrary CSS. Presets are later data, not a new style engine.

## Persistence and files

IndexedDB stores documents, metadata, and previous valid recovery snapshot. Writes are asynchronous and ordered by document revision. Debounce ordinary edits; never block editing on storage. On failure, keep in-memory work, show persistent unsaved status, retain last valid database copy, and offer JSON download. Recovery validates/migrates before replacing active state. A newer pending recovery record is presented for explicit recovery/duplicate. pagehide flush is best effort, not a guarantee.

IndexedDB is origin-scoped and can be quota-limited or evicted. See [MDN IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API#storage_limits_and_eviction_criteria). Test file-origin behavior per browser. Do not run persistence inside a worker in Core. Open via user-initiated file input; download JSON by Blob/object URL. ID collision prompts open-as-copy or replace-after-backup; never silently overwrite.

## Single-file build

Use modular sources and a pinned build tool once implementation begins. Inline code, CSS, icons and necessary assets into HTML. Keep readable and release outputs. Scan built HTML for external resources and runtime imports; build twice under normalized environment to check determinism. First release needs no runtime decoder. Embed a font only after licensing and glyph fallback review. Workers/OffscreenCanvas stay deferred; if introduced later, inline worker source at build time, retain main-thread fallback, and test CSP and file-origin behavior. [OffscreenCanvas documentation](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).

## Alternatives and decisions

| Concern | Alternatives | Recommendation |
|---|---|---|
| Renderer | SVG DOM, Canvas 2D, WebGL/WebGPU | Canvas 2D for dense view plus HTML semantics; SVG for export. GPU is premature without benchmarks. |
| History | Whole-document snapshots, inverse patches | Patches for undo proportional to edits; snapshots only as persistence checkpoints. |
| Persistence | localStorage, IndexedDB, manual JSON only | IndexedDB recovery plus explicit JSON user backup; localStorage is synchronous and JSON-only lacks automatic recovery. |
| Layout | fixed radial, external graph toolkit, app layout contract | Own the boundary; selectively adapt proven algorithms without adopting their model. |
| Worker | worker now, main-thread then profile | Main-thread Canvas first; worker complicates file-origin and fallback behavior. |
| Build | manual concatenation, bundler, runtime modules | Modular source plus deterministic local bundler; inline all runtime content. |

## Main risks

Cross-links can clutter the map; radial fan changes can shift whole branches; font fallback changes text geometry; touch drag competes with pan; IndexedDB can fail/evict; accessible outline can drift; duplicate scene/document buffers can inflate memory. Mitigate with secondary cross-link styling, movement benchmarks, actual-device tests, a single state projection, storage failure UX, and memory counters. Do not claim mobile limits before measuring.
