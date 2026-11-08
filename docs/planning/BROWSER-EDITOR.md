# Browser visualization and core interaction

The browser entry now composes the v1 document, immutable command history, supplied-dimension layout engine, and Canvas 2D renderer. `browser/controller.js` owns selection and pending edits independently of the document. Every accepted label/add/delete change runs through history commands. Layout switches, pan, zoom, selection, and canceled edits create no document command.

`browser/measurement.js` wraps plain text with a supplied width function. The entry supplies actual Canvas `measureText` using the same system font as the renderer. Measurements are cached per node label and removed when nodes disappear. Label changes trigger fresh dimensions and a full layout; unchanged labels are reused. The renderer draws layout rectangles and connector endpoints and culls offscreen rectangles. Root, selected, and editing nodes have distinct restrained treatments.

World coordinates come from layout. CSS viewport coordinates equal world coordinates times zoom plus translation; browser client coordinates subtract the Canvas bounding rectangle first. DPR affects only backing pixels and the drawing transform, never hit testing or document geometry. Zoom is limited to 0.05–4, with pointer-focused wheel zoom. Fit may stop at the minimum zoom for very large maps. Reset centers the root at 100%. The renderer and hit test use identical draw order; the last drawn rectangle wins overlap/boundary ties. Hit testing is a linear rectangle scan.

## Portable qualification handoff

For a tester on another machine or an accessible Android device, use [START-HERE](../qualification/START-HERE.md) and the [results/checklist template](../qualification/RESULTS-TEMPLATE.md). After `npm run build`, `node scripts/prepare-qualification.mjs` prepares a new `dist/qualification-handoff/` containing the unchanged application HTML, portable instructions/template, an unchanged copy of the authoritative visual standard, and a checksum manifest. It excludes historical environment logs and private machine paths from the handoff. Existing package directories are never overwritten. This prepares qualification; it does not change the NOT RUN browser/device/visual/accessibility/offline results recorded below.

## User operations

Tap/click selects; empty-space tap clears selection. Double-click or the Edit label button opens an HTML textarea over the map. Save or Enter commits (Shift+Enter adds a line), Escape or Cancel cancels. Blank/invalid labels remain open with an error. Add child uses the selected parent and starts editing the new child. Delete branch requires confirmation and is disabled for the root. Undo and redo use the existing history engine.

Dragging past an eight-CSS-pixel threshold pans even when starting over a node; node movement is absent. A tap selects only on release. A second pointer starts pinch navigation and suppresses tap selection until all pointers lift. Cancellation/lost capture ends pending taps. `touch-action: none` and wheel prevention apply only to the map surface. The surrounding document and outline retain normal scrolling.

The Canvas is focusable with visible focus. Arrow keys navigate hierarchy/preorder; Home selects root, Enter/F2 edits, Insert adds, and Delete requests confirmed deletion. Ctrl/Command+Z and Shift+Z/Y undo/redo outside text inputs. Textarea native editing shortcuts remain intact. Buttons/selects have accessible labels, and live status reports selection/errors. The HTML outline has tree levels, sibling counts/order, selected state, and roving focus. It exposes at most 80 nodes per page, with paging controls; keyboard navigation can move across pages. Canvas rendering never creates an element for every map node.

## Build and verification

The dependency-free build-time bundler supports the named local ESM import/export syntax used by this project, rejects unsupported syntax/cycles, isolates modules in closures, and checks compiled syntax. No runtime imports, eval, external fonts, or resource requests are needed. The build test checks deterministic bytes, embedded resources, compiled JavaScript syntax, and no external runtime references.

Node tests cover coordinate conversion, pan/zoom anchors and limits, fit/DPR sizing, hit order, selection/navigation, all layout switches preserving document/history, edit commit/cancel/invalid input, add/delete/root protection, undo/redo, cached measurement invalidation, and renderer geometry immutability.

For repeatable browser checks, run `npm run build`, then `python3 scripts/browser-check-server.py`, and open `http://127.0.0.1:8766/browser-check.html`. Python uses only its standard library. The test page exercises the real DOM/Canvas in 360px and 1280px iframes and writes a local report to ignored `dist/browser-results.json` plus a Canvas capture. These are synthetic browser actions, not physical gesture or screen-reader testing.

During implementation Android Chrome was detected and launch intents were accepted, but the verification page returned no result; Android full-screen capture also failed. Actual visual, physical mobile gesture, software keyboard, screen-reader, desktop-browser, and offline file-origin behavior therefore remain unverified. Node/compilation checks do not establish those capabilities.

