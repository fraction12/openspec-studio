import {
  buildRunnerDispatchPayload,
  createOpenSpecOperationIssue,
  deriveRunnerDispatchEligibility,
  type OpenSpecOperationIssue,
  type RunnerDispatchAttempt,
  type RunnerDispatchRequestInput,
  type RunnerExecutionDefaults,
  type RunnerSettings,
  type RunnerStatus,
} from "../appModel";
import type { ChangeRecord, WorkspaceView } from "../domain/workspaceViewModel";
import type { ValidationResult } from "../validation/results";
import {
  createRunnerDispatchAttempt,
  createRunnerLifecycleLogEvent,
  type RunnerStaleEvidence,
  type RunnerStreamEventInput,
} from "./studioRunnerLog";
import {
  runnerStatusFromDto,
  runnerStreamEventFromDto,
  unknownRunnerStatus,
  type RunnerStatusDto,
  type RunnerStreamEventDto,
} from "./studioRunnerBridgeDto";

export type RunnerStreamStatus = "disconnected" | "connecting" | "connected" | "error";

export const defaultRunnerSettings: RunnerSettings = {
  endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events",
};

export { unknownRunnerStatus };

export interface RunnerLifecycleResponseDto {
  started: boolean;
  endpoint: string;
  port: number;
  pid?: number | null;
  message: string;
}

export interface RunnerDispatchResponseDto {
  event_id: string;
  eventId?: string;
  status_code: number;
  statusCode?: number;
  accepted: boolean;
  message: string;
  response_body?: string | null;
  responseBody?: string | null;
  run_id?: string | null;
  runId?: string | null;
}

export type { RunnerStreamEventDto };

export interface RunnerStreamResponseDto {
  streaming: boolean;
  endpoint: string;
  message: string;
}

export interface RunnerDispatchRequestDto {
  eventId: string;
  repoPath: string;
  repoName: string;
  changeName: string;
  artifactPaths: string[];
  validation: {
    state: ValidationResult["state"];
    checkedAt: string | null;
    issueCount: number;
  };
  gitRef: string;
  requestedBy: string;
  runnerModel?: string;
  runnerEffort?: "low" | "medium" | "high";
}

export interface RunnerRepository {
  path: string;
  name: string;
  state: string;
}

export interface RunnerGitStatus {
  entries?: string[];
}

export type RunnerValidationResult =
  | {
      kind: "validated";
      validation: ValidationResult;
      workspace: WorkspaceView;
    }
  | {
      kind: "unsupported";
      message: string;
    }
  | {
      kind: "stale";
    };

export interface StudioRunnerSessionDependencies {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  isTauriRuntime: () => boolean;
  getSettings: () => RunnerSettings;
  updateSettings: (settings: RunnerSettings) => void;
  getRunnerExecutionDefaults: () => RunnerExecutionDefaults;
  getStatus: () => RunnerStatus;
  setStatus: (status: RunnerStatus) => void;
  getStreamStatus: () => RunnerStreamStatus;
  getCurrentRepoPath: () => string | null;
  isSessionSecretConfigured: () => boolean;
  setSessionSecretConfigured: (configured: boolean) => void;
  setDispatchBusy: (busy: boolean) => void;
  setLifecycleBusy: (busy: boolean) => void;
  setStreamStatus: (status: RunnerStreamStatus) => void;
  setMessage: (message: string) => void;
  getRunnerRepoPath: () => string;
  getWorkspace: () => WorkspaceView | null;
  setWorkspace: (workspace: WorkspaceView) => void;
  getGitStatus: () => RunnerGitStatus;
  validateWorkspace: (repoPath: string) => Promise<RunnerValidationResult>;
  rememberValidationSnapshot: (repoPath: string, result: ValidationResult) => void;
  rememberRunnerAttempt: (attempt: RunnerDispatchAttempt) => void;
  replaceRunnerAttempt: (eventId: string, attempt: RunnerDispatchAttempt) => void;
  mergeRunnerStreamEvent: (event: RunnerStreamEventInput) => void;
  reconcileRunnerAttempts: (evidence: RunnerStaleEvidence) => void;
  recordOperationIssue: (issue: OpenSpecOperationIssue) => void;
  clearRunnerDispatchIssues: (repoPath: string, changeName: string) => void;
  errorMessage: (error: unknown) => string;
}

