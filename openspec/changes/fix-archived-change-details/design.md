## Overview

Archived changes should be read-only snapshots of real OpenSpec artifacts, not active changes with missing data. The fix expands the derived index for archived folders, maps archived artifacts into the same preview pipeline used for active changes, and switches the inspector to an archive-specific tab set.

## Data Derivation

The archived index will inspect `openspec/changes/archive/<name>/` for:

- `proposal.md`
- `design.md`
- `tasks.md`
- spec delta files under `specs/**/spec.md`
- modified time across the archived folder

Archived task progress will be computed from archived `tasks.md` exactly like active tasks. Archived summaries will be derived from archived `proposal.md` content. Touched capabilities will be derived from archived spec delta paths when present.

## UI Behavior

Archived rows use an `Archived` pill and remain selectable like other rows. Task progress should show real archived task counts when a task artifact exists.

Archived detail panels use archive-only tabs:

- `Proposal` when `proposal.md` exists
- `Design` when `design.md` exists
- `Tasks` when `tasks.md` exists
- `Spec changes` when archived spec deltas exist
- `Archive info` always

The active `Validation` tab is omitted for archived changes. `Archive readiness` is omitted because an archived change has already completed that workflow.

## Archive Info

Archive info is intentionally lightweight:

- archive folder path
- archived date parsed from the folder name when available
- original change slug parsed from the folder name
- available archived files

If a value cannot be derived, the UI should say so plainly rather than inventing data.

## Risks

- Some archived folders may not follow the date-prefix naming convention. The parser should tolerate that and still show the folder path and available files.
- Historical changes may have missing artifacts. The UI should only show tabs for files that exist.
- Archived changes are not active validation targets, so the UI must not imply validation has passed for a historical snapshot.
