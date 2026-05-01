## 1. Baseline And Vocabulary

- [x] 1.1 Review `proposal.md`, `design.md`, and all spec deltas for this change before editing implementation files.
- [x] 1.2 Confirm `CONTEXT.md` contains Workbench Application Modules, Repository Opening Flow Module, Workspace Navigation State Module, Board Table Interaction Module, Artifact Detail View-Model, and Studio Runner Log Module terms.
- [x] 1.3 Run the current relevant test baseline with `npm test -- --run` and note any pre-existing failures before making code changes.
- [x] 1.4 Inspect the active `verify-mutating-operation-postconditions` change and avoid duplicating its archive postcondition contract.

## 2. Repository Opening Flow Module

- [x] 2.1 Add a Repository Opening Flow Module in `src/domain/` or another existing frontend domain/workflow location that matches repo conventions.
- [x] 2.2 Add tests covering empty repository path decisions, browser preview transition, no-provider transition, ready repository same-repo keep-selection decision, ready repository new-repo restore-selection decision, and refresh result transitions.
- [x] 2.3 Move browser preview repository/workspace construction policy out of `src/App.tsx` and behind the Repository Opening Flow Module Interface.
- [x] 2.4 Move no-provider candidate error, load state, workspace clearing, and message decisions out of `src/App.tsx` and behind the Module Interface.
- [x] 2.5 Move ready repository transition decisions for selection mode, recent repo persistence intent, Git status refresh intent, load state, and refreshed-files message behind the Module Interface.
- [x] 2.6 Move unchanged/updated/stale refresh transition decisions behind the Module Interface while leaving provider IO in Provider Session.
- [x] 2.7 Keep archive and validation command execution in Provider Session and app wiring; only extract result-to-shell transition policy that is already independent of provider IO.
- [x] 2.8 Run the new Repository Opening Flow Module tests and relevant existing provider/workspace tests.

## 3. Workspace Navigation State Module

- [x] 3.1 Add a Workspace Navigation State Module that consumes Workspace View-Model records and current navigation state.
- [x] 3.2 Add tests for new workspace persisted selection restoration, fallback to first active change, fallback to first available change, empty workspace selection, same-workspace selection retention, and missing-selection fallback.
- [x] 3.3 Add tests for selected detail tab normalization across active, archive-ready, and archived changes.
- [x] 3.4 Move `selectFirstItems`, `restorePersistedSelection`, `keepSelectionInWorkspace`, and detail-tab validity policy out of `src/App.tsx` into the Workspace Navigation State Module.
- [x] 3.5 Replace selection/detail-tab React effects with calls to the Workspace Navigation State Module while keeping React as the owner of state setters.
- [x] 3.6 Move persisted selection payload derivation behind the Workspace Navigation State Module without changing persistence format.
- [x] 3.7 Remove or relocate shallow selection helpers from `src/appModel.ts` when their policy is absorbed by the new Module.
- [x] 3.8 Run the new navigation tests plus `src/App.archived.test.ts` and persistence tests.

## 4. Board Table Interaction Module

- [x] 4.1 Deepen `src/domain/boardTableModel.ts` into the Board Table Interaction Module rather than creating a competing table policy Module.
- [x] 4.2 Add or move tests for default sort state, next sort state, sorted rows, bounded rows with selected-row inclusion, focus movement, resize clamping, reset width, aria sort value, and sort button label.
- [x] 4.3 Move `defaultBoardTableSort`, `sortBoardRows`, `boundedRows`, `sortAriaValue`, `sortButtonLabel`, and table-specific sorting policy out of `src/App.tsx`.
- [x] 4.4 Move keyboard focus target derivation out of `BoardTable` while leaving DOM focus calls and refs in React.
- [x] 4.5 Move resize width clamping/reset decisions out of `BoardTable` while leaving pointer listeners and CSS variable application in React.
- [x] 4.6 Update Changes, Specs, and Runner Log table callers to use the same Board Table Interaction Module Interface.
- [x] 4.7 Remove board table tests from broad archived-change test coverage when equivalent focused Module tests exist.
- [x] 4.8 Run Board Table Interaction Module tests and the full frontend unit suite.

