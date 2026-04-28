## 1. Persistence foundation

- [ ] Add app-local persistence backend using Tauri Store or a small versioned JSON file in the app data directory.
- [ ] Define and validate `PersistedAppState` version 1.
- [ ] Add safe load behavior for missing, corrupt, future-version, or partially invalid state.
- [ ] Add safe write behavior that does not interrupt the current session if persistence fails.

## 2. Recent repo and launch continuity

- [ ] Persist recent repositories with path, display name, and last-opened time.
- [ ] Cap and dedupe recent repositories.
- [ ] Restore or promote the last selected repo only after confirming it still exists and contains `openspec/`.
- [ ] Show unavailable recent repos without crashing or creating files.

## 3. Per-repo UI state

- [ ] Persist last selected change/spec per repo.
- [ ] Restore selection only when the item still exists in the current index.
- [ ] Persist change-table and specs-table updated-time sort direction per repo.
- [ ] Add tests for stale/missing selection fallback.

## 4. Validation snapshot persistence

- [ ] Persist validation state, issue count, summary, checked time, and OpenSpec file fingerprint after validation completes.
- [ ] On repo load, compare persisted fingerprint to the current OpenSpec file signature.
- [ ] Show matching snapshots as current-cached with checked time.
- [ ] Show mismatched snapshots as stale/outdated and keep validation rerun affordance visible.
- [ ] Add tests for matching, stale, missing, and corrupt validation snapshots.

## 5. Verification

- [ ] Run `npm test`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
- [ ] Run `cd src-tauri && cargo check`.
- [ ] Run `openspec validate explore-persistent-app-data` and `openspec validate --all`.
