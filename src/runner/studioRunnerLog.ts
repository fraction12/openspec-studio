import type {
  RunnerDispatchAttempt,
  RunnerExecutionDetails,
  RunnerExecutionLogEntry,
  RunnerExecutionLogLevel,
  RunnerExecutionLogPhase,
  RunnerExecutionLogSource,
  RunnerExecutionLogUnavailableReason,
  RunnerExecutionStatus,
  RunnerLogRowKind,
  RunnerLogSource,
} from "../appModel";
import type { Health } from "../domain/workspaceViewModel";

export const RUNNER_LOG_LIMIT = 50;
export const RUNNER_EXECUTION_LOG_LIMIT = 200;
export const RUNNER_EXECUTION_ENTRY_TEXT_LIMIT = 4096;

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
  workspaceStatus?: string | null;
  workspaceCreatedAt?: string | null;
  workspaceUpdatedAt?: string | null;
  sessionId?: string | null;
  sourceRepoPath?: string | null;
  baseCommitSha?: string | null;
  branchName?: string | null;
  commitSha?: string | null;
  prUrl?: string | null;
  prState?: string | null;
  prMergedAt?: string | null;
  prClosedAt?: string | null;
  cleanupEligible?: boolean | null;
  cleanupReason?: string | null;
  cleanupStatus?: string | null;
  cleanupError?: string | null;
  error?: string | null;
  message?: string | null;
  executionLogEntries?: unknown;
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
    message: truncateRunnerText(input.message).value,
    statusCode: input.statusCode ?? null,
    responseBody: input.responseBody ?? null,
    runId: input.runId ?? null,
    payload: input.payload ?? input.previousAttempt?.payload,
    createdAt: input.previousAttempt?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rowKind: "run",
    source: input.previousAttempt?.source ?? "dispatch",
    eventName: input.previousAttempt?.eventName ?? null,
    executionStatus: input.previousAttempt?.executionStatus ?? null,
  };
}

export function createRunnerLifecycleLogEvent(input: {
  repoPath: string;
  event: string;
  message: string;
  status?: RunnerExecutionStatus;
  occurredAt?: string;
  endpoint?: string | null;
}): RunnerDispatchAttempt {
  const occurredAt = input.occurredAt || new Date().toISOString();
  const rowKind = rowKindFromLocalEvent(input.event);
  const rowState = nonRunStateFromEvent(input.event, input.status);
  const source = localEventSource(input.event, rowKind);
  const attempt: RunnerDispatchAttempt = {
    eventId: `local_${input.event}_${Date.parse(occurredAt) || Date.now()}`,
    repoPath: input.repoPath,
    changeName: rowKind === "stream" ? "Runner stream" : rowKind === "diagnostic" ? "Diagnostics" : "Runner",
    status: input.status === "failed" ? "failed" : "accepted",
    message: truncateRunnerText(input.message).value,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    source,
    rowKind,
    rowState,
    endpoint: input.endpoint ?? null,
    eventName: input.event,
    executionStatus: input.status || "unknown",
    repeatCount: 1,
    firstRecordedAt: occurredAt,
    latestRecordedAt: occurredAt,
  };

  return {
    ...attempt,
    dedupeKey: runnerAttemptDedupeKey(attempt),
  };
}

