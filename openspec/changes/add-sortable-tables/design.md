## Overview

Add updated-time sorting to the shared table model used by changes and specs. The initial sort state is newest first. The `Updated` column header becomes an interactive button with a sort icon and accessible label that communicates the active direction.

## Sort Behavior

- Sort key: `modifiedTimeMs` where available.
- Default direction: descending, newest first.
- Toggle sequence for the `Updated` header: descending -> ascending -> descending.
- Unknown timestamps sort after known timestamps in descending order and after known timestamps in ascending order as a low-confidence fallback.
- Sorting applies after phase/search filtering and before row limiting so users see the correct top results.

## Table Interaction

Sorting must not fork the shared table component. The table should accept optional sortable column metadata and render consistent header controls. Row click, keyboard selection, column resize, horizontal scroll, and row limits must continue to behave as they do today.

## Accessibility

The sort header control should expose:

- active direction in button label or `aria-sort`
- visible icon state for direction
- keyboard activation with Enter/Space through native button behavior

## Non-Goals

- Multi-column sorting.
- Sorting every table column.
- Persisting sort preferences across app restarts.
