## Why

OpenSpec Studio is only useful if the status it shows is trustworthy. The current packaged app can misread CLI failures as validation failures, mark a change invalid without linked validation issues, and still contains browser-preview sample data that can be confused with real repository state.

This change tightens the product around a single rule: visible project state must be derived from the selected repository's OpenSpec files and OpenSpec CLI output, with command failures surfaced as command failures.

## What Changes

- Ensure packaged CLI execution provides the runtime PATH needed for the installed `openspec` command and its launcher dependencies.
- Keep repository validation state distinct from per-change health so a repo-level command failure does not automatically mark every change invalid.
- Require per-change invalid status to come from linked validation issues, missing artifacts, blocked workflow status, or explicit status-command errors.
- Remove, quarantine, or clearly isolate hardcoded browser-preview sample data so the production desktop surface cannot present it as selected-repository data.
- Add regression coverage around packaged command execution, validation parsing, health derivation, and the no-hardcoded-product-data invariant.

## Capabilities

### New Capabilities
- `derived-data-accuracy`: source-of-truth behavior for OpenSpec Studio data, including CLI execution fidelity, validation/health semantics, and avoiding hardcoded product data.

### Modified Capabilities

None. The existing product capabilities are still active in `build-local-desktop-companion`; this follow-up captures the accuracy contract needed before expanding the app.

## Impact

- Tauri command bridge in `src-tauri/src/bridge.rs`.
- React/TypeScript workspace and change health derivation in `src/App.tsx`.
- Validation parsing and grouping in `src/validation/results.ts`.
- Tests for Rust bridge command environment and TypeScript derived-state behavior.
- No OpenSpec file-format changes and no new user-facing features.
