# Mind Mapper qualification results — blank template

Copy this file for each browser/device/origin run. All cases begin **NOT RUN**. Replace each status only after an actual observation and fill in actual results/evidence. The expected-behavior column is a test oracle, not a completed result. Consult START-HERE.md and the included authoritative VISUAL-DESIGN-STANDARD.md.

## Run identity

| Field | Tester entry |
|---|---|
| Run ID (non-personal) | |
| Observation date/time and timezone | |
| Artifact filename and SHA-256 from MANIFEST.json | |
| Independent hash-check method/result (or not performed) | |
| Browser name and exact version | |
| Operating system and version | |
| Device model / desktop hardware category | |
| Viewport width × height in CSS pixels (or explicitly state unavailable) | |
| Device pixel ratio (or unavailable) | |
| Orientation, browser zoom, OS display/text scaling | |
| Input methods actually used (mouse, physical keyboard, touch, virtual keyboard) | |
| Origin/scheme (file:, content:, or local HTTP; omit personal paths) | |
| Network state and how established | |
| Assistive technology and version, if used | |
| Evidence directory / optional harness report filename | |

Status meanings: **PASS** directly observed expected behavior; **FAIL** directly observed defect; **PARTIAL** only part observed (name what passed and what remains); **NOT RUN** unavailable/not attempted (give reason). Do not infer physical, desktop, visual, screen-reader, or offline success from another environment or from a build/harness result.

## Manual functional checklist

Follow the fixture and steps in START-HERE.md. Use a separate row/report if a case has different outcomes across configurations. For non-applicable inputs leave NOT RUN and explain, rather than marking PASS.

| ID | Scenario and expected behavior | Status | Actual result, limitations, evidence / defect ID |
|---|---|---|---|
| I01 | Initial local/HTTP opening: application executes; initial map visible and sensibly framed; no observed runtime error. Record which error checks were possible. | NOT RUN | |
| I02 | Controls and session-only message visible/labeled/usable; no unexpected overflow or clipped actions. | NOT RUN | |
| L01 | Left-to-right: correct hierarchy, readable labels, attached connectors, root and selection distinguishable. | NOT RUN | |
| L02 | Right-to-left: same hierarchy/content and visual conventions, oriented correctly. | NOT RUN | |
| L03 | Top-to-bottom: same hierarchy/content and visual conventions, oriented correctly. | NOT RUN | |
| L04 | Bottom-to-top: same hierarchy/content and visual conventions, oriented correctly. | NOT RUN | |
| L05 | Radial: root centered, branches coherent, readable labels/connectors, same state conventions. | NOT RUN | |
| L06 | Long, multiline, and non-ASCII labels readable and wrapped without silent content loss/clipping. | NOT RUN | |
| E01 | Click/tap selects correct topic; empty space deselects; Canvas and outline agree. | NOT RUN | |
| E02 | Double-click or Edit label opens the selected topic's accessible inline editor. | NOT RUN | |
| E03 | Save and available commit shortcut update Canvas/outline, dimensions/layout, and retain valid selection. | NOT RUN | |
| E04 | Cancel/Escape leave original label intact; ordinary Enter adds a line in the textarea. | NOT RUN | |
| E05 | Blank label shows associated error and stays editable; valid correction clears error. | NOT RUN | |
| E06 | Add child creates a child under selected parent, selects it, and opens label editing. | NOT RUN | |
| E07 | Cancel subtree-deletion confirmation changes nothing. | NOT RUN | |
| E08 | Confirm non-root subtree deletion removes all descendants from map/outline. | NOT RUN | |
| E09 | Root deletion remains disabled/prohibited, including keyboard path. | NOT RUN | |
| E10 | Undo/redo restore representative label edits, child creation, and subtree deletion in map/outline. | NOT RUN | |
| N01 | Mouse/finger drag pans; a small tap does not accidentally move/select another topic. | NOT RUN | |
| N02 | Wheel zoom is usable and preserves the topic under the pointer. | NOT RUN | |
| N03 | Zoom buttons zoom within usable limits and update zoom display. | NOT RUN | |
| N04 | Fit frames the map subject to documented minimum zoom; Reset centers root at 100%. | NOT RUN | |
| N05 | Pan/zoom/fit/reset/layout changes preserve content/outline and do not add undo entries; Undo still reverses last document edit. | NOT RUN | |
| K01 | Arrow keys and Home navigate intended hierarchy/order and keep selection visible. | NOT RUN | |
| K02 | Enter/F2, Escape, Insert, Delete, and history shortcuts work where supported; textarea native shortcuts stay intact. | NOT RUN | |
| K03 | Tab focus is visible and not clipped; essential editing is possible without pointer use. | NOT RUN | |
| A01 | HTML outline conveys hierarchy/order/root/selection and exposes essential actions. | NOT RUN | |
| A02 | More than 80 nodes: Previous/Next, cross-page keyboard navigation, and selection-following work without losing context. | NOT RUN | |
| A03 | Live status text is meaningful; if tested with assistive technology, record actual announcements and tool/version. | NOT RUN | |
| T01 | Physical Android tap selection is reliable; no accidental activation or selection loss. | NOT RUN | |
| T02 | Actual virtual keyboard, editor focus, commit/cancel, and child creation are usable; Save/Cancel remain reachable. | NOT RUN | |
| T03 | Physical pinch zoom and pointer release/cancellation behave predictably without accidental edits. | NOT RUN | |
| T04 | Page scroll works outside map; map gestures do not unexpectedly scroll page or interfere with editing. | NOT RUN | |
| R01 | Narrow/wide window, portrait/landscape, and enlarged text preserve readable controls and unclipped editing. Record actual sizes. | NOT RUN | |
| R02 | Physical touch targets/separation are usable; Fit/Reset/layout controls remain accessible on mobile. | NOT RUN | |

