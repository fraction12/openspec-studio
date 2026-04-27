## 1. Project scaffold

- [x] Choose v1 desktop shell: Tauri with a React/TypeScript frontend.
- [x] Scaffold the app with a minimal desktop window and packaged launch path.
- [x] Add basic project scripts for development, build, lint/check, and test.
- [x] Document how to run the app locally and how to produce an app bundle.

## 2. OpenSpec bridge

- [x] Implement a local command bridge for running `openspec` CLI commands in a selected repo.
- [x] Implement safe filesystem reads for OpenSpec artifact files under the selected repo.
- [x] Add repo validation for detecting whether a selected folder contains `openspec/`.
- [x] Add tests for command execution, missing CLI behavior, and invalid repo handling.
- [x] Resolve the installed `openspec` CLI from standard local install paths when the packaged app has a limited PATH.

## 3. Repository indexer

- [x] Index active changes from `openspec/changes/` while excluding archive folders.
- [x] Index archived changes separately.
- [x] Index specs from `openspec/specs/`.
- [x] For each active change, gather artifact existence, workflow status, touched capabilities, task progress, and modified time.
- [x] Add file-watch refresh for relevant OpenSpec paths.

## 4. Core UI

- [x] Build repo picker and recent-repos view.
- [x] Build primary change board/table view.
- [x] Build change detail view with proposal, design, tasks, delta specs, and status panes.
- [x] Build specs browser view.
- [x] Add “open artifact in editor/default app” action.

## 5. Validation dashboard

- [x] Run repository-wide validation from the UI.
- [x] Parse and display validation success/failure state.
- [x] Link validation errors to affected changes/specs/files when possible.
- [x] Mark validation stale after relevant file changes.

## 6. Product polish

- [x] Add empty states for no repo, no OpenSpec workspace, no changes, no specs, and CLI failures.
- [x] Add visual treatment for missing artifacts, blocked artifacts, invalid changes, and archive-ready changes.
- [x] Add README screenshots or a short usage walkthrough once UI exists.
- [x] Run validation/build checks and record the result before first commit.
- [x] Tighten desktop UI spacing, readable artifact typography, and hierarchical task disclosure after live app review.

Verification recorded 2026-04-27: `npm run check`, `npm test`, `npm run build`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `openspec validate build-local-desktop-companion --strict`, and `npm run tauri:build` passed. The first sandboxed Tauri build produced the app binary and `.app` bundle but failed at DMG creation; rerunning with permission to use macOS disk image tooling produced both the `.app` and `.dmg`. OpenSpec emitted telemetry flush warnings in the network-restricted sandbox after validation, but the command exited 0.


## 7. Robust tooling roadmap

- [x] Define the post-v1 workflow layer for guided propose/apply/archive operations backed by OpenSpec CLI commands. Moved to `add-guided-operator-workflows`.
- [x] Define multi-repo workspace support for viewing several local OpenSpec repos in one dashboard. Moved to `add-multi-repo-workspace`.
- [x] Define cross-repo search over changes, specs, proposals, designs, tasks, and validation errors. Moved to `add-cross-repo-search`.
- [x] Define timeline/activity view using file modification times, git history, and OpenSpec archive state. Moved to `add-timeline-activity-view`.
- [x] Define dependency graph view connecting changes to touched specs/capabilities and archive readiness. Moved to `add-dependency-graph-view`.
- [x] Define safe artifact authoring/editing flows, including markdown preview and task checkbox updates. Moved to `add-safe-artifact-authoring`.
- [x] Identify OpenSpec CLI JSON gaps needed for robust app behavior and capture upstream change proposals separately. Moved to `improve-cli-json-contracts`.
- [x] Keep all robust features source-of-truth compatible: derived state must be rebuildable from OpenSpec files and CLI output. Captured as a shared constraint across the follow-up changes.
