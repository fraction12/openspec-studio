## 1. Provider contract

- [ ] Define frontend provider types for detection, capabilities, indexing, artifact reading, validation, and archive actions.
- [ ] Add provider id/label to repository or workspace state.
- [ ] Document which operations are deterministic and which are future extension points.

## 2. OpenSpec provider extraction

- [ ] Move current OpenSpec detection into an `OpenSpecProvider` boundary.
- [ ] Move current OpenSpec file indexing/status loading orchestration behind the provider boundary.
- [ ] Route artifact reads through the OpenSpec provider without loosening path restrictions.
- [ ] Route validation through the OpenSpec provider without loosening command allowlists.
- [ ] Route archive actions through the OpenSpec provider without loosening change-name validation.

## 3. UI preservation

- [ ] Preserve current change board, specs view, artifact inspector, validation dashboard, and archive behavior.
- [ ] Surface active provider metadata in state and optionally in a small UI label where useful.
- [ ] Keep no-workspace behavior clear when no provider matches.

## 4. Safety and tests

- [ ] Add tests for OpenSpec provider detection and activation.
- [ ] Add tests that unsupported/no-provider workspaces cannot run validation or archive actions.
- [ ] Add tests proving current OpenSpec workspace indexing output remains stable through the provider boundary.
- [ ] Verify Tauri bridge commands remain path-bounded and allowlisted.

## 5. Verification

- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Run `cd src-tauri && cargo check`.
- [ ] Run `openspec validate introduce-openspec-provider-adapter` and `openspec validate --all`.
