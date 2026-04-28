# Prioritized Audit Summary

## Totals

- P0: 0
- P1: 6
- P2: 18
- P3: 6
- Total findings: 30

## P1 Findings

1. Archive-ready phase does not require current clean validation.
   - Source: `reviews/app-model-derived-data.md`
2. Specs are marked valid when validation failed without linked spec issues.
   - Source: `reviews/app-model-derived-data.md`
3. Native folder picker is a no-op on non-macOS packaged targets.
   - Source: `reviews/tauri-desktop-bridge.md`
4. Command timeout can hang forever when child processes keep stdio open.
   - Source: `reviews/tauri-desktop-bridge.md`
5. Archive actions can be submitted multiple times while an archive is already running.
   - Source: `reviews/frontend-shell.md`
6. Validation parser treats real OpenSpec `level: "WARNING"` issues as errors.
   - Source: `reviews/validation-tests-tooling.md`

## Recommended Remediation Order

1. Fix validation trust and parsing first.
   - This includes warning/info severity parsing, failed-validation spec health, and archive-ready gating on current clean validation.
2. Fix mutating archive safety.
   - This includes duplicate submission guards, partial-success refresh, and confirmation for bulk archive.
3. Harden the Tauri command bridge.
   - This includes process-tree timeout handling, narrower command argument validation, CSP, and non-macOS picker behavior.
4. Clean up derived-data edge cases.
   - This includes normalized file lookup keys and ignoring root-level non-change files under `openspec/changes`.
5. Improve accessibility and interaction semantics.
   - This includes table row selection semantics, keyboard column resizing, tablist behavior, and split search state.
6. Tighten OpenSpec lifecycle and future-write contracts.
   - This includes archiving completed changes into baseline specs, resolving local-desktop-shell contradictions, and strengthening safe artifact authoring scenarios.

## Verification Run During Audit

- `npm run check` passed.
- `npm run test` passed with 36 tests.
- `cargo test` passed with 20 Rust tests.
- `openspec validate --all --strict` passed with 18 items.
- `npm run build` passed in the tooling lane.
- Performance fixture and measurement scripts ran in the tooling lane, but the audit found the measurement does not yet time production model derivation.
