# Validation, Tests, and Tooling Review

## Finding 1

- `Severity`: P1
- `Area`: Validation parsing
- `File`: `src/validation/results.ts`; `src/validation/results.test.ts`
- `Lines`: `src/validation/results.ts:291-313`, `src/validation/results.ts:453-463`, `src/validation/results.ts:481-483`, `src/validation/results.test.ts:65-68`
- `Problem`: The parser ignores OpenSpec's real `issue.level` field and only reads a lower-case `severity` field. OpenSpec emits `level: "ERROR" | "WARNING" | "INFO"`, so `WARNING` and `INFO` issues are normalized to `"error"` by default. Because `deriveState()` fails whenever any parsed issue has error severity, a non-strict OpenSpec run that is `valid: true` with warning-only issues is shown as failed in Studio.
- `Why it matters`: This makes validation misleading for a core workflow. OpenSpec treats warning-only output as valid outside strict mode, but Studio can mark the same validation result as failed and make clean work appear invalid.
- `Reproduction or evidence`: A local warning-only fixture produced this OpenSpec JSON with exit status 0: `items[0].valid: true`, `summary.totals.passed: 1`, `issues[0].level: "WARNING"`, `issues[0].path: "overview"`. OpenSpec's installed validator also defines `ValidationLevel = 'ERROR' | 'WARNING' | 'INFO'` and computes `valid` as `errors === 0` in non-strict mode. The current unit test fixture uses `severity: "warning"` instead of the real `level: "WARNING"`, so it misses the production shape.
- `Recommended fix`: Read `issue.level` as the primary OpenSpec severity source, normalize `WARNING` and `INFO` without turning them into errors, and add a warning-only `valid: true` fixture to `src/validation/results.test.ts` asserting that Studio preserves a passing validation state.

## Finding 2

- `Severity`: P2
- `Area`: Validation parsing
- `File`: `src/validation/results.ts`; `src/validation/results.test.ts`
- `Lines`: `src/validation/results.ts:117-119`, `src/validation/results.ts:274-282`, `src/validation/results.test.ts:10-158`
- `Problem`: Root-level `issues` are silently ignored whenever the payload contains an `items` array. `parseValidationResult()` chooses `parseItemIssues()` for any array-valued `raw.items` and never merges or checks `raw.issues`.
- `Why it matters`: A mixed or future-compatible validation payload such as `{ items: [], issues: [{ message: "workspace error" }] }` would produce no issues and can derive a passing state when `summary.failed` and `valid` do not force failure. That hides repository-level validation problems instead of surfacing a diagnostic.
- `Reproduction or evidence`: By inspection, `items` is set for any array at line 109, the branch at lines 117-119 calls only `parseItemIssues()`, and `parseRootIssues()` is only used when `items` is absent. Existing tests cover item issues and unrecognized payloads, but not a recognized payload with both `items` and root-level `issues`.
- `Recommended fix`: Merge normalized root-level issues with item-level issues, or convert unexpected root-level issues in an itemized payload into parse diagnostics. Add a regression test for `items: []` plus root `issues`.

## Finding 3

- `Severity`: P2
- `Area`: Fixture generation script
- `File`: `scripts/create-large-openspec-fixture.mjs`
- `Lines`: `scripts/create-large-openspec-fixture.mjs:6-15`
- `Problem`: The argument parser assumes every CLI argument is a key/value pair and advances by two. Boolean flags such as `--reset` corrupt parsing for all following options when placed before them.
- `Why it matters`: The performance fixture script can reset and generate the default `/tmp/openspec-studio-large-fixture` with default counts even when the caller requested a different target and small counts. That makes performance runs hard to reproduce and can overwrite the wrong temporary fixture.
- `Reproduction or evidence`: Running `node scripts/create-large-openspec-fixture.mjs --reset --target /tmp/openspec-fixture-arg-order --active 0 --archived 0 --specs 0` reported `target: "/tmp/openspec-studio-large-fixture"`, `active: 80`, `archived: 240`, and `specs: 60`. The requested target and counts were ignored because `--reset` consumed `--target` as its value.
- `Recommended fix`: Parse options with an explicit loop that recognizes boolean flags separately from value-taking flags, rejects unknown flags, and errors on missing values. Add script-level tests or at least a small Node smoke check for both `--reset --target ...` and `--target ... --reset`.

