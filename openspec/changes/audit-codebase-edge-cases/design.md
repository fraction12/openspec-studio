# Design

## Review Structure
This change is the shared audit ledger. Each reviewer owns one lane and writes findings to a dedicated file under `reviews/` so the review can run in parallel without merge conflicts.

## Severity
- `P0`: Data loss, destructive behavior, or app-wide breakage.
- `P1`: Core workflow fails, derived data is wrong, validation is misleading, or packaged desktop behavior breaks.
- `P2`: Edge case bug, confusing state, accessibility gap, or important robustness issue.
- `P3`: Polish issue, minor inconsistency, or low-risk maintainability concern.

## Required Finding Format
Each finding should include:

- `Severity`
- `Area`
- `File`
- `Lines`
- `Problem`
- `Why it matters`
- `Reproduction or evidence`
- `Recommended fix`

## Review Lanes
- Frontend shell, layout, table behavior, selection, keyboard states, and responsive UX.
- App model, derived OpenSpec data, search/filtering, task/spec/change state, and persistence behavior.
- Tauri Rust bridge, command execution, filesystem access, path handling, packaging assumptions, and error propagation.
- Validation parsing, tests, scripts, fixture generation, build/test configuration, and performance measurement utilities.
- OpenSpec artifacts, capability/spec consistency, archived change expectations, and product contract drift.