## Limits and next work

Edits live only in memory and are lost when the page closes/reloads; the page explicitly shows this. Native JSON APIs remain core-only, with no file workflow here. Cross-links are retained in the document but not rendered/edited. Reparent dragging, folding, formatting, multiple selection, search, persistence, and further layouts remain deferred. Layout and validation currently recompute synchronously; outline preparation and hit testing scan the document. No large-map performance or device usability targets have been measured. Rendering uses one scheduled animation frame per invalidation rather than a continuous loop; outline rebuilds occur on application changes, not pan/zoom frames.

## Binding visual standard and follow-up review

[VISUAL-DESIGN-STANDARD.md](VISUAL-DESIGN-STANDARD.md) is the mandatory authority for this editor and all future product surfaces. Codex and Claude Code instructions point to that document without restating a separate design language.

Source review found separate blue selection/focus and amber editing colors, pale boundaries, and state differentiation that relied too much on color. The follow-up introduces a neutral foundation and disciplined red emphasis from `browser/visual-tokens.js`. The build generates CSS custom properties from those same tokens; Canvas imports them. Root nodes use a neutral fill and heavier boundary, selection adds a solid inset frame, and editing adds a dashed frame plus an explicitly labeled editor. Outline selection adds weight and a thicker boundary. Keyboard focus remains a separate visible outline. Error messages now associate with the textarea and mark it invalid. Font metrics/wrapping and all layout geometry remain unchanged.

Two integration issues were corrected: application selection changes reveal the matching outline page while explicit paging remains possible, and Canvas double-clicks and outline clicks cannot change selection during an active edit. Root topics are named explicitly to assistive technology. Native `window.confirm` still uses browser/OS styling; replacing it with a custom accessible dialog is a separate bounded task if target-device review identifies a problem.

Automated checks calculate contrast for text and meaningful boundary/state token pairs, exercise root/selection/editing geometry and patterns in all five layouts, verify generated CSS tokens, and cover selection paging. These are source/logic checks. They do not verify rendered legibility, physical touch, or assistive technology. All these behavior gates remain pending until observable results exist.

### Repeatable acceptance procedure

1. Run `npm run check` and `python3 scripts/browser-check-server.py` from the repository root. If port 8766 is already used, stop the earlier verification server rather than replacing unrelated processes.
2. In an actual installed browser open `http://127.0.0.1:8766/browser-check.html`. Keep the tab active until it displays a pass/fail report; iframe load timeouts become failures. Check `dist/browser-results.json` for `passed: true`, environment details, and individual checks; retain `dist/browser-canvas.png` as Canvas-only evidence. A launch intent or server request alone is not a pass. Stop the server with Ctrl+C when finished.
3. Open the application itself and inspect all five layouts at narrow/mobile and wide/desktop sizes with short, long, multiline, and non-ASCII labels. Check root/boundaries/connectors, solid selection versus dashed editing, pointer and keyboard focus, error association, and outline agreement. Confirm selection on a node beyond the first 80-item page is revealed. Check ordinary and enlarged browser text, forced colors where supported, and that no Save/Cancel action is clipped.
4. Manually exercise tap versus drag, wheel anchoring, pinch, fit/reset, software keyboard, commit/cancel, add/delete confirmation and undo/redo. Use keyboard-only editing and a screen reader separately. Synthetic iframe actions do not cover physical gestures or establish desktop-browser behavior.
5. Copy the generated `dist/mind-mapper.html` to a location the target browser can open, open it directly as a local file, disconnect networking, and repeat the core flow. The localhost harness cannot establish offline/file-origin behavior. Record any restrictions or failures and the exact browser/version, OS/device, viewport/DPR, input method, origin, and checks actually completed.
6. Preserve a dated report and any permitted captures in ignored generated output (or attach them through the normal review process). Report untested entries explicitly; do not mark release-ready based only on a successful build or palette test.

Current verification boundary: no successful Android, desktop, physical gesture, screen-reader, or offline file-origin report is available. The prior Chrome launch/screen-capture attempt remains an unsuccessful verification attempt; this status must not be upgraded without observable results.

Follow-up environment attempt: installed Android Chrome was rechecked; no desktop browser executable, browser automation connector, or localhost DevTools endpoint was available. The local verification server started and Chrome accepted a launch intent, but no browser request/report was observed before the server was stopped. This is an unsuccessful verification attempt, not a browser test pass. The previous failed screen-capture result remains historical; no new capture or physical input testing was performed.

## Increment 5 qualification record — 2026-11-03

