import { describe, expect, it } from "vitest";

import {
  activeChangeNamesFromFileRecords,
  buildVirtualFilesByPath,
  buildOpenSpecFileSignature,
  createOpenSpecOperationIssue,
  decideRepositoryCandidateOpen,
  deriveChangeBuildStatus,
  deriveChangeHealth,
  deriveRunnerDispatchEligibility,
  deriveValidationTrustState,
  extractJsonPayload,
  isPersistableLocalRepoPath,
  normalizeRecentRepoPaths,
  recentRepoSwitcherPaths,
  sameOpenSpecOperationScope,
  selectVisibleItemId,
  toVirtualChangeStatusRecord,
  toVirtualFileRecords,
  buildRunnerDispatchPayload,
  createRunnerLifecycleLogEvent,
  mergeRunnerStreamEvent,
  runnerDispatchHistoryForChange,
} from "./appModel";

describe("OpenSpec operation issues", () => {
  it("keeps command output and status details for failed operations", () => {
    expect(
      createOpenSpecOperationIssue({
        kind: "archive",
        title: "Archive failed",
        fallbackMessage: "OpenSpec archive did not complete.",
        repoPath: "/repo",
        target: "fix-demo",
        occurredAt: "2026-04-28T12:00:00.000Z",
        command: {
          stdout: "Task status: complete",
          stderr: "MODIFIED failed for header",
          status_code: 1,
        },
      }),
    ).toEqual({
      id: "archive|/repo|fix-demo|2026-04-28T12:00:00.000Z|MODIFIED failed for header",
      kind: "archive",
      title: "Archive failed",
      message: "MODIFIED failed for header",
      occurredAt: "2026-04-28T12:00:00.000Z",
      repoPath: "/repo",
      target: "fix-demo",
      statusCode: 1,
      stdout: "Task status: complete",
      stderr: "MODIFIED failed for header",
    });
  });

  it("compares issues by operation scope for replacement", () => {
    const first = createOpenSpecOperationIssue({
      kind: "status",
      title: "Status failed",
      fallbackMessage: "Status failed.",
      repoPath: "/repo",
      target: "demo",
      occurredAt: "2026-04-28T12:00:00.000Z",
    });
    const second = createOpenSpecOperationIssue({
      kind: "status",
      title: "Status failed",
      fallbackMessage: "Status failed again.",
      repoPath: "/repo",
      target: "demo",
      occurredAt: "2026-04-28T12:05:00.000Z",
    });

    expect(sameOpenSpecOperationScope(first, second)).toBe(true);
  });
});

describe("toVirtualFileRecords", () => {
  it("normalizes bridge file records into indexer records", () => {
    expect(
      toVirtualFileRecords([
        {
          path: "openspec/changes/demo/tasks.md",
          kind: "file",
          modified_time_ms: 42,
          content: "- [x] Done",
        },
        {
          path: "openspec/changes/demo",
          kind: "directory",
          modifiedTimeMs: 41,
        },
      ]),
    ).toEqual([
      {
        path: "openspec/changes/demo/tasks.md",
        kind: "file",
        modifiedTimeMs: 42,
        content: "- [x] Done",
      },
      {
        path: "openspec/changes/demo",
        kind: "directory",
        modifiedTimeMs: 41,
        content: undefined,
      },
    ]);
  });

  it("normalizes paths before derived lookup helpers consume records", () => {
    expect(
      toVirtualFileRecords([
        {
          path: "./openspec\\changes//demo///tasks.md",
          modified_time_ms: 42,
          content: "- [x] Done",
        },
        {
          path: "/openspec/specs/auth/spec.md",
          modifiedTimeMs: 41,
        },
      ]),
    ).toEqual([
      {
        path: "openspec/changes/demo/tasks.md",
        kind: "file",
        modifiedTimeMs: 42,
        content: "- [x] Done",
        fileSize: undefined,
        readError: undefined,
      },
      {
        path: "openspec/specs/auth/spec.md",
        kind: "file",
        modifiedTimeMs: 41,
        content: undefined,
        fileSize: undefined,
        readError: undefined,
      },
    ]);
  });
});

