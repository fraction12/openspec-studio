## 1. Packaged CLI environment

- [x] 1.1 Add bridge test coverage for child PATH construction with limited desktop-style PATH input.
- [x] 1.2 Update the Rust command runner so each OpenSpec command candidate runs with a PATH that includes the candidate directory, standard local install directories, and existing PATH entries.
- [x] 1.3 Verify `openspec status --change <name> --json` and `openspec validate --all --json` can resolve launcher dependencies from the packaged-app environment.

## 2. Validation and change health accuracy

- [x] 2.1 Add TypeScript tests for repository validation failure without linked change issues.
- [x] 2.2 Separate command/parse failure diagnostics from structured validation issues in the validation model or app view model.
- [x] 2.3 Update change health derivation so invalid status only comes from linked validation errors, explicit change status errors, blocked workflow status, or missing artifacts.
- [x] 2.4 Keep repository-level validation failure or stale state visible without falsely marking every change invalid.

## 3. Hardcoded data isolation

- [x] 3.1 Remove hardcoded sample OpenSpec records from the production desktop loading path or isolate them behind an explicit browser-preview-only boundary.
- [x] 3.2 Add regression coverage or structural checks that prevent browser-preview data from being used as selected-repository data in Tauri runtime.
- [x] 3.3 Confirm recent repo state and selected repo state continue to use real repository paths only.

## 4. Verification

- [x] 4.1 Run TypeScript tests, Rust tests, type checks, and lint/clippy checks relevant to the bridge and UI model.
- [x] 4.2 Run `openspec validate fix-derived-data-accuracy --strict`.
- [x] 4.3 Rebuild the packaged app and verify the live OpenSpec Studio window shows this repo's active change as valid/clean when CLI validation passes.
