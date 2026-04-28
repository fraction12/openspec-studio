# Design

## Principles
- **Source-backed, not eager-everything:** Load enough data to render accurate overview state, then fetch heavier content only when it is needed.
- **Bounded work:** CLI processes, refreshes, filesystem walks, and renders should have clear limits, cancellation/drop-stale behavior, or concurrency control.
- **Stable surfaces:** Smoothness includes layout. Hover, focus, scroll, and breakpoint behavior must not shift content unexpectedly.
- **Measurable improvements:** Add targeted tests and lightweight timing/fixture checks so regressions are visible.

## Refresh and Indexing
Split repository refresh into two layers:

1. **Metadata/signature pass**
   - Return path, kind, modified time, and file size for `openspec/` entries.
   - Avoid reading every Markdown file during unchanged refresh checks.
   - Use a signature derived from path, kind, modified time, and size.

2. **Content pass**
   - Read content for artifacts required to render visible overview state.
   - Read selected proposal/design/spec preview content on demand when it is not already cached.
   - Preserve content from unchanged files across refreshes.

The indexer should avoid repeated full-file scans per change. It should bucket active changes, archived changes, specs, delta specs, and modified-time summaries in a single pass over normalized file records.

## OpenSpec Status Loading
Per-change status should stop being an unbounded `Promise.all` over active changes.

Options in order of preference:
- Use a batch OpenSpec CLI contract if available.
- Otherwise load status with bounded concurrency.
- Cache status records by change name and relevant artifact modified times.
- Skip status calls for unchanged changes during background refresh.

Status failures remain visible as command diagnostics and MUST NOT be converted into fake validation evidence.

## Bridge Responsiveness
Move heavy bridge work behind a bounded execution layer:

- Tauri command handlers should keep argument validation lightweight.
- Filesystem scans and process execution should run through blocking-task isolation or equivalent async command handling.
- CLI processes should have timeouts, kill-on-timeout behavior, and bounded captured output.
- Symlinked directories under `openspec/` should not recurse indefinitely.
- Markdown read failures should be reported per file or as a clear listing error instead of silently becoming missing content.

## Race Control
Repository operations should use a generation token or equivalent request identity:

- Ignore stale load, refresh, artifact-preview, and git-status responses if a newer request has superseded them.
- Do not start another background refresh while one is already in flight for the same repository.
- Quiet background git-status refreshes should not flash loading state or update React state when the payload has not changed.

## React and Rendering
Reduce avoidable work:

- Memoize Markdown block parsing by content.
- Parse full task groups only for the selected change's task detail, while keeping task counts available for table rows.
- Build validation issue maps once per workspace view instead of filtering all issues per row/spec.
- Use deferred search text or precomputed normalized search strings for large lists.
- Throttle column resize updates with `requestAnimationFrame` or update a CSS variable during drag and commit state on mouseup.
- Add row virtualization or a bounded rendering strategy when change/spec/archive counts exceed a practical threshold.

## Layout and UX Smoothness
Fix layout jank surfaced by the audit:

- Remove breakpoint dead zones where the fixed three-column shell can overflow while `body` cannot scroll.
- Avoid hard minimum row heights that clip inspector/status content at shorter desktop heights.
- Use one primary vertical scroller per panel where practical; nested Markdown/code scroll should not trap normal reading.
- Keep row hover/focus/selected states geometry-stable by reserving borders/padding or drawing states without changing metrics.
- Bound recent repository lists in the left rail.
- Make toolbar wrapping predictable with explicit grid/container-query behavior.

## Verification
Add coverage for:

- Indexer bucketing and signature behavior on large synthetic file lists.
- Bridge scan symlink safety and read-error reporting.
- Status concurrency/cache behavior.
- Stale response dropping for refresh/artifact preview.
- CSS/layout behavior through browser/UAT checks at compact and desktop sizes.

Run at minimum:

- `npm run check`
- `npm run test`
- `cd src-tauri && cargo test`
- `npm run build`

Use Tauri build/UAT before calling the change complete.
