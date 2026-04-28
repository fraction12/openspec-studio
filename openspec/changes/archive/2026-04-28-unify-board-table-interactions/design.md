# Design

## Approach
Create a generic table renderer inside the current app module. The component owns common behavior:

- table scroll wrapper
- colgroup/header rendering
- selectable row semantics
- keyboard activation
- selected row styling
- bounded row rendering with Show more
- optional first-column resizing

Each board passes context-specific columns and row renderers:

- Changes: change title, trust, tasks, capabilities, updated time, optional archive action.
- Specs: spec capability, trust, requirement count, updated time.

## Pill Spacing
The health pill should have enough horizontal padding and a minimum width that supports the longest current table label, including `Check needed`, without the status dot touching the edge. The table columns should provide enough width for that shared pill treatment.

## Constraints
- Keep horizontal table scrolling on compact widths.
- Keep row geometry stable during hover, focus, and selection.
- Preserve archive button click isolation so row selection does not fire when archiving.
