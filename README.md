# LFCFoundry Mind Mapper

An offline-first, single-file browser application for creating and organizing structured mind maps. The planned product centers on a rooted hierarchy with optional cross-links and direct visual editing.

## Development status

The browser now displays an editable Canvas mind map with inline labels, child creation, confirmed subtree deletion, undo/redo, five layout views, pan/zoom, and a paged accessible HTML outline. All document edits use the existing command engine. Changes are session-only and are lost on reload; persistence and file UI remain future work.

Open **dist/mind-mapper.html** after building. Tap/click a topic, use **Edit label** (or double-click), and choose **Add child** to grow the map. Use **Fit map** for framing. The detailed controls, architecture, and verification limits are in [Browser editor](docs/planning/BROWSER-EDITOR.md). Browser/device compatibility remains unverified in this environment; the Node suite and artifact checks pass.

All visual changes must comply with the shared [visual design standard](docs/planning/VISUAL-DESIGN-STANDARD.md). Codex and Claude Code use the same mandatory reference through the repository's root instruction files. Current visual consistency has been reviewed in source and supported by automated checks; actual visual/device acceptance remains pending.

## Build and test

Requires Node.js 20 or newer. There are no runtime or development package dependencies to install.

- Build: **npm run build**
- Test: **npm test**
- Run both checks: **npm run check**

The generated, self-contained HTML file is **dist/mind-mapper.html**. The **dist/** directory is a generated artifact and is ignored by Git. The file is intended to run offline without external scripts, stylesheets, fonts, or services.

The application source is modular under **src/**; edit those files rather than the generated HTML.

## Portable browser qualification

From this repository root run `npm test`, `npm run build`, then `node scripts/prepare-qualification.mjs`. The unchanged application artifact is copied into the new ignored folder `dist/qualification-handoff/`, with a start guide, manual checklist/results template, authoritative visual standard, and SHA-256 manifest. Transfer only that folder to a tester; do not transfer the entire development output directory. No application source or extra runtime is needed to open its HTML in an existing browser.

See [portable handoff instructions](docs/qualification/START-HERE.md). Existing destinations are preserved: choose a fresh `dist/` folder for another package. Packaging and automated checks do not establish browser/device, visual, accessibility, or offline qualification; those require recorded observations.