## Compact visual-standard acceptance

This checklist summarizes the included standard; it does not replace or redefine it. Review actual rendering in all five layouts and all affected HTML controls. Color calculations or source inspection alone cannot fill PASS.

| ID | Expected visual finding | Status | Actual finding / evidence |
|---|---|---|---|
| V01 | Clear typographic hierarchy; node labels, controls, and supporting text legible at realistic sizes. | NOT RUN | |
| V02 | Predominantly neutral foundation with disciplined red emphasis; no arbitrary palette proliferation. | NOT RUN | |
| V03 | Node hierarchy and root are distinguishable through restrained fill/boundary and accessible structure. | NOT RUN | |
| V04 | Connectors clearly attach to topics, remain subordinate to labels, and communicate rooted hierarchy. | NOT RUN | |
| V05 | Selection has solid additional frame/weight and matching outline emphasis, not color alone. | NOT RUN | |
| V06 | Editing has dashed frame and labeled Save/Cancel interface, distinct from selection; errors explicit. | NOT RUN | |
| V07 | Keyboard focus is clearly visible and distinct, including at Canvas edges. | NOT RUN | |
| V08 | Canvas and HTML outline communicate consistent hierarchy and selection across layouts/pagination. | NOT RUN | |
| V09 | Controls/spacing and mobile labels/targets readable; software keyboard does not hide current task. | NOT RUN | |
| V10 | No unnecessary decoration, gradients, shadows, or oversized cards; map remains primary. | NOT RUN | |
| V11 | Text enlargement, forced colors and screen-reader behavior checked in named environments; report separate limits. | NOT RUN | |
| V12 | Native confirmation remains understandable and keyboard/touch usable; platform styling documented. | NOT RUN | |

## Independent offline run

| ID | Expected behavior and required evidence | Status | Actual result / evidence |
|---|---|---|---|
| O01 | Supplied HTML freshly opens via file/provider route with server stopped and networking unavailable. Record scheme and network condition. | NOT RUN | |
| O02 | Offline map visibly renders; selection, labels, commit/cancel, add/delete, undo/redo work. | NOT RUN | |
| O03 | Offline layouts and pan/zoom/fit/reset work using applicable actual inputs. | NOT RUN | |
| O04 | No external runtime resource dependency observed. Name browser/network inspection available; if not observable, report PARTIAL/NOT RUN rather than assuming. | NOT RUN | |

## Supporting automated evidence — keep separate

| Evidence | Command/environment and actual result | Limitations |
|---|---|---|
| Build (if run by preparer) | | Does not establish browser execution. |
| Embedded-resource/deterministic checks (if run) | | Does not establish offline browser use. |
| Optional source-checkout browser harness | | Synthetic actions/iframe sizes are not physical touch, native-dialog, visual, or universal browser qualification. |

## Reproducible defect record — copy per defect

- Defect ID and affected case IDs:
- Artifact SHA-256 and run/environment ID:
- Severity / user impact:
- Fixture/setup (use synthetic labels and enough steps to recreate the session):
- Numbered reproduction steps:
  1.
  2.
- Expected behavior:
- Actual observed behavior / error text:
- Repeatability (failures / attempts):
- Screenshot/recording/log filenames and state captured:
- Any crop/redaction disclosed (no private paths, credentials, notifications, or account details):
- Smallest suspected component, if known (do not guess a proven cause):
- Correction reference, if any:
- Re-test environment/artifact and status (NOT RUN until performed):

## Run conclusion

- Overall: **Not yet qualified** (change only with supporting observations).
- Tested browser/device/origin scope:
- PASS / FAIL / PARTIAL / NOT RUN case counts:
- Observed defects and blocking limitations:
- Unverified behavior:
- Visual-standard acceptance and limits:
- Offline acceptance and limits:
- Conclusion rationale (qualified for tested environments / qualified with documented limitations / not yet qualified):
