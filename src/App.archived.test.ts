import { describe, expect, it } from "vitest";

import {
  archivedChangeToView,
  buildWorkspaceView,
  detailTabsForChange,
  nextTableSortDirection,
  sortRowsByUpdatedTime,
} from "./App";
import type { IndexedArchivedChange, VirtualOpenSpecFileRecord } from "./domain/openspecIndex";
import { indexOpenSpecWorkspace } from "./domain/openspecIndex";
import type { ValidationResult } from "./validation/results";

describe("archived change view model", () => {
  it("derives archived detail state from archived artifacts", () => {
    const change: IndexedArchivedChange = {
      name: "2026-04-27-old-flow",
      path: "openspec/changes/archive/2026-04-27-old-flow",
      state: "archived",
      artifacts: {
        proposal: {
          kind: "proposal",
          exists: true,
          path: "openspec/changes/archive/2026-04-27-old-flow/proposal.md",
          sourceTrace: {
            source: "file-tree",
            path: "openspec/changes/archive/2026-04-27-old-flow/proposal.md",
          },
        },
        design: {
          kind: "design",
          exists: true,
          path: "openspec/changes/archive/2026-04-27-old-flow/design.md",
          sourceTrace: {
            source: "file-tree",
            path: "openspec/changes/archive/2026-04-27-old-flow/design.md",
          },
        },
        tasks: {
          kind: "tasks",
          exists: true,
          path: "openspec/changes/archive/2026-04-27-old-flow/tasks.md",
          sourceTrace: {
            source: "file-tree",
            path: "openspec/changes/archive/2026-04-27-old-flow/tasks.md",
          },
        },
        deltaSpecs: [
          {
            kind: "delta-spec",
            capability: "change-board",
            exists: true,
            path: "openspec/changes/archive/2026-04-27-old-flow/specs/change-board/spec.md",
            sourceTrace: {
              source: "file-tree",
              path: "openspec/changes/archive/2026-04-27-old-flow/specs/change-board/spec.md",
            },
          },
        ],
      },
      touchedCapabilities: [
        {
          capability: "change-board",
          sourceTrace: {
            source: "file-tree",
            path: "openspec/changes/archive/2026-04-27-old-flow/specs/change-board/spec.md",
          },
        },
      ],
      taskProgress: {
        available: true,
        completed: 1,
        total: 2,
        sourceTrace: {
          source: "markdown",
          path: "openspec/changes/archive/2026-04-27-old-flow/tasks.md",
        },
      },
      archiveMetadata: {
        archivedDate: "2026-04-27",
        originalName: "old-flow",
      },
      sourceTrace: {
        source: "file-tree",
        path: "openspec/changes/archive/2026-04-27-old-flow",
      },
      modifiedTimeMs: 42,
    };
    const filesByPath: Record<string, VirtualOpenSpecFileRecord> = {
      "openspec/changes/archive/2026-04-27-old-flow/proposal.md": {
        path: "openspec/changes/archive/2026-04-27-old-flow/proposal.md",
        content: ["## Why", "", "Archived proposal summary."].join("\n"),
      },
      "openspec/changes/archive/2026-04-27-old-flow/tasks.md": {
        path: "openspec/changes/archive/2026-04-27-old-flow/tasks.md",
        content: ["- [x] Done", "- [ ] Todo"].join("\n"),
      },
    };

    const view = archivedChangeToView(change, filesByPath);

    expect(view.statusLabel).toBe("Archived");
    expect(view.summary).toBe("Archived proposal summary.");
    expect(view.taskProgress).toMatchObject({ done: 1, total: 2 });
    expect(view.capabilities).toEqual(["change-board"]);
    expect(view.archiveInfo).toMatchObject({
      path: "openspec/changes/archive/2026-04-27-old-flow",
      archivedDate: "2026-04-27",
      originalName: "old-flow",
    });
    expect(detailTabsForChange(view).map((tab) => tab.label)).toEqual([
      "Proposal",
      "Design",
      "Tasks",
      "Spec changes",
      "Archive info",
    ]);
  });
});