export function mergeRunnerStreamEvent(
  attempts: RunnerDispatchAttempt[] | undefined,
  event: RunnerStreamEventInput,
  fallbackRepoPath: string | null | undefined,
): RunnerDispatchAttempt[] {
  const existing = findExistingRunAttempt(attempts ?? [], event);
  const eventId = normalizeRunnerEventId(event.eventId, event.runId, event.eventName, existing?.eventId);
  const repoPath = event.repoPath || repoPathFromRepoChangeKey(event.repoChangeKey) || existing?.repoPath || fallbackRepoPath || "";
  const changeName = event.changeName || changeNameFromRepoChangeKey(event.repoChangeKey) || existing?.changeName || "Runner";
  const now = new Date().toISOString();
  const incomingExecutionStatus = normalizeRunnerExecutionStatus(event.status, event.eventName);
  const executionStatus =
    incomingExecutionStatus === "unknown"
      ? existing?.executionStatus ?? incomingExecutionStatus
      : incomingExecutionStatus;
  const updatedAt = event.recordedAt || existing?.updatedAt || now;
  const executionLog = mergeRunnerExecutionLogEntries(
    existing?.executionLogEntries,
    normalizeRunnerExecutionLogEntries(event.executionLogEntries, eventId, event.runId ?? existing?.runId ?? null),
    existing?.executionLogTruncated ?? false,
    existing?.executionLogDroppedEntryCount ?? 0,
  );
  const message = event.message || event.error || existing?.message || runnerExecutionMessage(executionStatus, event.eventName);
  const next: RunnerDispatchAttempt = {
    eventId,
    repoPath: existing?.repoPath || repoPath,
    changeName: existing?.changeName || changeName,
    status: deliveryStatusFromExecution(executionStatus),
    message: truncateRunnerText(message).value,
    createdAt: existing?.createdAt || updatedAt,
    updatedAt,
    statusCode: existing?.statusCode ?? null,
    responseBody: existing?.responseBody ?? null,
    runId: event.runId ?? existing?.runId ?? null,
    payload: existing?.payload,
    source: "stream",
    rowKind: "run",
    rowState: executionStatus,
    eventName: event.eventName ?? existing?.eventName ?? null,
    executionStatus,
    repoChangeKey: event.repoChangeKey ?? existing?.repoChangeKey ?? null,
    workspacePath: event.workspacePath ?? existing?.workspacePath ?? null,
    workspaceStatus: event.workspaceStatus ?? existing?.workspaceStatus ?? null,
    workspaceCreatedAt: event.workspaceCreatedAt ?? existing?.workspaceCreatedAt ?? null,
    workspaceUpdatedAt: event.workspaceUpdatedAt ?? existing?.workspaceUpdatedAt ?? null,
    sessionId: event.sessionId ?? existing?.sessionId ?? null,
    sourceRepoPath: event.sourceRepoPath ?? existing?.sourceRepoPath ?? null,
    baseCommitSha: event.baseCommitSha ?? existing?.baseCommitSha ?? null,
    branchName: event.branchName ?? existing?.branchName ?? null,
    commitSha: event.commitSha ?? existing?.commitSha ?? null,
    prUrl: event.prUrl ?? existing?.prUrl ?? null,
    prState: event.prState ?? existing?.prState ?? null,
    prMergedAt: event.prMergedAt ?? existing?.prMergedAt ?? null,
    prClosedAt: event.prClosedAt ?? existing?.prClosedAt ?? null,
    cleanupEligible: event.cleanupEligible ?? existing?.cleanupEligible ?? null,
    cleanupReason: event.cleanupReason ?? existing?.cleanupReason ?? null,
    cleanupStatus: event.cleanupStatus ?? existing?.cleanupStatus ?? null,
    cleanupError: event.cleanupError ?? existing?.cleanupError ?? null,
    error: event.error ?? existing?.error ?? null,
    recordedAt: event.recordedAt ?? existing?.recordedAt ?? null,
    executionLogEntries: executionLog.entries,
    executionLogUnavailableReason: executionLog.entries.length > 0 ? null : existing?.executionLogUnavailableReason ?? "not-provided",
    executionLogTruncated: executionLog.truncated,
    executionLogDroppedEntryCount: executionLog.droppedEntryCount,
  };

  return capRunnerDispatchAttempts([
    normalizeRunnerAttemptForStorage(next),
    ...(attempts ?? []).filter((attempt) => attempt.eventId !== existing?.eventId && attempt.eventId !== eventId),
  ]);
}

export function upsertRunnerDispatchAttempt(
  attempts: RunnerDispatchAttempt[] | undefined,
  attempt: RunnerDispatchAttempt,
): RunnerDispatchAttempt[] {
  const nextAttempt = normalizeRunnerAttemptForStorage(attempt);
  const dedupeKey = runnerAttemptDedupeKey(nextAttempt);

  if (dedupeKey && runnerAttemptRowKind(nextAttempt) !== "run") {
    const existing = (attempts ?? []).find((item) => runnerAttemptDedupeKey(item) === dedupeKey);
    if (existing) {
      const merged = mergeDuplicateNonRunAttempt(existing, nextAttempt, dedupeKey);
      return capRunnerDispatchAttempts([
        merged,
        ...(attempts ?? []).filter((item) => item.eventId !== existing.eventId),
      ]);
    }
  }

  return capRunnerDispatchAttempts([
    nextAttempt,
    ...(attempts ?? []).filter((item) => item.eventId !== nextAttempt.eventId),
  ]);
}

