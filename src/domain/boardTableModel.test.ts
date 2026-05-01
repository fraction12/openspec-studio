import { describe, expect, it } from "vitest";

import {
  boundedRows,
  clampBoardTableWidth,
  defaultBoardTableSort,
  nextBoardTableSort,
  nextFocusedRowId,
  resetBoardTableWidth,
  sortAriaValue,
  sortBoardRows,
  sortButtonLabel,
  nextTableSortDirection,
  sortRowsByUpdatedTime,
} from "./boardTableModel";

describe("Board Table Interaction Module", () => {
  const columns = [
    { id: "title", label: "Title" },
    {
      id: "updated",
      label: "Updated",
      sortable: {
        defaultDirection: "desc" as const,
        getValue: (row: { modifiedTimeMs?: number | null }) => row.modifiedTimeMs,
      },
    },
  ];

  it("derives default and next sort state", () => {
    expect(defaultBoardTableSort(columns)).toEqual({ columnId: "updated", direction: "desc" });
    expect(nextBoardTableSort(columns[1], { columnId: "updated", direction: "desc" })).toEqual({
      columnId: "updated",
      direction: "asc",
    });
    expect(nextBoardTableSort(columns[1], null)).toEqual({ columnId: "updated", direction: "desc" });
    expect(nextBoardTableSort(columns[0], null)).toBeNull();
  });

  it("sorts rows stably and keeps missing numeric values last", () => {
    const rows = [
      { id: "old", modifiedTimeMs: 1 },
      { id: "missing", modifiedTimeMs: null },
      { id: "new", modifiedTimeMs: 3 },
    ];

    expect(sortBoardRows(rows, columns, { columnId: "updated", direction: "desc" }).map((row) => row.id)).toEqual([
      "new",
      "old",
      "missing",
    ]);
  });

  it("keeps updated-time sorting stable in both directions", () => {
    const rows = [
      { id: "older", modifiedTimeMs: 20 },
      { id: "unknown", modifiedTimeMs: null },
      { id: "newest", modifiedTimeMs: 40 },
      { id: "oldest", modifiedTimeMs: 10 },
      { id: "also-older", modifiedTimeMs: 20 },
    ];

    expect(sortRowsByUpdatedTime(rows, "desc").map((row) => row.id)).toEqual([
      "newest",
      "older",
      "also-older",
      "oldest",
      "unknown",
    ]);
    expect(nextTableSortDirection("desc")).toBe("asc");
    expect(nextTableSortDirection("asc")).toBe("desc");
    expect(sortRowsByUpdatedTime(rows, "asc").map((row) => row.id)).toEqual([
      "oldest",
      "older",
      "also-older",
      "newest",
      "unknown",
    ]);
  });

  it("bounds rows while keeping the selected row visible", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: "row-" + index }));

    expect(boundedRows(rows, "row-4", 2)).toEqual({
      rows: [rows[0], rows[1], rows[4]],
      hiddenCount: 2,
    });
  });

  it("derives keyboard focus movement targets", () => {
    const rows = [{ id: "first" }, { id: "middle" }, { id: "last" }];

    expect(nextFocusedRowId(rows, "middle", "next")).toBe("last");
    expect(nextFocusedRowId(rows, "middle", "previous")).toBe("first");
    expect(nextFocusedRowId(rows, "missing", "next")).toBe("middle");
    expect(nextFocusedRowId(rows, "middle", "first")).toBe("first");
    expect(nextFocusedRowId(rows, "middle", "last")).toBe("last");
  });

  it("constrains resize widths and derives reset width", () => {
    const resize = { minWidth: 120, maxWidth: 360, resetWidth: 220 };

    expect(clampBoardTableWidth(80, resize)).toBe(120);
    expect(clampBoardTableWidth(400, resize)).toBe(360);
    expect(resetBoardTableWidth(resize)).toBe(220);
  });

  it("derives aria sort values and sort button labels", () => {
    expect(sortAriaValue(columns[0], { columnId: "updated", direction: "desc" })).toBeUndefined();
    expect(sortAriaValue(columns[1], null)).toBe("none");
    expect(sortAriaValue(columns[1], { columnId: "updated", direction: "asc" })).toBe("ascending");
    expect(sortButtonLabel(columns[1], null)).toBe("Sort by Updated");
    expect(sortButtonLabel(columns[1], { columnId: "updated", direction: "desc" })).toBe(
      "Updated: sorted newest first. Activate to sort oldest first.",
    );
  });
});
