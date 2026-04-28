# Tasks

## Validation and Derived Data
- [x] Parse real OpenSpec `issue.level` values, preserve warning/info severities, and merge root-level issues with item issues.
- [x] Update validation tests for warning-only valid output, mixed root/item issues, and command/parse diagnostics.
- [x] Gate archive-ready state on current clean validation and no blocking linked issues.
- [x] Make spec health conservative when validation failed, is stale, or has diagnostics.
- [x] Normalize file records consistently before building `filesByPath`.
- [x] Ignore root-level non-change files under `openspec/changes/` and avoid status calls for phantom changes.

## Archive and Frontend Interaction Safety
- [x] Add archive single-flight state and disable row/bulk archive actions while mutating.
- [x] Add bulk archive confirmation with affected count and names.
- [x] Refresh after partial bulk archive success before reporting failure.
- [x] Fix menu listener lifecycle so native open events do not leak duplicated listeners.
- [x] Split Changes and Specs search state or otherwise prevent hidden cross-view filtering.
- [x] Implement keyboard-accessible column resizing.
- [x] Replace incomplete tab roles with segmented button semantics or complete tab/tabpanel behavior.
- [x] Use valid selectable table semantics while preserving full-row click and keyboard selection.

## Tauri Bridge and Desktop Hardening
- [x] Replace macOS-only folder picker with cross-platform Tauri dialog support.
- [x] Narrow `run_openspec_command` to exact product command shapes.
- [x] Prevent command timeout/overflow hangs by terminating process groups/trees where practical and bounding reader joins.
- [x] Record symlink entries without following them and handle broken/external symlinks without aborting the index.
- [x] Preserve Git porcelain status columns.
- [x] Add a restrictive packaged-app CSP.
- [x] Remove the unused demo `greet` command.
- [x] Add Rust tests for command-shape validation, process timeout/tree behavior, symlinks, and porcelain preservation.

## Tooling and Documentation
- [x] Fix performance fixture argument parsing for boolean flags and validate unknown/missing options.
- [x] Make performance measurement time production indexing/model derivation and report derived counts.
- [x] Validate measurement target paths and report concise errors.
- [x] Add Node engine metadata and README minimum version.

## OpenSpec Lifecycle and Contract Hygiene
- [x] Archive completed implementation changes into baseline specs or otherwise move shipped contracts into canonical specs.
- [x] Resolve the local desktop shell command-scope contradiction around dedicated archive writes.
- [x] Rescope guided operator workflows so existing archive/validation flows are not treated as unbuilt from scratch.
- [x] Strengthen safe artifact authoring specs for overwrite, conflict, stale base, cancel, path-boundary, and write-failure behavior.
- [x] Replace baseline spec placeholder purposes with concrete capability purpose text.

## Verification
- [x] Run TypeScript check, unit tests, Rust tests, OpenSpec validation, web build, and Tauri build.
