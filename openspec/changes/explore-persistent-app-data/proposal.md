## Why

The app currently derives most state from live OpenSpec files, which is correct for source truth, but some operational state is useful across launches. Last validation snapshots, remembered repository metadata, and future settings need a persistence strategy that does not confuse cached app data with OpenSpec source data.

## What Changes

- Explore a lightweight local persistence layer for non-source-of-truth app data.
- Define what may be cached, how it expires, and how the UI communicates stale persisted data.
- Include future settings data in the persistence model without deciding the settings page scope yet.

## Capabilities

### New Capabilities
- `local-app-persistence`: Durable app-local storage for repository metadata, validation snapshots, settings, and UI preferences.

### Modified Capabilities

## Impact

- No implementation yet.
- Needs product and technical exploration before specs/design/tasks are finalized.
- Must preserve OpenSpec files as source of truth and avoid showing cached data as current facts.

## Open Questions

- What data should persist: last validation result, last validation time, recent repos, selected repo, table sort, dismissed issues, settings?
- Should data be stored with Tauri store, local files, SQLite, or another native mechanism?
- How should repo identity be keyed when paths move or names collide?
- What is the expiration/staleness model for validation snapshots?
- How does persistence interact with future settings and privacy expectations?
