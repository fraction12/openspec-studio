import { describe, expect, it } from "vitest";

import type { ChangeRecord, SpecRecord, WorkspaceView } from "./workspaceViewModel";
import {
  derivePersistedWorkspaceSelection,
  initializeWorkspaceNavigation,
  normalizeWorkspaceDetailTab,
  reconcileVisibleChangeSelection,
  reconcileVisibleSpecSelection,
  retainWorkspaceNavigation,
} from "./workspaceNavigationState";

describe("Workspace Navigation State Module", () => {
  it("restores persisted selection for a new workspace and resets navigation chrome", () => {
    const workspace = workspaceWith({
      changes: [change("active-a", "active"), change("active-b", "active")],
      specs: [spec("spec-a"), spec("spec-b")],
    });

    expect(
      initializeWorkspaceNavigation(workspace, {
        lastSelectedChange: "active-b",
        lastSelectedSpec: "spec-b",
      }),
    ).toEqual({
      selectedChangeId: "active-b",
      selectedSpecId: "spec-b",
      detailTab: "proposal",
      view: "changes",
      phase: "active",
      changesQuery: "",
      specsQuery: "",
    });
  });

  it("falls back to first active change, then first available change, then empty selection", () => {
    expect(
      initializeWorkspaceNavigation(workspaceWith({ changes: [change("archived", "archived"), change("active", "active")] })),
    ).toMatchObject({ selectedChangeId: "active" });

    expect(
      initializeWorkspaceNavigation(workspaceWith({ changes: [change("archived", "archived")] })),
    ).toMatchObject({ selectedChangeId: "archived" });

    expect(initializeWorkspaceNavigation(workspaceWith({ changes: [] }))).toMatchObject({
      selectedChangeId: "",
      selectedSpecId: "",
    });
  });

  it("retains same-workspace selections that still exist and falls back when missing", () => {
    const workspace = workspaceWith({
      changes: [change("active-a", "active"), change("active-b", "active")],
      specs: [spec("spec-a"), spec("spec-b")],
    });

    expect(
      retainWorkspaceNavigation(workspace, {
        selectedChangeId: "active-b",
        selectedSpecId: "spec-b",
      }),
    ).toEqual({ selectedChangeId: "active-b", selectedSpecId: "spec-b" });

    expect(
      retainWorkspaceNavigation(workspace, {
        selectedChangeId: "missing",
        selectedSpecId: "missing",
      }),
    ).toEqual({ selectedChangeId: "active-a", selectedSpecId: "spec-a" });
  });

  it("reconciles visible change and spec selections without leaking filter logic into React", () => {
    const changes = [
      change("active-a", "active", "alpha"),
      change("active-b", "active", "beta"),
      change("archived-a", "archived", "alpha archived"),
    ];
    const specs = [spec("auth", "login auth"), spec("billing", "invoice")];

    expect(
      reconcileVisibleChangeSelection({
        changes,
        selectedChangeId: "archived-a",
        phase: "active",
        query: "alpha",
      }),
    ).toEqual({ selectedChangeId: "active-a", detailTabReset: true });

    expect(
      reconcileVisibleSpecSelection({
        specs,
        selectedSpecId: "billing",
        query: "auth",
      }),
    ).toEqual({ selectedSpecId: "auth" });
  });

  it("normalizes detail tabs for active, archive-ready, and archived changes", () => {
    expect(normalizeWorkspaceDetailTab(change("active", "active"), "archive-info")).toBe("proposal");
    expect(normalizeWorkspaceDetailTab(change("ready", "archive-ready"), "status")).toBe("status");
    expect(normalizeWorkspaceDetailTab(change("archived", "archived"), "status")).toBe("proposal");
    expect(normalizeWorkspaceDetailTab({ ...change("archived", "archived"), artifacts: [] }, "status")).toBe("archive-info");
  });

  it("derives persisted selection payload without changing the persistence shape", () => {
    expect(
      derivePersistedWorkspaceSelection({
        repoPath: "/repo/current",
        repoState: "ready",
        workspaceFingerprint: "fp",
        selectedChangeId: "change-a",
        selectedSpecId: "spec-a",
      }),
    ).toEqual({
      repoPath: "/repo/current",
      selection: {
        changeId: "change-a",
        specId: "spec-a",
      },
    });

    expect(
      derivePersistedWorkspaceSelection({
        repoPath: "browser-preview://openspec-studio",
        repoState: "ready",
        workspaceFingerprint: "fp",
        selectedChangeId: "change-a",
        selectedSpecId: "spec-a",
      }),
    ).toBeNull();
  });
});

function workspaceWith(input: { changes?: ChangeRecord[]; specs?: SpecRecord[] }): WorkspaceView {
  return {
    changes: input.changes ?? [],
    specs: input.specs ?? [],
    filesByPath: {},
    fileSignature: { fingerprint: "fp", latestPath: null, latestModifiedTimeMs: null },
    changeStatuses: [],
    validation: null,
  };
}

function change(id: string, phase: ChangeRecord["phase"], searchText = id): ChangeRecord {
  return {
    id,
    name: id,
    title: id,
    phase,
    health: "stale",
    statusLabel: "Check needed",
    buildStatus: { kind: "validate", label: "Validate", health: "stale" },
    summary: "",
    capabilities: [],
    updatedAt: "Unknown",
    modifiedTimeMs: null,
    taskProgress: null,
    artifacts: [
      { id: "proposal", label: "Proposal", path: "openspec/changes/" + id + "/proposal.md", status: "present", note: "" },
      { id: "design", label: "Design", path: "openspec/changes/" + id + "/design.md", status: "present", note: "" },
      { id: "tasks", label: "Tasks", path: "openspec/changes/" + id + "/tasks.md", status: "present", note: "" },
    ],
    deltaSpecs: [],
    validationIssues: [],
    archiveInfo: phase === "archived" ? { path: "openspec/changes/archive/" + id, archivedDate: null, originalName: id, files: [] } : undefined,
    archiveReadiness: { ready: phase !== "active", reasons: [] },
    searchText,
  };
}

function spec(id: string, searchText = id): SpecRecord {
  return {
    id,
    capability: id,
    path: "openspec/specs/" + id + "/spec.md",
    health: "stale",
    requirements: 0,
    updatedAt: "Unknown",
    modifiedTimeMs: null,
    summary: "",
    summaryQuality: "missing",
    validationIssues: [],
    requirementsPreview: [],
    sourceContent: "",
    searchText,
  };
}
