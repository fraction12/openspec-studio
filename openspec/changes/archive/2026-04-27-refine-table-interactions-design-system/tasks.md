## 1. Table Interaction Polish

- [x] 1.1 Make change rows fully clickable and keyboard-selectable.
- [x] 1.2 Make spec rows fully clickable and keyboard-selectable.
- [x] 1.3 Remove secondary subtext beneath table status/trust pill badges.
- [x] 1.4 Preserve stable row hover, focus, and selected states without layout shift.
- [x] 1.5 Ensure table status and trust pills have enough width for their labels.

## 2. Spec Inspector Preview

- [x] 2.1 Carry selected spec source content into the spec view model.
- [x] 2.2 Render selected spec source text with the shared markdown preview treatment.
- [x] 2.3 Keep spec identity, trust, path, and file action controls above the preview.
- [x] 2.4 Remove repeated metadata, requirement summaries, and validation sections from the spec inspector preview path.

## 3. Archive-Ready Actions

- [x] 3.1 Add a restricted Tauri archive command for `openspec archive <change> --yes`.
- [x] 3.2 Add per-row Archive actions on the archive-ready change table.
- [x] 3.3 Add an Archive all action for currently archive-ready changes.
- [x] 3.4 Refresh the workspace after archive actions and preserve useful failure messages.
- [x] 3.5 Add Rust coverage for archive command argument validation.

## 4. Design System Tokens

- [x] 4.1 Define design tokens for color, typography, spacing, radius, borders, shadows, and controls.
- [x] 4.2 Migrate app CSS values to semantic tokens where a matching token exists.
- [x] 4.3 Reduce button text sizes while keeping button hit areas stable.
- [x] 4.4 Normalize table, inspector, markdown preview, and action styling through shared tokens.

## 5. Verification

- [x] 5.1 Run TypeScript tests and type checks.
- [x] 5.2 Run Rust tests and clippy checks.
- [x] 5.3 Run `openspec validate refine-table-interactions-design-system --strict`.
- [x] 5.4 Rebuild the packaged Tauri app.
- [x] 5.5 Use Computer Use for product-design UAT across tables, specs, archive-ready actions, buttons, and visual consistency.
