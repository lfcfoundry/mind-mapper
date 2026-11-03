# Mind Mapper visual design standard

**Status: mandatory, repository-wide.** This is the single authoritative visual-design reference for all Mind Mapper work, including Codex and Claude Code. It covers the current editor and future controls, dialogs, formatting, relationship views, file workflows, and visual exports. Architecture and feature plans do not override it. Changes to this standard must be explicit, justified, and reviewed across affected surfaces; a component must not silently establish an alternative design language.

## Basis and intent

The primary reference is Prezlab's [What We Can Learn From The Economist About Data Visualization](https://prezlab.com/what-we-can-learn-from-the-economist-about-data-visualization/) (May 5, 2024; reviewed for this standard). We adopt its emphasis on simple presentation, choosing a form that fits the message, guiding attention through purposeful emphasis, integrating labels with visuals, and consistent treatment across media. Mind Mapper applies those principles to an interactive knowledge workspace. The binding product rules below also incorporate the approved user requirements for red accents, accessibility, and direct editing. No Economist logo, exact brand palette, graphics, or other publication assets are adopted. Chart-specific advice about axes does not justify distorting document geometry or relationships.

## Editorial clarity

Each visual element must explain document structure, content, state, or an available action. Make the map the primary surface; toolbars and help support the current task. Keep the content, primary actions, secondary controls, and supporting information recognizably distinct. Remove ornament and redundant instructions before reducing label legibility or hiding necessary controls. A denser map may require navigation or selective disclosure; shrinking every label is not an adequate readability strategy.

## Semantic color and emphasis

Use a predominantly neutral foundation. Palette values are implementation tokens, not separate visual rules in individual components. The current shared source is `src/js/browser/visual-tokens.js`; the build exposes these same roles to CSS, and Canvas imports them. New consumers must reuse the roles. Review contrast before changing values or adding roles.

| Role | Intended use |
|---|---|
| `canvas`, `surface`, `rootSurface` | Quiet neutral workspace, content/control surfaces, restrained root differentiation. |
| `ink`, `muted` | Primary readable text and secondary readable information. Muted must not mean unreadable. |
| `border`, `connector` | Visible object/control boundaries and hierarchy lines, subordinate to labels. |
| `accent`, `accentSurface` | Disciplined red emphasis for current selection, keyboard focus, and the active editing task. Avoid red on every toolbar control. |
| `error` | Validation/error text, always accompanied by an explicit message. Errors and selection may share the red family but must differ through text, geometry, or pattern. |

Color must never be the only state signal. Avoid arbitrary branch colors, decorative gradients, and gratuitous semantic colors. Future semantic states require a documented purpose and an accompanying label or symbol. Meaning must remain understandable in monochrome and under color-vision differences.

## Typography and density

Use a legible local sans-serif stack and a small, consistent hierarchy. Primary node labels are the main reading content; preserve their wrapping, contrast, and spacing. Use a modest heading hierarchy for application/section titles, ordinary control text, and quieter but legible supporting text. Future relationship labels must sit close to their connectors and remain distinguishable from node labels through placement and hierarchy. Never imply document hierarchy with font size alone.

Measure and draw text using the same font and spacing assumptions. A weight or font change that alters metrics must invalidate measurements before layout. Do not clip long labels, reduce font size to force a fit, or discard content for decoration. Zoomed overview text may become small; provide reset/zoom and the readable HTML outline. Support browser text enlargement and verify that controls and editor actions remain reachable.

## Spacing and geometry

Use a compact spacing scale consistently for control groups, text padding, and section separation; sizes may adapt to viewport and input method. Prefer clean rectangles, thin meaningful rules, and modest control corners. Avoid nested rounded cards, decorative icons, gratuitous shadows, and motion unrelated to state. Preserve stable node geometry when selection/focus changes. Layout engines determine positions; visual state must not rewrite document or layout data.

Touch controls should generally provide about 44 CSS pixels of usable target height with adequate separation. This is a starting convention, not a license to clip content or fix every dimension across devices. Narrow screens may wrap controls and move the outline below the map. Keep label editing and Save/Cancel usable with the software keyboard and at text enlargement.

## Nodes and relationships

Ordinary nodes use readable text, a neutral surface, and visible boundaries. Root nodes combine restrained neutral surface differentiation with a heavier structural boundary; accessible navigation must identify the root as such. All five layouts use the same node and state conventions. Layout choice must not introduce an unrelated palette or new document meaning.

