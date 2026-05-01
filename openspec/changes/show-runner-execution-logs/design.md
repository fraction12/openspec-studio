# Design: Runner execution logs

## Problem
The Runner workspace currently mixes actual run rows with local lifecycle and stream rows. That makes the table noisy and confusing: duplicate `stream.error` rows can pile up, and non-run events can show run-only statuses such as `running`, `unknown`, or `failed`.

The current table also stops at summary state. It can show that a run is running, blocked, failed, or completed, plus publication metadata when Symphony provides it, but it does not show the actual execution trail that explains what happened inside the runner.

The goal is a clear operational log:

- summary table stays compact
- actual runs are distinct from local lifecycle/stream/diagnostic events
- duplicate non-run noise is collapsed
- each run row can expand to show bounded execution details
- Studio uses Symphony's current stream payload honestly before asking for richer follow-up data

## Current Symphony data contract
This change is Studio-side first. Symphony already exposes useful runner state over `GET /api/v1/studio-runner/events/stream`, and Studio should consume all currently available fields before inventing new requirements.

Current stream behavior:

- sends SSE frames named `runner.snapshot`, `runner.update`, `runner.accepted`, `runner.running`, `runner.completed`, `runner.blocked`, or `runner.failed`
- sends an initial snapshot and subsequent updates from the orchestrator dashboard publisher
- includes one frame per known Studio Runner event
- currently does not emit structured step-by-step execution log entries

Current event payload fields Studio can use:

- identity: `eventId`, `runId`, `repoChangeKey`, `recordedAt`, `status`
- workspace/session: `workspacePath`, `workspaceStatus`, `workspaceCreatedAt`, `workspaceUpdatedAt`, `sessionId`
- git/publication: `sourceRepoPath`, `baseCommitSha`, `branchName`, `commitSha`, `prUrl`, `prState`, `prMergedAt`, `prClosedAt`
- cleanup: `cleanupEligible`, `cleanupReason`, `cleanupStatus`, `cleanupError`
- failure: `error`

Initial signed dispatch responses provide: `status`, `eventId`, `runId`, `repoPath`, `repoName`, and `change`.

Studio should treat those fields as the v1 source of truth for summary rows and expandable run metadata. True execution-log entries are a forward-compatible extension: Studio should define the model and UI now, but tolerate Symphony not providing entries yet by showing an explicit unavailable/not-yet-provided state.

## Row model
Runner Log rows should carry a row kind:

- `run`: a real Studio Runner dispatch/run, keyed by `eventId` and/or `runId`
- `lifecycle`: local runner lifecycle events such as start, stop, restart, health check
- `stream`: local event stream connect/disconnect/error events
- `diagnostic`: local warnings/errors that are not tied to a run

Only `run` rows use run statuses:

- `accepted`
- `running`
- `completed`
- `blocked`
- `failed`
- `conflict` if surfaced from dispatch

Non-run rows use state/severity labels instead:

- stream: `connecting`, `connected`, `disconnected`, `error`
- lifecycle: `started`, `stopped`, `restarted`, `healthy`, `error`
- diagnostic: `info`, `warning`, `error`

If a non-run row's message already communicates the state, Studio may omit the badge rather than showing a misleading status pill.

## Table columns
Use a general table shape that works for both run and non-run rows:

- **Event**: row kind + event type, for example `Run · build.requested`, `Runner · runner.started`, or `Stream · stream.connected`
- **State**: run status for actual runs; event state/severity for non-run rows; may be blank when redundant
- **Subject**: change name for run rows, otherwise runner/stream/endpoint context
- **Message**: short summary of the event or latest update
- **Updated**: latest event/update timestamp

Implementation can keep extra hidden/secondary text such as event ID, run ID, branch, PR, or repeat count, but the table should not force every row into a run-centric vocabulary.

## Duplicate cleanup
Repeated non-run rows should collapse rather than append forever.

Dedupe key for non-run rows:

- repository path or repository identity
- endpoint when relevant
- row kind
- event type
- normalized message/error text

Collapse behavior:

- collapse indefinitely for the current retained history slice, not only a short time window
- preserve first timestamp, latest timestamp, and repeat count
- show repeat count or latest occurrence in the row when count is greater than 1
- update the row message/details with the latest bounded error detail when useful

Run rows must not use this collapse rule. Distinct `eventId` or `runId` values remain distinct rows even if their messages match.

## Execution log entry model
Add a run-scoped execution log concept separate from the summary row:

- `runId` and/or `eventId`
- `recordedAt`
- `level`: `debug | info | warning | error`
- `source`: `runner | orchestrator | agent | tool | git | validation | publication | cleanup`
- `phase`: optional normalized phase such as `ingress`, `workspace`, `artifacts`, `agent`, `validation`, `publication`, `cleanup`
- `message`: short human-readable text
- `details`: optional bounded structured metadata
- `sequence`: optional monotonic ordering key from the runner
- `truncated`: optional flag when content was shortened

For v1, Studio should derive a small number of synthetic detail entries from the existing Symphony summary payload when no explicit execution log entries exist. Examples:

- accepted/running/blocked/completed/failed status updates
- workspace path/status/create/update metadata
- branch/base/commit/PR publication metadata
- cleanup eligibility/status/error metadata
- final error/blocker text

Those synthetic entries should be clearly treated as summary-derived milestones, not as raw agent transcripts.

## Bounds and retention
Studio stores only a bounded recent slice:

- retain execution details for the latest 50 run rows per repository
- retain at most 200 execution log entries per run
- truncate each entry message/details display around 4 KB
- expose a truncation indicator when entry or run bounds are hit
- preserve summary rows separately according to the existing Runner Log retention behavior

The runner/workspace remains the source of truth for richer historical logs when available.

## Details UI
Use expandable rows, not a separate terminal view.

When a run row is expanded, show:

- run identity: event ID, run ID, change, repo/change key
- current run status
- workspace/session metadata: workspace path, workspace status, created/updated timestamps, session ID
- git/publication metadata: source repo, base commit, branch, commit, PR URL/state/merged/closed timestamps
- cleanup metadata: eligible/reason/status/error
- chronological execution entries
- explicit states: loading, empty, unavailable/not provided by runner, disconnected, error, truncated

Non-run rows may expand to show bounded diagnostic details and repeat metadata, but they do not need the full run execution surface.

## Delivery
Studio should prefer the existing SSE stream for all available runner summary data. The frontend should be ready to accept future structured execution-log entries on the same stream or via a local-only detail endpoint.

If a future endpoint is added, it must use the same local endpoint restrictions and bounded-response behavior as existing runner communication. This change should not require that endpoint for v1.

## Safety
- Do not render unbounded raw stdout/stderr or Codex transcripts.
- Do not store secrets, signatures, auth headers, or raw environment values.
- Treat log details as local operational data.
- Keep unavailable logs explicit instead of silently showing an empty panel.
- Do not add cloud dependencies or broader dispatch semantics.