export class StudioRunnerSession {
  private statusGeneration = 0;

  constructor(private readonly dependencies: StudioRunnerSessionDependencies) {}

  async configureSessionSecret(repo: RunnerRepository | null): Promise<void> {
    if (!this.dependencies.isTauriRuntime()) {
      this.dependencies.setMessage("Studio Runner session setup requires the Tauri desktop runtime.");
      return;
    }

    try {
      const secret = createRunnerSessionSecret();
      await this.dependencies.invoke("configure_studio_runner_session_secret", { secret });
      this.setSessionSecretConfigured(true);
      this.dependencies.setMessage("Studio Runner session secret generated for this app session.");
      if (repo?.path) {
        this.dependencies.rememberRunnerAttempt(createRunnerLifecycleLogEvent({
          repoPath: repo.path,
          endpoint: this.dependencies.getSettings().endpoint,
          event: "secret.generated",
          message: "Session secret generated.",
          status: "unknown",
        }));
      }
      await this.checkStatus({ quiet: true, force: true });
    } catch (error) {
      this.setSessionSecretConfigured(false);
      this.dependencies.setMessage("Studio Runner session setup failed: " + this.dependencies.errorMessage(error));
    }
  }

  async clearSessionSecret(): Promise<void> {
    if (this.dependencies.isTauriRuntime()) {
      try {
        await this.dependencies.invoke("clear_studio_runner_session_secret");
      } catch (error) {
        console.warn("Studio Runner session secret could not be cleared.", error);
      }
    }

    this.setSessionSecretConfigured(false);
    this.setStatus(unknownRunnerStatus);
    this.dependencies.setMessage("Studio Runner session secret cleared.");
  }

  async startRunner(repo: RunnerRepository | null): Promise<void> {
    if (!this.dependencies.isTauriRuntime()) {
      this.dependencies.setMessage("Starting Studio Runner requires the Tauri desktop runtime.");
      return;
    }

    if (!this.dependencies.isSessionSecretConfigured()) {
      try {
        const secret = createRunnerSessionSecret();
        await this.dependencies.invoke("configure_studio_runner_session_secret", { secret });
        this.setSessionSecretConfigured(true);
      } catch (error) {
        this.setSessionSecretConfigured(false);
        this.dependencies.setMessage("Studio Runner session setup failed: " + this.dependencies.errorMessage(error));
        return;
      }
    }

    const settings = this.dependencies.getSettings();
    const endpoint = settings.endpoint.trim() || defaultRunnerSettings.endpoint;
    if (!settings.endpoint.trim()) {
      this.dependencies.updateSettings(defaultRunnerSettings);
    }

    const startedRequestId = ++this.statusGeneration;
    this.dependencies.setLifecycleBusy(true);
    this.setStatus({
      state: "starting",
      label: "Starting runner",
      detail: "Starting local Studio Runner and waiting for health check.",
      endpoint,
    });

    try {
      const dto = await this.dependencies.invoke<RunnerLifecycleResponseDto>("restart_studio_runner", {
        request: {
          repoPath: this.dependencies.getRunnerRepoPath(),
          endpoint,
        },
      });
      const nextStatus: RunnerStatus = {
        state: "online",
        label: "Runner online",
        detail: dto.message || "Studio Runner started and passed health check.",
        endpoint: dto.endpoint || endpoint,
        managed: true,
        pid: dto.pid ?? null,
      };
      if (repo?.path) {
        this.dependencies.rememberRunnerAttempt(createRunnerLifecycleLogEvent({
          repoPath: repo.path,
          endpoint,
          event: "runner.started",
          message: nextStatus.detail,
          status: "running",
        }));
      }
      this.setStatus(nextStatus);
      this.dependencies.setMessage(dto.message);
      void this.checkStatus({ quiet: true, force: true, requestId: startedRequestId });
    } catch (error) {
      const nextStatus: RunnerStatus = {
        state: "offline",
        label: "Runner offline",
        detail: this.dependencies.errorMessage(error),
        endpoint,
      };
      this.setStatus(nextStatus);
      this.dependencies.setMessage("Studio Runner start failed: " + this.dependencies.errorMessage(error));
    } finally {
      this.dependencies.setLifecycleBusy(false);
    }
  }