describe("buildVirtualFilesByPath", () => {
  it("keys file records by normalized paths", () => {
    const filesByPath = buildVirtualFilesByPath([
      {
        path: "./openspec\\specs//auth/spec.md",
        content: "## Auth",
      },
    ]);

    expect(filesByPath["openspec/specs/auth/spec.md"]?.content).toBe("## Auth");
    expect(filesByPath["./openspec\\specs//auth/spec.md"]).toBeUndefined();
  });
});

describe("activeChangeNamesFromFileRecords", () => {
  it("ignores root-level non-change files under openspec changes", () => {
    expect(
      activeChangeNamesFromFileRecords([
        { path: "openspec/changes/README.md", kind: "file" },
        { path: "openspec/changes/.keep", kind: "file" },
        { path: "openspec/changes/archive", kind: "directory" },
        { path: "./openspec\\changes//add-login///tasks.md", kind: "file" },
        { path: "openspec/changes/empty-change", kind: "directory" },
      ]),
    ).toEqual(["add-login", "empty-change"]);
  });
});

describe("extractJsonPayload", () => {
  it("extracts JSON from CLI output that includes status text", () => {
    expect(extractJsonPayload('- Loading...\n{"valid":true,"items":[]}')).toEqual({
      valid: true,
      items: [],
    });
  });

  it("returns undefined when no JSON object is present", () => {
    expect(extractJsonPayload("Change is valid")).toBeUndefined();
  });
});

describe("toVirtualChangeStatusRecord", () => {
  it("normalizes OpenSpec status JSON into indexer status records", () => {
    expect(
      toVirtualChangeStatusRecord(
        {
          changeName: "build-local-desktop-companion",
          schemaName: "spec-driven",
          isComplete: true,
          artifacts: [
            { id: "proposal", status: "done" },
            { id: "tasks", status: "blocked", dependencies: ["design"] },
          ],
        },
        "fallback",
      ),
    ).toEqual({
      changeName: "build-local-desktop-companion",
      schemaName: "spec-driven",
      isComplete: true,
      artifacts: [
        {
          id: "proposal",
          status: "done",
          dependencies: undefined,
        },
        {
          id: "tasks",
          status: "blocked",
          dependencies: ["design"],
        },
      ],
    });
  });

  it("keeps an error record when status output cannot be parsed", () => {
    expect(toVirtualChangeStatusRecord("not json", "demo")).toEqual({
      changeName: "demo",
      error: "Status output was not recognized.",
    });
  });
});

describe("buildOpenSpecFileSignature", () => {
  it("builds a stable fingerprint and records the latest changed file", () => {
    expect(
      buildOpenSpecFileSignature([
        {
          path: "openspec/changes/demo/tasks.md",
          kind: "file",
          modifiedTimeMs: 20,
          fileSize: 12,
        },
        {
          path: "openspec/changes/demo/proposal.md",
          kind: "file",
          modifiedTimeMs: 30,
          fileSize: 42,
        },
      ]),
    ).toEqual({
      fingerprint:
        "openspec/changes/demo/proposal.md:file:30:42|openspec/changes/demo/tasks.md:file:20:12",
      latestPath: "openspec/changes/demo/proposal.md",
      latestModifiedTimeMs: 30,
    });
  });
});

describe("deriveChangeHealth", () => {
  it("keeps repo-level validation failure separate from per-change health", () => {
    expect(
      deriveChangeHealth({
        workflowStatus: "in-progress",
        missingArtifactCount: 0,
        validation: {
          state: "fail",
          validatedAt: "2026-04-27T12:00:00.000Z",
          summary: { total: 3, passed: 2, failed: 1 },
          issues: [],
          diagnostics: [
            {
              id: "diagnostic-1",
              kind: "command-failure",
              message: "openspec validate failed to execute",
              severity: "error",
            },
          ],
          raw: { valid: false },
        },
        validationIssueCount: 0,
      }),
    ).toBe("stale");
  });

  it("marks a change invalid only when linked evidence exists", () => {
    expect(
      deriveChangeHealth({
        workflowStatus: "in-progress",
        missingArtifactCount: 0,
        validation: {
          state: "fail",
          validatedAt: "2026-04-27T12:00:00.000Z",
          summary: { total: 3, passed: 2, failed: 1 },
          issues: [],
          diagnostics: [],
          raw: { valid: false },
        },
        validationIssueCount: 1,
      }),
    ).toBe("invalid");
  });

  it("treats linked issues as outdated when validation is stale", () => {
    expect(
      deriveChangeHealth({
        workflowStatus: "in-progress",
        missingArtifactCount: 0,
        validation: {
          state: "stale",
          validatedAt: "2026-04-27T12:00:00.000Z",
          summary: { total: 3, passed: 2, failed: 1 },
          issues: [],
          diagnostics: [],
          raw: { valid: false },
        },
        validationIssueCount: 1,
      }),
    ).toBe("stale");
  });
});

