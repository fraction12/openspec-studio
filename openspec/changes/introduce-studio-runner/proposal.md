## Why

OpenSpec Studio should not require users to install and wire Symphony by hand before they can hand an OpenSpec change to an agent. Studio is becoming the local operator surface for OpenSpec work, so the agent-runner path should feel first-class: install Studio, enable an optional **Studio Runner**, then dispatch one selected change with **Build with agent**.

The right product boundary is not “generic webhook to an external Symphony someone else installed.” It is **Studio Runner**: an optional companion runner, powered by the Studio-owned Symphony fork, configured to work with OpenSpec and OpenSpec Studio out of the box.

This keeps Studio focused as the human control plane, keeps OpenSpec files as the source of truth, and gives users a real orchestration path without polling, Linear dependency, or prototype sidecars.

## What Changes

- Reframe the previous Symphony webhook integration as **Studio Runner**.
- Add an optional companion runner integration that Studio can detect, configure, start, stop, and dispatch work to.
- Treat the Studio-owned Symphony fork as the runner engine, not as an external dependency users must install manually.
- Add a push dispatch API to Studio Runner rather than modeling OpenSpec work as a polled tracker adapter.
- Reuse Symphony's existing orchestrator, workspace, and agent-runner machinery behind that push API.
- Add a per-change **Build with agent** action that emits a `build.requested` event for one selected active change.
- Send dispatch to a local Studio Runner ingress endpoint by default, using signed, idempotent webhook semantics.
- Keep dispatch explicitly user-triggered; ordinary change creation, edits, validation, and archive readiness SHALL NOT automatically start agents.
- Keep payloads thin: send identifiers, repo/change metadata, validation state, and artifact paths rather than full repository contents.
- Record local runner connection state and dispatch delivery/history so users can see whether the runner is missing, stopped, reachable, accepted work, failed, or retryable.
- Leave OpenSpec CLI/core unchanged for this change.

## Capabilities

### Modified Capabilities

- `change-board`: Exposes a per-change **Build with agent** action, eligibility reasons, runner status, and dispatch history.
- `local-desktop-shell`: Supports local Studio Runner settings, lifecycle integration, signed dispatch, and bounded delivery.

### Possible Follow-up Capabilities

- `workspace-intelligence`: May later surface runner job history, logs, result summaries, and agent proof back into Studio.
- `validation-dashboard`: May later explain dispatch-blocking validation issues in more detail.

## Product Model

Studio Runner is an optional companion to OpenSpec Studio:

```text
OpenSpec Studio
  inspect / validate / archive OpenSpec repos
  show runner status
  dispatch selected change

Studio Runner
  local companion process powered by the Studio Symphony fork
  exposes push dispatch and status APIs
  receives signed build.requested events
  adapts the event into runner-owned work without polling or tracker discovery
  claims repo/change work
  creates isolated workspace
  runs agent
  reports status/result

OpenSpec repo
  remains source of truth on disk
```

Studio should feel integrated even though the runner is a companion process. Users should not need to understand upstream Symphony setup just to use the OpenSpec path.

## Event Model

The first event is:

- `build.requested`

This event means: a human operator explicitly requested that Studio Runner build one selected OpenSpec change.

Readiness remains derived locally from OpenSpec state. Studio may compute that a change is eligible, but it SHALL NOT emit an event merely because the change became valid.

The envelope should use common webhook practice:

```http
webhook-id: evt_...
webhook-timestamp: 1710000000
webhook-signature: v1,<base64-hmac-sha256>
content-type: application/json
```

Example payload shape:

```json
{
  "id": "evt_01j...",
  "type": "build.requested",
  "source": "openspec-studio",
  "time": "2026-04-29T12:40:10Z",
  "data": {
    "runner": "studio-runner",
    "repoPath": "/path/to/repo",
    "repoName": "openspec-studio",
    "repoRemote": "git@github.com:fraction12/openspec-studio.git",
    "gitRef": "main",
    "change": "introduce-studio-runner",
    "artifactPaths": [
      "openspec/changes/introduce-studio-runner/proposal.md",
      "openspec/changes/introduce-studio-runner/design.md",
      "openspec/changes/introduce-studio-runner/tasks.md"
    ],
    "validation": {
      "state": "passed",
      "checkedAt": "2026-04-29T12:40:00Z"
    },
    "requestedBy": "local-user"
  }
}
```

Exact fields can evolve during implementation, but the contract must remain change-scoped, explicit, signed, idempotent, and safe to receive more than once.

## Studio Runner Dispatch Boundary

Inspection of the Symphony fork shows the upstream service is currently built around polling Linear, normalizing tracker issues, and dispatching those issues into the orchestrator. The OpenSpec Studio path SHALL NOT force OpenSpec changes through that polling/tracker adapter boundary.

Instead, Studio Runner SHALL expose a push dispatch ingress that verifies a signed `build.requested` event, deduplicates it, claims the repository/change pair, adapts it into runner-owned work, and then invokes the same orchestration path that launches isolated workspaces and agent runs. The existing tracker polling path may remain for upstream compatibility, but it is not the OpenSpec Studio integration model.

## Delivery Semantics

Delivery SHALL be treated as at-least-once. Studio may retry a failed delivery only as an explicit user action in v1, and retrying SHOULD reuse the same event ID/idempotency key for the same delivery record. Studio Runner MUST deduplicate by event ID and SHOULD prevent concurrent duplicate agent runs for the same repository/change pair.

## Non-Goals

- No polling-based work discovery.
- No OpenSpec-as-tracker-adapter implementation.
- No Linear dependency in the OpenSpec path.
- No upstream OpenSpec CLI/core changes.
- No automatic agent dispatch for every active change.
- No generic provider-agnostic orchestration layer in this change.
- No hosted relay or cloud control plane.
- No background retry daemon in v1.
- No requirement to embed the full runner inside the main Studio app binary.

## Impact

- Frontend change-detail/action area for **Build with agent** and runner state.
- Local settings/onboarding for Studio Runner endpoint, secret, and lifecycle.
- Tauri/Rust bridge for runner detection, lifecycle commands where safe, signed outbound delivery, timeouts, and local delivery persistence.
- Tests for eligibility gating, payload construction, signature behavior, runner availability states, delivery status, duplicate/retry semantics, and failure handling.
- Documentation that Studio supports an optional local Studio Runner for OpenSpec change execution.
