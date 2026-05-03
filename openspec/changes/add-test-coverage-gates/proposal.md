# Add test coverage gates

## Why
OpenSpec Studio now has linting, type checks, tests, builds, and architecture-seam guardrails, but it does not yet have a coverage gate that tells maintainers how much of the codebase is exercised. Symphony already uses a coverage gate in its local quality flow; Studio needs the same kind of feedback, adapted to a TypeScript/Tauri desktop app.

Without coverage reporting, extracted domain modules can appear healthy while critical branches quietly lose regression coverage. The first version should make coverage visible and enforceable where it matters most, without creating a vanity metric that blocks UI-shell refactoring.

## What Changes
- Add a local TypeScript coverage command using Vitest coverage.
- Report coverage percentages for the frontend test suite.
- Introduce scoped thresholds for architecture modules such as `src/domain`, `src/runner`, `src/providers`, validation/persistence/model code, and other extracted non-shell modules.
- Exclude generated output, dependencies, test fixtures, build artifacts, and broad shell/composition files that are not yet useful threshold targets.
- Add a single quality/CI-style command that can run typecheck, lint, tests/coverage, build, Rust tests, and OpenSpec validation.
- Document a staged threshold strategy: start realistic, then ratchet upward as modules deepen.

## Out of Scope
- Requiring 100% coverage for the entire Studio codebase in the first pass.
- Forcing high coverage on `src/App.tsx` while it remains an app shell/composition module.
- Adding Rust/Tauri percentage coverage in the first pass; Rust bridge tests remain required, with `cargo llvm-cov` or equivalent left as future work.
- Rewriting production code solely to satisfy coverage metrics.
- Replacing architecture linting or OpenSpec validation with coverage.

## Impact
- `package.json` gains coverage/quality scripts and any needed coverage dependency.
- Vitest/Vite test configuration gains coverage include/exclude rules and thresholds.
- Documentation/specs clarify which modules are held to coverage thresholds and why.
- Existing tests may need small additions if threshold targets expose meaningful gaps.