**Conclusion: NOT YET QUALIFIED.** This record evaluates the existing artifact; it does not expand the editor. Browser outcomes and automated regression outcomes are separate below. PASS means observed successful execution of the stated check; FAIL means an observed defect; NOT RUN means the required observation was unavailable/not attempted; PARTIAL means only a stated subset was observed. A launch intent, HTTP fetch, source inspection, or successful build is not a browser PASS.

### Artifact, environment, and evidence

- Repository: `https://github.com/lfcfoundry/mind-mapper.git`, branch `main`, HEAD `97eb3f99e1ba5cb25bf26f903df144ba4e970871`. The intentional uncommitted Increments 0–4 work was preserved.
- Artifact: `dist/mind-mapper.html`, 92,604 bytes, SHA-256 `e1d71c2a2c998e0edc36a4beacae81ee461673c398677bb00b3913ffb8fe83f4`.
- Execution environment: Termux on a device identifying as Pixel 7 Pro, Android release 17, aarch64; Node `v26.13.0`, Python `3.14.8`. These device/OS values came from `getprop`/`uname`, not a browser user agent.
- Desktop environment: no Chromium/Chrome/Firefox executable found in PATH or the checked Termux binary directory; no standard Playwright/Puppeteer browser caches or global packages; no DISPLAY/Wayland session reported; no browser/computer automation connector available.
- Android environment: package manager confirms `com.android.chrome` is installed. Its running browser version, viewport, and DPR were not observed. No responding DevTools endpoint was found at `127.0.0.1:9222`. Android `dumpsys window policy` returned `Can't find service: window`, so this session could not inspect the foreground browser UI.
- Setup attempt: the existing Python qualification server was started on `127.0.0.1:8766`; `am start -a android.intent.action.VIEW -d 'http://127.0.0.1:8766/browser-check.html?qualification=increment5' -p com.android.chrome` accepted the intent. That does not establish application execution.
- Independent Python HTTP requests received 200 for the artifact and harness. Their origin is explicitly recorded as Python transport checks, not browser traffic. `dist/increment5-environment.json` records the time, artifact hash, versions, response sizes, and this distinction. `dist/increment5-regression.log` contains the automated test/build output. Generated evidence stays ignored under `dist/`.
- The existing harness was reviewed: it runs synthetic DOM actions in 360px and 1280px iframes, samples root pixels, and exercises basic edits/history/layout selection. It cannot by itself establish physical touch, software-keyboard usability, visual acceptance, actual desktop-browser compatibility, native confirmation behavior, or offline operation. Layout-handler assertions alone do not establish connector/label readability in every layout.

The attempt ended at 22:43 UTC on 2026-11-03. Only the two explicitly identified Python HTTP requests were logged; no browser report returned. The user confirmed they could not access the device at that time. The server was stopped with Ctrl+C (the resulting KeyboardInterrupt is server shutdown, not an application defect). `dist/increment5-attempt-outcome.json` and `dist/increment5-server.log` retain this setup outcome. Manual/device results remain NOT RUN.

### Desktop browser matrix

Reason D0: no usable desktop-browser execution/observation environment was available. The 1280px iframe in the harness, if later run in Android Chrome, must not be reported as a desktop-browser test.

| Check | Status | Evidence / remaining observation |
|---|---|---|
| Initial load without runtime errors | NOT RUN | D0; need console/runtime observation. |
| Initial map visibility and framing | NOT RUN | D0; inspect the rendered artifact. |
| Controls labeled, visible, usable; no overflow/clipping | NOT RUN | D0; narrow/wide and enlarged-text inspection required. |
| Left-to-right tree | NOT RUN | D0; inspect placement, labels, connectors, root, selection. |
| Right-to-left tree | NOT RUN | D0; same observations. |
| Top-to-bottom tree | NOT RUN | D0; same observations. |
| Bottom-to-top tree | NOT RUN | D0; same observations. |
| Radial | NOT RUN | D0; same observations. |
| Short/long/multiline/non-ASCII label wrapping and legibility | NOT RUN | D0; inspect actual font rendering. |
| Node selection and empty-space deselection | NOT RUN | D0; verify Canvas and outline agreement. |
| Enter inline editing and commit | NOT RUN | D0; verify both painted label and outline update. |
| Cancel editing | NOT RUN | D0; prior label must remain. |
| Add a child | NOT RUN | D0; inspect geometry, selection, outline. |
| Delete non-root subtree through confirmation | NOT RUN | D0; exercise Cancel and confirmed deletion, descendants included. |
| Root deletion prohibited | NOT RUN | D0; inspect disabled control and keyboard path. |
| Undo/redo representative edits, additions, deletions | NOT RUN | D0; inspect restored content and structure. |
| Mouse pan | NOT RUN | D0; distinguish drag from click. |
| Wheel zoom and pointer anchoring | NOT RUN | D0; observe the topic under the pointer. |
| Fit | NOT RUN | D0; inspect usable framing. |
| Reset | NOT RUN | D0; root centered at 100%. |
| Viewport/layout operations preserve content and history | NOT RUN | D0; compare labels/outline/history before and after navigation. Node coverage is separate. |
| Hierarchy keyboard navigation | NOT RUN | D0; Up/Down, Left/Right, Home and cross-page navigation. |
| Editing/add/delete/history shortcuts and ordinary input shortcuts | NOT RUN | D0; exercise Enter/F2, Escape, Insert, Delete, undo/redo outside inputs. |
| Visible keyboard focus | NOT RUN | D0; inspect Tab traversal and Canvas focus without clipping. |
| Selection versus editing without color alone | NOT RUN | D0; inspect solid/dashed patterns in rendered UI. |
| Outline hierarchy, selection, and 80-item pagination | NOT RUN | D0; compare Canvas with paged HTML tree. |
| Meaningful live status announcements | NOT RUN | D0; verify text and assistive-technology behavior separately. |

