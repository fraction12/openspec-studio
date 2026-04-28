# Design

## Validation Semantics
Studio treats OpenSpec `level` as the canonical issue severity and preserves warning/info issues without converting them into failures. A change or spec is only `Checked` when validation passed for the current file snapshot, has no diagnostics, and has no linked error-level issue. Failed, stale, parse-failed, or command-failed validation remains non-valid even if no issue could be linked to a specific artifact.

## Archive Safety
Archive actions are single-flight. Row archive buttons and bulk archive are disabled while an archive is running. Bulk archive opens a confirmation dialog listing affected changes. If a sequential bulk archive partially succeeds and then fails, Studio refreshes before reporting the partial failure.

## Desktop Bridge Boundary
The generic OpenSpec invoke command accepts only product-supported command shapes. Dedicated write commands remain separate and validate their inputs. Local command execution must not hang indefinitely after timeout/overflow; where the platform allows it, Studio terminates the process tree. File listing records symlink entries without following them and does not fail the whole index for broken symlinks.

## Cross-Platform Folder Selection
Folder picking uses the Tauri dialog plugin so supported desktop targets get a real native folder picker. Unsupported/canceled selection is distinguishable from bridge failure.

## Interaction Accessibility
Tables keep native table structure and full-row click behavior, but selected state and keyboard operation use valid grid-style semantics with roving focus. Column resize handles support keyboard operation. Segmented controls that are not full ARIA tabs use button semantics instead of incomplete tab widgets.

## Tooling and OpenSpec Hygiene
Scripts validate inputs and measure production indexing/model derivation, not only filesystem I/O. Package metadata and README document the Node version actually required by Vite. Completed implementation changes are archived into baseline specs, baseline spec purposes are replaced with real capability descriptions, and future write-operation specs gain conflict/data-loss scenarios.
