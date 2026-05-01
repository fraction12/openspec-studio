## Context

OpenSpec Studio has recently introduced deeper Modules for Provider Session, Workspace View-Model, Studio Runner Session, Native Bridge Module, and Spec Provider behavior. Those extractions improved locality, but they also made the remaining app-shell concentration easier to see: `src/App.tsx` still owns many policies that are not rendering concerns.

The current app shell mixes:

- repository opening and recovery transitions
- browser preview fallback
- persisted selection restoration
- refresh, validation, archive, and Git status message policy
- selected change/spec/detail-tab synchronization
- board table sort/window/focus/resize policy
- artifact detail tab and task parsing behavior
- runner history merging, filtering, display labels, and row identity

The active `verify-mutating-operation-postconditions` change is a related but narrower correctness change. This architecture change should not duplicate its archive postcondition contract. Instead, it should make the surrounding application Modules deep enough that verified mutation results can be wired through a smaller, testable Interface.

## Goals / Non-Goals

**Goals:**

- Deepen five Workbench Application Modules while preserving current behavior.
- Reduce `src/App.tsx` ownership of non-rendering policy.
- Keep each new Module named after a domain concept and documented in `CONTEXT.md`.
- Create focused unit tests for each Module Interface.
- Keep Module Interfaces small enough that deletion would cause meaningful policy to spread back into callers.
- Keep implementation incremental so each Module can be reviewed and verified independently.

**Non-Goals:**

- Add new product functionality, screens, settings, runner behavior, archive behavior, or provider behavior.
- Change visible UX copy except where an extracted Module already owns an existing label.
- Change persistence schema, runner dispatch payloads, Tauri command names, or OpenSpec CLI invocation semantics.
- Move endpoint editing into Settings.
- Introduce framework-level state management or new runtime dependencies.
- Rewrite `App.tsx` into many visual files solely for file-size reduction.

## Decisions

### Decision 1: Treat this as one ordered architecture change

Implement all five candidates under one OpenSpec change because they share one architectural intent: the app shell should render and dispatch intents while domain/workflow Modules own policy.

Alternatives considered:

- **Five separate changes**: smaller blast radius, but each runner would rediscover the same `App.tsx` context and risk inconsistent seams.
- **One broad cleanup without ordering**: simpler proposal, but too easy to produce a tangled refactor.

Rationale: one ordered change preserves the larger design while still allowing independent task groups and verification gates.

### Decision 2: Keep React as the rendering adapter

The new Modules should produce plain data and command results. React should continue to own JSX, browser events, local component state needed only for rendering, and visual composition.

For example:

- Board Table Interaction Module owns sorted/bounded rows, next sort state, focus target decisions, resize clamping, and sort labels.
- `BoardTable` owns DOM refs, actual focus calls, pointer listeners, and table markup.

Alternatives considered:

- **Extract React components only**: improves file size but fails the deletion test because policy would still be scattered.
- **Introduce a full app state machine**: could centralize behavior, but is too large and unnecessary for current needs.

Rationale: pure Modules give better leverage and test surfaces without changing the app stack.

### Decision 3: Repository Opening Flow Module owns repository transition policy

Create a Repository Opening Flow Module that receives repository operation results, current workspace/navigation inputs, runtime mode, and persistence hints, then returns transition decisions the app shell can apply.

It should own:

- empty candidate handling
- browser preview repository/workspace construction
- no-provider candidate error decisions
- ready repository transition summaries
- same-repo keep-selection vs new-repo restore-selection decision
- refresh result transition summaries
- validation/archive result summaries where the result already comes from Provider Session
- Git status kickoff recommendations, not Git command execution

It should not own provider IO. Provider Session remains the Module for provider-backed repository operations.

### Decision 4: Workspace Navigation State Module owns selection invariants

Create a Workspace Navigation State Module that derives and updates:

- selected change ID
- selected spec ID
- selected detail tab
- current board view
- current change phase
- query resets for workspace transitions
- persisted selection payloads