### Android / touch matrix

Reason A0: Chrome is installed, but an executing, observable/controllable Android browser session was not established. Physical behavior cannot be inferred from Node tests or iframe dimensions.

| Check | Status | Evidence / remaining observation |
|---|---|---|
| Initial application load and framing | NOT RUN | A0; accepted launch intent is insufficient. |
| Tap selection/deselection and accidental activation | NOT RUN | A0; physical taps required. |
| Inline editing and virtual keyboard visibility | NOT RUN | A0; inspect focus, viewport resize, reachable Save/Cancel. |
| Child creation | NOT RUN | A0; verify physical control use and selected parent. |
| Commit and cancel | NOT RUN | A0; verify actual label and outline. |
| One-finger pan versus tap | NOT RUN | A0; inspect accidental selection and page scrolling. |
| Pinch zoom and gesture completion/cancellation | NOT RUN | A0; physical two-pointer input required. |
| Fit and reset | NOT RUN | A0; inspect framing after gestures. |
| All five layout switches | NOT RUN | A0; inspect each rendered layout and stable content. |
| Touch target size/separation and control accessibility | NOT RUN | A0; physical use, not CSS-size inference. |
| Narrow viewport, orientation changes, overflow/clipping | NOT RUN | A0; inspect actual browser viewport and keyboard states. |
| Scrolling outside map and gesture isolation inside it | NOT RUN | A0; physical page/map interaction required. |
| Subtree confirmation, undo/redo, root protection | NOT RUN | A0; native dialog and physical interaction required. |
| Screen-reader navigation and status | NOT RUN | A0; dedicated assistive-technology session required. |

### Offline artifact matrix

Reason O0: no observable browser session could open and exercise the standalone artifact. No network settings were changed and no local-file browser success is claimed.

| Check | Status | Evidence / remaining observation |
|---|---|---|
| Open actual generated artifact independently of server | NOT RUN | O0; record actual `file:`/`content:` origin and browser. |
| Load with network unavailable and server stopped | NOT RUN | O0; an HTTP fetch is not this check. |
| Select/edit/add/delete/undo/redo offline | NOT RUN | O0; exercise the actual standalone artifact. |
| No runtime external resource requests | NOT RUN | O0 for browser observation; static embedded-resource checks passed separately. |

### Rendered visual-standard acceptance

| Required visual finding | Status | Remaining evidence |
|---|---|---|
| Neutral foundation and disciplined red accent | NOT RUN | Actual rendered Canvas and HTML inspection. |
| Typography hierarchy, wrapping, and legibility | NOT RUN | Desktop/mobile fonts, zoom and enlarged text. |
| Root versus ordinary nodes | NOT RUN | Rendered neutral fill and heavier boundary. |
| Connector weight, attachment, and hierarchy clarity | NOT RUN | Inspect every layout with a nontrivial map. |
| Selection/editing/focus non-color distinction | NOT RUN | Rendered solid/dashed frames and keyboard focus. |
| Canvas/outline structural and selection agreement | NOT RUN | Manual selection and pagination observations. |
| Control hierarchy, spacing, confirmation, errors | NOT RUN | Actual interactive UI and native dialog inspection. |
| Mobile readability and keyboard/editor fit | NOT RUN | Physical device and virtual keyboard observation. |
| Minimal ornament and cross-layout consistency | NOT RUN | Full affected-interface visual review. |
| Forced colors and screen-reader accessibility | NOT RUN | Dedicated target-environment checks. |

