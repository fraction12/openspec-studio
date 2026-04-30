## Why

The change table currently uses a **Trust** column whose labels can imply a change is blocked when OpenSpec can still operate on it. In particular, missing optional planning artifacts such as `design.md` can make a row look blocked even though OpenSpec archive is allowed and the actual next step may simply be validation or build work.

The board needs a simpler workflow signal that matches what users do in Studio: validate the current snapshot, build active work that still has actionable tasks, and recognize completed changes as done.

## What Changes

- Rename the change table **Trust** column to **Build Status**.
- Replace artifact-health labels with four workflow labels:
  - **Validate**: validation has not been run, is stale, is running, or is otherwise unknown for the current OpenSpec snapshot.
  - **Ready**: validation is current and passing, and the active change still has actionable open tasks to build.
  - **Incomplete**: validation has run, but the change is not ready to build because tasks are missing, empty, failed validation blocks the change, or required OpenSpec status data indicates incomplete work.
  - **Done**: the task list is complete and the change is archive-ready rather than build-ready.
- Do not mark a change as blocked/incomplete solely because `design.md` is missing when OpenSpec does not require it for the relevant workflow state.

## Impact

- Affected specs: `change-board`
- Affected code: change table column label and build-status derivation for active/archive-ready rows
- Non-goals: changing runner dispatch behavior, changing OpenSpec archive behavior, or hiding missing artifact details in the inspector
