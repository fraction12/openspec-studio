## 1. Design

- [x] 1.1 Define SSE transport choice and local endpoint derivation.
- [x] 1.2 Define bridge/client ownership and bounded parsing constraints.
- [x] 1.3 Define stream event payload fields and merge key semantics.
- [x] 1.4 Define UI surfaces for execution/publication metadata.

## 2. Bridge Implementation

- [ ] 2.1 Add Tauri/Rust command(s) to start and stop the Studio Runner event stream.
- [ ] 2.2 Derive `/api/v1/studio-runner/events/stream` from the configured events endpoint using strict URL parsing.
- [ ] 2.3 Parse SSE frames and map runner event names/payloads into typed bridge events.
- [ ] 2.4 Bound stream frame/body handling and surface stream errors without blocking the app.
- [ ] 2.5 Stop/restart stream connections on endpoint or runner lifecycle changes.

## 3. App Model and Persistence

- [ ] 3.1 Extend runner dispatch attempts with execution metadata fields.
- [ ] 3.2 Add merge helpers keyed by `eventId` for stream updates.
- [ ] 3.3 Preserve local delivery status separately from runner execution status.
- [ ] 3.4 Normalize persisted records that do not yet include execution metadata.

## 4. UI Implementation

- [ ] 4.1 Render execution status in the Runner workspace build requests table.
- [ ] 4.2 Render PR URL, commit SHA, branch, workspace path, and session ID when available.
- [ ] 4.3 Render bounded blocked/failed error detail.
- [ ] 4.4 Surface stream connection state and manual reconnect action in the Runner inspector.
- [ ] 4.5 Show selected-change execution status/history in the change inspector.

## 5. Verification

- [ ] 5.1 Add Rust tests for endpoint derivation and SSE parsing.
- [ ] 5.2 Add app-model tests for stream update merging and persistence normalization.
- [ ] 5.3 Add UI/model tests for completed, blocked, failed, and running table rows.
- [ ] 5.4 Verify stream start/stop/reconnect behavior around runner lifecycle actions.
- [ ] 5.5 Run TypeScript, Vitest, build, Rust, and OpenSpec validation checks.
