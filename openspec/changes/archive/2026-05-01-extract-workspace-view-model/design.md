## Context

`indexOpenSpecWorkspace` already owns source indexing: it turns normalized OpenSpec file records and change status records into indexed active changes, archived changes, and specs. The next layer, `buildWorkspaceView`, currently lives inside `App.tsx` and turns indexed records into UI-ready workspace records.

That projection has become product policy, not rendering: it derives archive-ready phase, build status, change/spec health, validation issue maps, missing artifact display state, summaries, timestamps, requirement counts, and search text. Keeping that implementation in the app shell reduces locality and makes tests import the whole React entry point to exercise non-React behavior.

## Goals / Non-Goals

**Goals:**

- Move workspace view projection into a dedicated Workspace View-Model module with a small interface.
- Preserve the existing `WorkspaceView`, `ChangeRecord`, and `SpecRecord` data shapes.
- Keep `indexOpenSpecWorkspace` unchanged as the source indexing module.
- Move focused tests to import the Workspace View-Model module instead of `App.tsx`.
- Keep the refactor behavior-preserving.

**Non-Goals:**

- Do not change visible build status, validation, archive readiness, or table behavior.
- Do not add settings, runner, graph, timeline, or provider functionality.
- Do not change OpenSpec CLI, Tauri bridge, or persistence behavior.

## Decisions

### Add a Workspace View-Model module

Create a frontend module that exports `buildWorkspaceView` and the related workspace record types. Its interface accepts indexed OpenSpec data, file records, validation, change statuses, and an optional file signature, then returns the existing workspace view shape.

Alternative considered: keep the function in `App.tsx` and only move tests. That fails the deletion test: the complexity still lives in the app shell and future callers still need to understand app internals.

### Keep view projection separate from source indexing

Leave `indexOpenSpecWorkspace` as the source model module and keep UI-specific concepts like `Health`, `Artifact`, `ChangePhase`, summary text, display timestamps, and search text in the Workspace View-Model module.

Alternative considered: merge view projection into `openspecIndex`. That would make the indexer less deep because callers who need source indexing would also inherit UI display policy.

### Keep App as the composition owner

`App.tsx` should import the Workspace View-Model module and continue composing Provider Session, persistence, runner operations, and rendering. The refactor should not move app state ownership in this pass.

## Risks / Trade-offs

- Type cycles between `App.tsx` and the new module → Move the required view record types with the projection module and import them from App.
- Accidental behavior drift during extraction → Reuse existing tests, add no semantic changes, and run the current test suite.
- Creating another shallow module → Keep the interface centered on the full workspace projection rather than many tiny helper exports.
