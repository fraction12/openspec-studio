# Codebase Edge Case Audit

## Why
OpenSpec Studio now has enough product surface area that regressions can hide across the React workbench, derived OpenSpec index, Tauri command bridge, validation parsing, persistence, and design-system interactions. We need a structured review that records concrete bugs and edge cases before adding more features.

## What Changes
- Audit the current codebase for correctness, edge cases, broken assumptions, and UX failure modes.
- Split review ownership across multiple codebase lanes so the audit covers frontend behavior, data derivation, desktop bridge logic, validation contracts, tests, scripts, and OpenSpec consistency.
- Record every finding in this change under `reviews/`, with file references, severity, reproduction notes, and recommended fixes.

## Impact
- Produces an actionable bug backlog grounded in the current implementation.
- Does not change product behavior directly.
- Follow-up fixes should be implemented as separate OpenSpec changes unless a finding is small enough to bundle into an approved remediation pass.
