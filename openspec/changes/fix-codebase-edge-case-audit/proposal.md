# Fix Codebase Edge Case Audit

## Why
The `audit-codebase-edge-cases` review found 30 concrete correctness, edge-case, accessibility, tooling, bridge-hardening, and OpenSpec lifecycle issues. Several are P1s that can mislead users about validation status, expose unsafe archive behavior, or hang desktop command execution.

## What Changes
- Fix validation parsing and trust semantics so Studio follows real OpenSpec output and only marks artifacts valid when validation is trustworthy.
- Guard archive actions against duplicate submission, add bulk confirmation, and refresh after partial archive mutations.
- Harden the Tauri bridge with exact command-shape validation, process-tree timeout handling where practical, symlink-safe file listing, preserved git porcelain records, restrictive CSP, removal of demo commands, and cross-platform folder selection.
- Fix derived-data edge cases for normalized paths and malformed root-level files under `openspec/changes/`.
- Improve table and tab accessibility while keeping the full-row clickable product behavior.
- Repair tooling scripts, performance measurements, Node version documentation, and OpenSpec contract hygiene.

## Impact
- Broadly touches React shell, validation parser, domain indexing, Tauri bridge/config, scripts, tests, README/package metadata, and OpenSpec artifacts.
- Mutating archive operations become safer and more explicit.
- Some active OpenSpec changes may be archived into baseline specs as part of lifecycle cleanup.
