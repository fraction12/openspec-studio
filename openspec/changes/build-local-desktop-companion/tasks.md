## 1. Project scaffold

- [ ] Choose v1 desktop shell: Tauri by default unless a Swift-only decision is made.
- [ ] Scaffold the app with a minimal desktop window and packaged launch path.
- [ ] Add basic project scripts for development, build, lint/check, and test.
- [ ] Document how to run the app locally and how to produce an app bundle.

## 2. OpenSpec bridge

- [ ] Implement a local command bridge for running `openspec` CLI commands in a selected repo.
- [ ] Implement safe filesystem reads for OpenSpec artifact files under the selected repo.
- [ ] Add repo validation for detecting whether a selected folder contains `openspec/`.
- [ ] Add tests for command execution, missing CLI behavior, and invalid repo handling.

## 3. Repository indexer

- [ ] Index active changes from `openspec/changes/` while excluding archive folders.
- [ ] Index archived changes separately.
- [ ] Index specs from `openspec/specs/`.
- [ ] For each active change, gather artifact existence, workflow status, touched capabilities, task progress, and modified time.
- [ ] Add file-watch refresh for relevant OpenSpec paths.

## 4. Core UI

- [ ] Build repo picker and recent-repos view.
- [ ] Build primary change board/table view.
- [ ] Build change detail view with proposal, design, tasks, delta specs, and status panes.
- [ ] Build specs browser view.
- [ ] Add “open artifact in editor/default app” action.

## 5. Validation dashboard

- [ ] Run repository-wide validation from the UI.
- [ ] Parse and display validation success/failure state.
- [ ] Link validation errors to affected changes/specs/files when possible.
- [ ] Mark validation stale after relevant file changes.

## 6. Product polish

- [ ] Add empty states for no repo, no OpenSpec workspace, no changes, no specs, and CLI failures.
- [ ] Add visual treatment for missing artifacts, blocked artifacts, invalid changes, and archive-ready changes.
- [ ] Add README screenshots or a short usage walkthrough once UI exists.
- [ ] Run validation/build checks and record the result before first commit.


## 7. Robust tooling roadmap

- [ ] Define the post-v1 workflow layer for guided propose/apply/archive operations backed by OpenSpec CLI commands.
- [ ] Define multi-repo workspace support for viewing several local OpenSpec repos in one dashboard.
- [ ] Define cross-repo search over changes, specs, proposals, designs, tasks, and validation errors.
- [ ] Define timeline/activity view using file modification times, git history, and OpenSpec archive state.
- [ ] Define dependency graph view connecting changes to touched specs/capabilities and archive readiness.
- [ ] Define safe artifact authoring/editing flows, including markdown preview and task checkbox updates.
- [ ] Identify OpenSpec CLI JSON gaps needed for robust app behavior and capture upstream change proposals separately.
- [ ] Keep all robust features source-of-truth compatible: derived state must be rebuildable from OpenSpec files and CLI output.
