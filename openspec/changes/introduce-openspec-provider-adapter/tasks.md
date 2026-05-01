## 1. Provider contract

- [x] Add `spec-provider-adapters` delta spec with deterministic provider contract requirements.
- [x] Define frontend provider types for detection, capabilities, indexing, artifact reading, validation, archive, change status, and Git status.
- [x] Add provider id, label, and capabilities to repository and workspace state.
- [x] Document in code which operations are deterministic now and which are future extension points.
- [x] Add a provider registry that activates built-in providers deterministically.
- [x] Define a provider session module interface for active repository workflow orchestration.

## 2. OpenSpec provider extraction

- [x] Move current OpenSpec detection into an `OpenSpecProvider` boundary.
- [x] Move current OpenSpec file listing, metadata refresh, file-signature, and workspace indexing orchestration behind the provider boundary.
- [x] Move current OpenSpec per-change status loading, freshness keys, caching, and bounded concurrency behind the provider boundary.
- [x] Route artifact reads through the OpenSpec provider without loosening `openspec/` path restrictions.
- [x] Route validation through the OpenSpec provider without loosening `validate --all --json` command allowlists.
- [x] Route archive actions through the OpenSpec provider without loosening change-name validation.
- [x] Route OpenSpec Git status loading through the OpenSpec provider without broadening Git command scope.
- [x] Preserve operation issue recording for repository reads, artifact reads, status, validation, archive, and Git failures.
- [x] Move active repository load, refresh, validation, archive, artifact read, Git status, operation diagnostics, and stale-result guard ownership into the provider session.
- [x] Keep UI-owned state in `App.tsx`: current view, filters, selected row, selected tab, busy flags, and user-facing messages.

## 3. UI preservation

- [x] Preserve current change board, specs view, artifact inspector, validation dashboard, and archive behavior.
- [x] Surface active provider metadata in state and in a small UI label only where it clarifies unsupported/no-provider states.
- [x] Keep no-workspace behavior clear when no provider matches.
- [x] Keep browser preview clearly separated from real provider-backed repository data.
- [x] Gate validation, archive, artifact, status, and Git actions from provider capabilities instead of OpenSpec-specific assumptions in UI components.

## 4. Safety and tests

- [x] Add tests for OpenSpec provider detection and activation.
- [x] Add tests that unsupported/no-provider workspaces cannot run validation or archive actions.
- [x] Add tests proving current OpenSpec workspace indexing output remains stable through the provider boundary.
- [x] Add tests proving artifact reads remain path-bounded to `openspec/`.
- [x] Add tests proving provider activation preserves stale-result guards during repository load, refresh, validation, and artifact preview.
- [x] Add tests proving provider session rejects unsupported provider actions before bridge invocation.
- [x] Add tests proving provider session verifies post-archive state and reports partial bulk-archive progress.
- [x] Verify Tauri bridge commands remain path-bounded and allowlisted.

## 5. Verification

- [x] Run `npm test`.
- [x] Run `npm run check`.
- [x] Run `npm run build`.
- [x] Run `cd src-tauri && cargo check`.
- [x] Run `openspec validate introduce-openspec-provider-adapter` and `openspec validate --all`.
