# Design: Studio Runner event stream client

## Goals

- Treat Symphony as the source of truth for runner execution state after dispatch acceptance.
- Keep Studio local-first and bounded: localhost-only endpoint, bounded frame sizes, bounded reconnect behavior, and no arbitrary remote streaming.
- Merge updates into existing dispatch records instead of creating duplicate rows.
- Show PR/publication metadata directly in Studio once available.

## Transport

Studio SHALL connect to the configured Studio Runner SSE endpoint derived from the push endpoint:

- push endpoint: `/api/v1/studio-runner/events`
- stream endpoint: `/api/v1/studio-runner/events/stream`

The bridge SHALL reuse the existing local endpoint validation rules: `http`/`https`, host `localhost` or `127.0.0.1`, explicit port, and no userinfo.

SSE is preferred because the runner sends one-way state updates. Studio SHALL NOT add polling as the default behavior for this change.

## Bridge boundary

The Tauri/Rust bridge SHOULD own the HTTP stream connection and SSE parsing, then emit typed Tauri events to React. The bridge SHOULD expose commands such as:

- start runner event stream for the configured endpoint
- stop runner event stream
- get stream status or last error

The bridge SHALL bound response/frame parsing so a malformed runner cannot grow memory unbounded.

## Event model

The bridge SHALL parse runner events and deliver metadata to React using the event ID as the merge key. Expected events include:

- `runner.snapshot`
- `runner.accepted`
- `runner.running`
- `runner.completed`
- `runner.blocked`
- `runner.failed`
- fallback `runner.update`

Payload fields may include:

- `eventId`
- `runId`
- `repoChangeKey`
- `recordedAt`
- `status`
- `workspacePath`
- `sessionId`
- `branchName`
- `commitSha`
- `prUrl`
- `error`

Studio SHALL ignore unknown fields and preserve known metadata.

## Merge behavior

React/app-model code SHALL merge stream updates into `runnerDispatchAttempts` by `eventId`.

If a local delivery record already exists, the stream update SHALL enrich it with execution/publication fields. If no local record exists but the update belongs to the current repository, Studio MAY create a remote-observed history record so reopened app sessions or externally started streams still show runner state.

Local delivery state and runner execution state are related but distinct:

- delivery state answers whether Studio successfully sent the request
- execution status answers what Runner did with accepted work

## UI

The Runner workspace table SHALL show execution/publication status rather than only accepted delivery state. Rows SHOULD surface:

- running/completed/blocked/failed state
- change name
- event/run identity
- PR link when available
- short commit SHA when available
- branch name
- workspace/session metadata
- bounded blocker/error text
- last updated time

The selected-change inspector SHALL show the same execution status for that change's recent attempts, including PR links and blockers.

## Lifecycle

Studio SHALL start the stream after runner status becomes reachable and stop it when the runner is stopped, endpoint changes, or the app tears down. Restart/reconnect behavior SHOULD be bounded and visible if the stream fails.

Manual reconnect is allowed as an escape hatch. Continuous polling is not.

## Security and privacy

The stream remains localhost-only. Payloads are metadata-only and SHALL NOT include arbitrary repository contents or full agent logs. Secrets SHALL NOT be included in stream payloads or persisted stream records.
