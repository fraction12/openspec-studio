import { describe, expect, it } from "vitest";

import type { ChangeRecord } from "./workspaceViewModel";
import {
  buildArtifactDetailViewModel,
  parseTaskProgressContent,
} from "./artifactDetailViewModel";
import type { OpenSpecOperationIssue } from "../appModel";
import type { ValidationResult } from "../validation/results";

describe("Artifact Detail View-Model Module", () => {
  it("normalizes selected artifact tabs and selects artifact-read issues", () => {
    const issue = operationIssue("artifact-read", "openspec/changes/demo/proposal.md");
    const model = buildArtifactDetailViewModel({
      change: change("demo", "active"),
      requestedTab: "archive-info",
      artifactPreview: "# Proposal",
      validation: null,
      operationIssues: [issue],
    });

    expect(model.selectedTab).toBe("proposal");
    expect(model.selectedArtifactPath).toBe("openspec/changes/demo/proposal.md");
    expect(model.selectedArtifactIssue).toBe(issue);
    expect(model.detail).toMatchObject({
      kind: "artifact",
      title: "proposal.md",
      content: "# Proposal",
      emptyText: "No artifact preview available.",
    });
  });

  it("parses task progress into open and completed task groups", () => {
    const parsed = parseTaskProgressContent([
      "## Build",
      "- [x] Done",
      "- [ ] Remaining",
      "## Verify",
      "- [ ] Check",
    ].join("\n"));

    expect(parsed.items).toHaveLength(3);
    expect(parsed.remainingGroups).toEqual([
      { title: "Build", items: [{ done: false, label: "Remaining" }] },
      { title: "Verify", items: [{ done: false, label: "Check" }] },
    ]);
    expect(parsed.completedGroups).toEqual([
      { title: "Build", items: [{ done: true, label: "Done" }] },
    ]);
  });

  it("derives task tab detail from the selected change", () => {
    const model = buildArtifactDetailViewModel({
      change: {
        ...change("demo", "active"),
        taskProgress: { done: 1, total: 2, content: "- [x] Done\n- [ ] Remaining" },
      },
      requestedTab: "tasks",
      artifactPreview: "",
      validation: null,
      operationIssues: [],
    });

    expect(model.detail).toMatchObject({
      kind: "tasks",
      remainingCount: 1,
      completedCount: 1,
      unavailable: false,
    });
  });

  it("derives archive-info detail for archived changes", () => {
    const archived = change("2026-04-27-demo", "archived");
    const model = buildArtifactDetailViewModel({
      change: archived,
      requestedTab: "archive-info",
      artifactPreview: "",
      validation: null,
      operationIssues: [],
    });

    expect(model.detail).toMatchObject({
      kind: "archive-info",
      archiveInfo: archived.archiveInfo,
      emptyTitle: "Archive information unavailable",
    });
  });

  it("derives status detail from validation and operation issues", () => {
    const validation: ValidationResult = {
      state: "fail",
      validatedAt: "2026-04-30T00:00:00.000Z",
      summary: { total: 1, passed: 0, failed: 1 },
      diagnostics: [{ id: "diagnostic", kind: "command-failure", severity: "error", message: "failed" }],
      issues: [],
      raw: {},
    };
    const archiveIssue = operationIssue("archive", "demo");
    const model = buildArtifactDetailViewModel({
      change: change("demo", "active"),
      requestedTab: "status",
      artifactPreview: "",
      validation,
      operationIssues: [archiveIssue],
    });

    expect(model.selectedChangeIssues).toEqual([archiveIssue]);
    expect(model.detail).toMatchObject({
      kind: "status",
      diagnostics: validation.diagnostics,
      validationIssues: [],
    });
  });

  it("derives spec-delta empty-state data when no delta artifacts exist", () => {
    const model = buildArtifactDetailViewModel({
      change: change("demo", "active"),
      requestedTab: "spec-delta",
      artifactPreview: "",
      validation: null,
      operationIssues: [],
    });

    expect(model.detail).toEqual({
      kind: "spec-delta",
      artifacts: [],
      emptyTitle: "No spec deltas",
      emptyBody: "No delta specs are indexed for this change.",
    });
  });
});

function change(name: string, phase: ChangeRecord["phase"]): ChangeRecord {
  const artifacts = [
    { id: "proposal", label: "Proposal", path: "openspec/changes/" + name + "/proposal.md", status: "present" as const, note: "" },
    { id: "design", label: "Design", path: "openspec/changes/" + name + "/design.md", status: "present" as const, note: "" },
    { id: "tasks", label: "Tasks", path: "openspec/changes/" + name + "/tasks.md", status: "present" as const, note: "" },
  ];

  return {
    id: name,
    name,
    title: name,
    phase,
    health: "stale",
    statusLabel: "Check needed",
    buildStatus: { kind: "validate", label: "Validate", health: "stale" },
    summary: "",
    capabilities: [],
    updatedAt: "Unknown",
    modifiedTimeMs: null,
    taskProgress: { done: 0, total: 1, content: "- [ ] Todo" },
    artifacts,
    deltaSpecs: [],
    validationIssues: [],
    archiveInfo: phase === "archived"
      ? { path: "openspec/changes/archive/" + name, archivedDate: "2026-04-27", originalName: name, files: artifacts }
      : undefined,
    archiveReadiness: { ready: phase !== "active", reasons: ["Complete all tasks."] },
    searchText: name,
  };
}

function operationIssue(kind: OpenSpecOperationIssue["kind"], target: string): OpenSpecOperationIssue {
  return {
    id: kind + "|" + target,
    kind,
    title: kind,
    message: "message",
    occurredAt: "2026-04-30T00:00:00.000Z",
    target,
  };
}
