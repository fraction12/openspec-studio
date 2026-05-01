export type BoardTableSortDirection = "asc" | "desc";

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