export function replaceRunnerDispatchAttempt(
  attempts: RunnerDispatchAttempt[] | undefined,
  eventId: string,
  attempt: RunnerDispatchAttempt,
): RunnerDispatchAttempt[] {
  return upsertRunnerDispatchAttempt(
    (attempts ?? []).filter((item) => item.eventId !== eventId),
    attempt,
  );
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

export function runnerChangeIsBuilding(
  attempts: RunnerDispatchAttempt[] | undefined,
  repoPath: string | null | undefined,
  changeName: string | null | undefined,
): boolean {
  if (!repoPath || !changeName) {
    return false;
  }

  const latestRun = sortRunnerDispatchAttempts(
    (attempts ?? []).filter(
      (attempt) =>
        runnerAttemptRowKind(attempt) === "run" &&
        attempt.repoPath === repoPath &&
        attempt.changeName === changeName,
    ),
  )[0];

  if (!latestRun) {
    return false;
  }

  const latestStatus = runnerAttemptStateLabel(latestRun);

  return latestStatus === "accepted" || latestStatus === "running";
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

export function runnerAttemptStableRowId(attempt: RunnerDispatchAttempt): string {
  return runnerAttemptDedupeKey(attempt) || attempt.eventId;
}

export function runnerAttemptRowKind(attempt: RunnerDispatchAttempt): RunnerLogRowKind {
  if (isRunnerLogRowKind(attempt.rowKind)) {
    return attempt.rowKind;
  }

  const eventName = attempt.eventName ?? "";
  if (eventName.startsWith("stream.")) {
    return "stream";
  }
  if (attempt.source === "lifecycle" || attempt.source === "status") {
    return "lifecycle";
  }
  if (attempt.source === "diagnostic" || eventName.startsWith("diagnostic.")) {
    return "diagnostic";
  }
  return "run";
}

export function runnerAttemptEventLabel(attempt: RunnerDispatchAttempt): string {
  const labels: Record<RunnerLogRowKind, string> = {
    run: "Run",
    lifecycle: "Runner",
    stream: "Stream",
    diagnostic: "Diagnostic",
  };
  return `${labels[runnerAttemptRowKind(attempt)]} · ${attempt.eventName || defaultEventName(attempt)}`;
}

export function runnerAttemptSubject(attempt: RunnerDispatchAttempt): string {
  const rowKind = runnerAttemptRowKind(attempt);
  if (rowKind === "run") return attempt.changeName;
  if (rowKind === "stream") return attempt.endpoint || "Runner stream";
  if (rowKind === "diagnostic") return "Diagnostics";
  return attempt.endpoint || "Runner";
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
    (attempt.repeatCount ?? 0) > 1 ? `${attempt.repeatCount} occurrences` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : attempt.message;
}

export function runnerAttemptStateLabel(attempt: RunnerDispatchAttempt): string {
  if (runnerAttemptRowKind(attempt) === "run") {
    return attempt.executionStatus && attempt.executionStatus !== "unknown" ? attempt.executionStatus : attempt.status;
  }

  return attempt.rowState || nonRunStateFromEvent(attempt.eventName || "", attempt.executionStatus || undefined);
}

export function runnerAttemptStatusLabel(attempt: RunnerDispatchAttempt): string {
  return runnerAttemptStateLabel(attempt);
}

export function runnerAttemptStatusHealth(attempt: RunnerDispatchAttempt): Health {
  const label = runnerAttemptStateLabel(attempt);
  return label === "completed" ||
    label === "accepted" ||
    label === "connected" ||
    label === "healthy" ||
    label === "started" ||
    label === "stopped" ||
    label === "restarted"
    ? "valid"
    : label === "failed" || label === "blocked" || label === "conflict" || label === "error"
      ? "invalid"
      : "stale";
}

export function runnerAttemptExecutionDetails(
  attempt: RunnerDispatchAttempt,
  options: { streamStatus?: "disconnected" | "connecting" | "connected" | "error" } = {},
): RunnerExecutionDetails {
  const firstClassEntries = sortRunnerExecutionLogEntries(attempt.executionLogEntries ?? []);
  const summaryEntries = firstClassEntries.length > 0 ? [] : deriveSummaryMilestones(attempt);
  const entries = firstClassEntries.length > 0 ? firstClassEntries : summaryEntries;
  const unavailableReason = firstClassEntries.length > 0
    ? null
    : executionUnavailableReason(attempt, options.streamStatus);
  const truncated = Boolean(attempt.executionLogTruncated || entries.some((entry) => entry.truncated));

  return {
    entries,
    unavailableReason,
    truncated,
    droppedEntryCount: attempt.executionLogDroppedEntryCount ?? 0,
  };
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

    const executionLog = normalizeRunnerExecutionLogEntries(item.executionLogEntries, eventId, readOptionalString(item.runId));
    attempts.push(normalizeRunnerAttemptForStorage({
      eventId,
      repoPath,
      changeName,
      status,
      createdAt,
      updatedAt,
      message: typeof item.message === "string" ? item.message : "",
      statusCode: readFiniteNumber(item.statusCode) ?? null,
      responseBody: readOptionalString(item.responseBody),
      runId: readOptionalString(item.runId),
      payload: item.payload,
      source: normalizeRunnerLogSource(item.source),
      rowKind: normalizeRunnerLogRowKind(item.rowKind),
      rowState: readOptionalString(item.rowState),
      endpoint: readOptionalString(item.endpoint),
      dedupeKey: readOptionalString(item.dedupeKey),
      repeatCount: readFiniteNumber(item.repeatCount),
      firstRecordedAt: readOptionalString(item.firstRecordedAt),
      latestRecordedAt: readOptionalString(item.latestRecordedAt),
      eventName: readOptionalString(item.eventName),
      executionStatus: normalizePersistedExecutionStatus(item.executionStatus),
      repoChangeKey: readOptionalString(item.repoChangeKey),
      workspacePath: readOptionalString(item.workspacePath),
      workspaceStatus: readOptionalString(item.workspaceStatus),
      workspaceCreatedAt: readOptionalString(item.workspaceCreatedAt),
      workspaceUpdatedAt: readOptionalString(item.workspaceUpdatedAt),
      sessionId: readOptionalString(item.sessionId),
      sourceRepoPath: readOptionalString(item.sourceRepoPath),
      baseCommitSha: readOptionalString(item.baseCommitSha),
      branchName: readOptionalString(item.branchName),
      commitSha: readOptionalString(item.commitSha),
      prUrl: readOptionalString(item.prUrl),
      prState: readOptionalString(item.prState),
      prMergedAt: readOptionalString(item.prMergedAt),
      prClosedAt: readOptionalString(item.prClosedAt),
      cleanupEligible: readBoolean(item.cleanupEligible),
      cleanupReason: readOptionalString(item.cleanupReason),
      cleanupStatus: readOptionalString(item.cleanupStatus),
      cleanupError: readOptionalString(item.cleanupError),
      error: readOptionalString(item.error),
      recordedAt: readOptionalString(item.recordedAt),
      executionLogEntries: executionLog.entries,
      executionLogUnavailableReason: normalizeUnavailableReason(item.executionLogUnavailableReason),
      executionLogTruncated: Boolean(item.executionLogTruncated || executionLog.truncated),
      executionLogDroppedEntryCount: readFiniteNumber(item.executionLogDroppedEntryCount) ?? executionLog.droppedEntryCount,
    }));
  }

  return capRunnerDispatchAttempts(attempts);
}

function mergeDuplicateNonRunAttempt(
  existing: RunnerDispatchAttempt,
  incoming: RunnerDispatchAttempt,
  dedupeKey: string,
): RunnerDispatchAttempt {
  const repeatCount = Math.max(1, existing.repeatCount ?? 1) + Math.max(1, incoming.repeatCount ?? 1);
  return normalizeRunnerAttemptForStorage({
    ...existing,
    ...incoming,
    eventId: existing.eventId,
    createdAt: existing.createdAt,
    firstRecordedAt: existing.firstRecordedAt || existing.createdAt,
    latestRecordedAt: incoming.updatedAt,
    repeatCount,
    dedupeKey,
  });
}

function normalizeRunnerAttemptForStorage(attempt: RunnerDispatchAttempt): RunnerDispatchAttempt {
  const message = truncateRunnerText(redactSensitiveText(attempt.message));
  const error = attempt.error ? truncateRunnerText(redactSensitiveText(attempt.error)).value : attempt.error;
  const cleanupError = attempt.cleanupError
    ? truncateRunnerText(redactSensitiveText(attempt.cleanupError)).value
    : attempt.cleanupError;
  const rowKind = runnerAttemptRowKind(attempt);
  const rowState = rowKind === "run"
    ? attempt.rowState ?? attempt.executionStatus ?? attempt.status
    : attempt.rowState || nonRunStateFromEvent(attempt.eventName || "", attempt.executionStatus || undefined);
  const dedupeKey = rowKind === "run" ? null : runnerAttemptDedupeKey({ ...attempt, rowKind, rowState });

  return {
    ...attempt,
    message: message.value,
    error,
    cleanupError,
    rowKind,
    rowState,
    dedupeKey,
    repeatCount: attempt.repeatCount ?? (rowKind === "run" ? undefined : 1),
    firstRecordedAt: attempt.firstRecordedAt ?? (rowKind === "run" ? undefined : attempt.createdAt),
    latestRecordedAt: attempt.latestRecordedAt ?? (rowKind === "run" ? undefined : attempt.updatedAt),
    executionLogTruncated: Boolean(attempt.executionLogTruncated || message.truncated),
  };
}

function capRunnerDispatchAttempts(attempts: RunnerDispatchAttempt[]): RunnerDispatchAttempt[] {
  return sortRunnerDispatchAttempts(attempts).slice(0, RUNNER_LOG_LIMIT);
}

function sortRunnerDispatchAttempts(attempts: RunnerDispatchAttempt[]): RunnerDispatchAttempt[] {
  return [...attempts].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function findExistingRunAttempt(
  attempts: RunnerDispatchAttempt[],
  event: RunnerStreamEventInput,
): RunnerDispatchAttempt | undefined {
  const eventId = event.eventId?.trim();
  if (eventId) {
    const byEvent = attempts.find((attempt) => attempt.eventId === eventId);
    if (byEvent) return byEvent;
  }

  const runId = event.runId?.trim();
  if (runId) {
    return attempts.find((attempt) => attempt.runId === runId);
  }

  return undefined;
}

function normalizeRunnerEventId(
  eventId: string | null | undefined,
  runId: string | null | undefined,
  eventName: string | null | undefined,
  fallbackEventId?: string,
): string {
  if (eventId && eventId.trim()) {
    return eventId.trim();
  }
  if (fallbackEventId) {
    return fallbackEventId;
  }
  if (runId && runId.trim()) {
    return `run_${runId.trim().replace(/[^a-zA-Z0-9_]/g, "_")}`;
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
  if (value.includes("conflict")) return "conflict";
  if (value.includes("failed") || value.includes("error")) return "failed";
  if (value.includes("running")) return "running";
  if (value.includes("accepted")) return "accepted";
  return "unknown";
}

function deliveryStatusFromExecution(status: RunnerExecutionStatus): RunnerDispatchAttempt["status"] {
  if (status === "failed" || status === "blocked" || status === "conflict") return "failed";
  if (status === "running" || status === "accepted" || status === "completed") return "accepted";
  return "pending";
}

function runnerExecutionMessage(status: RunnerExecutionStatus, eventName: string | null | undefined): string {
  if (eventName) {
    return eventName;
  }

  return status === "unknown" ? "Runner event" : `Runner ${status}`;
}

function defaultEventName(attempt: RunnerDispatchAttempt): string {
  if (runnerAttemptRowKind(attempt) === "run" && attempt.source === "dispatch") {
    return "build.requested";
  }
  return attempt.eventName || "runner.update";
}

function rowKindFromLocalEvent(event: string): RunnerLogRowKind {
  if (event.startsWith("stream.")) return "stream";
  if (event.startsWith("diagnostic.")) return "diagnostic";
  return "lifecycle";
}

function localEventSource(event: string, rowKind: RunnerLogRowKind): RunnerLogSource {
  if (rowKind === "stream") return "stream";
  if (rowKind === "diagnostic") return "diagnostic";
  return event === "status" ? "status" : "lifecycle";
}

function nonRunStateFromEvent(eventName: string, status?: RunnerExecutionStatus): string {
  const value = `${eventName} ${status ?? ""}`.toLowerCase();
  if (value.includes("error") || value.includes("failed") || value.includes("blocked") || value.includes("conflict")) return "error";
  if (value.includes("warning")) return "warning";
  if (value.includes("connecting")) return "connecting";
  if (value.includes("connected")) return "connected";
  if (value.includes("disconnected")) return "disconnected";
  if (value.includes("restarted")) return "restarted";
  if (value.includes("started")) return "started";
  if (value.includes("stopped")) return "stopped";
  if (value.includes("health") || value.includes("status")) return "healthy";
  return "info";
}

function runnerAttemptDedupeKey(attempt: RunnerDispatchAttempt): string | null {
  const rowKind = runnerAttemptRowKind(attempt);
  if (rowKind === "run") {
    return null;
  }

  return [
    normalizeDedupeText(attempt.repoPath),
    normalizeDedupeText(attempt.endpoint ?? ""),
    rowKind,
    normalizeDedupeText(attempt.eventName ?? ""),
    normalizeDedupeText(attempt.error || attempt.message),
  ].join("|");
}

function normalizeDedupeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeRunnerExecutionLogEntries(
  value: unknown,
  eventId: string | null | undefined,
  runId: string | null | undefined,
): { entries: RunnerExecutionLogEntry[]; truncated: boolean; droppedEntryCount: number } {
  if (!Array.isArray(value)) {
    return { entries: [], truncated: false, droppedEntryCount: 0 };
  }

  const entries = value
    .map((item) => normalizeRunnerExecutionLogEntry(item, eventId, runId))
    .filter((item): item is RunnerExecutionLogEntry => Boolean(item));

  const sorted = sortRunnerExecutionLogEntries(entries);
  const droppedEntryCount = Math.max(0, sorted.length - RUNNER_EXECUTION_LOG_LIMIT);
  const bounded = sorted.slice(-RUNNER_EXECUTION_LOG_LIMIT);

  return {
    entries: bounded,
    truncated: droppedEntryCount > 0 || bounded.some((entry) => entry.truncated),
    droppedEntryCount,
  };
}

function mergeRunnerExecutionLogEntries(
  existingEntries: RunnerExecutionLogEntry[] | undefined,
  incoming: { entries: RunnerExecutionLogEntry[]; truncated: boolean; droppedEntryCount: number },
  existingTruncated: boolean,
  existingDroppedEntryCount: number,
): { entries: RunnerExecutionLogEntry[]; truncated: boolean; droppedEntryCount: number } {
  const entriesByKey = new Map<string, RunnerExecutionLogEntry>();

  for (const entry of [...(existingEntries ?? []), ...incoming.entries]) {
    entriesByKey.set(runnerExecutionEntryKey(entry), entry);
  }

  const sorted = sortRunnerExecutionLogEntries(Array.from(entriesByKey.values()));
  const droppedEntryCount = existingDroppedEntryCount + incoming.droppedEntryCount + Math.max(0, sorted.length - RUNNER_EXECUTION_LOG_LIMIT);
  const entries = sorted.slice(-RUNNER_EXECUTION_LOG_LIMIT);

  return {
    entries,
    truncated: existingTruncated || incoming.truncated || droppedEntryCount > 0,
    droppedEntryCount,
  };
}

function normalizeRunnerExecutionLogEntry(
  value: unknown,
  eventId: string | null | undefined,
  runId: string | null | undefined,
): RunnerExecutionLogEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const recordedAt = readOptionalString(value.recordedAt) ?? readOptionalString(value.recorded_at) ?? new Date().toISOString();
  const messageText = readOptionalString(value.message) ?? "";
  if (!messageText.trim()) {
    return null;
  }

  const message = truncateRunnerText(redactSensitiveText(messageText));
  const details = sanitizeRunnerDetails(value.details);

  return {
    eventId: readOptionalString(value.eventId) ?? readOptionalString(value.event_id) ?? eventId ?? null,
    runId: readOptionalString(value.runId) ?? readOptionalString(value.run_id) ?? runId ?? null,
    recordedAt,
    level: normalizeExecutionLogLevel(value.level),
    source: normalizeExecutionLogSource(value.source),
    phase: normalizeExecutionLogPhase(value.phase),
    message: message.value,
    details: details.value,
    sequence: readFiniteNumber(value.sequence) ?? null,
    truncated: Boolean(value.truncated || message.truncated || details.truncated),
    derived: Boolean(value.derived),
  };
}

function deriveSummaryMilestones(attempt: RunnerDispatchAttempt): RunnerExecutionLogEntry[] {
  if (runnerAttemptRowKind(attempt) !== "run") {
    return [];
  }

  const entries: RunnerExecutionLogEntry[] = [];
  const status = runnerAttemptStateLabel(attempt);
  entries.push(summaryEntry(attempt, {
    level: status === "failed" || status === "blocked" || status === "conflict" ? "error" : "info",
    source: "runner",
    phase: "ingress",
    recordedAt: attempt.recordedAt || attempt.updatedAt,
    message: `Runner ${status}.`,
    details: {
      eventId: attempt.eventId,
      runId: attempt.runId,
      repoChangeKey: attempt.repoChangeKey,
      status,
    },
  }));

  if (attempt.workspacePath || attempt.workspaceStatus || attempt.workspaceCreatedAt || attempt.workspaceUpdatedAt || attempt.sessionId) {
    entries.push(summaryEntry(attempt, {
      level: "info",
      source: "orchestrator",
      phase: "workspace",
      recordedAt: attempt.workspaceUpdatedAt || attempt.workspaceCreatedAt || attempt.updatedAt,
      message: attempt.workspaceStatus ? `Workspace ${attempt.workspaceStatus}.` : "Workspace metadata available.",
      details: {
        workspacePath: attempt.workspacePath,
        workspaceStatus: attempt.workspaceStatus,
        workspaceCreatedAt: attempt.workspaceCreatedAt,
        workspaceUpdatedAt: attempt.workspaceUpdatedAt,
        sessionId: attempt.sessionId,
      },
    }));
  }

  if (
    attempt.sourceRepoPath ||
    attempt.baseCommitSha ||
    attempt.branchName ||
    attempt.commitSha ||
    attempt.prUrl ||
    attempt.prState ||
    attempt.prMergedAt ||
    attempt.prClosedAt
  ) {
    entries.push(summaryEntry(attempt, {
      level: "info",
      source: "publication",
      phase: "publication",
      recordedAt: attempt.prMergedAt || attempt.prClosedAt || attempt.recordedAt || attempt.updatedAt,
      message: attempt.prUrl ? "Publication metadata available." : "Git metadata available.",
      details: {
        sourceRepoPath: attempt.sourceRepoPath,
        baseCommitSha: attempt.baseCommitSha,
        branchName: attempt.branchName,
        commitSha: attempt.commitSha,
        prUrl: attempt.prUrl,
        prState: attempt.prState,
        prMergedAt: attempt.prMergedAt,
        prClosedAt: attempt.prClosedAt,
      },
    }));
  }

  if (
    attempt.cleanupEligible !== undefined ||
    attempt.cleanupReason ||
    attempt.cleanupStatus ||
    attempt.cleanupError
  ) {
    entries.push(summaryEntry(attempt, {
      level: attempt.cleanupError ? "error" : "info",
      source: "cleanup",
      phase: "cleanup",
      recordedAt: attempt.recordedAt || attempt.updatedAt,
      message: attempt.cleanupStatus ? `Cleanup ${attempt.cleanupStatus}.` : "Cleanup metadata available.",
      details: {
        cleanupEligible: attempt.cleanupEligible,
        cleanupReason: attempt.cleanupReason,
        cleanupStatus: attempt.cleanupStatus,
        cleanupError: attempt.cleanupError,
      },
    }));
  }

  if (attempt.error) {
    entries.push(summaryEntry(attempt, {
      level: "error",
      source: "agent",
      phase: "agent",
      recordedAt: attempt.recordedAt || attempt.updatedAt,
      message: attempt.error,
      details: { error: attempt.error },
    }));
  }

  return entries;
}

function summaryEntry(
  attempt: RunnerDispatchAttempt,
  input: {
    level: RunnerExecutionLogLevel;
    source: RunnerExecutionLogSource;
    phase: RunnerExecutionLogPhase;
    recordedAt: string;
    message: string;
    details: unknown;
  },
): RunnerExecutionLogEntry {
  const message = truncateRunnerText(redactSensitiveText(input.message));
  const details = sanitizeRunnerDetails(input.details);
  return {
    eventId: attempt.eventId,
    runId: attempt.runId ?? null,
    recordedAt: input.recordedAt,
    level: input.level,
    source: input.source,
    phase: input.phase,
    message: message.value,
    details: details.value,
    derived: true,
    truncated: message.truncated || details.truncated,
  };
}

function sortRunnerExecutionLogEntries(entries: RunnerExecutionLogEntry[]): RunnerExecutionLogEntry[] {
  return [...entries].sort((left, right) => {
    const leftSequence = left.sequence ?? Number.MAX_SAFE_INTEGER;
    const rightSequence = right.sequence ?? Number.MAX_SAFE_INTEGER;
    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }

    return Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
  });
}

function runnerExecutionEntryKey(entry: RunnerExecutionLogEntry): string {
  return [
    entry.sequence ?? "",
    entry.recordedAt,
    entry.source,
    entry.phase ?? "",
    entry.message,
  ].join("|");
}

function executionUnavailableReason(
  attempt: RunnerDispatchAttempt,
  streamStatus?: "disconnected" | "connecting" | "connected" | "error",
): RunnerExecutionLogUnavailableReason {
  if (attempt.executionLogUnavailableReason) return attempt.executionLogUnavailableReason;
  if (streamStatus === "error") return "error";
  if (streamStatus === "disconnected") return "disconnected";
  return "not-provided";
}

function sanitizeRunnerDetails(value: unknown, depth = 0): { value: unknown; truncated: boolean } {
  if (value === undefined) {
    return { value: undefined, truncated: false };
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return { value, truncated: false };
  }
  if (typeof value === "string") {
    return truncateRunnerText(redactSensitiveText(value));
  }
  if (depth >= 4) {
    return { value: "[truncated]", truncated: true };
  }
  if (Array.isArray(value)) {
    let truncated = value.length > 20;
    const sanitized = value.slice(0, 20).map((item) => {
      const next = sanitizeRunnerDetails(item, depth + 1);
      truncated ||= next.truncated;
      return next.value;
    });
    return truncateStructuredDetails(sanitized, truncated);
  }
  if (isRecord(value)) {
    let truncated = false;
    const entries = Object.entries(value).slice(0, 30).map(([key, item]) => {
      if (isSensitiveKey(key)) {
        return [key, "[redacted]"];
      }
      const next = sanitizeRunnerDetails(item, depth + 1);
      truncated ||= next.truncated;
      return [key, next.value];
    });
    truncated ||= Object.keys(value).length > 30;
    return truncateStructuredDetails(Object.fromEntries(entries), truncated);
  }

  return { value: undefined, truncated: false };
}

function truncateStructuredDetails(value: unknown, alreadyTruncated: boolean): { value: unknown; truncated: boolean } {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length <= RUNNER_EXECUTION_ENTRY_TEXT_LIMIT) {
    return { value, truncated: alreadyTruncated };
  }

  return {
    value: truncateRunnerText(serialized).value,
    truncated: true,
  };
}

