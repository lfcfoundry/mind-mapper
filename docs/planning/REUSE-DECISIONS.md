# Mind Mapper — LFCFoundry Reuse and Licensing

Read-only review of source, tests, manifests, and license headers. Existing checks/performance figures were not rerun.

| Component | Actual capability/API and evidence | Decision |
|---|---|---|
| JS-modules netflow-hierarchy | Global/CommonJS NetflowHierarchy.layout(view, graph, options), tree/radial/radial-cluster/indented plus treemap, sunburst, icicle, pack; optional scene(layout, options, NetflowScene). MIT, no page/DOM. README reports 925 checks and d3-hierarchy comparisons through 100k nodes. | Do not use as document model or directly as editor engine. It derives tree from graph links/groups; product hierarchy and sibling order are authoritative. Study algorithm/geometry; adapter or extraction only after tests show fit. Desktop data is not Pixel evidence. |
| JS-modules netflow-engine | NetflowEngine.build(graph, options), graph views and force/stress arrangements, optional addons and embedded Wasm fallback. MIT, about 212 KB source. Tests and 100k graph benchmark documented. | Do not ship wholesale. General graph semantics and unrelated compute add weight and coupling. Use benchmark methodology as reference. |
| JS-modules netflow-scene | NetflowScene.make(layout, options), typed drawing lists, styling, SVG, node/edge/label pick, rectangle/lasso selection and hit helpers. MIT, about 122 KB; tied to Netflow layout. | Do not ship wholesale. Use ID-based scene and hit-testing ideas as reference; create smaller scene contract. |
| netflow-scene-index + elias-fano | Optional Morton/Elias-Fano index for pick/box selection at 100k to 1,048,576 nodes; depends on elias-fano. README reports tests through 1M in three desktop browsers. | Defer. Start with app-local uniform grid for 1k/10k and measure. |
| story-editor packages/story-map | ESM layoutStory/toSvg plus layered, arc, matrix, shape algorithms, metrics. Story-format model dependency; no third-party runtime dependency; dist ESM about 57 KB; MIT. Node tests check SVG and parity on 60 generated stories. README says thousands, not huge, was target. | Reference/possible algorithm source, not a direct product dependency. It is story-specific, fixed-dimension in its wrapper, and has fixed views. Extract only a tested algorithm if justified. |
| JS-modules save-kit | Global/CommonJS SaveKit. Large mode is constructed with createLarge({name,schema,defaults,lock?}); exposes async load/save, onOtherTab, claim/onLost, clear/close. It validates schema fields, retains a backup slot, and uses IndexedDB. MIT. README records Chromium/Firefox/WebKitGTK testing and large-save measures. | No direct dependency initially. Multi-document revisions/recovery need app-specific store. Reuse validation and backup lessons only if API fit is proven. README reports WebKitGTK file-origin blob-worker DB caveat; keep persistence on page thread. |
| JS-modules single-file-tools | Optional font/SVG optimization and compression; some stages need fonttools, svgo, Zopfli, minifiers. MIT. | Optional build-time only. First output ordinary self-contained HTML without runtime decoder. Preserve font notices if embedding. |
| story-editor editor/build.py | Existing modular-source-to-one-HTML workflow, embeds assets, uses esbuild for part of build and Python stdlib. | Reuse pattern, not script; no coupling to story-editor or its dirty checkout. |
| netflow-map | Full graph-analysis single-file app: Canvas/WebGL, background layout, selection, styles, exports and large-map work. | Research reference only. Do not copy app or its graph-centric state. |

## Integration boundary

Any future algorithm adapter accepts explicit parent IDs and sibling order, translates to library inputs, and maps output by stable ID. It must not let a library infer/replace parentage, reorder siblings, drop cross-links, or mutate document. No remote runtime loading. Reused code retains applicable MIT copyright/license notices in source distribution and shipped artifact.

The workspace modules are generally global/CommonJS single files; story-map is ESM. Exact companion APIs must be reviewed before bundling. Do not assume a module's zero-dependency status means no integration cost.

## Licensing/provenance

Reviewed LFCFoundry module headers/manifests and repository MIT license files. MIT reuse requires retaining copyright and license text. Third-party projects mentioned in benchmarks were not reviewed as dependencies and are not approved. Before adding any dependency, record exact version, transitive code, license/notices, browser support, bundle cost, and reason.

## Evidence limits

Verified in source: graph-walk is CSR traversal/analysis, not layout/spatial rendering; netflow-scene exports SVG and hit-tests its own scene; story-map assumes story model; save-kit large mode uses IDB. Existing docs report unit/browser tests and large desktop benchmarks. Not established: Android Chrome latency/memory, file-origin IDB consistency, accessible inline editing, or layout stability under frequent edits. No tests or benchmarks were run for this planning task.
