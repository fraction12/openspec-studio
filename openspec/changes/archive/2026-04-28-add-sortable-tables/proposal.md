## Why

The changes and specs tables are scan-heavy surfaces, and users need a predictable way to bring the most relevant rows to the top. Updated time is the first sort users need because OpenSpec work is naturally reviewed by recency.

## What Changes

- Default changes and specs tables to newest-first sorting by the `Updated` column.
- Add a sort affordance/icon to the `Updated` column header.
- Let users toggle updated-time sorting between newest first and oldest first.
- Keep sorting derived from real indexed OpenSpec file metadata and preserve current row selection behavior.

## Capabilities

### New Capabilities

### Modified Capabilities
- `change-board`: Change table sorting and shared board-table sort affordance behavior.
- `workspace-intelligence`: Specs table sorting by updated time.

## Impact

- Shared table component sort state and header rendering in `src/App.tsx`.
- Updated-time comparison behavior for change and spec records.
- Tests for default sort order, toggle behavior, and selection preservation.
