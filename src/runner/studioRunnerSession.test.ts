import { describe, expect, it } from "vitest";

import type { RunnerDispatchAttempt, RunnerSettings, RunnerStatus } from "../appModel";
import type { ChangeRecord, WorkspaceView } from "../domain/workspaceViewModel";
import type { ValidationResult } from "../validation/results";
import {
  defaultRunnerSettings,
  runnerStreamEventFromDto,
  runnerStatusFromDto,
  StudioRunnerSession,
  unknownRunnerStatus,
  type StudioRunnerSessionDependencies,
} from "./studioRunnerSession";

describe("StudioRunnerSession", () => {
  it("configures a session secret and refreshes runner status through the session interface", async () => {
    const harness = createHarness({
      invoke: async <T,>(command: string) => {
        harness.commands.push(command);
        if (command === "check_studio_runner_status") {
          return {
            configured: true,
            reachable: true,
            status: "reachable",
            message: "ok",
            managed: true,
          } as T;
        }
        return { configured: true } as T;
      },
    });

    await harness.session.configureSessionSecret({ path: "/repo", name: "repo", state: "ready" });

    expect(harness.commands).toEqual([
      "configure_studio_runner_session_secret",
      "check_studio_runner_status",
    ]);
    expect(harness.secretConfigured).toBe(true);
    expect(harness.status.state).toBe("online");
    expect(harness.attempts[0]).toMatchObject({
      repoPath: "/repo",
      changeName: "Runner",
      eventName: "secret.generated",
    });
  });

  it("coordinates dispatch persistence and response handling", async () => {
    const validation = passingValidation();
    const change = readyChange();
    const harness = createHarness({
      workspace: workspaceWith(change, validation),
      status: {
        state: "online",
        label: "Runner online",
        detail: "Ready",
      },
      secretConfigured: true,
      invoke: async <T,>(command: string) => {
        harness.commands.push(command);
        return {
          event_id: "evt_demo",
          status_code: 202,
          accepted: true,
          message: "Accepted",
          response_body: "{\"run_id\":\"run_demo\"}",
          run_id: "run_demo",
        } as T;
      },
    });

    await harness.session.dispatchSelectedChange({
      repo: { path: "/repo", name: "repo", state: "ready" },
      selectedChange: change,
    });

    expect(harness.commands).toEqual(["dispatch_studio_runner_event"]);
    expect(harness.attempts).toHaveLength(2);
    expect(harness.attempts[0]).toMatchObject({
      changeName: "add-runner",
      status: "pending",
    });
    expect(harness.attempts[1]).toMatchObject({
      changeName: "add-runner",
      status: "accepted",
      runId: "run_demo",
      eventName: "runner.accepted",
    });
    expect(harness.messages[harness.messages.length - 1]).toBe("Studio Runner accepted add-runner as run_demo.");
  });

  it("keeps endpoint settings operational while applying execution defaults to dispatch requests", async () => {
    const dispatchArgs: Record<string, unknown>[] = [];
    const validation = passingValidation();
    const change = readyChange();
    const harness = createHarness({
      runnerExecutionDefaults: { runnerModel: "gpt-custom", runnerEffort: "high" },
      workspace: workspaceWith(change, validation),
      status: {
        state: "online",
        label: "Runner online",
        detail: "Ready",
      },
      secretConfigured: true,
      invoke: async <T,>(command: string, args?: Record<string, unknown>) => {
        harness.commands.push(command);
        dispatchArgs.push(args ?? {});
        return {
          event_id: "evt_demo",
          status_code: 202,
          accepted: true,
          message: "Accepted",
          response_body: "{\"run_id\":\"run_demo\"}",
          run_id: "run_demo",
        } as T;
      },
    });

    await harness.session.dispatchSelectedChange({
      repo: { path: "/repo", name: "repo", state: "ready" },
      selectedChange: change,
    });

    expect(dispatchArgs[0]).toMatchObject({
      settings: { endpoint: defaultRunnerSettings.endpoint },
      request: {
        runnerModel: "gpt-custom",
        runnerEffort: "high",
      },
    });
    expect(dispatchArgs[0]?.settings).not.toHaveProperty("runnerModel");
  });

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

  it("checks runner status without a session secret so app restart can recover listeners", async () => {
    const harness = createHarness({
      secretConfigured: false,
      invoke: async <T,>(command: string) => {
        harness.commands.push(command);
        return {
          configured: true,
          reachable: true,
          status: "reachable",
          message: "Recovered local Studio Runner.",
          managed: true,
          ownership: "recovered",
          can_stop: true,
          can_restart: true,
        } as T;
      },
    });

    await harness.session.checkStatus({ quiet: true });

    expect(harness.commands).toEqual(["check_studio_runner_status"]);
    expect(harness.status).toMatchObject({
      state: "online",
      label: "Restart runner",
      ownership: "recovered",
      canStop: true,
    });
  });

  it("reconciles stale rows only when status proves the runner is offline", async () => {
    const harness = createHarness({
      secretConfigured: true,
      invoke: async <T,>(command: string) => {
        harness.commands.push(command);
        return {
          configured: true,
          reachable: false,
          status: "unavailable",
          message: "connection refused",
          managed: false,
          ownership: "offline",
        } as T;
      },
    });

    await harness.session.checkStatus({ force: true });

    expect(harness.reconciliations).toEqual([
      {
        repoPath: "/repo",
        endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events",
        reason: "runner-offline",
        message: "Run marked stale after runner went offline.",
      },
    ]);
  });

  it("does not reconcile stale rows for occupied or custom runner status", async () => {
    const harness = createHarness({
      secretConfigured: true,
      invoke: async <T,>(command: string) => {
        harness.commands.push(command);
        return {
          configured: true,
          reachable: false,
          status: "unavailable",
          message: "port occupied",
          managed: false,
          ownership: "occupied",
        } as T;
      },
    });

    await harness.session.checkStatus({ force: true });

    expect(harness.reconciliations).toEqual([]);
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
    });
  });
});

