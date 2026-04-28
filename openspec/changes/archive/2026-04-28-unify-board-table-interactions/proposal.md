# Unify board table interactions

## Summary
Refactor the Changes and Specs tables to use one shared table component so row selection, keyboard behavior, bounded rendering, horizontal scrolling, and optional column resizing stay consistent across board contexts.

## Motivation
The Specs table currently looks and behaves close to the Changes table, but the implementation is duplicated and the spec trust pill can feel cramped. Duplicated table markup makes small interaction or spacing fixes easy to apply to one table and miss on the other.

## Scope
- Introduce a shared artifact table component used by both Changes and Specs.
- Preserve page-specific columns, empty states, archive actions, and copy.
- Make the Specs table use the same selection, keyboard, bounded rendering, notice, scrolling, and first-column resizing behavior as the Changes table.
- Fix trust pill spacing so Specs table pills match the rest of the app.

## Non-goals
- Change the underlying OpenSpec data model.
- Hide columns on compact widths.
- Add new table data or new product views.