describe("change build status", () => {
  const passingValidation = {
    state: "pass" as const,
    validatedAt: "2026-04-27T12:00:00.000Z",
    summary: { total: 1, passed: 1, failed: 0 },
    issues: [],
    diagnostics: [],
    raw: { valid: true },
  };

  const failingValidation = {
    ...passingValidation,
    state: "fail" as const,
    summary: { total: 1, passed: 0, failed: 1 },
    raw: { valid: false },
  };

  it("uses validate before current validation is known or while validation is running", () => {
    expect(
      deriveChangeBuildStatus({
        phase: "active",
        taskProgress: { done: 0, total: 2 },
        validation: null,
        validationIssueCount: 0,
      }),
    ).toMatchObject({ kind: "validate", label: "Validate" });

    expect(
      deriveChangeBuildStatus({
        phase: "active",
        taskProgress: { done: 0, total: 2 },
        validation: passingValidation,
        validationIssueCount: 0,
        validationRunning: true,
      }),
    ).toMatchObject({ kind: "validate", label: "Validate" });
  });

  it("uses validate when command diagnostics make validation unknown for the snapshot", () => {
    expect(
      deriveChangeBuildStatus({
        phase: "active",
        taskProgress: { done: 0, total: 2 },
        validation: {
          ...failingValidation,
          diagnostics: [
            {
              id: "diagnostic-1",
              kind: "command-failure",
              message: "openspec validate failed to execute",
              severity: "error",
            },
          ],
        },
        validationIssueCount: 0,
      }),
    ).toMatchObject({ kind: "validate", label: "Validate" });
  });

  it("uses done for archive-ready rows before considering validation", () => {
    expect(
      deriveChangeBuildStatus({
        phase: "archive-ready",
        taskProgress: { done: 2, total: 2 },
        validation: null,
        validationIssueCount: 0,
      }),
    ).toMatchObject({ kind: "done", label: "Done", health: "valid" });
  });

  it("uses ready for passing current validation and actionable open tasks", () => {
    expect(
      deriveChangeBuildStatus({
        phase: "active",
        taskProgress: { done: 1, total: 3 },
        validation: passingValidation,
        validationIssueCount: 0,
      }),
    ).toMatchObject({ kind: "ready", label: "Ready", health: "ready" });
  });

  it("uses incomplete for current blocking validation or non-actionable tasks", () => {
    expect(
      deriveChangeBuildStatus({
        phase: "active",
        taskProgress: { done: 1, total: 3 },
        validation: failingValidation,
        validationIssueCount: 1,
      }),
    ).toMatchObject({ kind: "incomplete", label: "Incomplete" });

    expect(
      deriveChangeBuildStatus({
        phase: "active",
        taskProgress: { done: 0, total: 0 },
        validation: passingValidation,
        validationIssueCount: 0,
      }),
    ).toMatchObject({ kind: "incomplete", label: "Incomplete" });
  });
});

describe("recent repo path guards", () => {
  it("accepts absolute local paths and rejects browser preview identifiers", () => {
    expect(isPersistableLocalRepoPath("/tmp/openspec-studio")).toBe(true);
    expect(isPersistableLocalRepoPath("browser-preview://openspec-studio")).toBe(false);
    expect(isPersistableLocalRepoPath("relative/path")).toBe(false);
  });

  it("deduplicates and filters persisted recent repository paths", () => {
    expect(
      normalizeRecentRepoPaths([
        "/repo/one",
        "browser-preview://openspec-studio",
        "/repo/two",
        "/repo/one",
        null,
      ]),
    ).toEqual(["/repo/one", "/repo/two"]);
  });

  it("presents recents as a switcher with the current repo selected first", () => {
    expect(recentRepoSwitcherPaths("/repo/current", ["/repo/one", "/repo/current", "/repo/two"])).toEqual([
      "/repo/current",
      "/repo/one",
      "/repo/two",
    ]);
  });
});

