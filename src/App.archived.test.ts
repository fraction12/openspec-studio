import { describe, expect, it } from "vitest";

import { archivedChangeToView, detailTabsForChange } from "./App";
import type { IndexedArchivedChange, VirtualOpenSpecFileRecord } from "./domain/openspecIndex";

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
