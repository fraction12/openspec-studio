# OpenSpec Artifact and Product Contract Review

## Finding 1: Completed implementation changes remain active instead of being archived into the baseline specs

- `Severity`: P2
- `Area`: OpenSpec lifecycle / baseline contract drift
- `File`: `openspec/changes/improve-app-performance-smoothness/tasks.md`, `openspec/changes/unify-board-table-interactions/tasks.md`, `openspec/specs/change-board/spec.md`, `openspec/specs/workspace-intelligence/spec.md`, `openspec/specs/local-desktop-shell/spec.md`
- `Lines`: `openspec/changes/improve-app-performance-smoothness/tasks.md` 1-47; `openspec/changes/unify-board-table-interactions/tasks.md` 1-10; `openspec/specs/change-board/spec.md` 80-156; `openspec/specs/workspace-intelligence/spec.md` 6-13; `openspec/specs/local-desktop-shell/spec.md` 63-79
- `Problem`: Two changes that appear fully implemented and verified remain in `openspec/changes/` as active changes instead of being archived into `openspec/specs/`. Their task ledgers are fully checked, and their deltas define current behavior such as bounded rendering, shared table behavior, status concurrency, stale-response handling, bridge bounds, and compact table behavior. The canonical baseline specs do not contain several of those current contracts.
- `Why it matters`: Future agents that read only `openspec/specs/**` will miss implemented product guarantees, while agents that read active changes may treat already-shipped behavior as pending work. That weakens Spec Driven Development by splitting the current contract between baseline specs and completed active deltas.
- `Reproduction or evidence`: `openspec list --json` reports `improve-app-performance-smoothness` and `unify-board-table-interactions` as `complete`, and their task files are entirely checked. Their spec deltas include requirements such as `Board interactions remain smooth at scale`, `Efficient derived workspace indexing`, `Bounded OpenSpec status loading`, `Desktop bridge keeps local operations bounded`, and shared board-table behavior, but those requirements are not present as named baseline requirements in the current spec files listed above.
- `Recommended fix`: Archive these completed changes through the OpenSpec lifecycle so their deltas are merged into `openspec/specs/**`, or intentionally reopen their task lists with explicit remaining work. After archiving, run a pass to ensure current specs include the shipped performance, bounded-work, and shared-table contracts.

## Finding 2: The local desktop shell contract contradicts the shipped archive bridge

- `Severity`: P2
- `Area`: Product contract consistency / desktop command scope
- `File`: `openspec/specs/local-desktop-shell/spec.md`, `src-tauri/src/bridge.rs`
- `Lines`: `openspec/specs/local-desktop-shell/spec.md` 19-22 and 94-110; `src-tauri/src/bridge.rs` 388-400 and 470-493
- `Problem`: The packaged CLI-resolution scenario says command arguments remain restricted to supported OpenSpec read and validation subcommands, but the same spec later requires archive actions through a restricted bridge. The implementation also ships a dedicated `archive_change` command that runs `openspec archive <change> --yes` after validating the change name.
- `Why it matters`: This is an internal product-contract conflict. A future security or bridge cleanup could cite the read/validation-only sentence and remove or block archive support even though archive actions are now part of the current baseline contract and UI workflow.
- `Reproduction or evidence`: `openspec/specs/local-desktop-shell/spec.md` line 22 excludes write subcommands by saying only read and validation subcommands are supported, while lines 94-110 require archive support. `src-tauri/src/bridge.rs` lines 388-400 implement the archive bridge and lines 470-493 validate archive inputs.
- `Recommended fix`: Rewrite the CLI-resolution scenario to distinguish general `run_openspec_command` allowlisted read/validation commands from dedicated, separately validated write commands such as `archive_change`. Keep the archive requirement as the source of truth for that write path.

## Finding 3: The guided workflow proposal still treats archive and validation as future capabilities

