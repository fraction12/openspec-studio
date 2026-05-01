import {
  normalizeOpenSpecPath,
  type IndexedWorkflowStatusValue,
  type VirtualOpenSpecChangeStatusRecord,
  type VirtualOpenSpecFileRecord,
} from "./domain/openspecIndex";

import type { ValidationResult } from "./validation/results";


export interface RunnerSettings {
  endpoint: string;
}

export type RunnerStatusKind = "offline" | "checking" | "starting" | "online";

export interface RunnerStatus {
  state: RunnerStatusKind;
  label: string;
  detail: string;
  endpoint?: string;
  statusCode?: number | null;
  managed?: boolean;
  pid?: number | null;
}

export type RunnerLogSource = "dispatch" | "stream" | "lifecycle" | "status";
export type RunnerExecutionStatus = "accepted" | "running" | "completed" | "blocked" | "failed" | "unknown";

export interface RunnerDispatchAttempt {
  eventId: string;
  repoPath: string;
  changeName: string;
  status: "pending" | "accepted" | "failed";
  message: string;
  createdAt: string;
  updatedAt: string;
  statusCode?: number | null;
  responseBody?: string | null;
  runId?: string | null;
  payload?: unknown;
  source?: RunnerLogSource;
  eventName?: string | null;
  executionStatus?: RunnerExecutionStatus | null;
  workspacePath?: string | null;
  sessionId?: string | null;
  branchName?: string | null;
  commitSha?: string | null;
  prUrl?: string | null;
  error?: string | null;
  recordedAt?: string | null;
}

export interface RunnerDispatchEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface RunnerDispatchChangeReadiness {
  kind: ChangeBuildStatusKind;
  label?: string;
}

export interface RunnerDispatchPayloadInput {
  eventId: string;
  repo: { name: string; path: string };
  change: { name: string; artifacts: { path: string; status: string }[]; taskProgress: { done: number; total: number } | null };
  validation: ValidationResult;
  gitStatus?: { entries?: string[] };
}

export interface RunnerDispatchRequestInput {
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
}

export interface BridgeFileRecord {
  path: string;
  kind?: "file" | "directory";
  modified_time_ms?: number;
  modifiedTimeMs?: number;
  file_size?: number;
  fileSize?: number;
  content?: string;
  read_error?: string;
  readError?: string;
}

export interface OpenSpecFileSignature {
  fingerprint: string;
  latestPath: string | null;
  latestModifiedTimeMs: number | null;
}

export type ChangeHealth = "valid" | "stale" | "invalid" | "missing" | "blocked" | "ready";

export type ChangeBuildStatusKind = "validate" | "ready" | "incomplete" | "done";

export type ValidationTrustKind =
  | "not-checked"
  | "checking"
  | "clean"
  | "needs-attention"
  | "command-problem"
  | "outdated";

export type OpenSpecOperationKind =
  | "validation"
  | "archive"
  | "status"
  | "artifact-read"
  | "repository-read"
  | "runner-dispatch";

export interface OpenSpecOperationIssue {
  id: string;
  kind: OpenSpecOperationKind;
  title: string;
  message: string;
  occurredAt: string;
  repoPath?: string;
  target?: string;
  statusCode?: number | null;
  stdout?: string;
  stderr?: string;
}

export interface CommandLikeResult {
  stdout?: string;
  stderr?: string;
  status_code?: number | null;
  statusCode?: number | null;
  success?: boolean;
}

export interface OpenSpecOperationIssueInput {
  kind: OpenSpecOperationKind;
  title: string;
  message?: string;
  fallbackMessage: string;
  repoPath?: string;
  target?: string;
  command?: CommandLikeResult | null;
  occurredAt?: Date | string;
}

export interface ValidationTrustState {
  kind: ValidationTrustKind;
  label: string;
  detail: string;
  attentionKnown: boolean;
}

export interface ChangeBuildStatusState {
  kind: ChangeBuildStatusKind;
  label: string;
  health: ChangeHealth;
}

export interface ChangeBuildStatusInput {
  phase: "active" | "archive-ready" | "archived";
  taskProgress: { done: number; total: number } | null;
  validation: ValidationResult | null;
  validationIssueCount: number;
  validationRunning?: boolean;
}

