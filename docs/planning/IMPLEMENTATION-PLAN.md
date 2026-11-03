# Mind Mapper — Implementation and Verification Plan

No app source is included in this plan. Start only after blueprint and open product decisions are reviewed.

## Sequenced increments

### 0. Isolated repository and test fixture
Use the existing mind-mapper checkout. Establish the modular source skeleton, deterministic build, generated seeded fixtures, browser/device instructions, and notices. Acceptance: two builds byte-identical under normalized environment; artifact has no runtime URLs/imports; opens offline in desktop Chromium and Android Chrome.

### 1. Versioned model and validation
**Implemented:** v1 envelope, flat plain-text node records, root/parent/order invariants, directed and undirected cross-links, validation, native JSON parse/serialize, and structured errors. Tests cover valid/invalid roots, duplicate IDs, missing parents/endpoints, cycles, reachability, sibling order, link duplicate/self rules, Unicode normalization, unknown fields, round trip, and unsupported versions. The validator does not mutate or repair input.

**Deferred:** migration registry, formatting fields, richer metadata, active-document open workflow, and preservation/recovery UI. These need later increments; v1 rejects unknown fields and unsupported versions explicitly.

### 2. Atomic commands and history
**Implemented:** immutable add-child, rename, subtree-delete, reparent, sibling-reorder, relationship add/update/remove commands; v1 precondition and resulting-document validation; deterministic sibling insertion rules; explicit ID-factory injection; and in-memory undo/redo using inverse actions. Tests cover operation success/failure, atomicity, all operation inverses, subtree/link restoration, redo invalidation, and returned-document isolation.

**Deferred:** fold/style/view-state commands, selection hints, typing coalescing, application revision/event integration, persistent history, and property-generated command sequences. These depend on later view/editor work or measured need.

### 3. Measurement and layouts
**Implemented:** deterministic variable-size directional trees and radial tree geometry, with caller-supplied dimensions, node rectangles, structural connector endpoints, bounds, and structured errors. Traversals are iterative; dimensions are required; cross-links are excluded. Tests include generated 3,000-node deep, 1,200-node wide, and 5,000-node mixed trees.

**Deferred:** text measurement/cache, fold-filtered layouts, cross-link routing, prior-layout stabilization, incremental reflow, scene/render integration, and performance qualification. The larger fixture is correctness coverage, not a benchmark.

### 4. Scene, Canvas, outline
**Implemented in Increment 4:** Canvas rectangles/labels/connectors, DPR-aware transforms, pan/zoom/fit/reset, reverse-draw-order hit testing, selection, paged semantic outline, and keyboard hierarchy navigation. Node tests exercise geometry/controller contracts. Browser verification has no successful result yet; see [Browser editor](BROWSER-EDITOR.md).

**Deferred:** separate scene generation, spatial grid/edge index, folding, and large-map qualification.

### 5. Desktop then touch editing
**Core subset implemented in Increment 4:** inline textarea commit/cancel, child creation, confirmed subtree deletion, history controls, keyboard shortcuts, and simple pointer tap/pan/pinch arbitration.

**Deferred:** reparent/reorder dragging, folding, contextual action sheets, physical Android usability and desktop visual verification. These remain separate from the implemented data command capabilities.

### 6. Basic formatting
Add theme, branch inheritance, node override/reset, small palette, shape/fill/border, connector and relationship label style. Test precedence and undo, preserve overrides, invalidate geometry only for typography/spacing changes. Review contrast/focus in light/dark themes.

### 7. Persistence and native JSON workflow
Implement multi-document IDB adapter, revision ordered autosave, recovery UI, quota/error messaging, open/download/duplicate/replace-with-backup. Fake storage fault tests: abort, quota, corrupt record, stale completion, rapid revisions, migration failure, collision. Real-browser test localhost and file-origin where available. Save failure retains current work and offers export. JSON round-trip preserves semantics.

### 8. Artifact qualification
Produce readable/release HTML, manifest and notices, correctness report and Android/desktop benchmark. Acceptance: no runtime external requests, deterministic build, offline open, license notices present, target browser correctness, results and known limits documented. Mark performance goals met only on measured evidence.

## Increment 4 visual-standard follow-up and release boundary

**Adopted:** [VISUAL-DESIGN-STANDARD.md](VISUAL-DESIGN-STANDARD.md) is mandatory repository-wide; root AGENTS.md and CLAUDE.md direct both coding agents to it. Current code now shares semantic palette roles between Canvas and generated CSS; root, solid selection, dashed editing, keyboard focus, and explicit errors have non-color cues. Token contrast and state-pattern tests support source-level review across all five layouts. Selection paging and active-edit selection guards are reconciled with the HTML outline.

**Verification status:** browser implementation remains unqualified for release. Compilation, Node tests, palette calculations, and source review are not actual visual/device/accessibility verification. Native confirmations retain platform styling. Keep physical Android gestures/software keyboard, desktop keyboard/visual checks, screen-reader use, text enlargement/forced colors, and offline file-origin checks pending until recorded results exist.

**Next release-readiness task:** run the repeatable browser harness and manual matrix in [BROWSER-EDITOR.md](BROWSER-EDITOR.md), preserve reports with environment/origin details, and correct observed failures before adding new editor features. Later release work still includes the planned recovery/file workflow and measured performance qualification.

