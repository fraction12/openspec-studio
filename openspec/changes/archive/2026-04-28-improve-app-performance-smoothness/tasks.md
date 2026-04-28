# Tasks

## 1. Baseline and Measurement
- [x] Add lightweight timing/log instrumentation or local debug helpers for repository load, metadata scan, content read, status load, index build, and render-heavy paths.
- [x] Create or script a synthetic large OpenSpec workspace fixture for repeatable local performance checks.
- [x] Record current baseline numbers for a normal repo and a large fixture.

## 2. Bridge Performance and Safety
- [x] Split file listing into metadata/signature and content-reading bridge paths.
- [x] Preserve existing content or fetch selected content on demand instead of reading every Markdown file on unchanged refresh.
- [x] Run blocking filesystem/process work through async/blocking isolation from Tauri command handlers.
- [x] Add process timeout, kill-on-timeout, and captured-output bounds for OpenSpec/Git/osascript commands.
- [x] Prevent symlink directory recursion under `openspec/`.
- [x] Surface Markdown read failures clearly instead of silently dropping content.
- [x] Add Rust tests for timeout/error mapping, symlink handling, metadata listing, and read-error behavior.

## 3. Refresh and Status Flow
- [x] Add an in-flight guard or generation token for repository load/refresh/git-status/artifact-preview requests.
- [x] Prevent overlapping background refreshes for the same repository.
- [x] Make background git-status refresh quiet and skip state updates when unchanged.
- [x] Cache change status records by change name and relevant artifact modified times.
- [x] Bound status command concurrency or replace per-change calls with a batch status path if available.
- [x] Avoid double indexing during repository load and refresh where possible.

## 4. Indexing and Derived Data
- [x] Refactor `indexOpenSpecWorkspace` to bucket files by active change, archived change, spec, delta spec, and modified-time summary in one normalized pass.
- [x] Build validation issue maps once per workspace view for change/spec lookups.
- [x] Keep task count parsing available for rows while lazily parsing full task groups for selected detail only.
- [x] Add regression tests for large file lists, archive-heavy workspaces, validation issue maps, and lazy task detail behavior.

## 5. React Render Smoothness
- [x] Memoize Markdown preview block parsing by content.
- [x] Prevent stale artifact-preview reads from overwriting newer selections.
- [x] Use deferred/precomputed search data for change/spec filters.
- [x] Throttle change-column resize rendering or move drag updates to a CSS variable until mouseup.
- [x] Add row virtualization or bounded row rendering for large change/spec/archive lists.

## 6. Layout and Interaction Polish
- [x] Remove desktop breakpoint dead zones and short-height clipping paths.
- [x] Make inspector/detail scrolling use a single primary vertical scroller where possible.
- [x] Make table hover/focus/selected states geometry-stable.
- [x] Bound the left-rail recent repository list.
- [x] Make board toolbar wrapping predictable at compact widths.
- [x] Verify compact widths preserve horizontal table scrolling rather than hiding columns.

## 7. Verification
- [x] Run `npm run check`.
- [x] Run `npm run test`.
- [x] Run `cd src-tauri && cargo test`.
- [x] Run `npm run build`.
- [x] Run a packaged app build/UAT pass before archiving the change.
- [x] Update baseline measurements and summarize before/after results.
