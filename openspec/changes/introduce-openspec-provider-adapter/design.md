## Overview

Introduce a provider architecture while keeping OpenSpec as the only implemented provider. The goal is architectural separation, not new product surface area. The app should still look and behave like OpenSpec Studio, but internally the OpenSpec-specific filesystem, command, indexing, and workflow sequencing assumptions should live behind a provider session boundary.

This is the foundation for a later Adapter Foundry. Foundry is explicitly out of scope here; this change defines the deterministic contract that a future foundry-created adapter would have to satisfy.

## Current Code Map

The current app has the right building blocks, but the orchestration is concentrated in `src/App.tsx`:

- `loadRepository` validates a repo with `validate_repo`, reads OpenSpec file records with `list_openspec_file_records`, loads per-change status through `run_openspec_command`, and builds the workspace view.
- `loadChangeStatuses` runs `openspec status --change <name> --json` with bounded concurrency and status-cache freshness keys.
- `runValidationCommand` runs `openspec validate --all --json` and normalizes results through `src/validation/results.ts`.
- `archiveChange`, `archiveAllChanges`, and `archiveOneChange` run validation before invoking the dedicated `archive_change` bridge command.
- artifact preview calls `read_openspec_artifact_file`.
- Git footer state calls `get_openspec_git_status`.
- `src/domain/openspecIndex.ts` is already a mostly pure OpenSpec indexer that turns normalized file records and status records into active changes, archived changes, and specs.
- `src/appModel.ts` contains reusable guards and result normalization for file records, validation trust, repository candidate decisions, and operation issues.
- `src-tauri/src/bridge.rs` already enforces the local safety boundary: canonical repository paths, required `openspec/`, path-bounded artifact reads, allowlisted OpenSpec command shapes, dedicated archive command validation, bounded command execution, and bounded file traversal.

The provider change should keep the Rust bridge narrow and move frontend orchestration into a provider session module instead of expanding bridge powers.

## Provider Contract

A provider is deterministic code, not an LLM prompt. It receives bounded repo inputs and returns normalized workspace data plus declared capabilities.

```ts
type SpecProvider = {
  id: string
  label: string
  detect(repo: RepositoryCandidate): Promise<ProviderDetection>
  index(context: ProviderIndexContext): Promise<ProviderWorkspace>
  readArtifact?(context: ArtifactReadContext): Promise<ArtifactReadResult>
  validate?(context: ProviderActionContext): Promise<ValidationResult>
  archive?(context: ProviderArchiveContext): Promise<ProviderActionResult>
  gitStatus?(context: ProviderActionContext): Promise<ProviderGitStatus>
  capabilities: ProviderCapabilities
}
```

Suggested frontend modules:

- `src/providers/types.ts`: provider contract, capability flags, detection/index/action result types.
- `src/providers/openspecProvider.ts`: OpenSpec detection, indexing orchestration, artifact read, validation, archive, Git status, and operation diagnostics.
- `src/providers/providerRegistry.ts`: built-in provider list and deterministic activation helper.
- `src/providers/providerSession.ts`: active repository/provider workflow owner that coordinates load, refresh, validation, archive, artifact reads, Git status, diagnostics, and stale-result guards.

The provider should receive dependencies for bridge invocation and operation issue reporting rather than importing React state directly. That keeps the provider testable and avoids turning it into a second app component.

Initial built-in provider:

```ts
OpenSpecProvider = {
  id: "openspec",
  label: "OpenSpec",
  detection: repo contains openspec/ directory,
  capabilities: {
    artifacts: true,
    changeStatus: true,
    validation: true,
    archive: true,
    gitStatus: true,
    writeActions: ["archive"]
  }
}
```

## Provider Session Module

The `ProviderSession` is the deeper module chosen for this change. A `SpecProvider` adapter knows how to perform deterministic provider operations. The `ProviderSession` owns the active repository workflow that currently lives in `App.tsx`.

The session interface should hide these ordering rules from the shell:

- repository detection and activation
- provider-backed workspace indexing
- metadata-only refresh followed by full refresh when file signatures change
- validation restore/staleness checks
- per-change status loading, freshness-aware caching, and bounded concurrency
- artifact reads and artifact-read diagnostics
- validation execution, validation diagnostics, and validation snapshot results
- archive execution, post-archive verification, and partial bulk-archive reporting
- provider-backed Git status loading
- operation diagnostics for repository read, status, artifact read, validation, archive, and Git failures
- stale-result guards for repository load, refresh, validation, artifact preview, archive, and Git status completions

