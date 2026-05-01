import { describe, expect, it } from "vitest";

import type { WorkspaceView } from "./workspaceViewModel";
import {
  BROWSER_PREVIEW_REPO_PATH,
  deriveBrowserPreviewRepositoryTransition,
  deriveEmptyRepositoryOpenTransition,
  deriveNoProviderRepositoryTransition,
  deriveReadyRepositoryTransition,
  deriveRefreshRepositoryTransition,
} from "./repositoryOpeningFlow";

describe("Repository Opening Flow Module", () => {
  it("derives the empty repository path decision", () => {
    expect(deriveEmptyRepositoryOpenTransition()).toEqual({
      candidateError: {
        kind: "missing",
        path: "",
        title: "Choose a repository folder",
        message: "Select a local folder that contains an openspec/ directory.",
      },
      message: "Choose a repository folder to begin.",
    });
  });

  it("derives browser preview repository and workspace state", () => {
    const transition = deriveBrowserPreviewRepositoryTransition();

    expect(transition.repository).toMatchObject({
      id: BROWSER_PREVIEW_REPO_PATH,
      name: "openspec-studio",
      path: BROWSER_PREVIEW_REPO_PATH,
      branch: "browser-preview",
      state: "ready",
    });
    expect(transition.workspace.changes).toEqual([]);
    expect(transition.workspace.specs).toEqual([]);
    expect(transition.gitStatus).toMatchObject({
      state: "unavailable",
      message: "Git status requires the Tauri desktop runtime.",
    });
    expect(transition.navigationMode).toBe("initialize");
    expect(transition.loadState).toBe("loaded");
    expect(transition.message).toBe(
      "Browser preview loaded without repository data. Run the Tauri app to inspect local files.",
    );
  });

  it("derives no-provider transitions and preserves an active workspace when present", () => {
    const result = {
      kind: "no-provider" as const,
      path: "/repo/plain",
      name: "plain",
      summary: "No OpenSpec provider",
    };

    expect(deriveNoProviderRepositoryTransition(result, { hasActiveRepository: false })).toMatchObject({
      repository: {
        id: "/repo/plain",
        name: "plain",
        path: "/repo/plain",
        branch: "local",
        state: "no-workspace",
      },
      workspaceAction: "clear",
      selectionAction: "clear",
      gitStatusAction: "reset",
      loadState: "loaded",
      message: "No OpenSpec workspace was found in /repo/plain",
    });

    expect(deriveNoProviderRepositoryTransition(result, { hasActiveRepository: true })).toMatchObject({
      repository: undefined,
      workspaceAction: "preserve",
      selectionAction: "preserve",
      gitStatusAction: "preserve",
    });
  });

  it("keeps same-repo selection and restores persisted selection for new repositories", () => {
    const workspace = workspaceWithCounts(2, 1);
    const repository = {
      id: "/repo/current",
      name: "current",
      path: "/repo/current",
      branch: "local",
      state: "ready" as const,
      summary: "OpenSpec workspace",
      providerId: "openspec" as const,
      providerLabel: "OpenSpec",
      providerCapabilities: {
        artifacts: true,
        changeStatus: true,
        validation: true,
        archive: true,
        gitStatus: true,
        writeActions: ["archive"],
      },
    };

    expect(
      deriveReadyRepositoryTransition({ kind: "ready", repository, workspace }, { currentRepoPath: "/repo/current" }),
    ).toMatchObject({
      navigationMode: "keep",
      rememberRecentRepo: { path: "/repo/current", name: "current" },
      shouldRefreshGitStatus: true,
      loadState: "loaded",
      message: "Refreshed files: 2 changes and 1 specs.",
    });

    expect(
      deriveReadyRepositoryTransition({ kind: "ready", repository, workspace }, { currentRepoPath: "/repo/other" }),
    ).toMatchObject({
      navigationMode: "restore",
    });
  });

  it("derives unchanged, updated, and stale refresh transitions", () => {
    const workspace = workspaceWithCounts(1, 2);

    expect(deriveRefreshRepositoryTransition({ kind: "unchanged" })).toEqual({
      kind: "unchanged",
      shouldRefreshGitStatus: true,
      gitStatusQuiet: true,
    });
    expect(deriveRefreshRepositoryTransition({ kind: "updated", workspace })).toEqual({
      kind: "updated",
      workspace,
      navigationMode: "keep",
      shouldRefreshGitStatus: true,
      gitStatusQuiet: true,
      message: "OpenSpec files changed. Local files refreshed.",
    });
    expect(deriveRefreshRepositoryTransition({ kind: "stale" })).toEqual({ kind: "stale" });
  });
});

function workspaceWithCounts(changeCount: number, specCount: number): WorkspaceView {
  return {
    changes: Array.from({ length: changeCount }, (_, index) => ({
      id: "change-" + index,
      name: "change-" + index,
      title: "Change " + index,
      phase: "active",
      health: "stale",
      statusLabel: "Check needed",
      buildStatus: { kind: "validate", label: "Validate", health: "stale" },
      summary: "",
      capabilities: [],
      updatedAt: "Unknown",
      modifiedTimeMs: null,
      taskProgress: null,
      artifacts: [],
      deltaSpecs: [],
      validationIssues: [],
      archiveReadiness: { ready: false, reasons: [] },
      searchText: "",
    })),
    specs: Array.from({ length: specCount }, (_, index) => ({
      id: "spec-" + index,
      capability: "spec-" + index,
      path: "openspec/specs/spec-" + index + "/spec.md",
      health: "stale",
      requirements: 0,
      updatedAt: "Unknown",
      modifiedTimeMs: null,
      summary: "",
      summaryQuality: "missing",
      validationIssues: [],
      requirementsPreview: [],
      sourceContent: "",
      searchText: "",
    })),
    filesByPath: {},
    fileSignature: { fingerprint: "fp", latestPath: null, latestModifiedTimeMs: null },
    changeStatuses: [],
    validation: null,
  };
}
