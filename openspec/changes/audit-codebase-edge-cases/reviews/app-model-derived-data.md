# App Model and Derived OpenSpec Data Review

## Finding 1: Archive-ready phase does not require current clean validation

- `Severity`: P1
- `Area`: Change state derivation / archive readiness
- `File`: `src/App.tsx`
- `Lines`: 2445-2463
- `Problem`: `archiveReady` is derived from completed tasks, no missing artifacts, and no linked validation issues, but it does not require validation to exist, be current, or pass. A change can therefore move into the `archive-ready` phase while `health` is still `stale`, while validation has never run, or while validation failed with only repo-level diagnostics.
- `Why it matters`: The archive-ready board drives the bulk and per-change archive actions. This can present an unvalidated or validation-problem change as ready to archive, which is a core workflow correctness issue for Spec Driven Development.
- `Reproduction or evidence`: Build a workspace with proposal/design/tasks present and `tasks.md` containing only checked tasks, then pass `validation = null` into `buildWorkspaceView`. Lines 2451-2457 make `archiveReady` true because there are no linked validation issues, and line 2463 assigns phase `archive-ready`; at the same time `deriveChangeHealth` on lines 2445-2450 returns `stale` because validation is missing. The same happens for stale validation or command-failure validation results that have no per-change issue associations.
- `Recommended fix`: Gate `archiveReady` on a trusted validation state, for example `validation?.state === "pass"` with no diagnostics and no linked issues. Keep stale, missing, parse-failure, and command-failure validation in the active phase with a readiness reason telling the user to run validation.

## Finding 2: Specs are marked valid when validation failed without linked spec issues

- `Severity`: P1
- `Area`: Spec health derivation
- `File`: `src/App.tsx`
- `Lines`: 2559-2566
- `Problem`: `specToView` marks a spec `valid` whenever a non-stale validation object exists and the spec has no linked issues. It does not distinguish a clean pass from a failed validation run with command diagnostics, parse diagnostics, or unassociated failures.
- `Why it matters`: A failed validation command means the app does not know whether specs are valid. Showing every unassociated spec as `valid` is misleading and contradicts the more conservative change-health behavior in `deriveChangeHealth`.
- `Reproduction or evidence`: `createValidationCommandFailureResult` returns `state: "fail"`, zero issues, and a diagnostic. With that result, `validationIssueMaps.bySpec` is empty, so `issues.length` is 0; lines 2564-2565 then set every spec health to `valid` solely because `validation` is truthy.
- `Recommended fix`: Treat spec health similarly to change health: only return `valid` when validation state is `pass` and there are no linked issues or diagnostics. Return `stale` or another non-valid health for command/parse diagnostics and failed validation runs with no spec association.

## Finding 3: Raw file path keys can desynchronize App view data from the normalized index

- `Severity`: P2
- `Area`: Path normalization / derived content lookups
- `File`: `src/App.tsx`
- `Lines`: 2405-2416, 2442, 2552-2567
- `Problem`: `indexOpenSpecWorkspace` normalizes paths before deriving artifact and spec paths, but `buildWorkspaceView` builds `filesByPath` from the original unnormalized file paths. Downstream lookups use normalized paths from the index, so malformed-but-normalizable paths can lose content in the App view.
- `Why it matters`: The index can discover the change/spec correctly while the UI derives missing summaries, empty task-detail content, zero requirements, empty requirement previews, and blank source content. This creates confusing stale or incomplete data without an obvious indexing failure.
- `Reproduction or evidence`: Given an input record such as `./openspec\\specs\\auth\\spec.md` with valid content, `indexOpenSpecWorkspace` normalizes it to `openspec/specs/auth/spec.md`, but line 2405 stores the raw key. `specToView` then looks up `filesByPath[spec.path]` on line 2552, receives `undefined`, and lines 2567 and 2573 derive zero requirements and an empty preview. The same mismatch affects task detail content on line 2442.
- `Recommended fix`: Normalize file records once before both indexing and view construction, or have `buildWorkspaceView` key `filesByPath` by the same normalized path representation used by `indexOpenSpecWorkspace`. Add tests with backslashes, leading `./`, duplicate slashes, and leading slashes.

## Finding 4: Root-level files under `openspec/changes` are indexed as phantom changes

- `Severity`: P2
- `Area`: Change discovery / malformed-file edge cases
- `File`: `src/domain/openspecIndex.ts`, `src/App.tsx`
- `Lines`: `src/domain/openspecIndex.ts` 255-282; `src/App.tsx` 2913-2923
- `Problem`: Change discovery treats any third path segment under `openspec/changes` as a change name. It does not require a directory record or a file nested below a change directory. A loose file such as `openspec/changes/README.md` or `openspec/changes/.keep` becomes an active change named `README.md` or `.keep`.
- `Why it matters`: Auxiliary files or malformed files directly under `openspec/changes` produce phantom rows with missing proposal/design/tasks, and `activeChangeNamesFromFileRecords` will also request CLI status for those fake change names.
- `Reproduction or evidence`: For `openspec/changes/README.md`, `getChangeFileBucket` sees `parts[2] === "README.md"` and creates an active bucket on lines 276-281. `activeChangeNamesFromFileRecords` uses the same third segment on lines 2917-2923, so status loading also treats it as a real active change.
- `Recommended fix`: Only create a change bucket for a depth-3 directory record, or for files/directories nested under `openspec/changes/<change-name>/...`. Exclude root-level files under `openspec/changes` and add regression tests for README, `.keep`, and other non-change files.
