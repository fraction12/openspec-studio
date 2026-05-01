import type {
  RunnerDispatchAttempt,
  RunnerExecutionStatus,
  RunnerLogSource,
} from "../appModel";
import type { Health } from "../domain/workspaceViewModel";

export const RUNNER_LOG_LIMIT = 50;

export interface RunnerStreamEventInput {
  eventId?: string | null;
  repoPath?: string | null;
  repoChangeKey?: string | null;
  changeName?: string | null;
  eventName?: string | null;
  status?: string | null;
  runId?: string | null;
  recordedAt?: string | null;
  workspacePath?: string | null;
  sessionId?: string | null;
  branchName?: string | null;
  commitSha?: string | null;
  prUrl?: string | null;
  error?: string | null;
  message?: string | null;
}

export function createRunnerDispatchAttempt(input: {
  eventId: string;
  repoPath: string;
  changeName: string;
  payload?: unknown;
  status: RunnerDispatchAttempt["status"];
  message: string;
  statusCode?: number | null;
  responseBody?: string | null;
  runId?: string | null;
  previousAttempt?: RunnerDispatchAttempt;
}): RunnerDispatchAttempt {
  return {
    eventId: input.eventId,
    repoPath: input.repoPath,
    changeName: input.changeName,
    status: input.status,
    message: input.message,
    statusCode: input.statusCode ?? null,
    responseBody: input.responseBody ?? null,
    runId: input.runId ?? null,
    payload: input.payload ?? input.previousAttempt?.payload,
    createdAt: input.previousAttempt?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createRunnerLifecycleLogEvent(input: {
  repoPath: string;
  event: string;
  message: string;
  status?: RunnerExecutionStatus;
  occurredAt?: string;
}): RunnerDispatchAttempt {
  const occurredAt = input.occurredAt || new Date().toISOString();
  return {
    eventId: `local_${input.event}_${Date.parse(occurredAt) || Date.now()}`,
    repoPath: input.repoPath,
    changeName: "Runner",
    status: input.status === "failed" ? "failed" : "accepted",
    message: input.message,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    source: input.event === "status" ? "status" : "lifecycle",
    eventName: input.event,
    executionStatus: input.status || "unknown",
  };
}

export function mergeRunnerStreamEvent(
  attempts: RunnerDispatchAttempt[] | undefined,
  event: RunnerStreamEventInput,
  fallbackRepoPath: string | null | undefined,
): RunnerDispatchAttempt[] {
  const eventId = normalizeRunnerEventId(event.eventId, event.eventName);
  const repoPath = event.repoPath || repoPathFromRepoChangeKey(event.repoChangeKey) || fallbackRepoPath || "";
  const changeName = event.changeName || changeNameFromRepoChangeKey(event.repoChangeKey) || "Runner";
  const now = new Date().toISOString();
  const existing = (attempts ?? []).find((attempt) => attempt.eventId === eventId);
  const executionStatus = normalizeRunnerExecutionStatus(event.status, event.eventName);
  const updatedAt = event.recordedAt || existing?.updatedAt || now;
  const next: RunnerDispatchAttempt = {
    eventId,
    repoPath: existing?.repoPath || repoPath,
    changeName: existing?.changeName || changeName,
    status: existing?.status || deliveryStatusFromExecution(executionStatus),
    message: event.message || event.error || existing?.message || runnerExecutionMessage(executionStatus, event.eventName),
    createdAt: existing?.createdAt || updatedAt,
    updatedAt,
    statusCode: existing?.statusCode ?? null,
    responseBody: existing?.responseBody ?? null,
    runId: event.runId ?? existing?.runId ?? null,
    payload: existing?.payload,
    source: "stream",
    eventName: event.eventName ?? existing?.eventName ?? null,
    executionStatus,
    workspacePath: event.workspacePath ?? existing?.workspacePath ?? null,
    sessionId: event.sessionId ?? existing?.sessionId ?? null,
    branchName: event.branchName ?? existing?.branchName ?? null,
    commitSha: event.commitSha ?? existing?.commitSha ?? null,
    prUrl: event.prUrl ?? existing?.prUrl ?? null,
    error: event.error ?? existing?.error ?? null,
    recordedAt: event.recordedAt ?? existing?.recordedAt ?? null,
  };

  return capRunnerDispatchAttempts([
    next,
    ...(attempts ?? []).filter((attempt) => attempt.eventId !== eventId),
  ]);
}

export function upsertRunnerDispatchAttempt(
  attempts: RunnerDispatchAttempt[] | undefined,
  attempt: RunnerDispatchAttempt,
): RunnerDispatchAttempt[] {
  return capRunnerDispatchAttempts([
    attempt,
    ...(attempts ?? []).filter((item) => item.eventId !== attempt.eventId),
  ]);
}

export function replaceRunnerDispatchAttempt(
  attempts: RunnerDispatchAttempt[] | undefined,
  eventId: string,
  attempt: RunnerDispatchAttempt,
): RunnerDispatchAttempt[] {
  return capRunnerDispatchAttempts([
    attempt,
    ...(attempts ?? []).filter((item) => item.eventId !== eventId),
  ]);
}

export function runnerDispatchHistoryForRepo(
  attempts: RunnerDispatchAttempt[] | undefined,
  repoPath: string | null | undefined,
): RunnerDispatchAttempt[] {
  if (!repoPath) {
    return [];
  }

  return sortRunnerDispatchAttempts((attempts ?? []).filter((attempt) => attempt.repoPath === repoPath));
}

export function runnerDispatchHistoryForChange(
  attempts: RunnerDispatchAttempt[] | undefined,
  repoPath: string | null | undefined,
  changeName: string | null | undefined,
): RunnerDispatchAttempt[] {
  if (!repoPath || !changeName) {
    return [];
  }

  return sortRunnerDispatchAttempts(
    (attempts ?? []).filter((attempt) => attempt.repoPath === repoPath && attempt.changeName === changeName),
  ).slice(0, 5);
}

export function latestRunnerAttempt(
  attempts: RunnerDispatchAttempt[] | undefined,
  repoPath?: string | null,
): RunnerDispatchAttempt | null {
  return (repoPath ? runnerDispatchHistoryForRepo(attempts, repoPath) : sortRunnerDispatchAttempts(attempts ?? []))[0] ?? null;
}

export function runnerAttemptRowId(attempt: RunnerDispatchAttempt): string {
  return `${attempt.eventId}-${attempt.updatedAt}-${attempt.status}`;
}

export function runnerAttemptMessage(attempt: RunnerDispatchAttempt): string {
  const source = attempt.source ? `${attempt.source} · ` : "";
  return `${source}${attempt.eventName || attempt.message}`;
}

export function runnerAttemptResponseLabel(attempt: RunnerDispatchAttempt): string {
  if (attempt.prUrl) {
    return attempt.prUrl;
  }
  if (attempt.error) {
    return attempt.error;
  }
  const parts = [
    attempt.branchName ? `branch ${attempt.branchName}` : null,
    attempt.commitSha ? `commit ${attempt.commitSha.slice(0, 7)}` : null,
    attempt.sessionId ? `session ${attempt.sessionId}` : null,
    attempt.runId ? `run ${attempt.runId}` : null,
    attempt.statusCode ? `HTTP ${attempt.statusCode}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : attempt.message;
}

export function runnerAttemptStatusLabel(attempt: RunnerDispatchAttempt): string {
  return attempt.executionStatus || attempt.status;
}

export function runnerAttemptStatusHealth(attempt: RunnerDispatchAttempt): Health {
  const label = runnerAttemptStatusLabel(attempt);
  return label === "completed" || label === "accepted"
    ? "valid"
    : label === "failed" || label === "blocked"
      ? "invalid"
      : "stale";
}

export function normalizeRunnerDispatchAttempts(value: unknown): RunnerDispatchAttempt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attempts: RunnerDispatchAttempt[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const eventId = readNonEmptyString(item.eventId);
    const repoPath = readNonEmptyString(item.repoPath);
    const changeName = readNonEmptyString(item.changeName);
    const status = normalizeDeliveryStatus(item.status);
    const createdAt = readNonEmptyString(item.createdAt);
    const updatedAt = readNonEmptyString(item.updatedAt);

    if (!eventId || !repoPath || !changeName || !status || !createdAt || !updatedAt) {
      continue;
    }

    attempts.push({
      eventId,
      repoPath,
      changeName,
      status,
      createdAt,
      updatedAt,
      message: typeof item.message === "string" ? item.message : "",
      statusCode: readFiniteNumber(item.statusCode) ?? null,
      responseBody: typeof item.responseBody === "string" ? item.responseBody : null,
      runId: typeof item.runId === "string" ? item.runId : null,
      payload: item.payload,
      source: normalizeRunnerLogSource(item.source),
      eventName: typeof item.eventName === "string" ? item.eventName : null,
      executionStatus: normalizePersistedExecutionStatus(item.executionStatus),
      workspacePath: typeof item.workspacePath === "string" ? item.workspacePath : null,
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      branchName: typeof item.branchName === "string" ? item.branchName : null,
      commitSha: typeof item.commitSha === "string" ? item.commitSha : null,
      prUrl: typeof item.prUrl === "string" ? item.prUrl : null,
      error: typeof item.error === "string" ? item.error : null,
      recordedAt: typeof item.recordedAt === "string" ? item.recordedAt : null,
    });
  }

  return capRunnerDispatchAttempts(attempts);
}

function capRunnerDispatchAttempts(attempts: RunnerDispatchAttempt[]): RunnerDispatchAttempt[] {
  return sortRunnerDispatchAttempts(attempts).slice(0, RUNNER_LOG_LIMIT);
}

function sortRunnerDispatchAttempts(attempts: RunnerDispatchAttempt[]): RunnerDispatchAttempt[] {
  return [...attempts].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function normalizeRunnerEventId(eventId: string | null | undefined, eventName: string | null | undefined): string {
  if (eventId && eventId.trim()) {
    return eventId.trim();
  }

  return `stream_${(eventName || "runner.update").replace(/[^a-zA-Z0-9_]/g, "_")}_${Date.now()}`;
}

function repoPathFromRepoChangeKey(value: string | null | undefined): string | null {
  if (!value || !value.includes("::")) {
    return null;
  }

  return value.split("::")[0] || null;
}

function changeNameFromRepoChangeKey(value: string | null | undefined): string | null {
  if (!value || !value.includes("::")) {
    return null;
  }

  return value.split("::").slice(1).join("::") || null;
}

function normalizeRunnerExecutionStatus(status: string | null | undefined, eventName: string | null | undefined): RunnerExecutionStatus {
  const value = (status || eventName || "").toLowerCase();
  if (value.includes("completed")) return "completed";
  if (value.includes("blocked")) return "blocked";
  if (value.includes("failed")) return "failed";
  if (value.includes("running")) return "running";
  if (value.includes("accepted")) return "accepted";
  return "unknown";
}

function deliveryStatusFromExecution(status: RunnerExecutionStatus): RunnerDispatchAttempt["status"] {
  if (status === "failed" || status === "blocked") return "failed";
  if (status === "running" || status === "accepted" || status === "completed") return "accepted";
  return "pending";
}

function runnerExecutionMessage(status: RunnerExecutionStatus, eventName: string | null | undefined): string {
  if (eventName) {
    return eventName;
  }

  return status === "unknown" ? "Runner event" : `Runner ${status}`;
}

function normalizeDeliveryStatus(value: unknown): RunnerDispatchAttempt["status"] | undefined {
  return value === "pending" || value === "accepted" || value === "failed" ? value : undefined;
}

function normalizeRunnerLogSource(value: unknown): RunnerLogSource {
  return value === "dispatch" || value === "stream" || value === "lifecycle" || value === "status"
    ? value
    : "dispatch";
}

function normalizePersistedExecutionStatus(value: unknown): RunnerExecutionStatus | null {
  return value === "accepted" ||
    value === "running" ||
    value === "completed" ||
    value === "blocked" ||
    value === "failed" ||
    value === "unknown"
    ? value
    : null;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
