## 1. Persistence foundation

- [x] Add app-local persistence backend using Tauri Store or a small versioned JSON file in the app data directory.
- [x] Define and validate `PersistedAppState` version 1.
- [x] Add safe load behavior for missing, corrupt, future-version, or partially invalid state.
- [x] Add safe write behavior that does not interrupt the current session if persistence fails.

## 2. Recent repo and launch continuity

- [x] Persist recent repositories with path, display name, and last-opened time.
- [x] Cap and dedupe recent repositories.
- [x] Restore or promote the last selected repo only after confirming it still exists and contains `openspec/`.
- [x] Show unavailable recent repos without crashing or creating files.

## 3. Per-repo UI state

- [x] Persist last selected change/spec per repo.
- [x] Restore selection only when the item still exists in the current index.
- [x] Persist change-table and specs-table updated-time sort direction per repo.
- [x] Add tests for stale/missing selection fallback.

## 4. Validation snapshot persistence

- [x] Persist validation state, issue count, summary, checked time, and OpenSpec file fingerprint after validation completes.
- [x] On repo load, compare persisted fingerprint to the current OpenSpec file signature.
- [x] Show matching snapshots as current-cached with checked time.
- [x] Show mismatched snapshots as stale/outdated and keep validation rerun affordance visible.
- [x] Add tests for matching, stale, missing, and corrupt validation snapshots.

## 5. Verification

- [x] Run `npm test`.
- [x] Run `npm run check`.
- [x] Run `npm run build`.
- [x] Run `cd src-tauri && cargo check`.
- [x] Run `openspec validate explore-persistent-app-data` and `openspec validate --all`.
