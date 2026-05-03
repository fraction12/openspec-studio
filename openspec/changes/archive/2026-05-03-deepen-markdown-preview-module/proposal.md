## Why

Markdown artifact preview parsing currently lives inside the React app shell, so its interface is only reachable through rendering. That makes a small but central preview policy harder to test directly and leaves App.tsx carrying implementation detail that belongs behind a deeper Workbench Application Module.

## What Changes

- Extract Markdown preview parsing and bounded parse-result caching into a Markdown Preview Model module.
- Keep the React Markdown preview renderer responsible only for rendering already-derived blocks.
- Add focused tests at the Markdown Preview Model interface.
- Preserve current visible Markdown preview behavior, cache bounds, product flows, persistence shape, native command names, public APIs, and dependencies.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workbench-application-modules`: add the Markdown Preview Model as a behavior-preserving module owned by the workbench module architecture.

## Impact

- Affected code: `CONTEXT.md`, `src/App.tsx`, a new `src/domain/markdownPreviewModel.ts`, and matching tests.
- No public API, product behavior, data schema, external dependency, generated file, or ADR-backed decision changes are intended.
