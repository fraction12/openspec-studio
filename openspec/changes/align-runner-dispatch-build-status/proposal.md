## Why

The change table now exposes a single Build Status value for change readiness, but the **Build with agent** action still repeats older hidden checks for artifacts, tasks, and validation. That can make the table say **Ready** while the button is disabled for a different private reason.

## What Changes

- Make **Build with agent** consume the selected change's existing Build Status readiness.
- Enable build dispatch for a selected active change only when its Build Status is **Ready** and runner environment prerequisites are satisfied.
- Remove duplicate artifact, task, and validation readiness checks from runner dispatch eligibility.
- Keep runner-specific prerequisites separate: real repository, configured endpoint, session secret, and reachable runner.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-board`: change inspector agent dispatch uses the same Build Status readiness shown in the table.

## Impact

- Affected code: runner dispatch eligibility derivation and selected-change dispatch calls.
- Affected tests: dispatch eligibility tests for ready, not-ready, and no-design buildable changes.
- No new app functionality, runner protocol changes, or OpenSpec archive behavior changes.