It should own invariants like:

- selected IDs must exist in the current Workspace View-Model
- active changes prefer proposal tabs
- archived changes prefer archive info when needed
- detail tabs must be valid for the selected change
- restoring persisted selection must fall back predictably

The existing `selectVisibleItemId` helper is too shallow because the real invariants live in React effects. This Module should absorb the policy rather than wrap the helper.

### Decision 5: Board Table Interaction Module owns reusable table policy

Deepen `src/domain/boardTableModel.ts` instead of adding another table utility file. The Module should cover table interaction behavior shared by Changes, Specs, and Runner Log:

- default sort state
- next sort state
- sorted rows
- bounded rows that include the selected row
- next focused row ID for keyboard movement
- resized width clamping and reset width decisions
- aria sort values and sort button labels

Rendering, DOM event listeners, refs, and CSS variables remain in React.

### Decision 6: Artifact Detail View-Model Module owns inspector detail modeling

Create an Artifact Detail View-Model Module that derives tab-specific detail state for a selected `ChangeRecord`.

It should own:

- selected tab normalization
- selected artifact path lookup
- artifact read issue selection
- task progress markdown parsing and open/done grouping
- archive info model
- validation/status detail model
- artifact list display state
- empty-state decisions for missing preview content

Markdown rendering itself can stay in React, but markdown block parsing should move if the data structure is used to model detail content rather than purely render one element.

### Decision 7: Studio Runner Log Module owns runner history policy

Create a Studio Runner Log Module around `RunnerDispatchAttempt`.

It should own:

- pending attempt creation
- lifecycle log event creation
- stream event normalization/merge policy
- replace/upsert/cap behavior
- persistence-safe normalization helpers
- repo/change filtering
- latest attempt selection
- row identity
- display labels for status, details, response, and timestamps when they are runner-log-specific

Studio Runner Session should continue to own operational runner workflow. It should call the Studio Runner Log Module instead of importing runner history policy from a broad app model.

## Risks / Trade-offs

- **Risk: One change becomes too large to review** → Mitigation: keep five task groups with tests and verification gates after each group.
- **Risk: Module Interfaces become pass-through wrappers** → Mitigation: apply the deletion test before wiring; if deleting the Module would not spread meaningful policy, fold the work back into an existing Module.
- **Risk: App shell state updates become harder to follow** → Mitigation: return explicit transition objects from Modules and keep React application of those transitions local and readable.
- **Risk: Behavior changes accidentally during extraction** → Mitigation: add tests that pin current behavior before moving policy, then run existing checks after each major group.
- **Risk: Active archive postcondition work overlaps repository flow work** → Mitigation: keep mutation postcondition logic in the active change and let this change only consume Provider Session archive results through a cleaner repository transition Interface.

## Migration Plan

1. Add domain terms to `CONTEXT.md`.
2. Add Module tests around current behavior before moving each policy group.
3. Implement the Repository Opening Flow Module and wire only the relevant `App.tsx` paths.
4. Implement the Workspace Navigation State Module and replace selection/detail-tab effects with Module decisions.
5. Deepen Board Table Interaction Module and move table policy tests out of broad app/view tests.
6. Implement Artifact Detail View-Model Module and simplify inspector detail derivation.
7. Implement Studio Runner Log Module and update Studio Runner Session, persistence, and Runner Log UI to consume it.
8. Run TypeScript checks, unit tests, build, Rust checks if touched, and OpenSpec validation.

Rollback is straightforward because no persistence or external command contract changes are planned: revert the extraction commit or move individual policies back into their previous call sites.

## Open Questions

- Should markdown block parsing live in Artifact Detail View-Model or remain a pure rendering helper if no non-rendering caller needs the parsed structure?
- Should Repository Opening Flow include archive result transition policy now, or wait until `verify-mutating-operation-postconditions` lands so it can consume the final result shape?
- Should Studio Runner Log move all runner history functions out of `appModel.ts`, or should `appModel.ts` re-export them temporarily to reduce migration risk?