## Benchmark protocol

### Seeded profiles
- 1k nodes, mixed depth/breadth and multilingual short/multiline labels, 1k cross-links, folds and style overrides.
- 10k nodes, 10k cross-links, broad-root and deep-chain stress cases, variable labels and 20% folded branches.
Keep generator, seeds, and serialized inputs fixed.

### Environments
Android physical Pixel 7 Pro: record OS/Chrome versions, DPR/orientation, thermal/battery conditions. Test local file and localhost separately. Desktop: record OS, CPU/RAM, browser/version, refresh rate/DPR. Five warmup runs; at least 30 timed operations; repeat cold-start five times. Preserve raw samples. Report p50, p95, max, dropped frames, environment and failures.

### Measurements, separate by stage

| Job | Measure |
|---|---|
| Initial radial/tree layout | p50/p95 from prepared model + measurements to LayoutResult at 1k/10k. |
| Incremental add/reorder/reparent | command, affected layout, scene/index update separately; nodes visited/repositioned and movement. |
| Pan/zoom | input-to-next-frame and frame intervals over 10s; p50/p95 and intervals over 16.7/33 ms. |
| Hit test | 1,000 seeded known-answer node/edge queries; p50/p95 and candidate count. |
| Text measurement | cold/warm timings, number measured, cache hit ratio, invalidation cases. |
| Render | scene-build time, Canvas draw time, frame intervals separately; count visible objects/draw calls. |
| Memory | JS heap after open/layout/idle/edit/history/reopen; process memory if available; report document, scene, index, history, cache and stored size separately. |
| Persistence | serialization, IDB commit, open/recovery, JSON download separately; rapid-edit failure behavior. |

Use performance.now for named stage durations. Use requestAnimationFrame timestamps/traces for frame intervals; a quick draw function is not proof of presentation time. Android results under warm/thermal throttling are labeled. Keep raw JSON/CSV and scripts.

### Hypothesis gates, not promises

Previous proposals—p95 layout <250 ms at 1k and <2 s at 10k; pan p95 ≤16.7 ms at 1k and ≤33 ms at 10k on Pixel; local edit p95 <100/250 ms; hit test <1 ms at 10k; memory +100 MB at 10k—are **unvalidated hypotheses**. Run baseline first, then approve numeric release budgets. Report refresh rate and unavailable memory metrics.

## Automated and manual verification

- Unit: validation/migration, commands/inverses, styles, layout geometry, transforms, serialization.
- Property/fuzz: random trees, command sequences, malformed bounded JSON; invariants after accept/reject.
- Browser integration: editor/outline parity, text input, gestures, persistence, download, offline artifact.
- Real device: touch ambiguity, Android keyboard/viewport, closure/recovery, screen-reader/keyboard route where tools permit.
- Performance: separate report, stable fixtures, environment and raw samples; avoid brittle single-run CI thresholds.

## Critical design review

**Overengineering:** no plugin system, graph schema generalization, collaboration protocol, worker pool, GPU renderer, generic style language, large dependency set, or broad importer. Avoid many modules for conceptual seams.

**Bottlenecks/coupling:** full reflow and text measurement may create long tasks; caches risk stale geometry; scene/index/history/snapshots can multiply memory; cross-links may obscure hierarchy; outline can drift; an adapter may reorder/drop semantics. Instrument cache/index/history, key everything by stable IDs and generation, test adapter invariants, route links separately.

**Mobile/accessibility:** pan/drag ambiguity is highest UX risk; explicit select then drag is safer but adds a step. Pinch cancels pending one-finger action. Canvas outline needs parity, visible focus, relation discovery and reader testing. Test on phone, not emulation.

**Data loss:** IndexedDB quota, eviction, private mode, file origin and interrupted writes can defeat recovery. Maintain unsaved status and previous valid revision; JSON backup remains explicit. pagehide is not a durability mechanism.

**Licensing/dependencies:** do not ship graph modules wholesale. MIT-compatible copies retain notices. Fonts/assets need separate review. SaveKit is MIT but game-save API does not directly fit a multi-document store. No dependency is approved by benchmark mention alone.

## Open decisions before implementation

1. Should fold/layout defaults be embedded in native JSON or remain local view preferences?
2. Approve performance gates after baseline rather than treating hypotheses as promises.
3. Choose minimum browser matrix/version; Android Chrome is required.
4. Should undo history survive app closure? Proposal: no; persist document snapshots only.

The v1 model already represents both relationship direction modes and rejects duplicate relationships under the documented endpoint/label normalization rules. The later UI can decide how users choose direction without changing these document semantics.

## Exact first implementation order

1. Isolated app repo and deterministic one-file build skeleton.
2. Versioned document, validation, canonical JSON and migration tests.
3. Atomic commands, inverse history, coalescing and selection behavior.
4. Text measurement, radial/tree layouts, fold geometry and relation routing.
5. Canvas scene, transforms, grid hit testing and semantic outline.
6. Desktop editing, then Android touch state machine and real-device tests.
7. Basic style inheritance and controls.
8. IndexedDB recovery and native JSON workflows with fault injection.
9. Release artifact, browser/device correctness, benchmarks and limits report.

Ingestion, collaboration, AI generation, unrestricted diagramming, manual layouts, and broad interchange remain outside this sequence.