describe("repository candidate opening", () => {
  it("promotes only readable folders that contain an openspec workspace", () => {
    expect(decideRepositoryCandidateOpen({ readable: true, hasOpenSpec: true })).toEqual({
      promote: true,
      preserveActiveWorkspace: false,
    });
  });

  it("preserves the active workspace when a candidate has no openspec workspace", () => {
    expect(decideRepositoryCandidateOpen({ readable: true, hasOpenSpec: false })).toEqual({
      promote: false,
      preserveActiveWorkspace: true,
    });
  });

  it("preserves the active workspace when a candidate is not readable", () => {
    expect(decideRepositoryCandidateOpen({ readable: false, hasOpenSpec: false })).toEqual({
      promote: false,
      preserveActiveWorkspace: true,
    });
  });
});

describe("selection synchronization", () => {
  const items = [
    { id: "active-a", phase: "active", title: "Active A" },
    { id: "active-b", phase: "active", title: "Active B" },
    { id: "archived-a", phase: "archived", title: "Archived A" },
  ];

  it("keeps the current selection when it is visible", () => {
    expect(
      selectVisibleItemId(items, "active-b", (item) => item.phase === "active"),
    ).toBe("active-b");
  });

  it("selects the first visible item when filters hide the current selection", () => {
    expect(
      selectVisibleItemId(items, "archived-a", (item) => item.phase === "active"),
    ).toBe("active-a");
  });

  it("clears selection when filters have no matches", () => {
    expect(
      selectVisibleItemId(items, "active-a", (item) => item.title.includes("Missing")),
    ).toBe("");
  });
});

describe("validation trust labels", () => {
  it("uses unknown attention semantics before validation runs", () => {
    expect(deriveValidationTrustState(null)).toMatchObject({
      label: "Not checked yet",
      attentionKnown: false,
    });
  });

  it("shows current clean validation as attention-known", () => {
    expect(
      deriveValidationTrustState({
        state: "pass",
        validatedAt: "2026-04-27T12:00:00.000Z",
        summary: { total: 1, passed: 1, failed: 0 },
        issues: [],
        diagnostics: [],
        raw: { valid: true },
      }),
    ).toMatchObject({
      label: "Checked clean",
      attentionKnown: true,
    });
  });

  it("keeps command diagnostics separate from linked attention counts", () => {
    expect(
      deriveValidationTrustState({
        state: "fail",
        validatedAt: "2026-04-27T12:00:00.000Z",
        summary: { total: 0, passed: 0, failed: 0 },
        issues: [],
        diagnostics: [
          {
            id: "diagnostic-1",
            kind: "command-failure",
            message: "node could not be found",
            severity: "error",
          },
        ],
        raw: {},
      }),
    ).toMatchObject({
      label: "Validation problem",
      attentionKnown: false,
    });
  });
});

