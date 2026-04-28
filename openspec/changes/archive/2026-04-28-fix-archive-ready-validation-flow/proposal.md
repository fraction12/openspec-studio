# Fix Archive Ready Validation Flow

## Why
The Archive ready board currently depends on a current clean validation snapshot. After archiving one change, the snapshot becomes stale and the remaining completed changes can disappear or require another manual validation run. The archive action also fails for `fix-codebase-edge-case-audit` because its deltas are marked as `MODIFIED` even though the target requirements do not exist in baseline specs.

## What Changes
- Treat a change as archive-ready when its task list is complete.
- Run validation automatically when the user presses Archive or Archive all.
- Only proceed with archive when that just-run validation passes.
- Keep validation errors visible in the app instead of requiring the user to discover the workflow manually.
- Correct the active remediation change deltas so OpenSpec can archive it.

## Impact
- The Archive ready board becomes stable after earlier archive operations.
- Archive actions become safer: they validate immediately before mutating files.
- `fix-codebase-edge-case-audit` can be archived by the app/CLI.