- `Severity`: P3
- `Area`: Active change scope / obsolete requirements
- `File`: `openspec/changes/add-guided-operator-workflows/proposal.md`, `openspec/changes/add-guided-operator-workflows/specs/guided-operator-workflows/spec.md`, `openspec/specs/change-board/spec.md`, `openspec/specs/validation-dashboard/spec.md`
- `Lines`: `openspec/changes/add-guided-operator-workflows/proposal.md` 3-13; `openspec/changes/add-guided-operator-workflows/specs/guided-operator-workflows/spec.md` 3-13; `openspec/specs/change-board/spec.md` 109-125; `openspec/specs/validation-dashboard/spec.md` 6-23
- `Problem`: The active guided-workflows change says the next workflow layer should add guided propose, apply, archive, and validation operations. Archive and validation are already baseline behavior: the current specs require validation execution and archive-ready archive actions, and the implementation has both flows.
- `Why it matters`: Leaving already-shipped workflows in a future-change scope invites duplicate UI and bridge work or conflicting behavior. The real remaining gap appears to be guided propose/apply plus preview/confirmation semantics for write operations, not adding archive/validation from scratch.
- `Reproduction or evidence`: The proposal scopes "propose, apply, archive, and validation" as future work, while `change-board` already requires archive actions from the archive-ready phase and `validation-dashboard` already requires running OpenSpec validation for the selected repository.
- `Recommended fix`: Rescope `add-guided-operator-workflows` to build on existing archive and validation flows. Mark archive/validation as existing operations that need guided confirmation, diagnostics, or preview affordances only where behavior actually differs.

## Finding 4: Safe artifact authoring lacks scenarios for overwrite, conflict, and dirty-state edge cases

- `Severity`: P2
- `Area`: Future write contract / data-loss prevention
- `File`: `openspec/changes/add-safe-artifact-authoring/specs/artifact-authoring/spec.md`, `openspec/changes/add-safe-artifact-authoring/design.md`, `openspec/changes/add-safe-artifact-authoring/tasks.md`
- `Lines`: `openspec/changes/add-safe-artifact-authoring/specs/artifact-authoring/spec.md` 3-13; `openspec/changes/add-safe-artifact-authoring/design.md` 3-9; `openspec/changes/add-safe-artifact-authoring/tasks.md` 3-14
- `Problem`: The spec only says the app writes saved markdown edits under `openspec/` and updates task checkboxes. The design explicitly calls out data-loss risk, and the tasks mention save/cancel and dirty-state handling, but there are no normative scenarios for external edits during an in-app edit, stale base content, save/cancel behavior, rejected writes outside the selected artifact, or refresh/validation behavior after write failures.
- `Why it matters`: This change will introduce direct file writes. Without edge-case scenarios, a future implementation could overwrite external editor changes, persist stale content, or silently desynchronize derived state while still satisfying the current thin spec.
- `Reproduction or evidence`: The authoring spec has only two scenarios: saving a supported markdown artifact and toggling a task checkbox. The design's risk section says in-app editing can create data loss if save/refresh boundaries are unclear, but that concern is not converted into testable requirements.
- `Recommended fix`: Add scenarios requiring base-file freshness checks before save, clear conflict handling when the file changed externally, explicit save/cancel dirty-state behavior, path-boundary rejection for writes outside the selected repository's `openspec/`, and visible refresh/validation results after successful or failed writes.

## Finding 5: Canonical specs still contain archived-change placeholder purposes

- `Severity`: P3
- `Area`: Baseline spec quality / artifact hygiene
- `File`: `openspec/specs/change-board/spec.md`, `openspec/specs/derived-data-accuracy/spec.md`, `openspec/specs/design-system/spec.md`, `openspec/specs/local-desktop-shell/spec.md`, `openspec/specs/product-design-uat/spec.md`, `openspec/specs/repo-discovery/spec.md`, `openspec/specs/validation-dashboard/spec.md`, `openspec/specs/workspace-intelligence/spec.md`
- `Lines`: `openspec/specs/change-board/spec.md` 3-4; `openspec/specs/derived-data-accuracy/spec.md` 3-4; `openspec/specs/design-system/spec.md` 3-4; `openspec/specs/local-desktop-shell/spec.md` 3-4; `openspec/specs/product-design-uat/spec.md` 3-4; `openspec/specs/repo-discovery/spec.md` 3-4; `openspec/specs/validation-dashboard/spec.md` 3-4; `openspec/specs/workspace-intelligence/spec.md` 3-4
- `Problem`: Every current baseline spec still has a generated placeholder purpose such as `TBD - created by archiving change ... Update Purpose after archive.`
- `Why it matters`: Purpose text is the quick orientation layer for future agents. Placeholder purposes make the canonical specs look unfinished and hide the intended boundaries between capabilities, which increases the chance that new changes add duplicate requirements to the wrong capability.
- `Reproduction or evidence`: `rg -n "^TBD - created by archiving change" openspec/specs` returns all eight current spec files.
- `Recommended fix`: Replace each placeholder with a concise capability purpose that explains what the spec owns and what adjacent specs own. Keep this as documentation-only cleanup or bundle it with the next lifecycle/archive hygiene pass.
