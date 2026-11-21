<!-- Copyright (c) 2026 LFC Foundry. MIT License. -->
# Mind Mapper large-map interaction test design

**Baseline:** main `8d644b5` (2026-11-07). Consult `AGENTS.md`, the visual design standard, `DOCUMENT-MODEL.md`, `COMMAND-SYSTEM.md`, `LAYOUT-ENGINE.md`, and `BROWSER-EDITOR.md` before changing code.

## Goal

Find scaling limits in the current session-only editor without changing the v1 model, command/history, deterministic layout, or visual standard. The layout suite’s 5,000-node case is correctness evidence, not an interaction-performance claim. Persistence and file UI are not implemented; do not measure or imply them.

## Test matrix

Generate deterministic maps of 10, 100, 1,000, and 5,000 nodes, then ramp only while the browser remains stable. Cross with a shallow wide tree, a deep chain, balanced tree, uneven branch sizes, long/multiline labels, non-ASCII labels, and a high-degree root. Use only valid documents and node dimensions for layout timing.

Run all five layouts, all four tree directions, and representative option boundaries. Measure validation, layout, text measurement, canvas draw, outline projection, and full redraw separately. Then exercise select, rename, add child, delete subtree, undo/redo, fit, pan, wheel/pinch zoom and outline page navigation. For each, record input-to-visible response, frames missed, maximum task, and memory where available. Repeat after label-only edits and layout switches to reveal stale text metrics or accidental whole-map rebuilds.

Cross viewport 320/390/768/1280 CSS px, DPR 1/2/3, desktop mouse/keyboard and physical touch separately. Include long text, browser zoom, text enlargement, forced colors, and keyboard-only use. Do not treat a DOM event shim as proof of physical gesture or accessibility acceptance.

## Invariants and gates

Every layout remains deterministic and nonmutating; the root, node order, and command results remain stable. Layout changes and pan/zoom do not enter document history. Canvas and paged HTML outline agree on node order, selection, root and labels. No label is silently dropped or clipped to win a timing test. Follow the visual standard for all affected Canvas and HTML states.

Use the existing focused tests, `npm test`, and `npm run build`; browser visual/device evidence must be recorded separately. Benchmark with generated fixtures, not real maps. Do not optimize before identifying which stage dominates. No incremental layout, scene cache, persistence, export, or new UI is authorized by this performance plan.