  async stopRunner(repo: RunnerRepository | null): Promise<void> {
    if (!this.dependencies.isTauriRuntime()) {
      this.dependencies.setMessage("Stopping Studio Runner requires the Tauri desktop runtime.");
      return;
    }

    this.dependencies.setLifecycleBusy(true);
    try {
      const dto = await this.dependencies.invoke<RunnerLifecycleResponseDto>("stop_studio_runner");
      this.dependencies.setMessage(dto.message);
      if (repo?.path) {
        this.dependencies.rememberRunnerAttempt(createRunnerLifecycleLogEvent({
          repoPath: repo.path,
          endpoint: this.dependencies.getSettings().endpoint,
          event: "runner.stopped",
          message: dto.message,
          status: "unknown",
        }));
        this.reconcileStaleRuns(repo.path, "runner-stopped", "Run marked stale after runner stopped.");
      }
      this.setStatus(unknownRunnerStatus);
    } catch (error) {
      this.dependencies.setMessage("Studio Runner stop failed: " + this.dependencies.errorMessage(error));
    } finally {
      this.dependencies.setLifecycleBusy(false);
    }
  }

  async checkStatus(options: { quiet?: boolean; force?: boolean; requestId?: number } = {}): Promise<RunnerStatus> {
    const settings = this.dependencies.getSettings();
    const requestId = options.requestId ?? ++this.statusGeneration;

    if (!settings.endpoint.trim()) {
      const nextStatus = { ...unknownRunnerStatus };
      if (!options.quiet) {
        this.dependencies.setMessage(nextStatus.detail);
      }
      this.setStatus(nextStatus);
      return nextStatus;
    }

    if (!this.dependencies.isTauriRuntime()) {
      const nextStatus: RunnerStatus = {
        state: "offline",
        label: "Runner offline",
        detail: "Runner status checks require the Tauri desktop runtime.",
      };
      this.setStatus(nextStatus);
      if (!options.quiet) {
        this.dependencies.setMessage(nextStatus.detail);
      }
      return nextStatus;
    }

    if (!options.quiet) {
      this.setStatus({
        state: "checking",
        label: "Checking runner",
        detail: "Checking the configured Studio Runner endpoint.",
        endpoint: settings.endpoint,
      });
    }

    try {
      const dto = await this.dependencies.invoke<RunnerStatusDto>("check_studio_runner_status", {
        settings: {
          ...settings,
          repoPath: this.dependencies.getRunnerRepoPath(),
        },
      });
      if (this.statusGeneration !== requestId) {
        return this.dependencies.getStatus();
      }
      const nextStatus = runnerStatusFromDto(dto, this.dependencies.getStatus());
      this.setStatus(nextStatus);
      this.reconcileAfterStatus(nextStatus);
      if (!options.quiet) {
        this.dependencies.setMessage(nextStatus.detail);
      }
      return nextStatus;
    } catch (error) {
      if (this.statusGeneration !== requestId) {
        return this.dependencies.getStatus();
      }
      const nextStatus: RunnerStatus = {
        state: "offline",
        label: "Runner offline",
        detail: this.dependencies.errorMessage(error),
        endpoint: settings.endpoint,
      };
      this.setStatus(nextStatus);
      if (!options.quiet) {
        this.dependencies.setMessage(nextStatus.detail);
      }
      return nextStatus;
    }
  }

