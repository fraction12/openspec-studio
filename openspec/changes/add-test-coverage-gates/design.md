# Design: Test coverage gates

## Approach
Use Vitest's coverage support for TypeScript/React code and make it part of a local quality gate. The gate should behave like Symphony's `mix test --cover` flow in spirit: run tests, print a percentage, and fail below configured thresholds. Studio should not copy Symphony's 100% threshold blindly because Studio has a different shape: a React/Tauri shell, decomposing app composition, and several recently extracted modules.

## Coverage Tooling
Use Vitest coverage with the V8 provider as the first implementation:

- keeps coverage in the existing frontend test runner;
- avoids a separate Jest/c8 stack;
- supports text/html/json-style reporting if needed;
- supports include/exclude filters and thresholds.

The expected command shape is:

```json
{
  "test:coverage": "vitest run --coverage",
  "quality": "npm run check && npm run lint && npm run test:coverage && npm run build && cargo test --manifest-path src-tauri/Cargo.toml && openspec validate --all --strict"
}
```

Exact command names can change during implementation, but the repo must expose one obvious coverage command and one obvious quality gate command.

## Threshold Strategy
Start with staged thresholds rather than universal 100%:

- meaningful thresholds for extracted architecture modules (`src/domain`, `src/runner`, `src/providers`, validation/model/persistence helpers);
- lower or excluded thresholds for shell/composition code such as `src/App.tsx` until responsibilities are moved behind deeper modules;
- no threshold pressure on generated files, build output, fixtures, or declarations;
- ratchet thresholds upward once the architecture seams settle.

A reasonable initial target is around 80-85% for core extracted modules, with per-file/per-directory thresholds adjusted based on real baseline data from the first coverage run.

## Relationship to Lint and Complexity Guards
Coverage is not a replacement for architecture linting. The project should keep the split:

- lint/complexity guards protect module boundaries and drift;
- coverage gates protect behavioral regression confidence;
- OpenSpec validation protects spec artifact health;
- Rust bridge tests protect native command behavior until Rust coverage is separately introduced.

## Rust/Tauri Coverage
Rust percentage coverage is intentionally deferred. The first gate should continue to run `cargo test` for the Tauri bridge. A later change may add `cargo llvm-cov` once the JS coverage gate is stable and the team wants native percentage reporting.

## Risks
- Coverage can incentivize low-value tests if thresholds are too aggressive.
- App shell coverage can be noisy while the shell is still being decomposed.
- Coverage tooling can slow the local gate; the command should remain fast enough for frequent use.

## Validation
Implementation should validate with:

- `npm run test:coverage`
- `npm run quality` or the final quality-gate command
- `npm run check`
- `npm run lint`
- `npm run build`
- relevant Vitest suites
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `openspec validate add-test-coverage-gates --strict`
