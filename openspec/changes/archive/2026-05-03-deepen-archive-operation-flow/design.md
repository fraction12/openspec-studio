## Overview

The goal is to create an Archive Operation Flow Module that converts provider archive results into ordered app-shell transition effects. `ProviderSession` keeps owning archive IO and postcondition checks; `App.tsx` keeps performing effects such as persistence writes and state updates.

## Observed Architectural Friction

`ProviderSession` is already a deep module for archive operations: it validates, invokes archive behavior, reloads workspace data, checks postconditions, and returns structured results. `App.tsx` still repeats result handling in the single-change archive flow and batch archive flow, including stale result handling, unsupported provider handling, validation-blocked cases, partial success messaging, workspace replacement, validation snapshot updates, and selected workspace transitions.

## Proposed Direction

Add `src/domain/archiveOperationFlow.ts` with a small pure interface that accepts provider archive result data plus archive mode context and returns an ordered archive transition effect plan. The app shell applies the effects while keeping side effects local to the shell. Ordered effects are intentional: validation snapshots must be persisted after workspace replacement so persistence sees the updated workspace fingerprint.

Sketch:

```text
ProviderSession archive operation
  -> ProviderSessionArchiveResult
  -> Archive Operation Flow Module
  -> ArchiveOperationTransition ordered effects
  -> App.tsx applies state/persistence/message effects in order
```

## Deepening Rationale

- **Module**: Archive Operation Flow Module.
- **Interface**: provider archive result plus archive mode in, ordered transition effects out.
- **Implementation**: result branching, aggregate partial-result interpretation, message selection, workspace update ordering, validation persistence ordering, and selection retention rules.
- **Depth**: callers learn one transition interface instead of every archive result branch.
- **Seam**: `src/domain/archiveOperationFlow.ts`.
- **Adapter**: none for the first pass; provider archive results already vary through the existing Spec Provider seam.
- **Leverage**: single and batch archive handlers can share one tested transition policy.
- **Locality**: archive transition fixes and tests live in one place rather than across app shell handlers.

Deletion test: deleting the module would push the same archive-result policy back into at least two `App.tsx` handlers. That means the module would keep real workflow policy local rather than acting as a pass-through.

## Risks

- Archive is a mutating workflow, so this should not be mixed with unrelated archive/spec reconciliation work.
- Partial archive handling is user-visible and remains aggregate-only because provider results do not expose per-change partial detail today.
- Validation snapshot persistence and selected-change retention are easy to subtly change if the transition intent is too broad or too effectful.
- The module should avoid owning provider IO; otherwise it would weaken the existing Provider Session seam.

## Open Decisions

- Whether future provider archive results should include structured partial detail such as archived change IDs or failed change name.
- Whether current archive copy should be frozen verbatim in broader App-level tests or kept at the module interface.

## Validation Plan

- Add focused tests for unsupported, stale, validation-blocked, partial, and success archive results for both single and batch flows.
- Run `npm test -- src/domain/archiveOperationFlow.test.ts src/providers/providerSession.test.ts src/App.archived.test.ts`.
- Run `npm test`.
- Run `npm run check`.
- Run `npm run lint`.
- Run `openspec validate deepen-archive-operation-flow --strict`.
