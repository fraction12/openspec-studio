## Overview

Add minimal app-local persistence for convenience state only. OpenSpec files and CLI output remain the source of truth. Persisted state improves launch continuity and inspection ergonomics, but every persisted derived fact must either be validated against the current repo snapshot or clearly marked stale.

## Storage Choice

Use a small JSON-backed Tauri persistence mechanism for v1, preferably the Tauri store plugin or an equivalent app-data JSON file managed by the backend.

Why not SQLite yet:
- the data is small
- no query workload exists yet
- no historical timeline/search index is being stored
- JSON is easier to inspect and migrate while the product shape is still moving

SQLite can be reconsidered later for cross-repo search, activity history, or large cached indexes.

## Persistence Boundaries

Persist only app-owned convenience state:

- recent repos
- last selected repo
- global preferences used by the current app shell
- per-repo selected change/spec
- per-repo table sort preferences
- last validation snapshot with repository file signature

Do not persist canonical OpenSpec state:

- proposal/design/tasks content
- task completion as app-owned state
- archive readiness as truth
- current validation health without checking staleness
- derived OpenSpec index as a long-lived source of truth

## Data Model

```ts
type PersistedAppState = {
  version: 1
  recentRepos: RecentRepo[]
  lastRepoPath?: string
  globalPreferences: {
    density?: "comfortable" | "compact"
    theme?: "system" | "light" | "dark"
  }
  repoStateByPath: Record<string, PersistedRepoState>
}

type RecentRepo = {
  path: string
  name: string
  lastOpenedAt: number
}

type PersistedRepoState = {
  lastOpenedAt: number
  lastSelectedChange?: string
  lastSelectedSpec?: string
  changeSort?: "updated-desc" | "updated-asc"
  specSort?: "updated-desc" | "updated-asc"
  lastValidation?: PersistedValidationSnapshot
}

type PersistedValidationSnapshot = {
  checkedAt: number
  state: "pass" | "fail" | "error"
  issueCount: number
  summary: string
  fileFingerprint: string
  latestPath?: string | null
  latestModifiedTimeMs?: number | null
}
```

## Staleness Model

When the app loads a persisted validation snapshot:

1. Build the current OpenSpec file signature for the selected repo.
2. Compare it to `lastValidation.fileFingerprint`.
3. If it matches, show the validation snapshot as current-cached with its checked time.
4. If it differs, show the snapshot as stale/outdated and prompt for validation.
5. If the repo is unreadable or missing, do not promote it as active; keep it only in recent repos with a clear missing state.

This prevents cached validation from masquerading as current truth.

## Migration / Corruption Handling

The persisted state must include a version. Unknown future versions, malformed JSON, invalid paths, or invalid enum values should not crash the app.

Behavior:
- ignore corrupted state and start fresh
- drop invalid recent repo paths
- cap recent repo count
- preserve current in-memory state if a persistence write fails
- never modify OpenSpec project files while recovering app persistence

## UX Behavior

On launch:
- load app state
- show recent repos
- if `lastRepoPath` still exists and contains `openspec/`, optionally reopen it automatically
- if it no longer exists, show it as unavailable in recent repos rather than failing the app

During use:
- update recent repos after a successful repo open
- save selected change/spec and sort preferences after user interaction
- save validation snapshot after validation completes
- mark restored validation as stale when current file signature differs

## Open Questions

- Should the app automatically reopen the last repo, or show a “continue where you left off” card first?
- Should validation snapshots persist only pass/fail summary, or also issue details for offline review?
- Should table sort preferences be global defaults or per repo?
- What is the maximum recent repo count: 5, 10, or 20?
