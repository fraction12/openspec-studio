## 1. Repository Opening and Launch Flow

- [x] 1.1 Add Tauri/native folder selection plumbing for choosing a repository folder.
- [x] 1.2 Make `Choose folder` the primary sidebar repository-open action.
- [x] 1.3 Move manual path entry into a secondary or advanced path-entry flow.
- [x] 1.4 Restore the last successful repository on launch when it still exists.
- [x] 1.5 Show a choose-folder first-run empty state when no repository can be restored.
- [x] 1.6 Add `File > Open Repository` or equivalent desktop menu affordance if supported by the current Tauri setup.

## 2. Repository State, Recents, and Error Recovery

- [x] 2.1 Refactor repository opening into candidate repo state and active repo state.
- [x] 2.2 Keep the previous valid workspace visible when a candidate path is missing or inaccessible.
- [x] 2.3 Keep the previous valid workspace visible when a candidate folder has no `openspec/` workspace.
- [x] 2.4 Add inline sidebar recovery actions for failed candidates: choose folder, retry, and return to last valid repo.
- [x] 2.5 Prevent failed candidate paths from being persisted in recent repositories.
- [x] 2.6 Present recent repositories as a switcher that includes the current repo with a selected state.
- [x] 2.7 Add copy-path and reveal-in-Finder affordances for the active repository.

## 3. Validation and Trust Language

- [x] 3.1 Replace `Not run`, `Stale`, and generic validation labels with actionable trust-state labels.
- [x] 3.2 Show attention counts as unknown or unavailable when validation has not run for the current snapshot.
- [x] 3.3 Distinguish file refresh copy from validation execution copy in buttons, status band, and toasts.
- [x] 3.4 Keep command/parse diagnostics visibly separate from linked change/spec validation issues.
- [x] 3.5 Show validation freshness or validated-at context after successful validation.

## 4. Selection Synchronization and Navigation

- [x] 4.1 Auto-select the first visible change when phase filters hide the current change.
- [x] 4.2 Auto-select the first visible change or show a neutral empty inspector when search hides the current change.
- [x] 4.3 Auto-select the first visible spec or show a neutral empty inspector when spec search hides the current spec.
- [x] 4.4 Remove primary actions from inspectors when the selected record is hidden by the current filter.
- [x] 4.5 Add keyboard focus and hover states that make table rows feel navigable without layout shift.

## 5. Specs Page Drill-Down

- [x] 5.1 Remove specs-page helper copy once specs are populated or replace it with a concise count/freshness summary.
- [x] 5.2 Redesign the spec inspector header around identity, health/trust, path, and file actions.
- [x] 5.3 Add structured spec metadata for requirement count, freshness, summary quality, and validation links.
- [x] 5.4 Treat placeholder archive summaries as missing or incomplete content instead of primary summary copy.
- [x] 5.5 Add a requirements preview or grouped requirement list when spec content is available.
- [x] 5.6 Add empty search result states for specs that do not keep stale inspector content visible.

## 6. Inspector Layout and Visual Polish

- [x] 6.1 Normalize inspector header, tab row, body, and section horizontal gutters.
- [x] 6.2 Add stable scrollbar gutter and bottom padding for long inspector content.
- [x] 6.3 Align tab row padding and active states with the shared inspector gutter.
- [x] 6.4 Improve completed-task disclosure spacing and task-group hierarchy.
- [x] 6.5 Reduce nested-card heaviness in proposal/design previews while preserving readability.
- [x] 6.6 Make the bottom status band feel like app chrome rather than competing content.
- [x] 6.7 Normalize button sizing, labels, disabled states, and action grouping across sidebar, header, and inspectors.

## 7. Redundancy and Copy Cleanup

- [x] 7.1 Remove redundant archive-ready/status repetition in archive-ready views.
- [x] 7.2 Replace internal terms such as artifact, spec delta, stale, and CLI where a clearer product label is needed.
- [x] 7.3 Ensure empty, loading, no-workspace, invalid-path, and no-results states include useful next actions.
- [x] 7.4 Audit sidebar, table, inspector, and status-band copy for repeated information on the same screen.

## 8. Verification

- [x] 8.1 Add unit coverage for candidate repo failure preserving the active workspace.
- [x] 8.2 Add unit coverage for recent repository filtering and current-repo switcher behavior.
- [x] 8.3 Add unit coverage for selection synchronization across phase/search/view changes.
- [x] 8.4 Add unit coverage for validation trust labels and unknown attention semantics.
- [x] 8.5 Run TypeScript tests, Rust tests, type checks, and clippy checks relevant to the changed code.
- [x] 8.6 Run `openspec validate improve-desktop-ux-uat --strict`.
- [x] 8.7 Rebuild the packaged Tauri app.
- [x] 8.8 Use Computer Use to UAT repo opening, invalid path recovery, no-workspace recovery, recents, specs, changes, search, phase filters, validation, and inspector scroll behavior.
