## 1. Archived Data Model

- [x] 1.1 Expand archived change indexing to discover proposal, design, tasks, and archived spec delta artifacts.
- [x] 1.2 Derive archived task progress from archived `tasks.md`.
- [x] 1.3 Derive archived summaries from archived `proposal.md`.
- [x] 1.4 Derive touched capabilities from archived spec delta paths.
- [x] 1.5 Parse archive metadata from archived folder names without requiring the date-prefix convention.

## 2. Archived Detail UI

- [x] 2.1 Label archived table rows with an `Archived` pill.
- [x] 2.2 Show archived proposal, design, tasks, and spec change previews when those files exist.
- [x] 2.3 Enable artifact open actions for archived files that exist.
- [x] 2.4 Remove the active validation tab for archived changes.
- [x] 2.5 Remove archive-readiness content from archived change details.
- [x] 2.6 Add a lightweight Archive info tab with path, parsed date, original slug, and available files.

## 3. Tests

- [x] 3.1 Add index tests for archived artifact discovery and capabilities.
- [x] 3.2 Add view-model tests for archived summary/task progress derivation.
- [x] 3.3 Add UI/model tests that archived changes omit active validation/readiness tabs.

## 4. Verification

- [x] 4.1 Run TypeScript checks and tests.
- [x] 4.2 Run OpenSpec validation for `fix-archived-change-details`.
- [x] 4.3 Run a visual UAT pass on the archived page.
