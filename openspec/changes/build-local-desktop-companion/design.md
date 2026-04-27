## Context

OpenSpec already provides the source-of-truth folder structure and CLI workflows for specs, changes, validation, and archive. The gap is not data modeling; it is visibility. A user working across multiple local repos needs a fast desktop surface that shows what exists, what is incomplete, what is invalid, and what is ready to archive.

The app should therefore treat the OpenSpec CLI and files as authoritative. It should not invent a parallel project database or require a hosted service.

## Goals / Non-Goals

### Goals

- Provide a standalone local desktop app that can be launched like a normal application.
- Allow the user to point the app at any local repo with an `openspec/` workspace.
- Show active changes, archived changes, specs, artifact completeness, task progress, and validation health.
- Keep normal usage free of `npm run dev`, local web servers, accounts, and cloud state.
- Use the installed OpenSpec CLI for canonical interpretation wherever JSON output is available.
- Read markdown artifacts directly for preview and lightweight indexing.
- Support a fast v1 without blocking on full artifact editing.
- Define a robust product trajectory so v1 choices do not block multi-repo, timeline, dependency, guided workflow, search, or editing features later.

### Non-Goals

- Do not replace the OpenSpec CLI.
- Do not change the OpenSpec file format.
- Do not require collaboration, sync, accounts, or cloud hosting.
- Do not build a full markdown IDE in v1.
- Do not implement archive/apply/propose flows in v1 unless the CLI-backed read-only overview is already stable.
- Do not make future robust workflows depend on app-private project state; OpenSpec artifacts and CLI behavior stay authoritative.

## Decisions

### 1. Build a Tauri desktop app with React/TypeScript

Use **Tauri** for the desktop shell and **React/TypeScript** for the frontend. This is the v1 product and design decision.

Tauri produces a real app bundle, can read local files through explicit permissions, can run CLI commands, and avoids Electron-level bloat. React/TypeScript gives the UI a fast implementation path while keeping the desktop boundary in the Tauri bridge.

A native Swift app is no longer part of the v1 path. It may be reconsidered only if the product deliberately becomes macOS-only later.

### 2. Treat OpenSpec CLI output as canonical

The app should call OpenSpec CLI commands such as:

- `openspec list --json`
- `openspec list --specs --json`
- `openspec status --change <name> --json`
- `openspec show <name> --json`
- `openspec validate --all --json`

When CLI JSON is unavailable or insufficient, the app may scan the `openspec/` tree directly, but it must mark that data as derived from files.

### 3. Start read-mostly

The first version should optimize browsing and understanding before editing. It may open artifacts in the user's editor, but it should not need to own proposal/design/tasks editing on day one.

This keeps the first useful version small and avoids creating a second, subtly incompatible authoring surface.

### 4. Use an in-memory project index first

The app can build an in-memory index from the selected repo on launch and refresh it via file watching. No database is required for v1.

A small app settings file may store recent repos and UI preferences. That settings file is app-local state, not a copy of OpenSpec project state.

### 5. Make the change board the primary view

The most useful first screen is a board/table hybrid showing every change with:

- name
- status/phase
- artifact completeness
- task progress
- validation health
- touched capabilities
- last modified time
- archive readiness

The app should make it obvious what needs attention before the user opens individual files.


### 6. Design for a robust tool, but ship in layers

The app should be architected as a durable OpenSpec workbench, not a throwaway viewer. However, robustness should arrive through explicit layers:

1. **Read-mostly v1:** repo picker, indexer, change board, details, specs browser, validation dashboard.
2. **Operator workflow layer:** guided propose/apply/archive flows that shell out to OpenSpec CLI and preview file changes before writing.
3. **Workspace intelligence:** multi-repo dashboard, cross-repo search, timeline/activity view, dependency graph, and “needs attention” triage.
4. **Authoring layer:** safe artifact editing, markdown preview, task checkbox updates, and template-aware creation flows.
5. **Automation layer:** optional notifications, stale validation detection, archive readiness checks, and CI/export integrations.

Each layer must preserve the same rule: OpenSpec files and CLI output remain the source of truth. The app may cache derived state for speed, but it must be disposable and rebuildable from disk.

## Architecture

```text
OpenSpec Studio.app
├─ Desktop shell
│  ├─ repo picker
│  ├─ recent repos
│  └─ local permissions
├─ UI
│  ├─ change board
│  ├─ change detail
│  ├─ specs browser
│  └─ validation dashboard
├─ local bridge
│  ├─ run openspec CLI commands
│  ├─ read markdown artifacts
│  ├─ scan openspec folders
│  └─ watch filesystem changes
└─ selected repo
   └─ openspec/
      ├─ specs/
      └─ changes/
```

## Data Model

Initial derived records:

- `Repository`: path, name, hasOpenSpec, lastOpenedAt.
- `Change`: name, location, active/archive state, artifacts, touched capabilities, validation summary, lastModifiedAt.
- `Artifact`: type, path, exists, status, markdown preview, dependencies if reported by CLI.
- `Spec`: name, path, requirement count if derivable, validation state.
- `ValidationResult`: command status, errors/warnings, affected files/items, raw JSON payload when available.
- `Workspace`: optional app-local grouping of multiple repositories for future cross-repo dashboards.
- `ActivityEvent`: derived file/CLI/git events for future timelines; rebuildable from local sources.
- `DependencyEdge`: derived relationship between changes, specs, artifacts, and touched capabilities.

## UX Outline

1. Launch app.
2. Choose a local repo or recent repo.
3. App detects `openspec/` and builds an index.
4. User lands on the Change Board.
5. Selecting a change opens detail panes for proposal/design/tasks/spec deltas and validation.
6. Validation can be refreshed manually and eventually automatically after file changes.
7. Artifacts can be opened in the user's editor from the detail view.

## Risks / Trade-offs

- **CLI JSON gaps:** Some useful state may not be exposed cleanly by OpenSpec CLI JSON. Mitigation: combine CLI calls with direct file scan and keep the source of each field clear.
- **Framework drift:** If the app parses markdown too aggressively, it may become format-fragile. Mitigation: prefer CLI output and only parse simple stable structures like task checkboxes.
- **Desktop shell complexity:** Tauri adds Rust/permissions complexity. Mitigation: keep bridge commands narrow and local-only, and keep React/TypeScript focused on rendering derived OpenSpec state rather than filesystem ownership.
- **Scope creep into editing:** Editing is tempting but can delay v1. Mitigation: open external editor first; add write flows later behind specs.

## Open Questions

- Which OpenSpec CLI JSON commands are sufficient today, and where do we need small upstream additions?
- Should the app include a timeline/recent activity view in v1 or wait until the board/detail views are stable?
- Should archived changes be shown as a separate tab or integrated as a board lane?
- Which robust phase should come immediately after v1: guided archive/apply workflows, multi-repo dashboard, or artifact editing?
- Should dependency graphs be inferred entirely from delta spec paths first, or should OpenSpec add explicit relationship metadata later?