function truncateRunnerText(value: string): { value: string; truncated: boolean } {
  if (value.length <= RUNNER_EXECUTION_ENTRY_TEXT_LIMIT) {
    return { value, truncated: false };
  }

  return {
    value: value.slice(0, RUNNER_EXECUTION_ENTRY_TEXT_LIMIT - 3) + "...",
    truncated: true,
  };
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(token|secret|signature|password|authorization|api[_-]?key)=([^\s&]+)/gi, "$1=[redacted]");
}

function isSensitiveKey(key: string): boolean {
  return /(secret|token|signature|authorization|auth|password|credential|cookie|env|api[_-]?key)/i.test(key);
}

function normalizeDeliveryStatus(value: unknown): RunnerDispatchAttempt["status"] | undefined {
  return value === "pending" || value === "accepted" || value === "failed" ? value : undefined;
}

function normalizeRunnerLogSource(value: unknown): RunnerLogSource {
  return value === "dispatch" || value === "stream" || value === "lifecycle" || value === "status" || value === "diagnostic"
    ? value
    : "dispatch";
}

function normalizeRunnerLogRowKind(value: unknown): RunnerLogRowKind | undefined {
  return isRunnerLogRowKind(value) ? value : undefined;
}

function isRunnerLogRowKind(value: unknown): value is RunnerLogRowKind {
  return value === "run" || value === "lifecycle" || value === "stream" || value === "diagnostic";
}

