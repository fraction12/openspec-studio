import type {
  IndexedWorkflowStatusValue,
  VirtualOpenSpecChangeStatusRecord,
  VirtualOpenSpecFileRecord,
} from "./domain/openspecIndex";
import type { ValidationResult } from "./validation/results";

export interface BridgeFileRecord {
  path: string;
  kind?: "file" | "directory";
  modified_time_ms?: number;
  modifiedTimeMs?: number;
  content?: string;
}

export interface OpenSpecFileSignature {
  fingerprint: string;
  latestPath: string | null;
  latestModifiedTimeMs: number | null;
}

export type ChangeHealth = "valid" | "stale" | "invalid" | "missing" | "blocked" | "ready";

export interface ChangeHealthInput {
  workflowStatus: IndexedWorkflowStatusValue;
  missingArtifactCount: number;
  validation: ValidationResult | null;
  validationIssueCount: number;
}

export function toVirtualFileRecords(
  records: BridgeFileRecord[],
): VirtualOpenSpecFileRecord[] {
  return records.map((record) => ({
    path: record.path,
    kind: record.kind ?? "file",
    modifiedTimeMs: record.modified_time_ms ?? record.modifiedTimeMs,
    content: record.content,
  }));
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
    .map((record) => {
      const modifiedTimeMs = record.modifiedTimeMs ?? 0;

      if (record.kind !== "directory" && modifiedTimeMs > (latestModifiedTimeMs ?? 0)) {
        latestPath = record.path;
        latestModifiedTimeMs = modifiedTimeMs;
      }

      return `${record.path}:${record.kind ?? "file"}:${modifiedTimeMs}`;
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
  if (validationIssueCount > 0 || workflowStatus === "error") {
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

  return validation.state === "pass" ? "valid" : "stale";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
