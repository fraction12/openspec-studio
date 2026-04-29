## Context

The previous shape was “OpenSpec Studio sends a signed webhook to Symphony.” That is directionally correct but too external. The desired product is **Studio Runner**: an optional local companion runner, powered by the Studio-owned Symphony fork, that OpenSpec Studio can help install/configure/run so users do not have to bring their own Symphony setup.

Studio remains the operator/control plane. OpenSpec files remain the source of truth. Studio Runner owns orchestration and agent execution. The handoff between Studio and Runner is still event-first and webhook-shaped, but the user-facing model is integrated: enable runner, select change, click **Build with agent**.

Inspection of the Symphony fork matters here: its current implementation is a Linear polling orchestrator with tracker adapters feeding `Issue` records into an orchestrator, which then launches `AgentRunner` in isolated workspaces. For Studio Runner, the useful part is the orchestrator/workspace/agent-runner stack. The wrong part is the polling tracker boundary. OpenSpec dispatch should therefore enter through a push dispatch API and only then adapt into runner-owned work.

## Principles

- **Runner as companion, not side quest:** Users should not manually install upstream Symphony to use the OpenSpec path.
- **Explicit over automatic:** Agents start only when a user presses **Build with agent**.
- **Event over polling:** Studio sends a signed event; Runner does not poll Studio or scan for work.
- **One change per dispatch:** Every event targets exactly one active OpenSpec change.
- **Local-first:** Runner configuration, delivery history, and status stay local unless explicitly sent to the local runner endpoint.
- **Signed and idempotent:** Runner can verify origin and ignore duplicate delivery.
- **At-least-once delivery:** Duplicate deliveries are expected and safe.
- **Thin payloads:** Send identifiers and metadata, not arbitrary repository contents.
- **OpenSpec-only alpha:** This change does not generalize orchestration across future providers.

## Product Boundary

OpenSpec Studio should own:

- runner discovery/status display;
- runner settings/onboarding UI;
- the selected-change **Build with agent** action;
- local eligibility checks;
- signed dispatch delivery;
- local delivery history;
- displaying accepted/failed/retryable dispatch state.

Studio Runner should own:

- push dispatch ingress for `build.requested`;
- signature/timestamp/idempotency verification;
- repo/change claim logic;
- adaptation from an OpenSpec repo/change event into runner-owned work;
- isolated workspace creation;
- agent process orchestration;
- run status/log/result tracking;
- preventing duplicate concurrent runs for the same repo/change.

OpenSpec should remain unchanged and continue to provide the repo artifacts/state that both Studio and Runner read from disk.

## Runner Packaging Model

The initial implementation should treat Studio Runner as an optional companion process rather than code embedded into the main Studio binary.

Preferred v1 posture:

1. Studio detects whether a compatible runner is configured and reachable.
2. If not configured, Studio offers setup guidance and/or a managed install path.
3. Studio stores the local endpoint and signing secret/reference.
4. Studio can start/stop the runner when a safe local command/path is configured.
5. Studio dispatches to the local runner endpoint once the runner is reachable.

This preserves a seamless product while keeping upgrades, failures, and platform packaging isolated from the core Studio app.

## Eligibility

Studio should derive whether **Build with agent** is enabled from local evidence. Initial eligibility should require:

1. a real OpenSpec-backed repository is open;
2. one active change is selected;
3. required planning artifacts are present according to the current change model;
4. `tasks.md` exists and contains actionable tasks;
5. latest validation for the change or workspace has passed, or Studio can run validation immediately before dispatch and it passes;
6. Studio Runner settings are configured;
7. Studio Runner is reachable, or Studio can start it successfully before dispatch.

If any requirement fails, Studio should show the blocking reason rather than sending.

## Symphony Fork Adaptation

The Studio-owned Symphony fork should add a push dispatch path alongside, not inside, the existing tracker polling loop. A reasonable implementation shape is:

```text
Studio POST /api/v1/studio-runner/events
  -> verify Standard Webhooks-style envelope
  -> reject stale or duplicate event IDs
  -> validate repo/change payload
  -> claim repo/change if no run is already active
  -> adapt payload into runner work metadata
  -> call orchestrator push-dispatch entrypoint
  -> reuse workspace creation and AgentRunner execution
  -> return accepted status and optional run ID
```

