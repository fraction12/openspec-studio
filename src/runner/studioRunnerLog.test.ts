import { describe, expect, it } from "vitest";

import {
  createRunnerDispatchAttempt,
  createRunnerLifecycleLogEvent,
  latestRunnerAttempt,
  mergeRunnerStreamEvent,
  normalizeRunnerDispatchAttempts,
  replaceRunnerDispatchAttempt,
  runnerChangeIsBuilding,
  runnerAttemptEventLabel,
  runnerAttemptExecutionDetails,
  runnerAttemptMessage,
  runnerAttemptResponseLabel,
  runnerAttemptRowId,
  runnerAttemptRowKind,
  runnerAttemptStateLabel,
  runnerAttemptStatusHealth,
  runnerAttemptStatusLabel,
  runnerAttemptSubject,
  runnerDispatchHistoryForChange,
  runnerDispatchHistoryForRepo,
  upsertRunnerDispatchAttempt,
} from "./studioRunnerLog";
import type { RunnerDispatchAttempt } from "../appModel";

describe("Studio Runner Log Module", () => {
  it("creates pending dispatch attempts while preserving retry payload and created time", () => {
    const previous = attempt({ eventId: "evt_demo", payload: { old: true }, createdAt: "2026-04-29T12:00:00Z" });

    const next = createRunnerDispatchAttempt({
      eventId: "evt_demo",
      repoPath: "/repo",
      changeName: "demo",
      status: "pending",
      message: "Retrying dispatch.",
      previousAttempt: previous,
    });

    expect(next).toMatchObject({
      eventId: "evt_demo",
      repoPath: "/repo",
      changeName: "demo",
      status: "pending",
      message: "Retrying dispatch.",
      payload: { old: true },
      createdAt: "2026-04-29T12:00:00Z",
    });
  });

  it("creates lifecycle and status events with runner log identity", () => {
    expect(
      createRunnerLifecycleLogEvent({
        repoPath: "/repo",
        event: "status",
        message: "Runner checked.",
        status: "unknown",
        occurredAt: "2026-04-29T12:00:00Z",
      }),
    ).toMatchObject({
      repoPath: "/repo",
      changeName: "Runner",
      source: "status",
      eventName: "status",
      executionStatus: "unknown",
    });
  });

  it("merges stream events into existing attempts instead of duplicating rows", () => {
    const attempts = mergeRunnerStreamEvent([
      attempt({ eventId: "evt_demo", repoPath: "/repo", changeName: "demo", updatedAt: "2026-04-29T12:00:00Z" }),
    ], {
      eventId: "evt_demo",
      eventName: "runner.completed",
      status: "completed",
      prUrl: "https://github.com/example/repo/pull/1",
      commitSha: "abcdef123456",
      sourceRepoPath: "/repo/source",
      baseCommitSha: "11111112222222",
      branchName: "studio/demo",
      prState: "open",
      workspaceStatus: "ready",
      workspaceCreatedAt: "2026-04-29T12:00:30Z",
      workspaceUpdatedAt: "2026-04-29T12:02:30Z",
      cleanupEligible: true,
      cleanupReason: "completed",
      cleanupStatus: "pending",
      recordedAt: "2026-04-29T12:03:00Z",
    }, "/repo");

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      eventId: "evt_demo",
      executionStatus: "completed",
      prUrl: "https://github.com/example/repo/pull/1",
      commitSha: "abcdef123456",
      sourceRepoPath: "/repo/source",
      baseCommitSha: "11111112222222",
      branchName: "studio/demo",
      prState: "open",
      workspaceStatus: "ready",
      workspaceCreatedAt: "2026-04-29T12:00:30Z",
      workspaceUpdatedAt: "2026-04-29T12:02:30Z",
      cleanupEligible: true,
      cleanupReason: "completed",
      cleanupStatus: "pending",
      source: "stream",
    });
  });

  it("classifies row kinds and collapses repeated non-run events without collapsing runs", () => {
    const firstStreamError = createRunnerLifecycleLogEvent({
      repoPath: "/repo",
      endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events",
      event: "stream.error",
      message: "Runner stream failed.",
      status: "failed",
      occurredAt: "2026-04-29T12:00:00Z",
    });
    const repeatedStreamError = createRunnerLifecycleLogEvent({
      repoPath: "/repo",
      endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events",
      event: "stream.error",
      message: "Runner stream failed.",
      status: "failed",
      occurredAt: "2026-04-29T12:01:00Z",
    });

    const collapsed = upsertRunnerDispatchAttempt(
      upsertRunnerDispatchAttempt([], firstStreamError),
      repeatedStreamError,
    );

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({
      repeatCount: 2,
      firstRecordedAt: "2026-04-29T12:00:00Z",
      latestRecordedAt: "2026-04-29T12:01:00Z",
    });
    expect(runnerAttemptRowKind(collapsed[0])).toBe("stream");
    expect(runnerAttemptStateLabel(collapsed[0])).toBe("error");
    expect(runnerAttemptEventLabel(collapsed[0])).toBe("Stream · stream.error");

    const distinctRuns = upsertRunnerDispatchAttempt(
      [attempt({ eventId: "evt_one", runId: "run_one", message: "Runner running." })],
      attempt({ eventId: "evt_two", runId: "run_two", message: "Runner running." }),
    );

    expect(distinctRuns.map((item) => item.eventId)).toEqual(["evt_two", "evt_one"]);
  });

  it("bounds and redacts structured execution log entries", () => {
    const entries = Array.from({ length: 205 }, (_, index) => ({
      recordedAt: `2026-04-29T12:${String(index % 60).padStart(2, "0")}:00Z`,
      level: "info",
      source: "agent",
      phase: "agent",
      message: index === 204 ? "x".repeat(5000) : `entry ${index}`,
      sequence: index,
      details: {
        keep: "visible",
        token: "secret-token",
        nested: { authorization: "Bearer secret", value: "safe" },
      },
    }));

    const [next] = mergeRunnerStreamEvent([], {
      eventId: "evt_demo",
      runId: "run_demo",
      eventName: "runner.running",
      repoPath: "/repo",
      changeName: "demo",
      status: "running",
      executionLogEntries: entries,
    }, "/repo");

    const details = runnerAttemptExecutionDetails(next);
    const lastEntry = details.entries[details.entries.length - 1];

    expect(next.executionLogEntries).toHaveLength(200);
    expect(next.executionLogEntries?.[0]?.sequence).toBe(5);
    expect(next.executionLogTruncated).toBe(true);
    expect(lastEntry?.message.length).toBeLessThanOrEqual(4096);
    expect(JSON.stringify(lastEntry?.details)).toContain("[redacted]");
    expect(JSON.stringify(lastEntry?.details)).not.toContain("secret-token");
  });

  it("derives summary milestones and unavailable state from current Symphony metadata", () => {
    const details = runnerAttemptExecutionDetails(attempt({
      eventId: "evt_demo",
      runId: "run_demo",
      repoChangeKey: "/repo::demo",
      executionStatus: "blocked",
      recordedAt: "2026-04-29T12:00:00Z",
      workspacePath: "/tmp/work",
      workspaceStatus: "ready",
      workspaceCreatedAt: "2026-04-29T11:59:00Z",
      workspaceUpdatedAt: "2026-04-29T12:00:30Z",
      branchName: "studio/demo",
      baseCommitSha: "111111122222",
      commitSha: "abcdef123456",
      prUrl: "https://github.com/example/repo/pull/1",
      cleanupEligible: false,
      cleanupReason: "blocked",
      cleanupStatus: "skipped",
      error: "Validation failed.",
    }));

    expect(details.unavailableReason).toBe("not-provided");
    expect(details.entries.map((entry) => entry.phase)).toEqual([
      "ingress",
      "workspace",
      "publication",
      "cleanup",
      "agent",
    ]);
    expect(details.entries.every((entry) => entry.derived)).toBe(true);
  });

  it("upserts, replaces, sorts, and caps runner log attempts", () => {
    const attempts = Array.from({ length: 52 }, (_, index) =>
      attempt({
        eventId: "evt_" + index,
        updatedAt: new Date(Date.UTC(2026, 3, 29, 12, index)).toISOString(),
      }),
    );

    expect(upsertRunnerDispatchAttempt(attempts, attempt({ eventId: "evt_new", updatedAt: "2026-04-29T13:00:00Z" }))).toHaveLength(50);
    expect(
      replaceRunnerDispatchAttempt(
        [attempt({ eventId: "evt_old" }), attempt({ eventId: "evt_keep" })],
        "evt_old",
        attempt({ eventId: "evt_replacement" }),
      ).map((item) => item.eventId),
    ).toEqual(["evt_replacement", "evt_keep"]);
  });

  it("filters repo and change histories and selects the latest attempt", () => {
    const attempts = [
      attempt({ eventId: "evt_old", repoPath: "/repo", changeName: "demo", updatedAt: "2026-04-29T12:00:00Z" }),
      attempt({ eventId: "evt_other", repoPath: "/repo", changeName: "other", updatedAt: "2026-04-29T12:01:00Z" }),
      attempt({ eventId: "evt_new", repoPath: "/repo", changeName: "demo", updatedAt: "2026-04-29T12:02:00Z" }),
      attempt({ eventId: "evt_wrong_repo", repoPath: "/other", changeName: "demo", updatedAt: "2026-04-29T12:03:00Z" }),
    ];

    expect(runnerDispatchHistoryForRepo(attempts, "/repo").map((item) => item.eventId)).toEqual([
      "evt_new",
      "evt_other",
      "evt_old",
    ]);
    expect(runnerDispatchHistoryForChange(attempts, "/repo", "demo").map((item) => item.eventId)).toEqual([
      "evt_new",
      "evt_old",
    ]);
    expect(latestRunnerAttempt(attempts, "/repo")?.eventId).toBe("evt_new");
  });

  it("detects an accepted or running run for the selected repository and change", () => {
    const attempts = [
      attempt({
        eventId: "evt_demo",
        repoPath: "/repo",
        changeName: "demo",
        executionStatus: "accepted",
      }),
      attempt({
        eventId: "evt_other",
        repoPath: "/repo",
        changeName: "other",
        executionStatus: "running",
      }),
    ];

    expect(runnerChangeIsBuilding(attempts, "/repo", "demo")).toBe(true);
    expect(runnerChangeIsBuilding(attempts, "/repo", "other")).toBe(true);
    expect(runnerChangeIsBuilding(attempts, "/repo", "missing")).toBe(false);
    expect(runnerChangeIsBuilding(attempts, "/other", "demo")).toBe(false);
  });

  it("uses the latest run state so terminal states stop selected-change building", () => {
    const attempts = [
      attempt({
        eventId: "evt_running",
        repoPath: "/repo",
        changeName: "demo",
        executionStatus: "running",
        updatedAt: "2026-04-29T12:00:00Z",
      }),
      attempt({
        eventId: "evt_completed",
        repoPath: "/repo",
        changeName: "demo",
        executionStatus: "completed",
        updatedAt: "2026-04-29T12:01:00Z",
      }),
    ];

    expect(runnerChangeIsBuilding(attempts, "/repo", "demo")).toBe(false);
  });

  it("does not treat failed, blocked, or conflict run states as selected-change building", () => {
    for (const executionStatus of ["failed", "blocked", "conflict"] as const) {
      expect(
        runnerChangeIsBuilding([
          attempt({
            eventId: "evt_" + executionStatus,
            repoPath: "/repo",
            changeName: "demo",
            executionStatus,
          }),
        ], "/repo", "demo"),
      ).toBe(false);
    }
  });

  it("ignores non-run lifecycle, stream, and diagnostic rows for selected-change building", () => {
    const attempts = [
      attempt({
        eventId: "evt_lifecycle",
        repoPath: "/repo",
        changeName: "demo",
        executionStatus: "running",
        rowKind: "lifecycle",
      }),
      attempt({
        eventId: "evt_stream",
        repoPath: "/repo",
        changeName: "demo",
        executionStatus: "accepted",
        rowKind: "stream",
      }),
      attempt({
        eventId: "evt_diagnostic",
        repoPath: "/repo",
        changeName: "demo",
        executionStatus: "running",
        rowKind: "diagnostic",
      }),
    ];

    expect(runnerChangeIsBuilding(attempts, "/repo", "demo")).toBe(false);
  });

  it("derives row identity and display labels", () => {
    const completed = attempt({
      eventId: "evt_demo",
      source: "stream",
      eventName: "runner.completed",
      executionStatus: "completed",
      prUrl: "https://github.com/example/repo/pull/1",
      updatedAt: "2026-04-29T12:03:00Z",
    });

    expect(runnerAttemptRowId(completed)).toBe("evt_demo-2026-04-29T12:03:00Z-accepted");
    expect(runnerAttemptMessage(completed)).toBe("stream · runner.completed");
    expect(runnerAttemptResponseLabel(completed)).toBe("https://github.com/example/repo/pull/1");
    expect(runnerAttemptStatusLabel(completed)).toBe("completed");
    expect(runnerAttemptStatusHealth(completed)).toBe("valid");
  });

  it("uses a concise table subject for stream rows instead of the raw endpoint", () => {
    const stream = createRunnerLifecycleLogEvent({
      repoPath: "/repo",
      event: "stream.connected",
      message: "Runner event stream connected.",
      status: "running",
      endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events",
    });

    expect(runnerAttemptSubject(stream)).toBe("Event stream");
  });

  it("normalizes only persistence-safe runner log records", () => {
    expect(
      normalizeRunnerDispatchAttempts([
        {
          eventId: "evt_demo",
          repoPath: "/repo",
          changeName: "demo",
          status: "accepted",
          message: "Accepted",
          createdAt: "2026-04-29T12:00:00Z",
          updatedAt: "2026-04-29T12:01:00Z",
          statusCode: 202,
          executionStatus: "completed",
          source: "stream",
          workspaceStatus: "ready",
          cleanupEligible: true,
          cleanupStatus: "complete",
        },
        { eventId: "", repoPath: "/repo" },
      ]),
    ).toHaveLength(1);
  });
});

function attempt(overrides: Partial<RunnerDispatchAttempt> = {}): RunnerDispatchAttempt {
  return {
    eventId: "evt_demo",
    repoPath: "/repo",
    changeName: "demo",
    status: "accepted",
    message: "Accepted",
    createdAt: "2026-04-29T12:00:00Z",
    updatedAt: "2026-04-29T12:00:00Z",
    ...overrides,
  };
}