function normalizePersistedExecutionStatus(value: unknown): RunnerExecutionStatus | null {
  return value === "accepted" ||
    value === "running" ||
    value === "completed" ||
    value === "blocked" ||
    value === "failed" ||
    value === "conflict" ||
    value === "unknown"
    ? value
    : null;
}

function normalizeExecutionLogLevel(value: unknown): RunnerExecutionLogLevel {
  return value === "debug" || value === "info" || value === "warning" || value === "error" ? value : "info";
}

function normalizeExecutionLogSource(value: unknown): RunnerExecutionLogSource {
  return value === "runner" ||
    value === "orchestrator" ||
    value === "agent" ||
    value === "tool" ||
    value === "git" ||
    value === "validation" ||
    value === "publication" ||
    value === "cleanup"
    ? value
    : "runner";
}

function normalizeExecutionLogPhase(value: unknown): RunnerExecutionLogPhase | null {
  return value === "ingress" ||
    value === "workspace" ||
    value === "artifacts" ||
    value === "agent" ||
    value === "validation" ||
    value === "publication" ||
    value === "cleanup"
    ? value
    : null;
}

function normalizeUnavailableReason(value: unknown): RunnerExecutionLogUnavailableReason | null {
  return value === "not-provided" || value === "disconnected" || value === "error" || value === "empty" ? value : null;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
