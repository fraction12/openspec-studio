# Tasks

## 1. Coverage tooling
- [ ] 1.1 Add Vitest coverage dependency/configuration using the V8 provider or the chosen equivalent.
- [ ] 1.2 Add a `test:coverage` command that prints coverage percentages locally.
- [ ] 1.3 Configure coverage include/exclude patterns for source modules, generated output, dependencies, fixtures, and shell/composition files.

## 2. Threshold policy
- [ ] 2.1 Establish initial thresholds for extracted architecture modules based on a real baseline run.
- [ ] 2.2 Exclude or separately classify `src/App.tsx` and other broad shell files until their responsibilities move behind deeper modules.
- [ ] 2.3 Document the ratchet policy for raising thresholds over time.

## 3. Quality gate
- [ ] 3.1 Add one local quality/CI command that runs typecheck, lint, coverage, build, Rust tests, and OpenSpec validation.
- [ ] 3.2 Ensure the quality command fails when coverage thresholds fail.
- [ ] 3.3 Preserve the existing Rust bridge test gate even though Rust percentage coverage is deferred.

## 4. Tests and validation
- [ ] 4.1 Add focused tests only where the first coverage baseline exposes meaningful gaps in threshold-targeted modules.
- [ ] 4.2 Run `npm run test:coverage`.
- [ ] 4.3 Run the final quality command.
- [ ] 4.4 Run `openspec validate add-test-coverage-gates --strict`.
