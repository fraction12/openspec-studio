## Why

Archive result handling has deep provider-side behavior, but the app shell still owns repeated archive transition policy for single-change and multi-change archive flows. This makes archive UI state harder to reason about because similar result branching, workspace replacement, validation snapshot persistence, and user-facing messages live in multiple shell handlers.

## What Changes

- Introduce a future Archive Operation Flow Module that derives UI transitions from provider archive results without owning provider IO.
- Move duplicated archive-result branching out of `App.tsx` while preserving the current archive workflow and provider contracts.
- Add focused tests at the archive transition interface before rewiring the React shell.
- Do not implement this in the current architecture pass; this change records the recommendation for human review because it touches archive workflows and should be sequenced carefully around existing OpenSpec archive work.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workbench-application-modules`: add an Archive Operation Flow Module that owns archive-result transition policy for single and batch archive flows.

## Impact

- Observed friction: `src/App.tsx` handles single archive and batch archive result branching separately, while `src/providers/providerSession.ts` already concentrates provider archive validation, mutation, re-indexing, and postcondition checks.
- Files/modules involved: `src/App.tsx`, `src/providers/providerSession.ts`, `src/providers/types.ts`, and a likely new `src/domain/archiveOperationFlow.ts`.
- Expected gains: better locality for archive state bugs, more leverage from a tested transition interface, and improved AI-navigability by naming the archive workflow module explicitly.
- Risks: archive is a mutating workflow; careless extraction could change validation-first guardrails, partial archive messaging, validation snapshot persistence, selected workspace updates, or archive-ready board behavior.