export interface RepositoryCandidateInput {
  readable: boolean;
  hasOpenSpec: boolean;
}

export interface RepositoryCandidateDecision {
  promote: boolean;
  preserveActiveWorkspace: boolean;
}

export interface ChangeHealthInput {
  workflowStatus: IndexedWorkflowStatusValue;
  missingArtifactCount: number;
  validation: ValidationResult | null;
  validationIssueCount: number;
}

export function toVirtualFileRecords(
  records: BridgeFileRecord[],
): VirtualOpenSpecFileRecord[] {
  return records
    .map((record) => ({
      path: normalizeOpenSpecPath(record.path),
      kind: record.kind ?? "file",
      modifiedTimeMs: record.modified_time_ms ?? record.modifiedTimeMs,
      fileSize: record.file_size ?? record.fileSize,
      content: record.content,
      readError: record.read_error ?? record.readError,
    }))
    .filter((record) => record.path.length > 0);
}

export function buildVirtualFilesByPath(
  records: VirtualOpenSpecFileRecord[],
): Record<string, VirtualOpenSpecFileRecord> {
  return Object.fromEntries(
    records
      .map((record) => ({
        ...record,
        path: normalizeOpenSpecPath(record.path),
        kind: record.kind ?? "file",
      }))
      .filter((record) => record.path.length > 0)
      .map((record) => [record.path, record]),
  );
}

export function activeChangeNamesFromFileRecords(
  records: VirtualOpenSpecFileRecord[],
): string[] {
  const names = new Set<string>();

  for (const record of records) {
    const normalizedPath = normalizeOpenSpecPath(record.path);
    const parts = normalizedPath.split("/");

    if (
      parts[0] !== "openspec" ||
      parts[1] !== "changes" ||
      parts[2] === "archive" ||
      !parts[2]
    ) {
      continue;
    }

    if (parts.length === 3 && record.kind !== "directory") {
      continue;
    }

    names.add(parts[2]);
  }

  return Array.from(names).sort((left, right) => left.localeCompare(right));
}

export function toVirtualChangeStatusRecord(
  payload: unknown,
  fallbackChangeName: string,
): VirtualOpenSpecChangeStatusRecord {
  if (!isRecord(payload)) {
    return {
      changeName: fallbackChangeName,
      error: "Status output was not recognized.",
    };
  }

  const changeName =
    readString(payload.changeName) ??
    readString(payload.change_name) ??
    fallbackChangeName;
  const artifacts = Array.isArray(payload.artifacts)
    ? payload.artifacts.filter(isRecord).map((artifact) => ({
        id: readString(artifact.id) ?? "unknown",
        status: readString(artifact.status) ?? "unknown",
        dependencies: readStringArray(artifact.dependencies),
      }))
    : undefined;
  const record: VirtualOpenSpecChangeStatusRecord = {
    changeName,
    schemaName:
      readString(payload.schemaName) ?? readString(payload.schema_name),
    isComplete:
      readBoolean(payload.isComplete) ?? readBoolean(payload.is_complete),
    artifacts,
  };
  const error = readString(payload.error) ?? readString(payload.message);

  if (error) {
    record.error = error;
  }

  return record;
}

export function buildOpenSpecFileSignature(
  records: VirtualOpenSpecFileRecord[],
): OpenSpecFileSignature {
  let latestPath: string | null = null;
  let latestModifiedTimeMs: number | null = null;
  const fingerprint = records
    .map((record) => ({
      ...record,
      path: normalizeOpenSpecPath(record.path),
      kind: record.kind ?? "file",
    }))
    .filter((record) => record.path.length > 0)
    .map((record) => {
      const modifiedTimeMs = record.modifiedTimeMs ?? 0;
      const fileSize = record.fileSize ?? 0;

      if (
        record.kind !== "directory" &&
        modifiedTimeMs > (latestModifiedTimeMs ?? 0)
      ) {
        latestPath = record.path;
        latestModifiedTimeMs = modifiedTimeMs;
      }

      return `${record.path}:${record.kind ?? "file"}:${modifiedTimeMs}:${fileSize}`;
    })
    .sort()
    .join("|");

  return {
    fingerprint,
    latestPath,
    latestModifiedTimeMs,
  };
}

