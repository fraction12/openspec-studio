## Why

The latest UAT pass made the app more trustworthy, but the everyday scan-and-drill interactions still have friction: table rows require tiny click targets, table status cells repeat secondary copy, specs do not offer the same readable source preview as changes, and styling values are still scattered through CSS. This change tightens the interaction model and introduces a tokenized design foundation so future UI polish is cheaper and more consistent.

## What Changes

- Make entire change/spec table rows selectable, with pointer, hover, focus, and keyboard behavior applying to the row rather than only the name text.
- Remove secondary subtext beneath table status/trust pill badges in both changes and specs tables.
- Replace the structured-only spec side panel with a readable spec document preview matching proposal/design previews while preserving key spec identity and file actions.
- Reduce button text size across primary, secondary, segmented, tab, and inline actions.
- Introduce design-system tokens for color, typography, spacing, radius, controls, borders, and shadows, and migrate visible app styling away from hardcoded design values.
- Add archive actions to the archive-ready phase: per-change `Archive` buttons and an `Archive all` action for every currently archive-ready change.
- Run a fresh product-design UAT pass after implementation.

## Capabilities

### New Capabilities

- `design-system`: Covers reusable visual tokens and shared control/table/preview styling expectations for OpenSpec Studio.

### Modified Capabilities

- `change-board`: Table row selection, table status hierarchy, and row interaction behavior.
- `local-desktop-shell`: Safe desktop bridge behavior for archive actions that modify local OpenSpec files.
- `workspace-intelligence`: Spec drill-down side panel behavior and readable spec previews.

## Impact

- React table and inspector event handling in `src/App.tsx`.
- CSS token layer and component styling in `src/App.css`.
- Tauri bridge command restrictions for invoking OpenSpec archive operations.
- App model/view data needed to render spec source preview.
- Unit/type coverage where pure behavior is extracted or changed.
- Packaged Tauri build and Computer Use product-design UAT.