function createHarness(overrides: Partial<{
  invoke: StudioRunnerSessionDependencies["invoke"];
  settings: RunnerSettings;
  status: RunnerStatus;
  secretConfigured: boolean;
  workspace: WorkspaceView | null;
  runnerExecutionDefaults: { runnerModel?: string; runnerEffort?: "default" | "low" | "medium" | "high" };
}> = {}) {
  const commands: string[] = [];
  const messages: string[] = [];
  const attempts: RunnerDispatchAttempt[] = [];
  const reconciliations: unknown[] = [];
  const issues: unknown[] = [];
  let settings = overrides.settings ?? defaultRunnerSettings;
  let status = overrides.status ?? unknownRunnerStatus;
  let secretConfigured = overrides.secretConfigured ?? false;
  let workspace = overrides.workspace ?? null;

  const harness = {
    commands,
    messages,
    attempts,
    reconciliations,
    issues,
    get settings() {
      return settings;
    },
    get status() {
      return status;
    },
    get secretConfigured() {
      return secretConfigured;
    },
    session: undefined as unknown as StudioRunnerSession,
  };

  harness.session = new StudioRunnerSession({
    invoke: overrides.invoke ?? (async <T,>(command: string) => {
      commands.push(command);
      return {} as T;
    }),
    isTauriRuntime: () => true,
    getSettings: () => settings,
    updateSettings: (nextSettings) => {
      settings = nextSettings;
    },
    getRunnerExecutionDefaults: () => overrides.runnerExecutionDefaults ?? {},
    getStatus: () => status,
    setStatus: (nextStatus) => {
      status = nextStatus;
    },
    getStreamStatus: () => "disconnected",
    getCurrentRepoPath: () => "/repo",
    isSessionSecretConfigured: () => secretConfigured,
    setSessionSecretConfigured: (configured) => {
      secretConfigured = configured;
    },
    setDispatchBusy: () => undefined,
    setLifecycleBusy: () => undefined,
    setStreamStatus: () => undefined,
    setMessage: (message) => {
      messages.push(message);
    },
    getRunnerRepoPath: () => "/runner-repo",
    getWorkspace: () => workspace,
    setWorkspace: (nextWorkspace) => {
      workspace = nextWorkspace;
    },
    getGitStatus: () => ({ entries: [] }),
    validateWorkspace: async () => ({
      kind: "validated",
      validation: passingValidation(),
      workspace: workspace ?? workspaceWith(readyChange(), passingValidation()),
    }),
    rememberValidationSnapshot: () => undefined,
    rememberRunnerAttempt: (attempt) => {
      attempts.push(attempt);
    },
    replaceRunnerAttempt: (eventId, attempt) => {
      attempts.splice(0, attempts.length, attempt, ...attempts.filter((item) => item.eventId !== eventId));
    },
    mergeRunnerStreamEvent: () => undefined,
    reconcileRunnerAttempts: (evidence) => {
      reconciliations.push(evidence);
    },
    recordOperationIssue: (issue) => {
      issues.push(issue);
    },
    clearRunnerDispatchIssues: () => undefined,
    errorMessage: (error) => error instanceof Error ? error.message : String(error),
  });

  return harness;
}

function readyChange(): ChangeRecord {
  return {
    id: "add-runner",
    name: "add-runner",
    title: "Add Runner",
    phase: "active",
    health: "ready",
    statusLabel: "Ready",
    buildStatus: { kind: "ready", label: "Ready", health: "ready" },
    summary: "",
    capabilities: [],
    updatedAt: "Unknown",
    modifiedTimeMs: null,
    taskProgress: { done: 0, total: 1, content: "- [ ] Build" },
    artifacts: [
      {
        id: "proposal",
        label: "Proposal",
        path: "openspec/changes/add-runner/proposal.md",
        status: "present",
        note: "",
      },
    ],
    deltaSpecs: [],
    validationIssues: [],
    archiveReadiness: { ready: false, reasons: [] },
    searchText: "add runner",
  };
}

function workspaceWith(change: ChangeRecord, validation: ValidationResult): WorkspaceView {
  return {
    changes: [change],
    specs: [],
    filesByPath: {},
    fileSignature: { fingerprint: "fp", latestPath: null, latestModifiedTimeMs: null },
    changeStatuses: [],
    validation,
  };
}

function passingValidation(): ValidationResult {
  return {
    state: "pass",
    validatedAt: "2026-05-01T00:00:00.000Z",
    summary: { total: 1, passed: 1, failed: 0 },
    issues: [],
    diagnostics: [],
    raw: {},
  };
}