Primary connectors are neutral and less prominent than text, with clear endpoint attachment. The root and HTML hierarchy establish parent ownership; layout orientation alone is not a relationship label. Future cross-links must be distinguishable from primary hierarchy connectors and directly labeled near their paths. Directional semantics must be explicit when rendered, and arrow appearance must not redefine stored semantic direction. Use legends only when direct labeling is impractical; place them near the relevant content. Labels must not collide silently or misrepresent hierarchy.

## Interaction states across Canvas and HTML

| State | Required non-color signal and consistency rule |
|---|---|
| Rest/root | Normal boundary versus heavier root boundary; neutral hierarchy treatment, with root identified in accessible text. |
| Selection | Additional solid frame/weight on Canvas; persistent boundary emphasis and selected state in the HTML outline. Selection does not change node size. |
| Keyboard focus | Clearly visible outline with separation from the object, distinct from selection; never clipped by map overflow. Preserve native high-contrast focus behavior where necessary. |
| Editing | Dashed inset frame plus labeled inline editor with explicit Save/Cancel; distinguish it from ordinary selection. |
| Hover/press | Modest neutral background/underline or control feedback; must not be mistaken for persistent selection. Essential actions must also work without hover. |
| Error | Readable message close to the failed input, associated accessibly and marked invalid; color is supplementary. |
| Disabled | Native disabled semantics and visibly unavailable control treatment; do not present disabled actions as ready to execute. |

Keep toolbar, menu, dialog, confirmation, keyboard, and touch feedback consistent with these conventions. Native browser/OS controls and `window.confirm` retain platform styling for now: preserve their text, confirmation, and keyboard behavior, document this platform-managed exception, and verify them on target devices. A custom dialog is a separate accessible-interface task, not a reason to remove confirmation.

## Accessibility requirements

Target at least 4.5:1 contrast for normal text and 3:1 for large text and meaningful control boundaries, state indicators, connectors, and focus against adjacent surfaces. Do not treat passing token calculations as proof of rendered browser accessibility. Check actual states, thin lines, zoom, DPR, text enlargement, and forced-color behavior. Important labels and controls must remain usable at realistic mobile and desktop sizes.

The HTML outline must communicate the same node hierarchy, order, root, and selection as Canvas, including paged content. Expose state through accessible roles/attributes and explicit error text. Preserve visible keyboard focus, ordinary input shortcuts, a usable pointer-free editing path, and normal page scrolling outside the map. Verify with keyboard and assistive technology; screenshots and Node tests alone cannot establish this.

## Acceptable and unacceptable examples

- Acceptable: neutral map with one selected node framed in red and an equivalent bold/bordered selected outline item. Unacceptable: selection indicated only by a subtle blue-to-red fill change.
- Acceptable: editing shown by a dashed frame and a named textarea with Save/Cancel. Unacceptable: replacing the selection color with another arbitrary hue and no other cue.
- Acceptable: a heavier root boundary and readable neutral fill in every layout. Unacceptable: a glowing oversized root card or a different theme for radial view.
- Acceptable: concise text buttons, restrained spacing, nearby relationship labels. Unacceptable: unlabeled decorative icons, rainbow connectors, gradients, and floating shadows that compete with content.
- Acceptable: future visual exports reuse semantic typography, node, connector, and label conventions while omitting transient editor selection unless explicitly requested. Unacceptable: exports silently invent another palette or change relationship meaning.

## Required review checklist

- [ ] Consult this standard before changing visual work; identify the affected Canvas, HTML, responsive, and future-export surfaces.
- [ ] Every added element has a content, structure, state, or action purpose; map content remains primary.
- [ ] Reuse semantic tokens; justify any new role and check contrast against all adjacent surfaces.
- [ ] Root, selection, focus, editing, and errors remain distinct without relying only on color.
- [ ] Font metrics, wrapping, node padding, geometry, and connectors agree across all affected layouts.
- [ ] HTML hierarchy/selection/root and visual state agree, including outline pagination.
- [ ] Controls, editor actions, keyboard focus, touch targets, and text enlargement are usable at narrow and wide sizes.
- [ ] Keep confirmation and error handling intact; disclose platform-controlled styling.
- [ ] Report compliance findings and actual verification evidence, naming untested visual/device/accessibility behavior.
- [ ] Preserve the model/command/layout boundaries, single-file offline build, dependencies policy, and existing work.

If a feature request appears to conflict with this standard, explain the conflict and propose a compliant approach before silently diverging. Automated tests support this checklist; they do not replace visual/device review or turn an unverified build into a release-ready product.