There are no new rendered visual findings in this increment. The prior source-level visual-standard review and contrast tests remain useful automated evidence, but do not count as visual acceptance.

### Defects and corrections

No reproducible browser/application defect was directly observed, because browser execution could not be established. No application, model, command, layout, design token, or interaction code was changed. Environment-access limitations are not classified as product defects. If later testing exposes a defect, record environment, reproduction, expected/actual behavior, repeatability, smallest responsible component, bounded correction, regression, and re-test evidence before changing its status.

### Automated regression record (not manual/browser qualification)

| Check | Status | Direct evidence and limits |
|---|---|---|
| Complete existing Node suite | PASS | `npm run check` ran `npm test`: 122 tests, 122 passed, 0 failed. Includes existing model/command/layout and browser-independent tests; log in `dist/increment5-regression.log`. |
| Deterministic single-file packaging | PASS | Existing build test compares two output byte sequences and hashes, parses compiled script, verifies shared tokens and absence of external runtime resource references. This is artifact validation, not offline browser execution. |
| Build command | PASS | `npm run check` ran `npm run build` successfully and produced the artifact/hash recorded above. |

Final preservation checks: `git diff --check` completed successfully. File-hash comparison against the starting workspace found only this qualification-document update outside ignored generated output, no created/deleted source files, and unchanged `package.json`; no dependencies were installed. `git check-ignore -v` confirms the artifact and qualification evidence remain ignored under `/dist/`. Branch and HEAD remain as recorded. Existing model, command, and layout source files are byte-identical to their starting state.

### Precise remaining manual procedure

1. Start the existing server from the repository root with `python3 scripts/browser-check-server.py`. Open the qualification URL in an actual browser, keep it foreground, and retain the report only after it finishes. Read each assertion and its scope; a synthetic PASS remains separate from manual visual/gesture checks. Record browser/version, OS/device, CSS viewport, DPR, input method, origin, artifact SHA-256, and observation time.
2. Open `http://127.0.0.1:8766/mind-mapper.html` itself. Rename the root, add three branches and two deeper descendants, and use short, long, multiline, and non-ASCII labels. Inspect all five layouts individually against each visual matrix row. Record screenshots only when actually obtainable, plus specific findings; do not fill PASS from appearance inferred from code.
3. Exercise select, edit, Save, Cancel/Escape, add, and a confirmed non-root subtree deletion (first cancel the confirmation, then confirm). Undo and redo the deletion and label edits. Check the painted map, outline, selection, and live status after each operation. Root deletion must remain disabled/prohibited.
4. With one label edit as the last document command, pan, wheel/pinch zoom, change layout, fit, and reset. Check that content/outline remains unchanged. Undo should reverse the label edit rather than viewport changes. Check pointer-focused wheel zoom by keeping a recognizable topic under the pointer while zooming.
5. Use keyboard alone: Tab through controls and into Canvas/outline, navigate with arrows/Home, edit with Enter/F2, cancel with Escape, add with Insert, request deletion with Delete, and undo/redo outside inputs. Verify ordinary textarea shortcuts remain native. Create more than 80 nodes through repeated Add/Save actions and test Previous/Next plus selection crossing a page boundary. Do not infer screen-reader usability from keyboard success; run and record that separately.
6. On Android perform physical taps, small finger movements versus drags, one-finger pan, two-finger pinch and release/cancellation, layout switching, fit/reset, and software-keyboard editing. Check for accidental activation, selection loss, hidden editor actions, and scrolling inside/outside the map. Repeat in portrait/landscape and at enlarged text. Record physical-device results separately from synthetic iframe results.
7. For offline testing stop the server, then open the unchanged generated file directly. An existing Termux option is `termux-open --view --content-type text/html dist/mind-mapper.html`; choose an actual browser if offered. If that browser cannot handle the provider URI, the tester may copy the artifact through normal device file tools to an accessible Downloads location and open it there. Record whether the origin is `file:` or `content:` and any handler restriction. With network unavailable/offline mode active, verify actual load and core edits. Do not substitute the localhost harness or static source checks.
8. Fill each pending matrix entry with PASS/FAIL/PARTIAL only from the observations actually obtained, with evidence and reproduction details. Preserve generated reports/captures under ignored `dist/`. A browser unable to open the artifact is an observed environment limitation; report it without claiming that all offline use fails.
