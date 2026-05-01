## Why

OpenSpec Studio currently works because the app is directly shaped around OpenSpec paths, commands, and indexing assumptions. That is fine for the first version, but it makes the product harder to evolve into a broader spec-system window. We need to make OpenSpec the first deterministic provider adapter instead of embedding OpenSpec behavior throughout the app shell.

This is not the custom/LLM adapter Foundry yet. This change creates the rails: a provider contract, a normalized workspace model, and one built-in OpenSpec provider that preserves current behavior.

## What Changes

- Introduce a deterministic spec provider contract for detection, indexing, artifact reading, validation, archive actions, and capability reporting.
- Introduce a provider session module that owns active repository/provider workflow orchestration for load, refresh, validation, archive, artifact reads, Git status, diagnostics, and stale-result guards.
- Move current OpenSpec-specific behavior behind a built-in `openspec` provider adapter and session while preserving OpenSpec Studio's current product behavior.
- Keep the app UI consuming a normalized workspace model instead of raw OpenSpec assumptions where practical.
- Keep OpenSpec provider actions command-allowlisted and path-bounded through the Tauri bridge.
- Carry active provider identity and capabilities through repository/workspace state so UI actions can be enabled from declared support rather than hard-coded OpenSpec assumptions.
- Keep browser/non-Tauri fallback clearly separate from real provider-backed repository data.
- Preserve current user-visible OpenSpec Studio behavior while establishing a seam for future providers.

## Capabilities

### New Capabilities
- `spec-provider-adapters`: Deterministic provider contract and built-in OpenSpec adapter.

### Modified Capabilities
- `local-desktop-shell`: Repository opening and provider selection should use provider detection/activation.
- `workspace-intelligence`: Indexed workspace data should be produced by the active provider and normalized for UI use.
- `validation-dashboard`: Validation should run through provider capabilities rather than hard-coded OpenSpec calls.
- `change-board`: Archive readiness and archive actions should be exposed as provider capabilities.

## Impact

- Frontend app model/provider boundary.
- Tauri bridge naming or routing for provider-specific operations.
- Tests proving current OpenSpec indexing, validation, and archive flows continue to work through the adapter.
- Future custom adapter/Foundry work can build on this contract and session seam without changing the core UI again.
- The first implementation should mostly reorganize existing code paths in `src/App.tsx`, `src/domain/openspecIndex.ts`, `src/appModel.ts`, and `src-tauri/src/bridge.rs` instead of introducing new product surfaces.

## Non-Goals

- No custom adapter generation.
- No LLM integration.
- No automatic repo-wide spec discovery beyond deterministic OpenSpec detection.
- No support for Spec Kit, Kiro, or generic Markdown in this change.
- No behavior change to existing OpenSpec archive/validation rules.