  async dispatchSelectedChange(input: {
    repo: RunnerRepository | null;
    selectedChange: ChangeRecord | null;
    retryAttempt?: RunnerDispatchAttempt;
  }): Promise<void> {
    const { repo, selectedChange } = input;
    const workspace = this.dependencies.getWorkspace();
    if (!repo || repo.state !== "ready" || !workspace || !selectedChange) {
      this.dependencies.setMessage("Select an active OpenSpec change before dispatching.");
      return;
    }

    if (!this.dependencies.isTauriRuntime()) {
      this.dependencies.setMessage("Build with agent requires the Tauri desktop runtime.");
      return;
    }

    const initialEligibility = deriveRunnerDispatchEligibility({
      repoReady: true,
      change: selectedChange,
      runnerSettings: this.dependencies.getSettings(),
      runnerStatus: this.dependencies.getStatus(),
      sessionSecretConfigured: this.dependencies.isSessionSecretConfigured(),
    });

    if (!input.retryAttempt && !initialEligibility.eligible) {
      this.dependencies.setMessage(initialEligibility.reasons[0] ?? "This change is not ready for runner dispatch.");
      return;
    }

    this.dependencies.setDispatchBusy(true);
    this.dependencies.setMessage(input.retryAttempt ? "Retrying Studio Runner dispatch..." : "Preparing Studio Runner dispatch...");
    const repoPath = repo.path;
    const changeName = selectedChange.name;

    let pendingAttempt: RunnerDispatchAttempt | undefined;

    try {
      let validation = workspace.validation;
      if (!validation || validation.state !== "pass") {
        this.dependencies.setMessage("Validating before Studio Runner dispatch...");
        const validationResult = await this.dependencies.validateWorkspace(repoPath);
        if (validationResult.kind === "stale") {
          return;
        }
        if (validationResult.kind === "unsupported") {
          this.dependencies.setMessage(validationResult.message);
          return;
        }
        validation = validationResult.validation;
        this.dependencies.setWorkspace(validationResult.workspace);
        this.dependencies.rememberValidationSnapshot(repoPath, validation);
      }

      const latestWorkspace = this.dependencies.getWorkspace();
      const latestChange = latestWorkspace?.changes.find((change) => change.name === changeName) ?? selectedChange;
      const currentStatus = this.dependencies.getStatus();
      const latestEligibility = deriveRunnerDispatchEligibility({
        repoReady: true,
        change: latestChange,
        runnerSettings: this.dependencies.getSettings(),
        runnerStatus: currentStatus.state === "online" ? currentStatus : await this.checkStatus({ quiet: true }),
        sessionSecretConfigured: this.dependencies.isSessionSecretConfigured(),
      });

      if (!latestEligibility.eligible) {
        this.dependencies.setMessage(latestEligibility.reasons[0] ?? "This change is not ready for runner dispatch.");
        return;
      }

      const eventId = input.retryAttempt?.eventId ?? createRunnerEventId();
      const payload = buildRunnerDispatchPayload({
        eventId,
        repo,
        change: latestChange,
        validation,
        gitStatus: this.dependencies.getGitStatus(),
        runnerExecutionDefaults: this.dependencies.getRunnerExecutionDefaults(),
      });
      pendingAttempt = createRunnerDispatchAttempt({
        eventId,
        repoPath,
        changeName,
        payload,
        status: "pending",
        message: input.retryAttempt ? "Retrying dispatch." : "Dispatch queued.",
        previousAttempt: input.retryAttempt,
      });

      this.dependencies.rememberRunnerAttempt({
        ...pendingAttempt,
        source: "dispatch",
        rowKind: "run",
        eventName: "build.requested",
        endpoint: this.dependencies.getSettings().endpoint,
      });
      this.dependencies.setMessage("Sending signed build.requested to Studio Runner...");

      const response = await this.dependencies.invoke<RunnerDispatchResponseDto>("dispatch_studio_runner_event", {
        settings: this.dependencies.getSettings(),
        request: toRunnerDispatchRequestDto(payload),
      });
      const accepted = Boolean(response.accepted);
      const statusCode = response.status_code ?? response.statusCode;
      const responseBody = response.response_body ?? response.responseBody ?? null;
      const runId = response.run_id ?? response.runId ?? extractRunId(responseBody);
      const nextAttempt = createRunnerDispatchAttempt({
        ...pendingAttempt,
        status: accepted ? "accepted" : "failed",
        statusCode,
        runId,
        responseBody,
        message: response.message,
      });

      this.dependencies.rememberRunnerAttempt({
        ...nextAttempt,
        source: "dispatch",
        rowKind: "run",
        eventName: response.accepted ? "runner.accepted" : "runner.dispatch.failed",
        executionStatus: response.accepted ? "accepted" : "failed",
        endpoint: this.dependencies.getSettings().endpoint,
      });
      this.dependencies.clearRunnerDispatchIssues(repoPath, changeName);
      this.dependencies.setMessage(
        accepted
          ? "Studio Runner accepted " + changeName + (runId ? " as " + runId + "." : ".")
          : "Studio Runner dispatch failed: " + response.message,
      );
    } catch (error) {
      if (pendingAttempt) {
        const failedAttempt = createRunnerDispatchAttempt({
          ...pendingAttempt,
          status: "failed",
          message: this.dependencies.errorMessage(error),
        });
        this.dependencies.rememberRunnerAttempt({
          ...failedAttempt,
          source: "dispatch",
          rowKind: "run",
          eventName: "runner.dispatch.failed",
          executionStatus: "failed",
          endpoint: this.dependencies.getSettings().endpoint,
        });
      }
      this.dependencies.recordOperationIssue(
        createOpenSpecOperationIssue({
          kind: "runner-dispatch",
          title: "Runner dispatch failed",
          message: this.dependencies.errorMessage(error),
          fallbackMessage: "Studio Runner dispatch did not complete.",
          repoPath,
          target: changeName,
        }),
      );
      this.dependencies.setMessage("Studio Runner dispatch failed: " + this.dependencies.errorMessage(error));
    } finally {
      this.dependencies.setDispatchBusy(false);
    }
  }

