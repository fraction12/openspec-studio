# Design: Runner Log table layout fix

## Approach
Keep the Runner Log as the existing table surface and improve the presentation in place:

- Treat an expanded Runner Log summary row as the selected row.
- Toggle expansion from the row itself for pointer users and with Enter/Space for keyboard users.
- Stop propagation from nested interactive controls so the details button and PR links do not double-toggle the row.
- Keep raw stream endpoint data in expanded metadata, but show `Event stream` as the table Subject so the table remains scan-friendly.
- Remove the hard-coded table minimum width and let long values wrap within fixed-layout columns.
- Preserve native table-cell display for each summary cell, and put grid/flex layout on inner wrappers only. This keeps row backgrounds and divider lines continuous across all columns.

## Risks
The table still uses native table markup, so column sizing is CSS-driven. The fix keeps widths conservative and wraps long Event, Subject, Message, and Updated values to avoid overlap or horizontal scroll.