export function deriveChangeHealth({
  workflowStatus,
  missingArtifactCount,
  validation,
  validationIssueCount,
}: ChangeHealthInput): ChangeHealth {
  if (workflowStatus === "error") {
    return "invalid";
  }

  if (workflowStatus === "blocked") {
    return "blocked";
  }

  if (missingArtifactCount > 0) {
    return "missing";
  }

  if (!validation) {
    return "stale";
  }

  if (validation.state === "stale") {
    return "stale";
  }

  if (validationIssueCount > 0) {
    return "invalid";
  }

  return validation.state === "pass" ? "valid" : "stale";
}

export function deriveChangeBuildStatus({
  phase,
  taskProgress,
  validation,
  validationIssueCount,
  validationRunning = false,
}: ChangeBuildStatusInput): ChangeBuildStatusState {
  if (phase === "archive-ready") {
    return changeBuildStatusState("done");
  }

  if (
    validationRunning ||
    !validation ||
    validation.state === "stale" ||
    validation.diagnostics.length > 0
  ) {
    return changeBuildStatusState("validate");
  }

  const hasActionableOpenTasks = Boolean(
    taskProgress &&
      taskProgress.total > 0 &&
      taskProgress.done < taskProgress.total,
  );

  if (
    !hasActionableOpenTasks ||
    validation.state !== "pass" ||
    validationIssueCount > 0
  ) {
    return changeBuildStatusState("incomplete");
  }

  return changeBuildStatusState("ready");
}

export function changeBuildStatusState(kind: ChangeBuildStatusKind): ChangeBuildStatusState {
  const states: Record<ChangeBuildStatusKind, ChangeBuildStatusState> = {
    validate: {
      kind: "validate",
      label: "Validate",
      health: "stale",
    },
    ready: {
      kind: "ready",
      label: "Ready",
      health: "ready",
    },
    incomplete: {
      kind: "incomplete",
      label: "Incomplete",
      health: "missing",
    },
    done: {
      kind: "done",
      label: "Done",
      health: "valid",
    },
  };

  return states[kind];
}

export function extractJsonPayload(output: string): unknown | undefined {
  const start = output.indexOf("{");

  if (start === -1) {
    return undefined;
  }

  for (let end = output.length; end > start; end -= 1) {
    const candidate = output.slice(start, end).trim();

    if (!candidate.endsWith("}")) {
      continue;
    }

    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Keep walking backward. Some CLIs append non-JSON diagnostics.
    }
  }

  return undefined;
}

export function createOpenSpecOperationIssue({
  kind,
  title,
  message,
  fallbackMessage,
  repoPath,
  target,
  command,
  occurredAt = new Date(),
}: OpenSpecOperationIssueInput): OpenSpecOperationIssue {
  const stdout = normalizeOptionalText(command?.stdout);
  const stderr = normalizeOptionalText(command?.stderr);
  const statusCode = command?.status_code ?? command?.statusCode ?? null;
  const resolvedMessage = normalizeOptionalText(message) ?? stderr ?? stdout ?? fallbackMessage;
  const timestamp = typeof occurredAt === "string" ? occurredAt : occurredAt.toISOString();
  const idParts = [kind, repoPath, target, timestamp, resolvedMessage].filter(Boolean);

  return {
    id: idParts.join("|"),
    kind,
    title,
    message: resolvedMessage,
    occurredAt: timestamp,
    repoPath,
    target,
    statusCode,
    stdout,
    stderr,
  };
}

export function sameOpenSpecOperationScope(
  left: OpenSpecOperationIssue,
  right: OpenSpecOperationIssue,
): boolean {
  return left.kind === right.kind && left.repoPath === right.repoPath && left.target === right.target;
}

export function isPersistableLocalRepoPath(path: string): boolean {
  const normalizedPath = path.trim();

  return (
    normalizedPath.startsWith("/") &&
    !normalizedPath.includes("://") &&
    !normalizedPath.includes("\0")
  );
}

export function normalizeRecentRepoPaths(
  value: unknown,
  limit = 5,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const paths: string[] = [];

  for (const item of value) {
    if (typeof item !== "string" || !isPersistableLocalRepoPath(item)) {
      continue;
    }

    if (!paths.includes(item)) {
      paths.push(item);
    }

    if (paths.length === limit) {
      break;
    }
  }

  return paths;
}

