## Context

OpenSpec's public site presents the product as lightweight, repo-native, and text-first. It uses simple trust cues, source paths, markdown/spec snippets, CLI examples, and generous whitespace to explain the workflow without dashboard decoration.

OpenSpec Studio already has working data surfaces and an initial token system. This change adapts those surfaces so the desktop app feels like a native OpenSpec workbench: a place to inspect changes, specs, proposals, designs, tasks, and deltas with quiet confidence.

## Goals / Non-Goals

**Goals:**
- Make OpenSpec artifacts and source paths the dominant visual material.
- Reduce dashboard noise, repeated status language, heavy borders, and competing decorative treatments.
- Define a restrained OpenSpec-native token direction that can be reused across future surfaces.
- Preserve the current derived-data behavior and existing workflows.
- Provide static visual examples for review before implementation.

**Non-Goals:**
- Rebrand OpenSpec or copy the website one-to-one.
- Add new product features, analytics, collaboration workflows, or data sources.
- Change validation, archive, indexing, or CLI behavior.
- Introduce a component library or external design dependency.

## Decisions

### Use a repo workbench layout, not a SaaS dashboard
The app will keep the core shell, but the visual hierarchy should feel closer to a source-aware desktop tool than an analytics dashboard. Navigation, filters, and summary counts should be compact support elements. Rows, selected artifacts, markdown previews, paths, and spec deltas should carry the product identity.

Alternative considered: a stronger branded dashboard with larger cards and richer status color. That would make the app feel more generic and less aligned with OpenSpec's lightweight philosophy.

### Use restrained monochrome surfaces with small semantic accents
Most UI should use near-white surfaces, soft borders, neutral text, and subtle selected states. Semantic colors remain for validation, readiness, errors, and warnings, but they should be quieter and smaller than artifact content.

Alternative considered: keep the current blue-forward control palette. Blue works for primary actions, but using it too broadly makes navigation and status compete with the content.

### Treat markdown and code previews as first-class design objects
Proposal, design, task, and spec-delta panes should look intentionally document-like, with readable headings, calm line length, source path headers, and code/diff blocks that resemble OpenSpec examples. This is where the app should most strongly echo OpenSpec's site.

Alternative considered: render all artifacts as plain preformatted text. That preserves fidelity but makes the experience feel unfinished and harder to scan.

### Make status subordinate to workflow phase and artifact completeness
Status pills should be compact trust cues. The app should avoid repeating the same phase/status in adjacent cells and should not let validation health dominate the page when the user is primarily reviewing artifacts.

Alternative considered: expose validation and workflow state prominently in every row. That helps debugging, but it increases noise and weakens the OpenSpec artifact-first feel.

### Preserve table columns and scroll when space runs out
The board should give change/spec rows enough horizontal room by keeping the inspector slightly narrower, but it must not hide data columns at compact widths. Manual change-column resizing stays available, and when the board becomes too narrow the table should keep all overview columns intact and use horizontal scrolling.

Alternative considered: hide lower-priority columns at compact widths. That keeps the table within the viewport, but it makes the overview inconsistent and can make columns appear broken during resize.

### Keep source paths in inspectors, not overview rows
Source paths are important, but overview rows should stay scan-focused. Changes and specs should show artifact names in the table, while exact source paths remain available in the inspector header and file/action context.

Alternative considered: show paths beneath every row title. That provides context, but repeats data already visible after selection and increases row noise.

### Replace the footer with repo-operational context
The bottom status band should stop repeating generic workspace/attention labels and instead show operational context that helps users decide what to do next: last validation time, latest OpenSpec change, and Git cleanliness for `openspec/` paths. These values must come from current validation state, indexed OpenSpec files, and repository Git status.

Alternative considered: remove the footer entirely. That would reduce noise, but the footer can still be useful if it carries low-profile, repo-specific facts.

### Keep the mockups static and review-only
Visual examples live under `examples/` in this change. They are not app code and are not shipped. They are intentionally simple enough to review quickly and revise before implementation.

## Risks / Trade-offs

- [Risk] The interface could become too quiet and hide important error states. -> Mitigation: preserve semantic color for actionable error, blocked, stale, and ready states, but reduce their footprint.
- [Risk] Static mockups can diverge from real component constraints. -> Mitigation: keep examples close to existing app structure and implement with current React/CSS primitives.
- [Risk] More document-style rendering may obscure raw source fidelity. -> Mitigation: preserve source paths and provide open-file actions; render spec deltas with code-aware formatting.
- [Risk] Visual cleanup could accidentally change data behavior. -> Mitigation: keep implementation scoped to presentation and run existing data, archive, and validation tests.

## Visual Review Artifacts

- `examples/openspec-native-workbench.html`: static review mockup for the proposed visual direction.
- `examples/openspec-native-workbench.svg`: quick visual preview of the proposed shell, board, and inspector direction.
- `examples/openspec-native-workbench.png`: rendered preview for review in tools that do not display SVG.
