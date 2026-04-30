# Design: Mutating operation postcondition verification

## Problem
Studio currently has command bridges that can treat process success as operation success. That breaks down when a CLI exits 0 but reports a no-op, partial failure, or aborted mutation in stdout/stderr. The archive flow exposed this: the command returned successfully while no files moved, leaving the UI in a false-success state.

## Principle
Every local mutation gets two separate outcomes:

1. **Command outcome** — process spawn/exit/stdout/stderr/timeout.
2. **Postcondition outcome** — observed repository state proves the intended mutation happened.

Studio may only report success when both outcomes are acceptable.

## Operation contract
Each mutating bridge operation should declare:

- operation kind, e.g. `archive-change`
- target repository and target entity
- allowed command shape
- expected postcondition
- state evidence used to verify the postcondition
- failure message when the command succeeded but the postcondition failed

For archive, the expected postcondition is:

- `openspec/changes/<change-name>` no longer exists as an active change
- an archived change for `<change-name>` exists under `openspec/changes/archive/<date>-<change-name>` or equivalent OpenSpec archive path
- indexed workspace state is rebuilt from disk after the command
- selection moves to the archived change only after that rebuilt state contains it

## UI model
A mutation can finish as:

- `succeeded` — command succeeded and postcondition verified
- `failed` — command failed or bridge failed
- `no-op` / `postcondition-failed` — command returned successfully but the expected filesystem/index state did not materialize

The UI should avoid optimistic “Archived …” messages until the postcondition is verified. If verification fails, operation issues should include command output and the missing postcondition evidence.

## Testing strategy
Add regression tests for:

- zero exit plus `Aborted. No files were changed.` does not count as archive success
- archive command success without active-change removal is surfaced as postcondition failure
- successful archive refreshes indexed files and selects the archived record only after it exists
- stale background refresh cannot overwrite a verified mutation result

## Risks
- Postcondition checks can be too strict if OpenSpec changes archive layout. Keep the check based on the app's indexed active/archived change model rather than hardcoding only one path shape where possible.
- Some future write operations may need partial-success semantics. Those should define explicit postconditions instead of falling back to exit-code trust.
