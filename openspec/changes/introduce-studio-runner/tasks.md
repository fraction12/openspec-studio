## 1. Design

- [x] 1.1 Define Studio Runner product boundary, naming, and user-facing setup model.
- [x] 1.2 Define runner configuration fields, storage location, and secret-handling approach.
- [x] 1.3 Define runner status states such as not configured, stopped, starting, reachable, incompatible, and failed.
- [x] 1.4 Define the `build.requested` payload contract using a CloudEvents-like shape with stable event IDs.
- [x] 1.5 Define Standard Webhooks-style headers, timestamp handling, and HMAC-SHA256 signature scheme.
- [x] 1.6 Define idempotency and dedupe rules for retries and duplicate deliveries.
- [x] 1.7 Define change eligibility rules for enabling **Build with agent**.
- [x] 1.8 Decide exact Rust/Tauri command boundary for runner status, lifecycle, delivery, signing, timeouts, and persistence.
- [x] 1.9 Define the Studio Runner push dispatch API and explicitly exclude OpenSpec-as-tracker-adapter/polling behavior.
- [x] 1.10 Decide whether Runner initially adapts `build.requested` into the existing Symphony issue shape or introduces a separate runner work-item model.

## 2. Studio Implementation

- [x] 2.1 Add local Studio Runner settings UI/state.
- [x] 2.2 Add runner status detection and display in the app shell or change detail.
- [ ] 2.3 Add safe start/stop hooks for configured local runner paths where supported.
- [x] 2.4 Add per-change **Build with agent** action gated by eligibility and runner state.
- [x] 2.5 Implement thin `build.requested` payload construction without arbitrary file contents.
- [x] 2.6 Implement signed webhook delivery in the Tauri/Rust bridge.
- [x] 2.7 Add bounded timeout, response capture, and error reporting for delivery.
- [x] 2.8 Persist dispatch delivery attempts/status locally.
- [x] 2.9 Support manual retry using the same event ID/idempotency key for an existing failed delivery.
- [x] 2.10 Surface dispatch status/history in the selected change detail.

## 3. Runner Contract

- [x] 3.1 Document the expected Studio Runner push dispatch endpoint.
- [x] 3.2 Document runner health/status endpoint expectations.
- [x] 3.3 Document expected accepted response shape, including optional run ID.
- [x] 3.4 Document duplicate/in-flight repo/change behavior expected from Runner.
- [x] 3.5 Document that Runner reads OpenSpec artifacts from the repo after accepting work rather than relying on full file contents in the webhook payload.
- [x] 3.6 Document that Studio Runner dispatch bypasses tracker polling and does not require Linear.
- [ ] 3.7 Document the expected Runner flow from push event to orchestrator/workspace/agent-runner execution.

## 4. Verification

- [x] 4.1 Add unit tests for eligibility, runner status mapping, and payload construction.
- [x] 4.2 Add bridge tests for signature construction, timestamp handling, and raw-body signing.
- [ ] 4.3 Add bridge tests for runner status checks and bounded lifecycle command handling where implemented.
- [x] 4.4 Add tests for delivery failure, non-2xx response handling, and bounded error capture.
- [x] 4.5 Add tests proving manual retry reuses the existing event ID/idempotency key.
- [x] 4.6 Verify dispatch is never automatic on change creation/update/validation/archive-readiness.
- [x] 4.7 Run existing app, Rust, and OpenSpec validation checks.

## 5. Documentation

- [x] 5.1 Document Studio Runner as an optional local companion powered by the Studio Symphony fork.
- [x] 5.2 Document setup, runner status states, and safe local configuration.
- [x] 5.3 Document the webhook envelope, payload shape, signature verification, and replay window.
- [x] 5.4 Document that delivery is at-least-once and Runner must dedupe by event ID.
- [x] 5.5 Document that dispatch is explicit, one-change-at-a-time, and OpenSpec-only in this alpha.
