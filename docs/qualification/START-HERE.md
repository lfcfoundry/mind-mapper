# Mind Mapper browser qualification handoff

This package is for a human who can visibly open and interact with the application. **Browser, device, visual, accessibility, and offline qualification are NOT RUN until observed and recorded.** Prior Termux launch attempts did not establish browser execution. The package does not contain a completed qualification report.

## What to transfer

Transfer only the generated `qualification-handoff` folder (or the differently named folder chosen by the preparer), preserving these five files:

- `mind-mapper.html` — the existing application artifact, copied unchanged; the only executable application file.
- `START-HERE.md` — this guide.
- `RESULTS-TEMPLATE.md` — the manual checklist and blank results form.
- `VISUAL-DESIGN-STANDARD.md` — an unchanged copy of the repository's authoritative standard.
- `MANIFEST.json` — SHA-256 and byte counts identifying the supplied files, with qualification initially NOT RUN.

Do not transfer the whole development `dist/` directory: it may contain environment-specific logs or previous reports. This allowlisted handoff excludes repository history, machine paths, credentials, account information, and development logs. Use synthetic topics during testing, not private work. Recipients do not need Node, Python, a server, an account, or an installation to try the standalone application in an already available browser.

## Prepare from the source checkout

From the repository root, with an existing Node.js 20+ installation:

```sh
npm test
npm run build
node scripts/prepare-qualification.mjs
```

The existing build produces exactly `dist/mind-mapper.html`. The handoff command copies that artifact verbatim into `dist/qualification-handoff/`; it does not rebuild or create another application implementation. It lists the artifact SHA-256 for the tester to record. Generated output remains ignored by Git.

The packager refuses to reuse an existing destination, protecting any previous reports or edits. For a later run, use a fresh name:

```sh
node scripts/prepare-qualification.mjs dist/qualification-handoff-run2
```

Only new direct child directories inside the repository's `dist/` are accepted. Preserve an existing package instead of cleaning or replacing it. If preparation fails partway, retain that directory and choose a new destination after addressing the error. Packaging verifies a file's identity, not that it runs in a browser. Do not rebuild midway through a qualification run; test and report the exact artifact hash shipped.

For an optional independent artifact identity check, compare the output of an already available command with the `mind-mapper.html` entry in MANIFEST.json: Linux/Termux `sha256sum mind-mapper.html`, macOS `shasum -a 256 mind-mapper.html`, or Windows PowerShell `Get-FileHash mind-mapper.html -Algorithm SHA256`. Run it from the received folder. Record whether the hash was independently checked or merely copied from the manifest. A matching checksum establishes file identity, not browser qualification.

## Open on a desktop browser

1. Copy the handoff folder to the test computer. Keep the artifact filename unchanged.
2. Copy `RESULTS-TEMPLATE.md` to a new report file such as `RESULTS-desktop-01.md`; do not overwrite the template. Fill in environment fields before testing. Read the included visual standard.
3. Open `mind-mapper.html` using the browser's **Open file** command or drag the file into an existing browser window. Confirm that the page is the Mind Mapper application, not source text, a download prompt, or an OS preview. Record the actual URI scheme (`file:`, `content:`, or HTTP) and browser version without recording personal path details.
4. Follow the checklist below and record what actually happens. Keep a normal browser window visible; compilation, a successful file copy, or a browser launch alone is not a pass. Use developer tools if already available to record runtime errors and resource requests; ordinary editing also needs human observation.
5. Create a separate report for each browser/environment/origin. Do not infer Firefox/Safari/Chrome compatibility from a result in another browser.

## Open on an actual Android device

1. Transfer the same `mind-mapper.html` to an accessible location such as Downloads through normal device file tools. Preserve the rest of the handoff for reference and reporting.
2. In the file manager choose **Open with** an installed browser capable of executing local HTML. A text viewer or HTML preview that does not execute the page is not an application pass. Some browsers reject certain local/provider URIs; record that exact limitation and any alternative browser/origin tried.
3. Keep the browser foreground and complete the touch cases using physical taps, drags, and two-finger pinch. Edit with the actual virtual keyboard. Repeat relevant checks in portrait and landscape. Record device model, Android/browser versions, orientation, and display/text scaling.
4. Android desktop-site mode, a desktop simulator, and a wide iframe do not replace physical-device testing. Likewise, a 1280px iframe in Android Chrome is not evidence of a desktop-browser pass. Keyboard or assistive-technology cases that cannot be run must remain NOT RUN with a reason.

## Manual scenario sequence

Use the detailed results table in `RESULTS-TEMPLATE.md`; every case has expected behavior and fields for actual results/evidence. Start a fresh session for each run. **Changes are session-only and disappear on reload**; recreate the fixture after reopening.

