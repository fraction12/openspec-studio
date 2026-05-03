import type { RunnerOwnershipState, RunnerStatus } from "../appModel";
import type { RunnerStreamEventInput } from "./studioRunnerLog";

export const unknownRunnerStatus: RunnerStatus = {
  state: "offline",
  label: "Runner offline",
  detail: "Add a local Studio Runner endpoint and generate a session secret to enable Build with agent.",
};

export interface RunnerStatusDto {
  configured: boolean;
  reachable: boolean;
  status: string;
  endpoint?: string | null;
  runner_endpoint?: string | null;
  runnerEndpoint?: string | null;
  runner_repo_path?: string | null;
  runnerRepoPath?: string | null;
  status_code?: number | null;
  statusCode?: number | null;
  message: string;
  response_body?: string | null;
  responseBody?: string | null;
  managed?: boolean;
  pid?: number | null;
  ownership?: RunnerOwnershipState | null;
  listener_ownership?: RunnerOwnershipState | null;
  listenerOwnership?: RunnerOwnershipState | null;
  can_stop?: boolean | null;
  canStop?: boolean | null;
  can_restart?: boolean | null;
  canRestart?: boolean | null;
}

export interface RunnerStreamEventDto {
  eventName?: string | null;
  event_name?: string | null;
  eventId?: string | null;
  event_id?: string | null;
  repoPath?: string | null;
  repo_path?: string | null;
  repoChangeKey?: string | null;
  repo_change_key?: string | null;
  changeName?: string | null;
  change_name?: string | null;
  status?: string | null;
  runId?: string | null;
  run_id?: string | null;
  recordedAt?: string | null;
  recorded_at?: string | null;
  workspacePath?: string | null;
  workspace_path?: string | null;
  workspaceStatus?: string | null;
  workspace_status?: string | null;
  workspaceCreatedAt?: string | null;
  workspace_created_at?: string | null;
  workspaceUpdatedAt?: string | null;
  workspace_updated_at?: string | null;
  sessionId?: string | null;
  session_id?: string | null;
  sourceRepoPath?: string | null;
  source_repo_path?: string | null;
  baseCommitSha?: string | null;
  base_commit_sha?: string | null;
  branchName?: string | null;
  branch_name?: string | null;
  commitSha?: string | null;
  commit_sha?: string | null;
  prUrl?: string | null;
  pr_url?: string | null;
  prState?: string | null;
  pr_state?: string | null;
  prMergedAt?: string | null;
  pr_merged_at?: string | null;
  prClosedAt?: string | null;
  pr_closed_at?: string | null;
  cleanupEligible?: boolean | null;
  cleanup_eligible?: boolean | null;
  cleanupReason?: string | null;
  cleanup_reason?: string | null;
  cleanupStatus?: string | null;
  cleanup_status?: string | null;
  cleanupError?: string | null;
  cleanup_error?: string | null;
  executionLogEntries?: unknown;
  execution_log_entries?: unknown;
  executionLogs?: unknown;
  execution_logs?: unknown;
  error?: string | null;
  message?: string | null;
}

export function runnerStreamEventFromDto(dto: RunnerStreamEventDto): RunnerStreamEventInput {
  return {
    eventName: dto.eventName ?? dto.event_name ?? null,
    eventId: dto.eventId ?? dto.event_id ?? null,
    repoPath: dto.repoPath ?? dto.repo_path ?? null,
    repoChangeKey: dto.repoChangeKey ?? dto.repo_change_key ?? null,
    changeName: dto.changeName ?? dto.change_name ?? null,
    status: dto.status ?? null,
    runId: dto.runId ?? dto.run_id ?? null,
    recordedAt: dto.recordedAt ?? dto.recorded_at ?? null,
    workspacePath: dto.workspacePath ?? dto.workspace_path ?? null,
    workspaceStatus: dto.workspaceStatus ?? dto.workspace_status ?? null,
    workspaceCreatedAt: dto.workspaceCreatedAt ?? dto.workspace_created_at ?? null,
    workspaceUpdatedAt: dto.workspaceUpdatedAt ?? dto.workspace_updated_at ?? null,
    sessionId: dto.sessionId ?? dto.session_id ?? null,
    sourceRepoPath: dto.sourceRepoPath ?? dto.source_repo_path ?? null,
    baseCommitSha: dto.baseCommitSha ?? dto.base_commit_sha ?? null,
    branchName: dto.branchName ?? dto.branch_name ?? null,
    commitSha: dto.commitSha ?? dto.commit_sha ?? null,
    prUrl: dto.prUrl ?? dto.pr_url ?? null,
    prState: dto.prState ?? dto.pr_state ?? null,
    prMergedAt: dto.prMergedAt ?? dto.pr_merged_at ?? null,
    prClosedAt: dto.prClosedAt ?? dto.pr_closed_at ?? null,
    cleanupEligible: dto.cleanupEligible ?? dto.cleanup_eligible ?? null,
    cleanupReason: dto.cleanupReason ?? dto.cleanup_reason ?? null,
    cleanupStatus: dto.cleanupStatus ?? dto.cleanup_status ?? null,
    cleanupError: dto.cleanupError ?? dto.cleanup_error ?? null,
    executionLogEntries:
      dto.executionLogEntries ??
      dto.execution_log_entries ??
      dto.executionLogs ??
      dto.execution_logs ??
      null,
    error: dto.error ?? null,
    message: dto.message ?? null,
  };
}

