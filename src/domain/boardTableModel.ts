export type BoardTableSortDirection = "asc" | "desc";

export interface BoardTableSortState {
  columnId: string;
  direction: BoardTableSortDirection;
}

export interface BoardTableSortConfig<T> {
  defaultDirection?: BoardTableSortDirection;
  getValue: (row: T) => number | null | undefined;
}

export interface BoardTableSortableColumn<T> {
  id: string;
  label: string;
  sortable?: BoardTableSortConfig<T>;
}

export interface BoardTableResizeBounds {
  minWidth: number;
  maxWidth: number;
  resetWidth: number;
}

export type BoardTableFocusMovement = "next" | "previous" | "first" | "last";

export interface BoundedRows<T> {
  rows: T[];
  hiddenCount: number;
}

export function sortRowsByUpdatedTime<T extends { modifiedTimeMs?: number | null }>(
  rows: T[],
  direction: BoardTableSortDirection,
): T[] {
  return sortRowsByNumericValue(rows, direction, (row) => row.modifiedTimeMs);
}

export function sortRowsByNumericValue<T>(
  rows: T[],
  direction: BoardTableSortDirection,
  getValue: (row: T) => number | null | undefined,
): T[] {
  return rows
    .map((row, index) => ({ index, row, value: getValue(row) }))
    .sort((left, right) => {
      const leftKnown = typeof left.value === "number" && Number.isFinite(left.value);
      const rightKnown = typeof right.value === "number" && Number.isFinite(right.value);

      if (!leftKnown && !rightKnown) {
        return left.index - right.index;
      }

      if (!leftKnown) {
        return 1;
      }

      if (!rightKnown) {
        return -1;
      }

      const diff = left.value! - right.value!;

      if (diff === 0) {
        return left.index - right.index;
      }

      return direction === "asc" ? diff : -diff;
    })
    .map(({ row }) => row);
}

export function nextTableSortDirection(direction: BoardTableSortDirection): BoardTableSortDirection {
  return direction === "desc" ? "asc" : "desc";
}

export function defaultBoardTableSort<T>(
  columns: BoardTableSortableColumn<T>[],
): BoardTableSortState | null {
  const column = columns.find((candidate) => candidate.sortable);

  if (!column?.sortable) {
    return null;
  }

  return {
    columnId: column.id,
    direction: column.sortable.defaultDirection ?? "desc",
  };
}

export function nextBoardTableSort<T>(
  column: BoardTableSortableColumn<T>,
  current: BoardTableSortState | null,
): BoardTableSortState | null {
  if (!column.sortable) {
    return null;
  }

  return {
    columnId: column.id,
    direction:
      current?.columnId === column.id
        ? nextTableSortDirection(current.direction)
        : column.sortable.defaultDirection ?? "desc",
  };
}

export function sortBoardRows<T extends { id: string }>(
  rows: T[],
  columns: BoardTableSortableColumn<T>[],
  sortState: BoardTableSortState | null,
): T[] {
  if (!sortState) {
    return rows;
  }

  const column = columns.find((candidate) => candidate.id === sortState.columnId);

  if (!column?.sortable) {
    return rows;
  }

  return sortRowsByNumericValue(rows, sortState.direction, column.sortable.getValue);
}

export function boundedRows<T extends { id: string }>(
  rows: T[],
  selectedId: string,
  limit: number,
): BoundedRows<T> {
  if (rows.length <= limit) {
    return { rows, hiddenCount: 0 };
  }

  const bounded = rows.slice(0, limit);
  const selectedIndex = selectedId ? rows.findIndex((row) => row.id === selectedId) : -1;

  if (selectedIndex >= limit) {
    bounded.push(rows[selectedIndex]);
  }

  return {
    rows: bounded,
    hiddenCount: rows.length - bounded.length,
  };
}

export function nextFocusedRowId<T extends { id: string }>(
  rows: T[],
  currentId: string,
  movement: BoardTableFocusMovement,
): string {
  if (rows.length === 0) {
    return "";
  }

  const currentIndex = rows.findIndex((row) => row.id === currentId);
  let nextIndex = currentIndex >= 0 ? currentIndex : 0;

  if (movement === "first") {
    nextIndex = 0;
  } else if (movement === "last") {
    nextIndex = rows.length - 1;
  } else if (movement === "next") {
    nextIndex = Math.min(nextIndex + 1, rows.length - 1);
  } else {
    nextIndex = Math.max(nextIndex - 1, 0);
  }

  return rows[nextIndex]?.id ?? "";
}

export function reconcileFocusedRowId<T extends { id: string }>(
  rows: T[],
  currentFocusId: string,
  selectedId: string,
): string {
  if (selectedId && rows.some((row) => row.id === selectedId)) {
    return selectedId;
  }

  if (rows.some((row) => row.id === currentFocusId)) {
    return currentFocusId;
  }

  return rows[0]?.id ?? "";
}

export function clampBoardTableWidth(value: number, bounds: Pick<BoardTableResizeBounds, "minWidth" | "maxWidth">): number {
  return Math.min(Math.max(value, bounds.minWidth), bounds.maxWidth);
}

export function resetBoardTableWidth(bounds: Pick<BoardTableResizeBounds, "resetWidth">): number {
  return bounds.resetWidth;
}

export function sortAriaValue<T>(
  column: BoardTableSortableColumn<T>,
  sortState: BoardTableSortState | null,
): "ascending" | "descending" | "none" | undefined {
  if (!column.sortable) {
    return undefined;
  }

  if (sortState?.columnId !== column.id) {
    return "none";
  }

  return sortState.direction === "desc" ? "descending" : "ascending";
}

export function sortButtonLabel<T>(
  column: BoardTableSortableColumn<T>,
  sortState: BoardTableSortState | null,
): string {
  if (sortState?.columnId !== column.id) {
    return "Sort by " + column.label;
  }

  const current = sortState.direction === "desc" ? "newest first" : "oldest first";
  const next = nextTableSortDirection(sortState.direction) === "desc" ? "newest first" : "oldest first";

  return column.label + ": sorted " + current + ". Activate to sort " + next + ".";
}