  handleStreamEvent(event: RunnerStreamEventDto): void {
    this.dependencies.mergeRunnerStreamEvent(runnerStreamEventFromDto(event));
  }

  handleStreamError(message: string, currentRepoPath: string | null | undefined): void {
    this.dependencies.setStreamStatus("error");
    if (currentRepoPath) {
      this.dependencies.rememberRunnerAttempt(createRunnerLifecycleLogEvent({
        repoPath: currentRepoPath,
        endpoint: this.dependencies.getSettings().endpoint,
        event: "stream.error",
        message: message || "Runner stream failed.",
        status: "failed",
      }));
    }
  }

  async startStream(repo: RunnerRepository | null, options: { quiet?: boolean } = {}): Promise<void> {
    if (!this.dependencies.isTauriRuntime() || !repo?.path || this.dependencies.getStatus().state !== "online") {
      return;
    }

    this.dependencies.setStreamStatus("connecting");
    const connectingAt = new Date().toISOString();
    const connectingAttempt = createRunnerLifecycleLogEvent({
      repoPath: repo.path,
      endpoint: this.dependencies.getSettings().endpoint,
      event: "stream.connecting",
      message: "Connecting Runner event stream.",
      status: "running",
      occurredAt: connectingAt,
    });
    this.dependencies.rememberRunnerAttempt(connectingAttempt);
    try {
      await this.dependencies.invoke<RunnerStreamResponseDto>("start_studio_runner_event_stream", {
        request: { endpoint: this.dependencies.getSettings().endpoint, repoPath: repo.path },
      });
      this.dependencies.setStreamStatus("connected");
      if (!options.quiet) {
        this.dependencies.setMessage("Studio Runner stream connected.");
      }
      this.dependencies.replaceRunnerAttempt(connectingAttempt.eventId, createRunnerLifecycleLogEvent({
        repoPath: repo.path,
        endpoint: this.dependencies.getSettings().endpoint,
        event: "stream.connected",
        message: "Runner event stream connected.",
        status: "running",
      }));
    } catch (error) {
      this.dependencies.setStreamStatus("error");
      this.dependencies.replaceRunnerAttempt(connectingAttempt.eventId, createRunnerLifecycleLogEvent({
        repoPath: repo.path,
        endpoint: this.dependencies.getSettings().endpoint,
        event: "stream.error",
        message: this.dependencies.errorMessage(error),
        status: "failed",
      }));
      if (!options.quiet) {
        this.dependencies.setMessage("Studio Runner stream failed: " + this.dependencies.errorMessage(error));
      }
    }
  }