## 5. Artifact Detail View-Model Module

- [x] 5.1 Add an Artifact Detail View-Model Module that consumes `ChangeRecord`, artifact preview content, validation state, and operation issues.
- [x] 5.2 Add tests for selected tab normalization, selected artifact path derivation, artifact-read issue selection, task parsing/grouping, archive detail derivation, validation/status detail derivation, and empty-state data.
- [x] 5.3 Move `parseTaskProgressContent`, task group filtering, selected artifact issue lookup, and selected artifact path/detail-tab composition out of `src/App.tsx`.
- [x] 5.4 Move archive-info, status, task, and artifact-list model decisions behind the Artifact Detail View-Model Interface while keeping JSX rendering in React.
- [x] 5.5 Decide whether markdown block parsing belongs in Artifact Detail View-Model or remains a render helper; document the decision in code organization by keeping it with its actual caller.
- [x] 5.6 Simplify `Inspector` and `renderDetailTab` so they render the Artifact Detail View-Model result instead of recomputing selected-change detail policy.
- [x] 5.7 Run Artifact Detail View-Model tests and existing Workspace View-Model tests.

## 6. Studio Runner Log Module

- [x] 6.1 Add a Studio Runner Log Module under `src/runner/` or the closest existing runner domain location.
- [x] 6.2 Add tests for pending dispatch attempt creation, lifecycle/status event creation, stream event normalization and merge, replace/upsert/cap behavior, repo filtering, change filtering, latest attempt selection, row identity, display labels, and persistence-safe normalization.
- [x] 6.3 Move runner history policy from `src/appModel.ts`, `src/persistence.ts`, `src/runner/studioRunnerSession.ts`, and Runner Log rendering helpers into the Studio Runner Log Module.
- [x] 6.4 Update Studio Runner Session to call the Studio Runner Log Module for attempt creation, lifecycle/status events, and stream merges while preserving operational runner workflow ownership.
- [x] 6.5 Update persistence normalization to use the Studio Runner Log Module without changing the durable persisted shape or cap behavior.
- [x] 6.6 Update Runner workspace and Runner Log table helpers to use the Studio Runner Log Module for row identity, latest attempt, response/detail labels, and status/timestamp labels.
- [x] 6.7 Leave runner dispatch payload shape, endpoint handling, Tauri command names, and stream DTO handling compatible with current behavior.
- [x] 6.8 Run Studio Runner Session, Studio Runner Log, persistence, and app model tests.

## 7. App Shell Integration Cleanup

- [x] 7.1 Review `src/App.tsx` after each Module extraction and remove only the policy that has moved behind a tested Module Interface.
- [x] 7.2 Keep visual composition, event handler wiring, DOM refs, browser event listeners, and component-local rendering state in React.
- [x] 7.3 Ensure no new Module is a pass-through wrapper; fold any shallow extraction into an existing Module if it fails the deletion test.
- [x] 7.4 Ensure imports from `src/App.tsx` do not leak into Module tests.
- [x] 7.5 Ensure all moved helpers have one clear owner and no duplicate implementations remain in `src/App.tsx`, `src/appModel.ts`, or persistence.

## 8. Verification

- [x] 8.1 Run `npm test -- --run`.
- [x] 8.2 Run `npm run check`.
- [x] 8.3 Run `npm run build`.
- [x] 8.4 Run Rust checks/tests only if native files were touched; otherwise note that native files were not changed.
- [x] 8.5 Run `openspec validate deepen-workbench-application-modules --strict`.
- [x] 8.6 Run `openspec validate --all --strict` after all implementation tasks pass.
- [ ] 8.7 Manually inspect the Changes, Specs, Runner, and inspector flows in the app or via screenshots if frontend behavior was meaningfully rewired.