describe("active archive readiness view model", () => {
  it("uses complete tasks for archive-ready placement without requiring current validation", () => {
    const workspace = buildWorkspaceView(
      indexOpenSpecWorkspace({
        files: activeWorkspaceFiles(),
        changeStatuses: [
          {
            changeName: "ready-flow",
            isComplete: true,
            artifacts: [
              { id: "proposal", status: "done" },
              { id: "design", status: "done" },
              { id: "tasks", status: "done" },
            ],
          },
        ],
      }),
      activeWorkspaceFiles(),
      null,
      [],
    );

    const readyChange = workspace.changes.find((change) => change.name === "ready-flow");

    expect(readyChange).toMatchObject({
      phase: "archive-ready",
      health: "stale",
      archiveReadiness: {
        ready: true,
        reasons: ["All tasks are complete. Archive will run validation before changing files."],
      },
    });
  });

  it("keeps warning-only validation non-blocking in archive-ready rows", () => {
    const validation: ValidationResult = {
      state: "pass",
      validatedAt: "2026-04-27T12:00:00.000Z",
      summary: { total: 1, passed: 1, failed: 0 },
      diagnostics: [],
      raw: {},
      issues: [
        {
          id: "issue-warning",
          severity: "warning",
          message: "Review wording before final archive.",
          associations: [{ kind: "change", id: "ready-flow" }],
          raw: {},
        },
      ],
    };

    const workspace = buildWorkspaceView(
      indexOpenSpecWorkspace({
        files: activeWorkspaceFiles(),
        changeStatuses: [
          {
            changeName: "ready-flow",
            isComplete: true,
            artifacts: [
              { id: "proposal", status: "done" },
              { id: "design", status: "done" },
              { id: "tasks", status: "done" },
            ],
          },
        ],
      }),
      activeWorkspaceFiles(),
      validation,
      [],
    );

    const readyChange = workspace.changes.find((change) => change.name === "ready-flow");

    expect(readyChange).toMatchObject({
      phase: "archive-ready",
      health: "valid",
      archiveReadiness: { ready: true },
    });
    expect(readyChange?.validationIssues).toHaveLength(1);
  });

  it("keeps trust conservative when validation failed without removing task-complete archive readiness", () => {
    const validation: ValidationResult = {
      state: "fail",
      validatedAt: "2026-04-27T12:00:00.000Z",
      summary: { total: 1, passed: 0, failed: 1 },
      diagnostics: [],
      issues: [],
      raw: {},
    };

    const workspace = buildWorkspaceView(
      indexOpenSpecWorkspace({
        files: activeWorkspaceFiles(),
        changeStatuses: [
          {
            changeName: "ready-flow",
            isComplete: true,
            artifacts: [
              { id: "proposal", status: "done" },
              { id: "design", status: "done" },
              { id: "tasks", status: "done" },
            ],
          },
        ],
      }),
      activeWorkspaceFiles(),
      validation,
      [],
    );

    const change = workspace.changes.find((candidate) => candidate.name === "ready-flow");
    const spec = workspace.specs.find((candidate) => candidate.capability === "change-board");

    expect(change?.phase).toBe("archive-ready");
    expect(change?.archiveReadiness).toMatchObject({ ready: true });
    expect(change?.health).toBe("stale");
    expect(spec?.health).toBe("invalid");
  });
});

describe("board table sorting", () => {
  const rows = [
    { id: "older", modifiedTimeMs: 20 },
    { id: "unknown", modifiedTimeMs: null },
    { id: "newest", modifiedTimeMs: 40 },
    { id: "oldest", modifiedTimeMs: 10 },
    { id: "also-older", modifiedTimeMs: 20 },
  ];

  it("defaults updated-time ordering to newest first with unknown values last", () => {
    expect(sortRowsByUpdatedTime(rows, "desc").map((row) => row.id)).toEqual([
      "newest",
      "older",
      "also-older",
      "oldest",
      "unknown",
    ]);
  });

  it("toggles updated-time ordering to oldest first with stable ties", () => {
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
});

function activeWorkspaceFiles(): VirtualOpenSpecFileRecord[] {
  return [
    {
      path: "openspec/changes/ready-flow/proposal.md",
      content: ["## Why", "", "Ready flow."].join("\n"),
    },
    {
      path: "openspec/changes/ready-flow/design.md",
      content: "Design.",
    },
    {
      path: "openspec/changes/ready-flow/tasks.md",
      content: ["- [x] Done", "- [x] Also done"].join("\n"),
    },
    {
      path: "openspec/changes/ready-flow/specs/change-board/spec.md",
      content: "### Requirement: Board",
    },
    {
      path: "openspec/specs/change-board/spec.md",
      content: ["## Purpose", "Board capability.", "### Requirement: Board"].join("\n"),
    },
  ];
}
