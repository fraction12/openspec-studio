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
        file("openspec/changes/archive/2026-04-01-old-flow/specs/auth/spec.md", 11),
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
    expect(index.archivedChanges[0]?.archiveMetadata).toEqual({
      archivedDate: "2026-04-01",
      originalName: "old-flow",
    });
    expect(index.archivedChanges[0]?.artifacts.proposal.exists).toBe(true);
    expect(index.archivedChanges[0]?.artifacts.design.exists).toBe(false);
    expect(index.archivedChanges[0]?.artifacts.deltaSpecs).toEqual([
      {
        kind: "delta-spec",
        capability: "auth",
        exists: true,
        path: "openspec/changes/archive/2026-04-01-old-flow/specs/auth/spec.md",
        modifiedTimeMs: 11,
        sourceTrace: {
          source: "file-tree",
          path: "openspec/changes/archive/2026-04-01-old-flow/specs/auth/spec.md",
        },
        modifiedTimeTrace: {
          source: "file-record",
          path: "openspec/changes/archive/2026-04-01-old-flow/specs/auth/spec.md",
        },
      },
    ]);
    expect(index.archivedChanges[0]?.touchedCapabilities).toEqual([
      {
        capability: "auth",
        sourceTrace: {
          source: "file-tree",
          path: "openspec/changes/archive/2026-04-01-old-flow/specs/auth/spec.md",
        },
      },
    ]);
    expect(index.archivedChanges[0]?.taskProgress).toEqual({
      available: true,
      completed: 0,
      total: 0,
      sourceTrace: {
        source: "markdown",
        path: "openspec/changes/archive/2026-04-01-old-flow/tasks.md",
      },
    });
  });

  it("derives archived task progress from archived tasks content", () => {
    const index = indexOpenSpecWorkspace({
      files: [
        file(
          "openspec/changes/archive/manual-old-flow/tasks.md",
          12,
          ["- [x] Complete proposal", "- [ ] Follow-up note"].join("\n"),
        ),
      ],
    });

    expect(index.archivedChanges[0]?.archiveMetadata).toEqual({});
    expect(index.archivedChanges[0]?.taskProgress).toEqual({
      available: true,
      completed: 1,
      total: 2,
      sourceTrace: {
        source: "markdown",
        path: "openspec/changes/archive/manual-old-flow/tasks.md",
      },
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

  it("indexes large active, archive, spec, and delta-spec lists accurately", () => {
    const files: VirtualOpenSpecFileRecord[] = [];

    for (let index = 0; index < 80; index += 1) {
      const changeName = `add-capability-${String(index).padStart(3, "0")}`;
      files.push(
        file(`openspec/changes/${changeName}/proposal.md`, 1000 + index),
        file(
          `openspec/changes/${changeName}/tasks.md`,
          2000 + index,
          ["- [x] Propose", "- [ ] Implement", "- [X] Verify"].join("\n"),
        ),
        file(
          `openspec/changes/${changeName}/specs/capability-${index}/spec.md`,
          3000 + index,
        ),
        file(`openspec/changes/${changeName}/notes.md`, 4000 + index),
      );
    }

    for (let index = 0; index < 120; index += 1) {
      const changeName = `2026-04-01-old-capability-${String(index).padStart(
        3,
        "0",
      )}`;
      files.push(
        file(`openspec/changes/archive/${changeName}/proposal.md`, 5000 + index),
        file(`openspec/changes/archive/${changeName}/design.md`, 6000 + index),
        file(
          `openspec/changes/archive/${changeName}/tasks.md`,
          7000 + index,
          ["- [x] Done", "- [x] Also done", "- [ ] Deferred"].join("\n"),
        ),
        file(
          `openspec/changes/archive/${changeName}/specs/archive-capability-${index}/spec.md`,
          8000 + index,
        ),
      );
    }

    for (let index = 0; index < 40; index += 1) {
      files.push(
        file(`openspec/specs/root-capability-${index}/spec.md`, 9000 + index),
      );
    }

    const indexed = indexOpenSpecWorkspace({ files });

    expect(indexed.activeChanges).toHaveLength(80);
    expect(indexed.archivedChanges).toHaveLength(120);
    expect(indexed.specs).toHaveLength(40);

    const active = indexed.activeChanges.find(
      (change) => change.name === "add-capability-042",
    );
    expect(active?.modifiedTimeMs).toBe(4042);
    expect(active?.artifacts.deltaSpecs).toEqual([
      expect.objectContaining({
        capability: "capability-42",
        path: "openspec/changes/add-capability-042/specs/capability-42/spec.md",
      }),
    ]);
    expect(active?.taskProgress).toEqual({
      available: true,
      completed: 2,
      total: 3,
      sourceTrace: {
        source: "markdown",
        path: "openspec/changes/add-capability-042/tasks.md",
      },
    });

    const archived = indexed.archivedChanges.find(
      (change) => change.name === "2026-04-01-old-capability-077",
    );
    expect(archived?.archiveMetadata).toEqual({
      archivedDate: "2026-04-01",
      originalName: "old-capability-077",
    });
    expect(archived?.modifiedTimeMs).toBe(8077);
    expect(archived?.taskProgress).toEqual({
      available: true,
      completed: 2,
      total: 3,
      sourceTrace: {
        source: "markdown",
        path: "openspec/changes/archive/2026-04-01-old-capability-077/tasks.md",
      },
    });
    expect(indexed.specs[0]?.capability).toBe("root-capability-0");
  });

  it("keeps archive directory records from creating active changes", () => {
    const index = indexOpenSpecWorkspace({
      files: [
        directory("openspec/changes/archive", 100),
        directory("openspec/changes/archive/2026-04-01-old-flow", 110),
        file("openspec/changes/archive/2026-04-01-old-flow/tasks.md", 120),
        file("openspec/changes/archive-ready/tasks.md", 130),
      ],
    });

    expect(index.activeChanges.map((change) => change.name)).toEqual([
      "archive-ready",
    ]);
    expect(index.archivedChanges.map((change) => change.name)).toEqual([
      "2026-04-01-old-flow",
    ]);
    expect(index.archivedChanges[0]?.modifiedTimeMs).toBe(120);
  });
});

function file(
  path: string,
  modifiedTimeMs: number,
  content?: string,
): VirtualOpenSpecFileRecord {
  return { path, kind: "file", modifiedTimeMs, content };
}

function directory(
  path: string,
  modifiedTimeMs: number,
): VirtualOpenSpecFileRecord {
  return { path, kind: "directory", modifiedTimeMs };
}
