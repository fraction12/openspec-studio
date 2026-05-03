import { describe, expect, it } from "vitest";

import {
  runnerStatusFromDto,
  runnerStreamEventFromDto,
} from "./studioRunnerBridgeDto";

describe("Runner Bridge DTO Adapter", () => {
  it("normalizes status DTOs without leaking bridge status names", () => {
    expect(
      runnerStatusFromDto({
        configured: true,
        reachable: true,
        status: "reachable",
        message: "healthy",
        managed: true,
        pid: 42,
        ownership: "managed",
        can_stop: true,
        can_restart: true,
      }),
    ).toMatchObject({
      state: "online",
      label: "Runner online",
      detail: "healthy",
      managed: true,
      pid: 42,
      ownership: "managed",
      canStop: true,
      canRestart: true,
    });

    expect(
      runnerStatusFromDto({
        configured: false,
        reachable: false,
        status: "not-configured",
        message: "missing",
      }),
    ).toMatchObject({
      state: "offline",
      label: "Runner offline",
    });
  });

  it("normalizes recovered, custom, and occupied runner ownership states", () => {
    expect(
      runnerStatusFromDto({
        configured: true,
        reachable: true,
        status: "reachable",
        message: "Recovered local Studio Runner.",
        managed: true,
        pid: 42,
        ownership: "recovered",
        runner_repo_path: "/repo",
        can_stop: true,
        can_restart: true,
      }),
    ).toMatchObject({
      state: "online",
      label: "Restart runner",
      managed: true,
      ownership: "recovered",
      runnerRepoPath: "/repo",
      canStop: true,
      canRestart: true,
    });

    expect(
      runnerStatusFromDto({
        configured: true,
        reachable: true,
        status: "reachable",
        message: "Custom runner reachable.",
        managed: false,
        ownership: "custom",
        can_stop: false,
        can_restart: false,
      }),
    ).toMatchObject({
      state: "online",
      label: "Custom runner reachable",
      managed: false,
      ownership: "custom",
      canStop: false,
      canRestart: false,
    });

    expect(
      runnerStatusFromDto({
        configured: true,
        reachable: false,
        status: "unavailable",
        message: "Port occupied by another process.",
        managed: false,
        ownership: "occupied",
        can_stop: false,
        can_restart: false,
      }),
    ).toMatchObject({
      state: "offline",
      label: "Port occupied",
      ownership: "occupied",
      canStop: false,
      canRestart: false,
    });
  });

  it("preserves current Symphony stream metadata fields from DTOs", () => {
    expect(
      runnerStreamEventFromDto({
        eventName: "runner.completed",
        eventId: "evt_demo",
        runId: "run_demo",
        repoChangeKey: "/repo::add-runner",
        recordedAt: "2026-04-29T12:00:00Z",
        status: "completed",
        workspacePath: "/tmp/workspace",
        workspaceStatus: "ready",
        workspaceCreatedAt: "2026-04-29T11:59:00Z",
        workspaceUpdatedAt: "2026-04-29T12:00:30Z",
        sessionId: "session_demo",
        sourceRepoPath: "/repo/source",
        baseCommitSha: "111111122222",
        branchName: "studio/add-runner",
        commitSha: "abcdef123456",
        prUrl: "https://github.com/example/repo/pull/1",
        prState: "open",
        prMergedAt: null,
        prClosedAt: null,
        cleanupEligible: true,
        cleanupReason: "completed",
        cleanupStatus: "pending",
        cleanupError: null,
        executionLogs: [{ message: "done" }],
        message: "completed",
        error: null,
      }),
    ).toMatchObject({
      eventId: "evt_demo",
      runId: "run_demo",
      repoChangeKey: "/repo::add-runner",
      workspaceStatus: "ready",
      workspaceCreatedAt: "2026-04-29T11:59:00Z",
      workspaceUpdatedAt: "2026-04-29T12:00:30Z",
      sourceRepoPath: "/repo/source",
      baseCommitSha: "111111122222",
      prState: "open",
      cleanupEligible: true,
      cleanupReason: "completed",
      cleanupStatus: "pending",
      executionLogEntries: [{ message: "done" }],
      message: "completed",
    });
  });
});