export function runnerStatusFromDto(dto: RunnerStatusDto, previousStatus?: RunnerStatus): RunnerStatus {
  const endpoint = dto.endpoint ?? dto.runnerEndpoint ?? dto.runner_endpoint ?? previousStatus?.endpoint;
  const runnerEndpoint = dto.runnerEndpoint ?? dto.runner_endpoint ?? null;
  const runnerRepoPath = dto.runnerRepoPath ?? dto.runner_repo_path ?? null;
  const statusCode = dto.status_code ?? dto.statusCode ?? null;
  const managed = Boolean(dto.managed);
  const pid = dto.pid ?? null;
  const ownership = normalizeRunnerOwnership(dto.ownership ?? dto.listenerOwnership ?? dto.listener_ownership, managed, dto.reachable);
  const canStop = Boolean(dto.canStop ?? dto.can_stop ?? (managed && ownership !== "custom" && ownership !== "occupied"));
  const canRestart = Boolean(dto.canRestart ?? dto.can_restart ?? (managed && ownership !== "custom" && ownership !== "occupied"));

  if (!dto.configured) {
    if (previousStatus?.managed && endpoint && previousStatus.endpoint === endpoint) {
      return {
        ...unknownRunnerStatus,
        endpoint,
        managed: previousStatus.managed,
        pid: previousStatus.pid ?? null,
        ownership: previousStatus.ownership ?? "managed",
        runnerEndpoint: previousStatus.runnerEndpoint ?? runnerEndpoint,
        runnerRepoPath: previousStatus.runnerRepoPath ?? runnerRepoPath,
        canStop: previousStatus.canStop ?? canStop,
        canRestart: previousStatus.canRestart ?? canRestart,
      };
    }
    return { ...unknownRunnerStatus, endpoint, ownership: "offline", runnerEndpoint, runnerRepoPath, canStop: false, canRestart: false };
  }

  if (dto.reachable) {
    return {
      state: "online",
      label: runnerStatusOwnershipLabel(ownership, true),
      detail: dto.message || "Studio Runner responded to health check.",
      statusCode,
      endpoint,
      runnerEndpoint,
      runnerRepoPath,
      managed,
      pid,
      ownership,
      canStop,
      canRestart,
    };
  }

  return {
    state: "offline",
    label: runnerStatusOwnershipLabel(ownership, false),
    detail: dto.message || "Studio Runner did not respond successfully.",
    statusCode,
    endpoint,
    runnerEndpoint,
    runnerRepoPath,
    managed,
    pid,
    ownership,
    canStop,
    canRestart,
  };
}

function normalizeRunnerOwnership(
  value: RunnerOwnershipState | string | null | undefined,
  managed: boolean,
  reachable: boolean,
): RunnerOwnershipState {
  if (value === "offline" || value === "managed" || value === "recovered" || value === "custom" || value === "occupied") {
    return value;
  }
  if (managed) {
    return "managed";
  }
  if (reachable) {
    return "custom";
  }
  return "offline";
}

function runnerStatusOwnershipLabel(ownership: RunnerOwnershipState, reachable: boolean): string {
  if (ownership === "recovered") {
    return "Restart runner";
  }
  if (ownership === "custom") {
    return "Custom runner reachable";
  }
  if (ownership === "occupied") {
    return "Port occupied";
  }
  if (ownership === "managed" && reachable) {
    return "Runner online";
  }
  return reachable ? "Runner online" : "Runner offline";
}