## Finding 4

- `Severity`: P2
- `Area`: Performance measurement
- `File`: `scripts/measure-openspec-workspace.mjs`; `package.json`; `src/domain/openspecIndex.test.ts`
- `Lines`: `scripts/measure-openspec-workspace.mjs:13-24`, `scripts/measure-openspec-workspace.mjs:28-40`, `package.json:12-13`, `src/domain/openspecIndex.test.ts:305-395`
- `Problem`: The perf measurement script times filesystem walking and markdown reads only; it never invokes the production indexing or view-model derivation paths. The large indexer test checks correctness at size but records no timing, threshold, or regression signal.
- `Why it matters`: A regression in `indexOpenSpecWorkspace()`, validation issue grouping, task parsing, or derived view construction would not move the published `perf:measure` numbers. The tooling can therefore report healthy performance while the UI's actual expensive work regresses.
- `Reproduction or evidence`: `npm run perf:fixture` generated 1,340 markdown files, and `npm run perf:measure -- /tmp/openspec-studio-large-fixture` reported `metadataScanMs`, `markdownReadMs`, and `totalMs`, but the script only calls `walk()` and `readFile()` before printing those numbers. No production parser/indexer import appears in the script.
- `Recommended fix`: Add an end-to-end measurement that converts the walked records into the same virtual records used by the app and times the production index/model derivation. Record item counts, derived active/archive/spec counts, and a repeatable threshold or baseline so regressions are visible.

## Finding 5

- `Severity`: P3
- `Area`: Build and README instructions
- `File`: `README.md`; `package.json`
- `Lines`: `README.md:11-16`, `package.json:25-32`
- `Problem`: The README says only "Node.js and npm" are required, and `package.json` has no `engines` field, but the Vite version in dev dependencies requires Node `^20.19.0 || >=22.12.0`.
- `Why it matters`: Developers on common older LTS versions such as Node 18 or early Node 20 can follow the documented setup and hit install/build failures that are not explained by the repo.
- `Reproduction or evidence`: `node -p "require('./node_modules/vite/package.json').engines.node"` returns `^20.19.0 || >=22.12.0`, while `README.md` does not state a minimum Node version and `package.json` does not enforce one.
- `Recommended fix`: Add an `engines.node` entry to `package.json` and update the README prerequisite to the same minimum version.

## Finding 6

- `Severity`: P3
- `Area`: Performance measurement script
- `File`: `scripts/measure-openspec-workspace.mjs`
- `Lines`: `scripts/measure-openspec-workspace.mjs:6-13`, `scripts/measure-openspec-workspace.mjs:46-52`
- `Problem`: The measurement script does not validate that the requested repository exists or contains an `openspec/` directory before walking it.
- `Why it matters`: A typo in the target path produces a raw Node stack trace instead of a clear tooling error, which slows down local performance checks and CI diagnosis if the script is reused there.
- `Reproduction or evidence`: `node scripts/measure-openspec-workspace.mjs /tmp/does-not-exist-openspec-studio-audit` exits 1 with `ENOENT: no such file or directory, scandir '/tmp/does-not-exist-openspec-studio-audit/openspec'` from line 47.
- `Recommended fix`: Check `repoPath` and `openspecPath` up front, print a concise error such as `No openspec/ directory found at ...`, and exit non-zero without a stack trace.

## Verification

- `npm run check` passed.
- `npm run test` passed: 4 test files, 36 tests.
- `npm run build` passed.
- `npm run perf:fixture` passed with the default fixture.
- `npm run perf:measure` passed on the repository workspace.
- `npm run perf:measure -- /tmp/openspec-studio-large-fixture` passed after fixture generation completed.
- `openspec validate audit-codebase-edge-cases --json` returned a valid change payload.
- `openspec validate --all --json` returned 18 valid items.
