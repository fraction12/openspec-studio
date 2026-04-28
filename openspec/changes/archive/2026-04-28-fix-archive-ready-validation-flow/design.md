# Design

## Archive Ready Criteria
Archive readiness is a workflow queue based on completed task checkboxes. Trust and validation status remain visible, but they do not decide whether a completed change appears on the Archive ready board.

## Archive Action
Before invoking `archive_change`, the frontend runs `openspec validate --all --json` through the existing command bridge. The parsed validation result updates the workspace. If validation fails, is unparseable, or produces command diagnostics, archive is blocked and the user sees the validation failure message.

## Spec Delta Correction
The `fix-codebase-edge-case-audit` change introduced new baseline requirements. Its change deltas must use `ADDED Requirements`, not `MODIFIED Requirements`, so the OpenSpec archiver can merge them.