1. Observe the initial root, framing, toolbar, outline, focus, and session-only message. Rename the root to `Qualification map`.
2. Add root children `Ideas`, `Research`, and `Next steps`. Select `Ideas` and add `Long label: explain how the map should remain readable when several words wrap onto additional lines`, `第一案 — café`, and a label with two lines entered using ordinary Enter. This fixture exercises width, wrapping, non-ASCII content, depth, and siblings. Select through Canvas and outline and compare both representations.
3. Edit a label using double-click on desktop or **Edit label** on touch. Try Save, Ctrl/Command+Enter where available, Escape, and Cancel. Test a blank label: the error should remain next to the open editor, and a valid correction should clear it.
4. Exercise Add child, canceled deletion, and confirmed subtree deletion on `Ideas`; inspect descendants. Undo/redo the deletion, label edits, and child creation. Verify root deletion stays prohibited. Do not reload to test undo: history is also session-only.
5. Inspect each layout individually: left-to-right, right-to-left, top-to-bottom, bottom-to-top, radial. Check node placement, wrapped labels, neutral root treatment, endpoint attachment, connector clarity, selection, and unchanged hierarchy/labels. A selector changing value alone does not prove correct rendering.
6. Pan by dragging; a tap should select and empty-space tap should deselect. On desktop wheel-zoom over a recognizable topic and check it stays under the pointer. On Android use physical pinch and lift both fingers; check for accidental actions, selection loss, and unexpected page scrolling. Try zoom buttons, Fit map, and Reset view. Reset should center the root at 100%; Fit may stop at the minimum zoom for extremely large maps.
7. Make one distinctive label edit, then pan/zoom/fit/reset/switch layouts. Labels and outline must remain intact; Undo should reverse that last label edit, not navigation. Node tests provide separate semantic coverage; record only the UI invariants actually observed here.
8. Use Tab and the supported hierarchy keys: arrows and Home, Enter/F2 to edit, Escape to cancel, Insert to add, Delete to request confirmation, Ctrl/Command+Z and Shift+Z/Y outside text inputs. Verify native textarea editing shortcuts still work. Inspect focus outlines and the solid-selection/dashed-editing distinction without relying on color alone.
9. For pagination, repeatedly select the root, click Add child, and Save until the map has at least 81 nodes (the footer count helps). Check Previous/Next, keyboard navigation across a page boundary, and whether selection reveals the corresponding item. Record NOT RUN if this longer case is not completed. Screen-reader checks need a dedicated observed run and tool/version, not an inference from ARIA attributes or keyboard success.
10. Resize the desktop window and test an actual narrow Android viewport. Inspect toolbar wrapping, readable labels and targets, page scrolling outside the map, editor Save/Cancel visibility with the virtual keyboard, portrait/landscape, and enlarged browser text. Then perform the independent offline run below.

## Offline qualification is a separate run

Three different claims require different evidence:

1. **Build succeeded:** the build command finished successfully. This does not exercise a browser.
2. **Resources are embedded:** static/deterministic artifact checks find the application's JavaScript/CSS inside the HTML and no external runtime resource references. This does not prove offline execution or local-file browser support.
3. **Offline browser use succeeded:** a human directly observed the supplied standalone artifact opening and functioning while networking was unavailable. Only this can qualify the tested browser/device/origin for offline use.

For the third claim, stop any qualification server, close the HTTP application tab, disable network access or use the browser's offline mode, and open the actual supplied HTML again through a local-file/provider route. Confirm the location is not `http://localhost` or a cached server page. Record how networking was disabled and the URI scheme. Recreate a small map, switch layouts, edit/commit/cancel, add/delete, undo/redo, and pan/zoom/fit/reset. Check for external requests where browser tools permit. If the browser refuses the file or offers a non-executing viewer, record the observed restriction and keep core offline behavior NOT RUN; do not convert static packaging success to an offline PASS.

## Optional existing browser harness (source checkout only)

The minimum portable folder deliberately contains no server or synthetic harness; manual testing works by opening its one HTML file. If the tester also has the source checkout and an existing Python 3 installation, the existing harness can provide supplementary evidence:

```sh
npm run build
python3 scripts/browser-check-server.py
```

Open `http://127.0.0.1:8766/browser-check.html` in a browser on that same host, keep it active, and wait for a report. The server binds to host-local loopback: opening that address on a separate Android device will not reach a desktop's server. Prefer the portable file route on the phone. The source harness loads `/mind-mapper.html`, performs synthetic DOM/Canvas actions in 360px and 1280px iframes, and POSTs a report to `/report`. It writes `dist/browser-results.json` and a Canvas-only `dist/browser-canvas.png`. Copy those to the run's evidence folder before another harness run, because these fixed filenames are reused. Stop the server with Ctrl+C afterward.

Retain individual assertion results and limits. A Canvas capture is not a full-interface screenshot; synthetic clicks do not test physical gestures or native dialogs. A successful layout-handler assertion does not by itself establish visual readability. The server harness is not the offline test and is not required by the portable package.

## Evidence, screenshots, and defects

Create a new run folder containing the completed report and an `evidence/` subfolder. Use filenames such as `desktop-01-L05-radial.png` or `android-01-T03-keyboard.png` and reference them in the results table. Use existing OS/browser screenshot tools; capture the actual app state with viewport/orientation and relevant controls visible. For focus/editing defects, capture the focus frame, editor, and error together where possible. A screenshot cannot prove a gesture, offline network condition, or screen-reader outcome: add reproduction steps and observations or an available recording.

Avoid capturing personal tabs, profile/account details, notifications, credentials, or private file paths. Crop/redact those if necessary and disclose that the capture was cropped/redacted. Do not alter the app state being evidenced. Preserve original evidence privately through normal tester practice when appropriate; ship only the sanitized evidence needed for review.

For every defect use the supplied defect form: case ID and environment, fixture/setup, numbered steps, expected and actual behavior, repeatability count, evidence, severity/impact, and any re-test result. Record the exact artifact SHA-256. Do not invent a fix or mark retests PASS without running them. Mark the overall conclusion as qualified for the tested environment, qualified with documented limitations, or not yet qualified, with clear scope and reasons.