  async stopStream(): Promise<void> {
    if (!this.dependencies.isTauriRuntime()) {
      this.dependencies.setStreamStatus("disconnected");
      return;
    }

    try {
      await this.dependencies.invoke<RunnerStreamResponseDto>("stop_studio_runner_event_stream");
    } catch (error) {
      console.warn("Studio Runner stream could not be stopped.", error);
    }
    this.dependencies.setStreamStatus("disconnected");
  }

  private setSessionSecretConfigured(configured: boolean) {
    this.dependencies.setSessionSecretConfigured(configured);
  }

  private setStatus(status: RunnerStatus) {
    this.dependencies.setStatus(status);
  }

  private reconcileAfterStatus(status: RunnerStatus): void {
    const repoPath = this.dependencies.getCurrentRepoPath();
    if (!repoPath || this.dependencies.getStreamStatus() === "connected") {
      return;
    }
    if (
      status.state === "offline" &&
      status.ownership === "offline"
    ) {
      this.reconcileStaleRuns(repoPath, "runner-offline", "Run marked stale after runner went offline.");
    }
  }

  private reconcileStaleRuns(
    repoPath: string,
    reason: RunnerStaleEvidence["reason"],
    message: string,
  ): void {
    this.dependencies.reconcileRunnerAttempts({
      repoPath,
      endpoint: this.dependencies.getSettings().endpoint,
      reason,
      message,
    });
  }
}

export function runnerRepoPath(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENSPEC_STUDIO_RUNNER_REPO) {
    return import.meta.env.VITE_OPENSPEC_STUDIO_RUNNER_REPO;
  }

  return "/Volumes/MacSSD/Projects/symphony/elixir";
}

export function createRunnerSessionSecret(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

export function toRunnerDispatchRequestDto(request: RunnerDispatchRequestInput): RunnerDispatchRequestDto {
  return {
    eventId: request.eventId,
    repoPath: request.repoPath,
    repoName: request.repoName,
    changeName: request.changeName,
    artifactPaths: request.artifactPaths,
    validation: request.validation,
    gitRef: request.gitRef,
    requestedBy: request.requestedBy,
    ...(request.runnerModel ? { runnerModel: request.runnerModel } : {}),
    ...(request.runnerEffort ? { runnerEffort: request.runnerEffort } : {}),
  };
}

export function createRunnerEventId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return "evt_" + random.replace(/-/g, "");
}

export function extractRunId(responseBody: string | null): string | null {
  if (!responseBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(responseBody) as unknown;
    if (parsed && typeof parsed === "object" && "run_id" in parsed && typeof parsed.run_id === "string") {
      return parsed.run_id;
    }
    if (parsed && typeof parsed === "object" && "runId" in parsed && typeof parsed.runId === "string") {
      return parsed.runId;
    }
  } catch {
    return null;
  }

  return null;
}
