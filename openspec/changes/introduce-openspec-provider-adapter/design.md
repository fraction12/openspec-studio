## Overview

Introduce a provider architecture while keeping OpenSpec as the only implemented provider. The goal is architectural separation, not new product surface area. The app should still look and behave like OpenSpec Studio, but internally the OpenSpec-specific filesystem, command, and indexing assumptions should live behind an `OpenSpecProvider` boundary.

## Provider Contract

A provider is deterministic code, not an LLM prompt. It receives bounded repo inputs and returns normalized workspace data plus declared capabilities.

```ts
type SpecProvider = {
  id: string
  label: string
  detect(repo: RepositoryCandidate): Promise<ProviderDetection>
  index(repo: ProviderRepoContext): Promise<ProviderWorkspace>
  readArtifact?(context: ArtifactReadContext): Promise<ArtifactReadResult>
  validate?(context: ProviderActionContext): Promise<ValidationResult>
  archive?(context: ProviderArchiveContext): Promise<ProviderActionResult>
  capabilities: ProviderCapabilities
}
```

Initial built-in provider:

```ts
OpenSpecProvider = {
  id: "openspec",
  label: "OpenSpec",
  detection: repo contains openspec/ directory,
  capabilities: {
    artifacts: true,
    validation: true,
    archive: true,
    gitStatus: true,
    writeActions: ["archive"]
  }
}
```

## Normalized Workspace Model

The provider should produce or feed a normalized model that the UI can render without caring whether the backing system is OpenSpec.

Core concepts:

- workspace provider id/name
- work items (changes, archived changes, future generic items)
- capabilities/specs
- artifacts
- diagnostics
- validation state
- archive/action availability
- source paths and modified timestamps

For this change, the normalized model may closely mirror the existing OpenSpec-derived model. The important requirement is that OpenSpec-specific parsing moves behind a named adapter seam and provider id is carried through the model.

## Tauri Bridge Strategy

Current bridge commands are OpenSpec-specific. Do not make them arbitrary shell runners. For this change, either:

1. keep existing commands but route them only from `OpenSpecProvider`, or
2. introduce provider-shaped bridge commands that dispatch only to the built-in OpenSpec implementation.

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
- if exactly one provider matches, activate it
- if none match, show the current no-workspace state

The future settings/custom-provider onboarding work may let users select provider roots manually, but that is out of scope here.

## Migration Plan

1. Define provider types and capabilities.
2. Wrap existing OpenSpec indexing/load/validation/archive behavior in `OpenSpecProvider`.
3. Update app load flow to activate the OpenSpec provider rather than directly assuming OpenSpec.
4. Carry provider metadata through repository/workspace state.
5. Keep existing UI and tests passing.
6. Add focused tests that prove OpenSpec remains the active provider and unsupported providers cannot invoke actions.

## Risks

- Refactor churn without visible benefit: keep the change behavior-preserving.
- Over-generalizing too early: only model concepts the current UI already needs.
- Security regression: do not replace command allowlists with provider-supplied arbitrary commands.
