# Fix Runner Log table layout

## Why
The Runner Log table can overflow horizontally and stream rows show raw endpoint URLs as the primary Subject value. That makes the row hard to scan, creates awkward wrapping and selected-row border artifacts, and leaves only the small details button as the obvious click target.

## What changes
- Make Runner Log rows clickable so selecting anywhere on the summary row expands or collapses details.
- Keep the details button accessible without double-toggling the row.
- Replace raw stream endpoint subjects with a stable stream subject label while preserving the endpoint in row details.
- Remove forced horizontal table width and allow Event, Subject, and Message content to wrap within available space.
- Keep expanded-row selected styling visually continuous across columns.

## Out of scope
- Changing Runner Log data retention, filtering, sorting, or event semantics.
- Adding new runner functionality.
