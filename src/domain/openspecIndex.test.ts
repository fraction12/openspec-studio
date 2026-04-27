import { describe, expect, it } from "vitest";

import {
  indexOpenSpecWorkspace,
  type VirtualOpenSpecFileRecord,
} from "./openspecIndex";

describe("indexOpenSpecWorkspace", () => {
  it("indexes active changes separately from archived changes", () => {
    const index = indexOpenSpecWorkspace({
      files: [
        file("openspec/changes/add-login/proposal.md", 100),
        file("openspec/changes/archive-ready/proposal.md", 110),
        file("openspec/changes/archive/2026-04-01-old-flow/proposal.md", 10),
        file("openspec/changes/archive/2026-04-01-old-flow/tasks.md", 12),
      ],
    });

    expect(index.activeChanges.map((change) => change.name)).toEqual([
      "add-login",
      "archive-ready",
    ]);
    expect(index.archivedChanges.map((change) => change.name)).toEqual([
      "2026-04-01-old-flow",
    ]);
    expect(index.archivedChanges[0]?.sourceTrace).toEqual({
      source: "file-tree",
      path: "openspec/changes/archive/2026-04-01-old-flow",
    });
  });

  it("indexes specs by capability name from openspec/specs", () => {
    const index = indexOpenSpecWorkspace({
      files: [
        file("openspec/specs/auth/spec.md", 100),
        file("openspec/specs/billing/invoices/spec.md", 90),
        file("openspec/changes/add-login/specs/auth/spec.md", 80),
      ],
    });

    expect(index.specs).toEqual([
      {
        capability: "auth",
        path: "openspec/specs/auth/spec.md",
        modifiedTimeMs: 100,
        sourceTrace: {
          source: "file-tree",
          path: "openspec/specs/auth/spec.md",
        },
        modifiedTimeTrace: {
          source: "file-record",
          path: "openspec/specs/auth/spec.md",
        },
      },
      {
        capability: "billing/invoices",
        path: "openspec/specs/billing/invoices/spec.md",
        modifiedTimeMs: 90,
        sourceTrace: {
          source: "file-tree",
          path: "openspec/specs/billing/invoices/spec.md",
        },
        modifiedTimeTrace: {
          source: "file-record",
          path: "openspec/specs/billing/invoices/spec.md",
        },
      },
    ]);
  });

  it("derives active change artifacts, touched capabilities, task progress, workflow status, and modified time", () => {
    const index = indexOpenSpecWorkspace({
      files: [
        file("openspec/changes/add-login/proposal.md", 100),
        file("openspec/changes/add-login/design.md", 120),
        file(
          "openspec/changes/add-login/tasks.md",
          150,
          [
            "- [x] Write the proposal",
            "- [ ] Implement the indexer",
            "  - [X] Nested completed task",
            "- not a checkbox",
            "Text with [ ] is not a task",
          ].join("\n"),
        ),
        file("openspec/changes/add-login/specs/auth/spec.md", 130),
        file("openspec/changes/add-login/specs/billing/invoices/spec.md", 140),
        file("openspec/changes/add-login/notes.md", 90),
      ],
      changeStatuses: [
        {
          changeName: "add-login",
          schemaName: "spec-driven",
          isComplete: false,
          artifacts: [
            { id: "proposal", status: "done" },
            { id: "design", status: "ready" },
            { id: "tasks", status: "blocked", dependencies: ["design"] },
          ],
        },
      ],
    });

    expect(index.activeChanges).toHaveLength(1);
    const change = index.activeChanges[0];

    expect(change).toMatchObject({
      name: "add-login",
      path: "openspec/changes/add-login",
      state: "active",
      modifiedTimeMs: 150,
      modifiedTimeTrace: {
        source: "file-record",
        path: "openspec/changes/add-login/tasks.md",
      },
      workflowStatus: {
        status: "blocked",
        schemaName: "spec-driven",
        sourceTrace: {
          source: "cli-status",
          changeName: "add-login",
        },
      },
    });
    expect(change.artifacts.proposal).toMatchObject({
      kind: "proposal",
      exists: true,
      path: "openspec/changes/add-login/proposal.md",
      workflowStatus: "done",
      sourceTrace: {
        source: "file-tree",
        path: "openspec/changes/add-login/proposal.md",
      },
    });
    expect(change.artifacts.design).toMatchObject({
      kind: "design",
      exists: true,
      workflowStatus: "ready",
    });
    expect(change.artifacts.tasks).toMatchObject({
      kind: "tasks",
      exists: true,
      workflowStatus: "blocked",
      workflowDependencies: ["design"],
    });
    expect(change.artifacts.deltaSpecs).toEqual([
      {
        kind: "delta-spec",
        capability: "auth",
        exists: true,
        path: "openspec/changes/add-login/specs/auth/spec.md",
        modifiedTimeMs: 130,
        sourceTrace: {
          source: "file-tree",
          path: "openspec/changes/add-login/specs/auth/spec.md",
        },
        modifiedTimeTrace: {
          source: "file-record",
          path: "openspec/changes/add-login/specs/auth/spec.md",
        },
      },
      {
        kind: "delta-spec",
        capability: "billing/invoices",
        exists: true,
        path: "openspec/changes/add-login/specs/billing/invoices/spec.md",
        modifiedTimeMs: 140,
        sourceTrace: {
          source: "file-tree",
          path: "openspec/changes/add-login/specs/billing/invoices/spec.md",
        },
        modifiedTimeTrace: {
          source: "file-record",
          path: "openspec/changes/add-login/specs/billing/invoices/spec.md",
        },
      },
    ]);
    expect(change.touchedCapabilities).toEqual([
      {
        capability: "auth",
        sourceTrace: {
          source: "file-tree",
          path: "openspec/changes/add-login/specs/auth/spec.md",
        },
      },
      {
        capability: "billing/invoices",
        sourceTrace: {
          source: "file-tree",
          path: "openspec/changes/add-login/specs/billing/invoices/spec.md",
        },
      },
    ]);
    expect(change.taskProgress).toEqual({
      available: true,
      completed: 2,
      total: 3,
      sourceTrace: {
        source: "markdown",
        path: "openspec/changes/add-login/tasks.md",
      },
    });
  });

  it("marks missing artifacts and unavailable task progress without implying readiness", () => {
    const index = indexOpenSpecWorkspace({
      files: [file("openspec/changes/incomplete-change/proposal.md", 25)],
    });

    const change = index.activeChanges[0];

    expect(change.artifacts.design).toEqual({
      kind: "design",
      exists: false,
      path: "openspec/changes/incomplete-change/design.md",
      sourceTrace: {
        source: "file-tree",
        path: "openspec/changes/incomplete-change/design.md",
      },
    });
    expect(change.taskProgress).toEqual({
      available: false,
      completed: 0,
      total: 0,
      sourceTrace: {
        source: "file-tree",
        path: "openspec/changes/incomplete-change/tasks.md",
      },
    });
    expect(change.workflowStatus).toEqual({
      status: "unknown",
      sourceTrace: {
        source: "not-provided",
        changeName: "incomplete-change",
      },
    });
  });
});

function file(
  path: string,
  modifiedTimeMs: number,
  content?: string,
): VirtualOpenSpecFileRecord {
  return { path, kind: "file", modifiedTimeMs, content };
}
