## Overview

Studio should distinguish board-level build readiness from artifact completeness. The current health model blends OpenSpec workflow status, missing artifact checks, validation freshness, and archive readiness into one pill. That makes the table feel stricter than OpenSpec itself.

This change introduces a narrow derived display state for change rows:

- `validate`
- `ready`
- `incomplete`
- `done`

The display state is for the board column only. Existing artifact records, validation issues, archive readiness, and runner dispatch eligibility can remain separate.

## Derivation

The build status should be derived in this order:

1. If the row is archive-ready because `tasks.md` is complete, show **Done**.
2. If validation is missing, stale, running, or not known for the current OpenSpec file snapshot, show **Validate**.
3. If validation has a blocking diagnostic associated with the change, or task progress is missing, empty, or otherwise not actionable, show **Incomplete**.
4. Otherwise show **Ready**.

This intentionally keeps missing `design.md` out of the primary build-status derivation. Missing artifacts can still be shown in artifact tabs or runner-specific disabled reasons when those surfaces truly need them.

## Notes

- **Ready** means ready for build work, not ready to archive.
- **Done** means the change is no longer build-ready because all tasks are complete and it belongs in the archive-ready path.
- Runner dispatch may continue to enforce its own prerequisites until that workflow is separately revised.
