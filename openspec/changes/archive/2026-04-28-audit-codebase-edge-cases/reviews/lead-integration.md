# Lead Integration Review

## Summary

- P0: 0
- P1: 0
- P2: 2
- P3: 0

This pass focused on cross-lane failure modes after reading the frontend, model, bridge, validation/tooling, and OpenSpec contract reviews.

## Finding 1: Bulk archive failure leaves the view stale after partial mutation

- `Severity`: P2
- `Area`: Archive workflow / refresh consistency
- `File`: `src/App.tsx`
- `Lines`: 699-708
- `Problem`: `archiveAllChanges` archives changes sequentially and only refreshes the repository after the full loop succeeds. If one archive succeeds and a later archive fails, the catch path sets the load state back to loaded and shows the error, but does not reload the repository.
- `Why it matters`: The underlying OpenSpec tree may have already changed, while the UI still shows the pre-archive archive-ready list. A user can retry against rows that have already moved, producing more failures and reducing trust in the tool's derived state.
- `Reproduction or evidence`: Make two changes archive-ready, then cause the second `openspec archive` call to fail after the first succeeds. Lines 699-703 mutate the first change, and lines 706-708 handle the error without calling `loadRepository(repo.path)`.
- `Recommended fix`: Track whether any archive command succeeded and always refresh after a partial mutation before showing the final error. Consider reporting partial success with the names archived and the name that failed.

## Finding 2: General OpenSpec command allowlist validates only the subcommand

- `Severity`: P2
- `Area`: Desktop bridge command boundary
- `File`: `src-tauri/src/bridge.rs`
- `Lines`: 379-384, 454-468
- `Problem`: `run_openspec_command` accepts arbitrary arguments as long as the first argument is one of `list`, `show`, `status`, or `validate`. It does not validate supported flag combinations, path-like values, or unexpected extra arguments for the product's known call sites.
- `Why it matters`: The frontend currently calls only narrow command shapes, but the native invoke surface is broader than the product needs. If a future UI bug, XSS, or plugin path reaches the invoke API, it can exercise unreviewed OpenSpec CLI behavior from inside the selected repository.
- `Reproduction or evidence`: `validate_openspec_args` returns `Ok(())` for any argument vector beginning with an allowed subcommand, including unsupported combinations that the app never intentionally calls.
- `Recommended fix`: Replace the generic subcommand-only allowlist with per-command validators for the exact product command shapes currently needed, such as `validate --all --json` and `status --change <safe-change-name> --json`. Keep dedicated write commands, like archive, separately validated.
