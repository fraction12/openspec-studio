# Show Studio Runner execution logs

## Why
The Runner Log should explain runner work without making users inspect terminals, Symphony logs, or worktree files manually. Today it is a useful summary ledger, but it mixes real runs with local lifecycle/stream noise and does not expose enough execution context for active or blocked runs.

The current UI can also show misleading statuses for non-run events, such as a stream connection row appearing as `running`. That makes sense for a real run, but not for runner lifecycle or stream diagnostics.

## What changes
- Keep the Runner Log as the main summary table.
- Add expandable rows for per-run execution details.
- Use Symphony's current SSE payload fields for run metadata: event/run identity, workspace/session, branch/commit/PR, cleanup, and error details.
- Show explicit unavailable/not-yet-provided states when Symphony does not provide structured execution log entries yet.
- Derive bounded summary milestones from existing Symphony fields while leaving room for future first-class execution-log events.
- Collapse duplicate lifecycle/stream/diagnostic rows instead of appending repeated noise.
- Replace one-size-fits-all Status semantics with row-kind-aware State semantics.
- Keep execution log content structured, bounded, local-only, and safe to render.

## Out of scope
- Turning Studio into a terminal emulator.
- Streaming arbitrary raw stdout/stderr or full Codex transcripts into React state.
- Requiring a new Symphony endpoint for v1.
- Changing runner dispatch semantics, signing, capacity, workspace creation, cleanup, or publication completion rules.
- Persisting full raw agent transcripts forever in Studio app state.
- Treating lifecycle/stream connectivity events as fake runs.

## Impact
- `studio-runner-session`: normalize row kinds, dedupe non-run rows, derive row-kind-aware state, merge current Symphony stream metadata, and hold bounded run execution details.
- `local-desktop-shell`: Runner Log table column/copy cleanup plus expandable run detail rows.
- Symphony follow-up: optional future structured execution-log entries on the existing stream or a bounded local detail endpoint.
