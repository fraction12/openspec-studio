import { describe, expect, it } from "vitest";

import {
  createRunnerDispatchAttempt,
  createRunnerLifecycleLogEvent,
  latestRunnerAttempt,
  mergeRunnerStreamEvent,
  normalizeRunnerDispatchAttempts,
  replaceRunnerDispatchAttempt,
  runnerAttemptMessage,
  runnerAttemptResponseLabel,
  runnerAttemptRowId,
  runnerAttemptStatusHealth,
  runnerAttemptStatusLabel,
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
      recordedAt: "2026-04-29T12:03:00Z",
    }, "/repo");

    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      eventId: "evt_demo",
      executionStatus: "completed",
      prUrl: "https://github.com/example/repo/pull/1",
      commitSha: "abcdef123456",
      source: "stream",
    });
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