`App.tsx` should remain responsible for UI state such as the selected tab, selected row, current search query, busy indicators, and displaying messages. It should not know OpenSpec command shapes, OpenSpec bridge command names, status cache keys, or the exact sequence of provider operations needed for load/refresh/validation/archive.

The session should accept dependencies rather than import Tauri or React directly:

```ts
type ProviderSessionDependencies = {
  invoke: InvokeAdapter
  now: () => Date
  isRuntimeAvailable: () => boolean
}
```

Session operations should return structured results and diagnostics. The shell may decide how to present messages, but it should not inspect command stdout/stderr to derive provider state.

## Normalized Workspace Model

The provider should produce or feed a normalized model that the UI can render without caring whether the backing system is OpenSpec.

Core concepts:

- workspace provider id/name
- provider capabilities used by the current workspace
- work items (changes, archived changes, future generic items)
- capabilities/specs
- artifacts
- diagnostics
- validation state
- archive/action availability
- source paths and modified timestamps

For this change, the normalized model may closely mirror the existing OpenSpec-derived model. The important requirement is that OpenSpec-specific parsing moves behind a named adapter seam and provider id is carried through the model.

Initial state additions:

- `RepositoryView.providerId`
- `RepositoryView.providerLabel`
- `RepositoryView.providerCapabilities`
- `WorkspaceView.providerId`
- `WorkspaceView.providerLabel`
- `WorkspaceView.providerCapabilities`

The current `ChangeRecord`, `SpecRecord`, `Artifact`, and validation models can remain OpenSpec-shaped in this change. Generalizing those deeply is Foundry work, not required for this provider extraction.

## Tauri Bridge Strategy

Current bridge commands are OpenSpec-specific. Do not make them arbitrary shell runners. For this change, either:

1. keep existing commands but route them only from `OpenSpecProvider`, or
2. introduce provider-shaped bridge commands that dispatch only to the built-in OpenSpec implementation.

Preferred implementation: option 1. Keep these existing bridge commands narrow:

- `validate_repo`
- `list_openspec_file_records`
- `list_openspec_file_metadata_records`
- `read_openspec_artifact_file`
- `run_openspec_command` for `validate --all --json` and `status --change <name> --json`
- `archive_change`
- `get_openspec_git_status`

Allowed operations remain narrow:

- validate selected repo contains `openspec/`
- list files under `openspec/`
- read artifacts under `openspec/`
- run exact OpenSpec command shapes needed by the app
- archive a validated change name
- inspect git status for `openspec/`

No provider action may run unbounded shell commands or read outside the selected provider root.

## Detection and Activation

For now, detection is deterministic:

- user selects a repository
- app asks built-in providers whether they match
- OpenSpec matches when the repo contains a real `openspec/` directory under the selected repo
- if exactly one provider matches, activate it and carry its id, label, and capabilities into state
- if more than one provider matches in the future, the app must use deterministic precedence or an explicit user choice
- if none match, show the current no-workspace state

The future settings/custom-provider onboarding work may let users select provider roots manually, but that is out of scope here.

The current browser fallback should remain visibly non-repository-backed. It must not masquerade as a real provider-backed workspace or include fake OpenSpec data that could be confused with local repository state.

## Migration Plan

1. Define provider types and capabilities.
2. Add `spec-provider-adapters` delta requirements.
3. Extract the existing `App.tsx` OpenSpec operation implementations into `OpenSpecProvider` while keeping `indexOpenSpecWorkspace` pure.
4. Add `ProviderSession` and move repository load, refresh, validation, archive, artifact read, Git status, operation diagnostics, status caching, and stale-result guard ownership into it.
5. Update app load flow to activate the OpenSpec provider through a session rather than directly assuming OpenSpec.
6. Carry provider metadata through repository/workspace state.
7. Gate validation, archive, artifact read, status, and Git actions from provider capabilities.
8. Keep existing UI and tests passing.
9. Add focused tests that prove OpenSpec remains the active provider, unsupported providers cannot invoke actions, and stale provider completions cannot overwrite newer session state.

## Risks

- Refactor churn without visible benefit: keep the change behavior-preserving.
- Over-generalizing too early: only model concepts the current UI already needs.
- Security regression: do not replace command allowlists with provider-supplied arbitrary commands.
- State race regression: move the existing generation/ref guards into the provider session deliberately, and test that stale repository, validation, artifact preview, refresh, archive, and Git status results cannot overwrite newer state.
