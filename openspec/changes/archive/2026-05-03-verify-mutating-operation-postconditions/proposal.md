# Change: Verify mutating operation postconditions

## Why
Studio has now hit the same class of failure twice: a local CLI command reported success, or at least exited with status 0, while the intended repository mutation did not actually happen. In the archive case, OpenSpec printed `Aborted. No files were changed.` with a zero exit code, and Studio treated that as success because it trusted process status instead of repository state.

That is the wrong trust boundary. For local-first tooling, success must be based on the observed postcondition, not just the command's tone of voice.

## What changes
- Introduce a state-based success contract for mutating desktop bridge operations.
- Require each mutating operation to define and verify an explicit postcondition before Studio reports success.
- Persist or surface a durable operation issue when a command exits successfully but the postcondition fails.
- Apply the first concrete contract to archive: the active change must disappear from `openspec/changes/<name>`, an archived change must appear under `openspec/changes/archive/...`, and affected specs/files must be re-indexed from disk before success is shown.
- Add regression coverage for zero-exit/no-op command output and stale UI success states.

## Impact
- Users stop seeing false-positive success after no-op or partially failed mutations.
- Archive and future write flows become conservative by default.
- Bridge responses become richer: command status plus verified state delta/postcondition result.
- The UI may show more “failed/no-op” states, but those states will match the filesystem.

## Non-goals
- Changing OpenSpec CLI archive semantics.
- Making every read-only command postcondition-verified.
- Building a generic transaction engine for arbitrary shell commands.
