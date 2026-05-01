import { describe, expect, it } from "vitest";

import type { RunnerDispatchAttempt, RunnerSettings, RunnerStatus } from "../appModel";
import type { ChangeRecord, WorkspaceView } from "../domain/workspaceViewModel";
import type { ValidationResult } from "../validation/results";
import {
  defaultRunnerSettings,
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

  it("normalizes status DTOs without leaking bridge status names", () => {
    expect(
      runnerStatusFromDto({
        configured: true,
        reachable: true,
        status: "reachable",
        message: "healthy",
        managed: true,
        pid: 42,
      }),
    ).toMatchObject({
      state: "online",
      label: "Runner online",
      detail: "healthy",
      managed: true,
      pid: 42,
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
});

function createHarness(overrides: Partial<{
  invoke: StudioRunnerSessionDependencies["invoke"];
  settings: RunnerSettings;
  status: RunnerStatus;
  secretConfigured: boolean;
  workspace: WorkspaceView | null;
}> = {}) {
  const commands: string[] = [];
  const messages: string[] = [];
  const attempts: RunnerDispatchAttempt[] = [];
  const issues: unknown[] = [];
  let settings = overrides.settings ?? defaultRunnerSettings;
  let status = overrides.status ?? unknownRunnerStatus;
  let secretConfigured = overrides.secretConfigured ?? false;
  let workspace = overrides.workspace ?? null;

  const harness = {
    commands,
    messages,
    attempts,
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
    getStatus: () => status,
    setStatus: (nextStatus) => {
      status = nextStatus;
    },
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
