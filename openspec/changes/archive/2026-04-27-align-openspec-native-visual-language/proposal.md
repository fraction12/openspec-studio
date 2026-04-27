## Why

OpenSpec Studio should feel like a native companion to OpenSpec rather than a generic dashboard wrapped around OpenSpec data. The current app is functional, but the visual language can better reflect OpenSpec's calm, lightweight, repo-native identity: text-first, artifact-first, low-noise, and grounded in source files.

## What Changes

- Align the app's visual direction with OpenSpec's public identity: restrained surfaces, strong whitespace, quiet status cues, and developer-native document/code presentation.
- Rebalance the app hierarchy so repo, changes, specs, and artifacts read as the primary product, with chrome and metrics receding.
- Introduce OpenSpec-native design tokens for typography, spacing, surfaces, borders, document previews, code blocks, tables, and status cues.
- Refine the change/spec board to feel like a repo workbench: compact scanning rows, stable controls, source-path emphasis, and drill-down artifact previews.
- Add proposal mockups as review artifacts before implementation so the visual direction can be approved or adjusted first.
- No new features, external services, or data transformations are introduced by this change.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `design-system`: Add OpenSpec-native visual language requirements for restrained, text-first, repo-native UI styling.
- `change-board`: Add artifact-first presentation requirements so overview and detail surfaces express OpenSpec's workflow and avoid dashboard-style noise.

## Impact

- Affects React/Tauri UI styling and component composition in `src/App.tsx` and `src/App.css`.
- May update design tokens, table rows, navigation, inspector headers, artifact previews, code/document styling, and empty states.
- Does not change the OpenSpec indexing model, CLI bridge contracts, validation behavior, archive behavior, or file data derivation.
- Includes static visual examples under this change for review before implementation begins.