describe("Studio Runner dispatch model", () => {
  const passingValidation = {
    state: "pass" as const,
    validatedAt: "2026-04-29T12:00:00.000Z",
    summary: { total: 1, passed: 1, failed: 0 },
    issues: [],
    diagnostics: [],
    raw: { valid: true },
  };

  const eligibleChange = {
    phase: "active",
    buildStatus: { kind: "ready" as const, label: "Ready" },
    artifacts: [
      { id: "proposal", path: "openspec/changes/add-runner/proposal.md", status: "present" },
      { id: "design", path: "openspec/changes/add-runner/design.md", status: "present" },
      { id: "tasks", path: "openspec/changes/add-runner/tasks.md", status: "present" },
    ],
    taskProgress: { done: 0, total: 3 },
  };

  it("gates dispatch on build status readiness, settings, and reachable runner", () => {
    expect(deriveRunnerDispatchEligibility({
      repoReady: true,
      change: eligibleChange,
      runnerSettings: { endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events" },
      sessionSecretConfigured: true,
      runnerStatus: { state: "reachable", label: "Reachable", detail: "ok" },
    })).toEqual({ eligible: true, reasons: [] });

    expect(deriveRunnerDispatchEligibility({
      repoReady: true,
      change: eligibleChange,
      runnerSettings: { endpoint: "" },
      sessionSecretConfigured: false,
      runnerStatus: { state: "not-configured", label: "Missing", detail: "missing" },
    }).reasons).toEqual([
      "Configure Studio Runner endpoint.",
      "Generate a Studio Runner session secret.",
      "Studio Runner must be reachable.",
    ]);
  });

  it("uses the selected change build status as the only change readiness gate", () => {
    expect(deriveRunnerDispatchEligibility({
      repoReady: true,
      change: {
        ...eligibleChange,
        buildStatus: { kind: "validate" as const, label: "Validate" },
      },
      runnerSettings: { endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events" },
      sessionSecretConfigured: true,
      runnerStatus: { state: "reachable", label: "Reachable", detail: "ok" },
    }).reasons).toContain(
      "Change Build Status must be Ready before dispatching with agent. Current status: Validate.",
    );
  });

  it("does not require design when build status is ready", () => {
    const noDesignReadyChange = {
      ...eligibleChange,
      artifacts: eligibleChange.artifacts.filter((artifact) => artifact.id !== "design"),
    };

    expect(deriveRunnerDispatchEligibility({
      repoReady: true,
      change: noDesignReadyChange,
      runnerSettings: { endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events" },
      sessionSecretConfigured: true,
      runnerStatus: { state: "reachable", label: "Reachable", detail: "ok" },
    })).toEqual({ eligible: true, reasons: [] });
  });

  it("builds a thin change-scoped build.requested payload", () => {
    const payload = buildRunnerDispatchPayload({
      eventId: "evt_demo",
      repo: { name: "openspec-studio", path: "/repo/openspec-studio" },
      change: { name: "add-runner", ...eligibleChange },
      validation: passingValidation,
    });

    expect(payload.eventId).toBe("evt_demo");
    expect(payload.changeName).toBe("add-runner");
    expect(payload.repoPath).toBe("/repo/openspec-studio");
    expect(payload).not.toHaveProperty("proposal");
  });

  it("blocks dispatch when tasks are already complete", () => {
    const doneChange = {
      ...eligibleChange,
      buildStatus: { kind: "done" as const, label: "Done" },
      taskProgress: { done: 3, total: 3 },
    };

    expect(deriveRunnerDispatchEligibility({
      repoReady: true,
      change: doneChange,
      runnerSettings: { endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events" },
      sessionSecretConfigured: true,
      runnerStatus: { state: "reachable", label: "Reachable", detail: "ok" },
    }).reasons).toContain(
      "Change Build Status must be Ready before dispatching with agent. Current status: Done.",
    );
  });

  it("merges runner stream metadata into existing runner log records", () => {
    const attempts = mergeRunnerStreamEvent([
      { eventId: "evt_demo", repoPath: "/repo", changeName: "demo", status: "accepted", message: "accepted", createdAt: "2026-04-29T12:00:00Z", updatedAt: "2026-04-29T12:00:00Z" },
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

  it("creates runner lifecycle log records", () => {
    expect(createRunnerLifecycleLogEvent({
      repoPath: "/repo",
      event: "runner.started",
      message: "Runner started",
      status: "running",
      occurredAt: "2026-04-29T12:00:00Z",
    })).toMatchObject({
      repoPath: "/repo",
      changeName: "Runner",
      source: "lifecycle",
      eventName: "runner.started",
      executionStatus: "running",
    });
  });

  it("filters dispatch history by repo and change with newest first", () => {
    expect(runnerDispatchHistoryForChange([
      { eventId: "evt_old", repoPath: "/repo", changeName: "demo", status: "failed", message: "old", createdAt: "2026-04-29T12:00:00Z", updatedAt: "2026-04-29T12:00:00Z" },
      { eventId: "evt_other", repoPath: "/repo", changeName: "other", status: "accepted", message: "other", createdAt: "2026-04-29T12:01:00Z", updatedAt: "2026-04-29T12:01:00Z" },
      { eventId: "evt_new", repoPath: "/repo", changeName: "demo", status: "accepted", message: "new", createdAt: "2026-04-29T12:02:00Z", updatedAt: "2026-04-29T12:02:00Z" },
    ], "/repo", "demo").map((attempt) => attempt.eventId)).toEqual(["evt_new", "evt_old"]);
  });
});
