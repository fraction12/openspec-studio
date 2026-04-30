## Overview

Settings should be a control surface for the app behavior OpenSpec Studio already owns. It should not create product functionality merely to fill out categories. The first implementation should focus on local app behavior, stored local data, and current repository continuity.

The app already persists:

- recent repositories and the last successful repo;
- global preferences with `theme` and `density` fields;
- per-repo selected change/spec ids;
- per-repo change/spec table sort preferences;
- validation snapshots with file signatures and diagnostic detail;
- Studio Runner state, endpoint, dispatch history, and execution metadata delivered by the Runner integration.

The app also already performs background refresh every 15 seconds for the active repository and restores the last successful repository on launch. Those behaviors are useful defaults, but users need explicit control over them.

## Product Boundary

In scope:

- open/close Settings from global shell chrome;
- app-wide toggles for launch restore and automatic background refresh;
- recent repo management;
- current-repo continuity reset for selection and table sort state;
- validation snapshot/diagnostic cache clearing;
- theme/density controls only when their stored values are applied by the shell immediately;
- global Studio Runner configuration defaults for implemented Runner behavior, starting with model and effort;
- explanatory copy for local data and privacy boundaries.

Out of scope:

- creating new OpenSpec authoring workflows;
- generic provider management while OpenSpec is the only shipped provider;
- runner session secret, start/stop lifecycle, live stream state, and dispatch history controls; these remain operational Runner workspace surfaces, not durable Settings controls;
- graph, timeline, guided workflow, or future adapter controls before those features exist;
- editing OpenSpec project files from Settings.

## Navigation Model

Use a dedicated Settings surface rather than hiding controls inside unrelated boards. The shell should expose a single Settings entry near global app/repository controls. Opening Settings should preserve the active repository/workspace in memory and let users return without losing selection or filter state.

The Settings surface should distinguish scopes clearly:

- **App**: launch restore, automatic refresh, appearance preferences that are actually implemented.
- **Repositories**: recent repository list, remove one recent repo, clear all recents, clear last-repo restore target.
- **Current Repository**: reset selected change/spec and table sort state for the active repo.
- **Validation And Diagnostics**: show what local validation data may be stored and clear validation snapshots for the current repo or all repos.
- **Integrations**: render only settings contributed by implemented capabilities. Studio Runner should expose durable global Runner defaults here; no placeholder cards for unavailable integrations.

When no repository is active, current-repository controls should be unavailable or omitted, while app-wide and all-repo data controls remain available.

## Persistence Model

Keep the existing Tauri Store-backed JSON state. Extend it conservatively for behavior toggles:

```ts
type PersistedGlobalPreferences = {
  density?: "comfortable" | "compact"
  theme?: "system" | "light" | "dark"
  autoRestoreLastRepo?: boolean
  autoRefreshRepository?: boolean
  runnerModel?: "default" | string
  runnerEffort?: "default" | "low" | "medium" | "high"
}
```

Defaults should preserve current behavior:

- `autoRestoreLastRepo` defaults to `true`;
- `autoRefreshRepository` defaults to `true`;
- absent `theme` and `density` keep the current visual default;
- absent or `default` Runner model/effort values preserve Symphony/Codex configured defaults.

Add focused persistence helpers instead of mutating the state shape ad hoc from React:

- update global preferences;
- forget one recent repository;
- clear all recent repositories and `lastRepoPath`;
- reset one repo's UI continuity state;
- clear validation snapshot for one repo;
- clear validation snapshots for all repos;
- update global Studio Runner defaults.

Normalization must continue to drop invalid paths, invalid enum values, malformed snapshots, and unknown future versions safely.

## Behavior

Launch restore:

1. Load persisted state.
2. If `autoRestoreLastRepo` is not `false`, keep the current behavior and try the last successful repo.
3. If disabled, show the choose-folder state with recent repos available.

Automatic refresh:

1. Keep manual refresh always available for the active repository.
2. Start the background refresh timer only when `autoRefreshRepository` is not `false`.
3. Changing the setting should start or stop future background refresh without requiring restart.

Recent repositories:

- removing a repo should remove it from `recentRepos`;
- if the removed repo is `lastRepoPath`, clear `lastRepoPath`;
- if the removed repo is currently active, keep the current in-memory workspace open until the user switches or closes it;
- clearing recents must not modify repository files.

Current repo reset:

- reset selected change/spec and table sort persisted fields for the active repo;
- keep the current in-memory selection stable until the next explicit reload or choose a valid current item immediately;
- do not remove validation snapshots unless the user chooses a validation/data clearing action.

Validation and diagnostics:

- explain that snapshots may include validation diagnostics, file paths, stdout, stderr, and status codes;
- clearing snapshots removes app-local cached validation state only;
- current workspace validation should fall back to not-checked or stale after clearing instead of pretending validation passed;
- OpenSpec files and CLI output remain source of truth.

Appearance:

- only show `theme` and `density` controls if changing them visibly affects the shell in the same session;
- if first implementation does not apply those fields, leave them out of the UI even though the persistence type already accepts them.

Studio Runner defaults:

- show a Settings integration section for global Studio Runner defaults once Runner behavior is available;
- initial controls are Model and Effort, with default values that mean “use Symphony/Codex configured default”;
- changed defaults apply only to future Studio-managed dispatches;
- historical Runner Log rows remain immutable;
- the Runner workspace may show a compact summary/link to Settings, but Settings is the source of truth for durable defaults;
- session secret, start/stop/status, stream status, and dispatch history stay in the Runner workspace/inspector because they are operational state, not durable app preferences.

## Coordination With Active Changes

`introduce-studio-runner` owns runner behavior, signing secret handling, lifecycle controls, dispatch history, and event streaming. Because Runner behavior now exists, `app-settings` should host durable global Runner defaults such as model and effort, while leaving session-only secrets, lifecycle, status, and Runner Log/history in the Runner workspace.

`introduce-openspec-provider-adapter` keeps OpenSpec as the only implemented provider. Settings should not expose provider selection until multiple implemented providers or configurable adapter roots exist.

## Risks

- Settings becoming a dumping ground: require every control to map to current behavior, current persisted data, or an accepted implemented capability.
- Clearing data accidentally disrupting active inspection: keep destructive data actions explicit and scoped.
- Privacy expectations: clearly distinguish local app cache from OpenSpec project files and avoid implying that clearing cache removes repository content.
- Dead appearance controls: hide visual preferences unless the app applies them.
