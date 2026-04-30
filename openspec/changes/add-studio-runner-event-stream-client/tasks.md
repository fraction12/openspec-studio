## 1. Design

- [x] 1.1 Define SSE transport choice and local endpoint derivation.
- [x] 1.2 Define bridge/client ownership and bounded parsing constraints.
- [x] 1.3 Define stream event payload fields and merge key semantics.
- [x] 1.4 Define unified Runner Log surfaces for execution/publication/lifecycle metadata.

## 2. Bridge Implementation

- [x] 2.1 Add Tauri/Rust command(s) to start and stop the Studio Runner event stream.
- [x] 2.2 Derive `/api/v1/studio-runner/events/stream` from the configured events endpoint using strict URL parsing.
- [x] 2.3 Parse SSE frames and map runner event names/payloads into typed bridge events.
- [x] 2.4 Bound stream frame/body handling and surface stream errors without blocking the app.
- [x] 2.5 Stop/restart stream connections on endpoint or runner lifecycle changes.

## 3. App Model and Persistence

- [x] 3.1 Extend runner log records with execution metadata fields.
- [x] 3.2 Add merge helpers keyed by `eventId` for stream updates and stable local IDs for lifecycle/status events.
- [x] 3.3 Preserve local delivery status separately from runner execution status.
- [x] 3.4 Normalize persisted records that do not yet include execution metadata.
- [x] 3.5 Record Studio Runner lifecycle/status events in the Runner Log.

## 4. UI Implementation

- [x] 4.1 Rename the main Runner workspace table to Runner Log and remove build-request framing/subtext.
- [x] 4.2 Render all Studio Runner-related log events in the Runner Log.
- [x] 4.3 Render PR URL, commit SHA, branch, workspace path, and session ID when available.
- [x] 4.4 Render bounded blocked/failed error detail.
- [x] 4.5 Surface stream connection state and manual reconnect action in the Runner inspector.
- [x] 4.6 Show selected-change execution status/history in the change inspector.

## 5. Verification

- [x] 5.1 Add Rust tests for endpoint derivation and SSE parsing.
- [x] 5.2 Add app-model tests for stream update merging, lifecycle/status log records, and persistence normalization.
- [x] 5.3 Add UI/model tests for completed, blocked, failed, running, and lifecycle/status log rows.
- [x] 5.4 Verify stream start/stop/reconnect behavior around runner lifecycle actions.
- [x] 5.5 Run TypeScript, Vitest, build, Rust, and OpenSpec validation checks.