export function recentRepoSwitcherPaths(
  currentPath: string | null | undefined,
  recentPaths: string[],
  limit = 5,
): string[] {
  return normalizeRecentRepoPaths(
    currentPath ? [currentPath, ...recentPaths] : recentPaths,
    limit,
  );
}

export function decideRepositoryCandidateOpen({
  readable,
  hasOpenSpec,
}: RepositoryCandidateInput): RepositoryCandidateDecision {
  const promote = readable && hasOpenSpec;

  return {
    promote,
    preserveActiveWorkspace: !promote,
  };
}

export function deriveValidationTrustState(
  validation: ValidationResult | null,
  isWorking = false,
): ValidationTrustState {
  if (isWorking) {
    return {
      kind: "checking",
      label: "Checking files",
      detail: "OpenSpec Studio is updating repository data.",
      attentionKnown: false,
    };
  }

  if (!validation) {
    return {
      kind: "not-checked",
      label: "Not checked yet",
      detail: "Run validation to know whether this snapshot needs attention.",
      attentionKnown: false,
    };
  }

  if (validation.state === "stale") {
    return {
      kind: "outdated",
      label: "Check outdated",
      detail: validation.staleReason?.changedPath
        ? `Files changed after validation: ${validation.staleReason.changedPath}.`
        : "Files changed after the last validation run.",
      attentionKnown: false,
    };
  }

  if (validation.diagnostics.length > 0) {
    return {
      kind: "command-problem",
      label: "Validation problem",
      detail: validation.diagnostics[0]?.message ?? "OpenSpec validation output could not be read.",
      attentionKnown: false,
    };
  }

  if (validation.state === "pass") {
    return {
      kind: "clean",
      label: "Checked clean",
      detail: validation.validatedAt
        ? `Validated ${formatShortDateTime(validation.validatedAt)}.`
        : "Validation completed for this snapshot.",
      attentionKnown: true,
    };
  }

  return {
    kind: "needs-attention",
    label: "Needs attention",
    detail: validation.validatedAt
      ? `Validated ${formatShortDateTime(validation.validatedAt)}.`
      : "Validation found linked issues.",
    attentionKnown: true,
  };
}

function formatShortDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeOptionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function deriveRunnerDispatchEligibility({
  repoReady,
  change,
  runnerSettings,
  runnerStatus,
  sessionSecretConfigured,
}: {
  repoReady: boolean;
  change: { phase: string; buildStatus: RunnerDispatchChangeReadiness } | null;
  runnerSettings: RunnerSettings;
  runnerStatus: RunnerStatus;
  sessionSecretConfigured: boolean;
}): RunnerDispatchEligibility {
  const reasons: string[] = [];

  if (!repoReady) {
    reasons.push("Open a real OpenSpec repository.");
  }

  if (!change) {
    reasons.push("Select one active change.");
  } else {
    if (change.phase !== "active") {
      reasons.push("Build dispatch is only available for active changes.");
    }

    if (change.buildStatus.kind !== "ready") {
      const label = change.buildStatus.label ?? changeBuildStatusState(change.buildStatus.kind).label;
      reasons.push("Change Build Status must be Ready before dispatching with agent. Current status: " + label + ".");
    }
  }

  if (!runnerSettings.endpoint.trim()) {
    reasons.push("Configure Studio Runner endpoint.");
  }

  if (!sessionSecretConfigured) {
    reasons.push("Generate a Studio Runner session secret.");
  }

  if (runnerStatus.state !== "online") {
    reasons.push("Studio Runner must be online.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export function buildRunnerDispatchPayload({
  eventId,
  repo,
  change,
  validation,
  gitStatus,
}: RunnerDispatchPayloadInput): RunnerDispatchRequestInput {
  return {
    eventId,
    repoPath: repo.path,
    repoName: repo.name,
    gitRef: gitStatus?.entries?.length ? "dirty" : "local",
    changeName: change.name,
    artifactPaths: change.artifacts
      .filter((artifact) => artifact.status === "present")
      .map((artifact) => artifact.path),
    validation: {
      state: validation.state,
      checkedAt: validation.validatedAt,
      issueCount: validation.issues.length,
    },
    requestedBy: "local-user",
  };
}
