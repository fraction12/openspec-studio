## 1. Provider contract

- [ ] Add `spec-provider-adapters` delta spec with deterministic provider contract requirements.
- [ ] Define frontend provider types for detection, capabilities, indexing, artifact reading, validation, archive, change status, and Git status.
- [ ] Add provider id, label, and capabilities to repository and workspace state.
- [ ] Document in code which operations are deterministic now and which are future extension points.
- [ ] Add a provider registry that activates built-in providers deterministically.

## 2. OpenSpec provider extraction

- [ ] Move current OpenSpec detection into an `OpenSpecProvider` boundary.
- [ ] Move current OpenSpec file listing, metadata refresh, file-signature, and workspace indexing orchestration behind the provider boundary.
- [ ] Move current OpenSpec per-change status loading, freshness keys, caching, and bounded concurrency behind the provider boundary.
- [ ] Route artifact reads through the OpenSpec provider without loosening `openspec/` path restrictions.
- [ ] Route validation through the OpenSpec provider without loosening `validate --all --json` command allowlists.
- [ ] Route archive actions through the OpenSpec provider without loosening change-name validation.
- [ ] Route OpenSpec Git status loading through the OpenSpec provider without broadening Git command scope.
- [ ] Preserve operation issue recording for repository reads, artifact reads, status, validation, archive, and Git failures.

## 3. UI preservation

- [ ] Preserve current change board, specs view, artifact inspector, validation dashboard, and archive behavior.
- [ ] Surface active provider metadata in state and in a small UI label only where it clarifies unsupported/no-provider states.
- [ ] Keep no-workspace behavior clear when no provider matches.
- [ ] Keep browser preview clearly separated from real provider-backed repository data.
- [ ] Gate validation, archive, artifact, status, and Git actions from provider capabilities instead of OpenSpec-specific assumptions in UI components.

## 4. Safety and tests

- [ ] Add tests for OpenSpec provider detection and activation.
- [ ] Add tests that unsupported/no-provider workspaces cannot run validation or archive actions.
- [ ] Add tests proving current OpenSpec workspace indexing output remains stable through the provider boundary.
- [ ] Add tests proving artifact reads remain path-bounded to `openspec/`.
- [ ] Add tests proving provider activation preserves stale-result guards during repository load, refresh, validation, and artifact preview.
- [ ] Verify Tauri bridge commands remain path-bounded and allowlisted.

## 5. Verification

- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Run `cd src-tauri && cargo check`.
- [ ] Run `openspec validate introduce-openspec-provider-adapter` and `openspec validate --all`.