The runner may reuse the existing internal issue/work item shape as an implementation detail, but OpenSpec changes should not be represented as tracker records that must be discovered by polling. The OpenSpec path is explicit, event-triggered, and one-change-at-a-time.

## Dispatch Flow

1. User selects an active change.
2. Studio computes eligibility and runner state.
3. Studio enables **Build with agent** only when local prerequisites are satisfied.
4. User presses the button.
5. Studio optionally revalidates before dispatch if the current validation snapshot is stale.
6. Studio constructs a `build.requested` payload.
7. Studio signs the payload.
8. Studio POSTs to the configured Studio Runner push dispatch endpoint.
9. Runner verifies, deduplicates, claims the repo/change pair, and either accepts or rejects the request.
10. Studio records delivery status, response metadata, and timestamp locally.
11. Runner owns agent execution after accepting the event.
12. If Runner returns a run ID, Studio stores and displays it with the dispatch record.

## Webhook Envelope

Studio should send a Standard Webhooks-style envelope:

```http
webhook-id: evt_...
webhook-timestamp: 1710000000
webhook-signature: v1,<base64-hmac-sha256>
content-type: application/json
```

The signed content should be derived from:

```text
webhook-id.webhook-timestamp.raw-body
```

The receiver should verify using constant-time comparison and reject stale timestamps. A five-minute default replay window is a reasonable starting point.

## Payload Contract

The payload should use a CloudEvents-like shape:

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

The payload should not include full proposal/design/tasks/spec contents by default. Studio Runner or the spawned agent should read the repository directly after verifying and claiming the work.

## Delivery and Retry Semantics

Delivery is at-least-once. Studio Runner must assume duplicates can arrive.

For v1, Studio should avoid background retry machinery. A safer first implementation is:

- send once when the user clicks **Build with agent**;
- record the delivery result;
- if delivery fails, show **Retry dispatch**;
- retry with the same event ID/idempotency key for the same delivery record;
- create a new event ID only when the user intentionally starts a fresh dispatch.

Studio should treat `2xx` as delivered/accepted depending on response body. It should record non-2xx responses and network failures as failed delivery attempts with bounded response/error detail.

## Studio Runner Receiver Expectations

The runner implementation is outside this Studio change, but the Studio contract should assume the receiver will:

1. expose a push dispatch endpoint such as `POST /api/v1/studio-runner/events`;
2. verify signature and timestamp;
3. deduplicate by `webhook-id` / payload `id`;
4. validate that the event is a supported `build.requested` payload;
5. claim one active run for the repository/change pair;
6. reject or no-op duplicate in-flight requests for the same repository/change;
7. adapt the OpenSpec event into runner-owned work without polling Studio or Linear;
8. create an isolated workspace;
9. enqueue one agent run through the existing runner/orchestrator machinery;
10. return a run ID when available for Studio to display.

This prevents double-spawning agents when a request is retried or delivered twice.

## Rust/Tauri Boundary

Runner integration should execute through the Tauri/Rust bridge where it touches secrets, local processes, networking, or filesystem state.

Rust should own:

- signing-secret access;
- HMAC construction;
- raw-body signing;
- HTTPS/HTTP POST;
- request timeout;
- bounded response/error capture;
- delivery history persistence;
- safe runner status checks;
- safe runner start/stop commands when configured.

React should request dispatch for a selected change and render eligibility, runner state, progress, and history.

## Security Notes

The endpoint must be explicit and local by default. Studio should not send arbitrary file contents by default. Signing secrets should not be casually exposed to the renderer. Runner start/stop should avoid arbitrary shell execution; if Studio supports managed lifecycle commands, they should use explicit configured paths or bundled metadata rather than freeform command strings.

The implementation should support future secret rotation by making verification compatible with key IDs or multiple signatures later, even if v1 stores one secret.

## Open Questions

- Should the first managed install path download a release artifact, use a checked-out local runner repo, or only document setup?
- Should the signing secret be stored directly in Tauri store, macOS Keychain later, or supplied via environment variable?
- Should Runner return a run ID synchronously on accepted dispatch?
- Should dispatch history be global, per repo, or per change in local persistence?
- What is the minimum runner health endpoint Studio should require before enabling dispatch?
- Should the first push-dispatch implementation reuse Symphony's `Issue` struct internally or introduce a separate `WorkItem` domain model immediately?
