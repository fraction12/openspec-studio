# OpenSpec Studio Context

## Domain Terms

### Spec Provider
A deterministic adapter that can detect a supported repository shape and perform provider-backed operations such as indexing, artifact reading, validation, archive actions, change status loading, and Git status loading.

### OpenSpec Provider
The built-in Spec Provider for repositories with an `openspec/` directory. It preserves the current OpenSpec Studio behavior while keeping OpenSpec-specific filesystem and command knowledge behind the provider seam.

### Provider Session
The active repository/provider workflow owner for a loaded workspace. It coordinates provider detection, indexing, refresh, validation, archive, artifact reads, Git status, operation diagnostics, and stale-result guards for the current repository.

### Provider Workspace
The source-backed workspace state returned by a Provider Session. It carries provider identity, provider capabilities, indexed changes, specs, artifacts, validation state, file signatures, diagnostics, source paths, and modified timestamps.

### Workspace View-Model
The UI-ready projection of a Provider Workspace. It derives change records, spec records, archive readiness, build status, health, artifacts, summaries, timestamps, validation issue maps, and search text from indexed OpenSpec data without owning repository IO or app shell state.

### Studio Runner Session
The frontend workflow owner for Studio Runner coordination. It owns Runner settings defaults, session-secret setup, lifecycle/status transitions, dispatch persistence, stream event merging, and Runner diagnostics behind a small Interface used by the app shell.

### Native Bridge Module
A Rust bridge Module behind the Tauri command seam. It keeps native behavior local by separating shared command/process utilities from local OpenSpec operations and Studio Runner operations while preserving the external command Interface.

### Workbench Application Modules
The set of frontend Modules that concentrate application policy currently owned by the workbench shell. They keep React focused on rendering and event wiring while repository flow, navigation, table interactions, artifact detail modeling, and runner log policy live behind smaller testable Interfaces.

### Repository Opening Flow Module
The workflow Module that derives repository-open, no-provider, browser-preview, refresh, validation, archive, Git-status-intent, persistence, and message transitions from Provider Session results without owning provider IO.

### Workspace Navigation State Module
The Module that derives selected change, selected spec, detail tab, board view, phase, query reset, and persisted-selection decisions from a Workspace View-Model and current navigation state.

### Board Table Interaction Module
The Module that owns reusable board table policy such as default sort, next sort, sorted rows, bounded row windows, selected-row inclusion, keyboard focus movement, resize clamping, and sort accessibility labels.

### Artifact Detail View-Model
The selected-change detail projection consumed by the inspector. It derives tab-specific artifact, task, archive, validation, status, issue, and empty-state data from Workspace View-Model records without owning React rendering.

### Markdown Preview Model
The Module that owns lightweight Markdown preview parsing and bounded parse-result caching for artifact previews. It keeps Markdown block derivation testable outside the React app shell while leaving rendering in the inspector UI.

### Studio Runner Log Module
The Module that owns Runner Log history policy for RunnerDispatchAttempt records, including attempt creation, stream merging, lifecycle/status log events, replacement/upsert/capping, persistence normalization, filtering, row identity, and display labels.
