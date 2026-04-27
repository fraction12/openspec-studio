export type ValidationState = "pass" | "fail" | "stale";

export type ValidationSeverity = "error" | "warning";

export type ValidationAssociation =
  | {
      kind: "change";
      id: string;
      path?: string;
    }
  | {
      kind: "spec";
      id: string;
      path?: string;
    }
  | {
      kind: "file";
      path: string;
    };

export interface ValidationIssue {
  id: string;
  message: string;
  severity: ValidationSeverity;
  code?: string;
  path?: string;
  associations: ValidationAssociation[];
  raw: unknown;
}

export interface ValidationSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface ValidationStaleReason {
  changedPath: string;
  changedAt: string;
}

export type ValidationDiagnosticKind = "command-failure" | "parse-failure";

export interface ValidationDiagnostic {
  id: string;
  kind: ValidationDiagnosticKind;
  message: string;
  severity: "error";
  stdout?: string;
  stderr?: string;
  statusCode?: number | null;
  raw?: unknown;
}

export interface ValidationResult {
  state: ValidationState;
  validatedAt: string | null;
  summary: ValidationSummary;
  issues: ValidationIssue[];
  diagnostics: ValidationDiagnostic[];
  raw: unknown;
  previousState?: Exclude<ValidationState, "stale">;
  staleSince?: string;
  staleReason?: ValidationStaleReason;
}

export interface ParseValidationOptions {
  validatedAt?: Date | string;
  repoPath?: string;
}

export interface ValidationCommandFailureInput {
  stdout?: string;
  stderr?: string;
  statusCode?: number | null;
  message?: string;
  validatedAt?: Date | string;
  raw?: unknown;
}

export interface ValidationIssueGroups {
  changes: Record<string, string[]>;
  specs: Record<string, string[]>;
  files: Record<string, string[]>;
}

interface IssueContext {
  itemId?: string;
  itemType?: string;
  issuePath?: string;
  message?: string;
  repoPath?: string;
}

const DEFAULT_SUMMARY: ValidationSummary = {
  total: 0,
  passed: 0,
  failed: 0,
};

export function parseValidationResult(
  raw: unknown,
  options: ParseValidationOptions = {},
): ValidationResult {
  if (!isRecord(raw)) {
    return createUnrecognizedResult(raw, options);
  }

  const items = Array.isArray(raw.items) ? raw.items.filter(isRecord) : null;
  const rootValid = readBoolean(raw.valid);
  const summary = readSummary(raw);

  if (!items && !summary && rootValid === undefined) {
    return createUnrecognizedResult(raw, options);
  }

  const issues = items
    ? parseItemIssues(items, options)
    : parseRootIssues(raw, options);
  const derivedSummary =
    summary ?? deriveSummary(items, rootValid, issues.length > 0);
  const state = deriveState(derivedSummary, issues, rootValid);

  return {
    state,
    validatedAt: normalizeDate(options.validatedAt),
    summary: derivedSummary,
    issues,
    diagnostics: [],
    raw,
  };
}

export function createValidationCommandFailureResult({
  stdout = "",
  stderr = "",
  statusCode = null,
  message,
  validatedAt,
  raw,
}: ValidationCommandFailureInput): ValidationResult {
  const diagnosticMessage =
    message || stderr || stdout || "OpenSpec validation command failed.";

  return {
    state: "fail",
    validatedAt: normalizeDate(validatedAt),
    summary: {
      ...DEFAULT_SUMMARY,
      failed: 1,
    },
    issues: [],
    diagnostics: [
      {
        id: "diagnostic-1",
        kind: "command-failure",
        message: diagnosticMessage,
        severity: "error",
        stdout,
        stderr,
        statusCode,
        raw,
      },
    ],
    raw: raw ?? { stdout, stderr, statusCode },
  };
}

export function markValidationStaleAfterFileChange(
  result: ValidationResult,
  changedPath: string,
  changedAt: Date | string = new Date(),
): ValidationResult {
  const normalizedPath = normalizePath(changedPath);

  if (!isValidationRelevantPath(normalizedPath)) {
    return result;
  }

  const normalizedChangedAt = normalizeDate(changedAt) ?? new Date().toISOString();

  return {
    ...result,
    state: "stale",
    previousState:
      result.state === "stale" ? result.previousState ?? "fail" : result.state,
    staleSince: result.staleSince ?? normalizedChangedAt,
    staleReason: {
      changedPath: normalizedPath,
      changedAt: normalizedChangedAt,
    },
  };
}

export function isValidationRelevantPath(path: string): boolean {
  const normalizedPath = normalizePath(path);

  return (
    normalizedPath === "openspec" ||
    normalizedPath.startsWith("openspec/") ||
    normalizedPath.includes("/openspec/")
  );
}

export function groupValidationIssues(
  result: Pick<ValidationResult, "issues">,
): ValidationIssueGroups {
  const groups: ValidationIssueGroups = {
    changes: {},
    specs: {},
    files: {},
  };

  for (const issue of result.issues) {
    for (const association of issue.associations) {
      if (association.kind === "change") {
        appendIssueId(groups.changes, association.id, issue.id);
      } else if (association.kind === "spec") {
        appendIssueId(groups.specs, association.id, issue.id);
      } else {
        appendIssueId(groups.files, association.path, issue.id);
      }
    }
  }

  return groups;
}

function parseItemIssues(
  items: Record<string, unknown>[],
  options: ParseValidationOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const item of items) {
    const itemId = readString(item.id);
    const itemType = readString(item.type);
    const rawIssues = Array.isArray(item.issues) ? item.issues : [];

    for (const rawIssue of rawIssues) {
      issues.push(
        normalizeIssue(rawIssue, issues.length + 1, {
          itemId,
          itemType,
          repoPath: options.repoPath,
        }),
      );
    }

    if (readBoolean(item.valid) === false && rawIssues.length === 0) {
      const label = [itemType, itemId].filter(Boolean).join(" ");

      issues.push(
        normalizeIssue(
          {
            message: label
              ? `${label} failed validation.`
              : "Item failed validation.",
          },
          issues.length + 1,
          {
            itemId,
            itemType,
            repoPath: options.repoPath,
          },
        ),
      );
    }
  }

  return issues;
}

function parseRootIssues(
  raw: Record<string, unknown>,
  options: ParseValidationOptions,
): ValidationIssue[] {
  const rawIssues = Array.isArray(raw.issues) ? raw.issues : [];

  return rawIssues.map((issue, index) =>
    normalizeIssue(issue, index + 1, { repoPath: options.repoPath }),
  );
}

function normalizeIssue(
  rawIssue: unknown,
  index: number,
  context: IssueContext,
): ValidationIssue {
  const issue = isRecord(rawIssue) ? rawIssue : {};
  const message =
    readString(issue.message) ??
    readString(issue.detail) ??
    readString(issue.error) ??
    (typeof rawIssue === "string" ? rawIssue : "Validation issue.");
  const path = normalizeOptionalPath(
    readString(issue.path) ??
      readString(issue.file) ??
      readString(issue.filePath) ??
      extractOpenSpecPath(message),
    context.repoPath,
  );
  const issueContext = {
    ...context,
    issuePath: path,
    message,
  };

  return {
    id: `issue-${index}`,
    message,
    severity: normalizeSeverity(readString(issue.severity)),
    code: readString(issue.code),
    path,
    associations: inferAssociations(issueContext),
    raw: rawIssue,
  };
}

function inferAssociations(context: IssueContext): ValidationAssociation[] {
  const associations: ValidationAssociation[] = [];

  if (context.itemType === "change" && context.itemId) {
    associations.push({
      kind: "change",
      id: context.itemId,
      path: `openspec/changes/${context.itemId}`,
    });
  }

  if (context.itemType === "spec" && context.itemId) {
    associations.push({
      kind: "spec",
      id: context.itemId,
      path: context.issuePath,
    });
  }

  if (context.issuePath) {
    associations.push({
      kind: "file",
      path: context.issuePath,
    });
  }

  const changeId = context.issuePath
    ? extractChangeId(context.issuePath)
    : extractChangeId(context.message ?? "");
  const specId = context.issuePath
    ? extractSpecId(context.issuePath)
    : extractSpecId(context.message ?? "");

  if (changeId) {
    associations.push({
      kind: "change",
      id: changeId,
      path: `openspec/changes/${changeId}`,
    });
  }

  if (specId) {
    associations.push({
      kind: "spec",
      id: specId,
      path: context.issuePath,
    });
  }

  return dedupeAssociations(associations);
}

function createUnrecognizedResult(
  raw: unknown,
  options: ParseValidationOptions,
): ValidationResult {
  return {
    state: "fail",
    validatedAt: normalizeDate(options.validatedAt),
    summary: {
      ...DEFAULT_SUMMARY,
      failed: 1,
    },
    issues: [],
    diagnostics: [
      {
        id: "diagnostic-1",
        kind: "parse-failure",
        message: "Validation output was not recognized.",
        severity: "error",
        raw,
      },
    ],
    raw,
  };
}

function readSummary(raw: Record<string, unknown>): ValidationSummary | null {
  const summary = isRecord(raw.summary) ? raw.summary : null;
  const totals = summary && isRecord(summary.totals) ? summary.totals : summary;

  if (!totals) {
    return null;
  }

  const total = readNumber(totals.total) ?? readNumber(totals.items);
  const passed = readNumber(totals.passed);
  const failed = readNumber(totals.failed);

  if (total === undefined && passed === undefined && failed === undefined) {
    return null;
  }

  return {
    total: total ?? (passed ?? 0) + (failed ?? 0),
    passed: passed ?? 0,
    failed: failed ?? 0,
  };
}

function deriveSummary(
  items: Record<string, unknown>[] | null,
  rootValid: boolean | undefined,
  hasIssues: boolean,
): ValidationSummary {
  if (!items) {
    if (rootValid === true) {
      return { total: 1, passed: 1, failed: 0 };
    }

    return { total: 1, passed: 0, failed: rootValid === false || hasIssues ? 1 : 0 };
  }

  let passed = 0;
  let failed = 0;

  for (const item of items) {
    const valid = readBoolean(item.valid);

    if (valid === true) {
      passed += 1;
    } else if (valid === false) {
      failed += 1;
    }
  }

  return {
    total: items.length,
    passed,
    failed,
  };
}

function deriveState(
  summary: ValidationSummary,
  issues: ValidationIssue[],
  rootValid: boolean | undefined,
): Exclude<ValidationState, "stale"> {
  if (rootValid === false || summary.failed > 0) {
    return "fail";
  }

  return issues.some((issue) => issue.severity === "error") ? "fail" : "pass";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeSeverity(value: string | undefined): ValidationSeverity {
  return value === "warning" ? "warning" : "error";
}

function normalizeDate(value: Date | string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

function normalizeOptionalPath(
  value: string | undefined,
  repoPath?: string,
): string | undefined {
  return value ? normalizePath(value, repoPath) : undefined;
}

function normalizePath(path: string, repoPath?: string): string {
  const normalizedRepoPath = repoPath
    ? repoPath.replace(/\\/g, "/").replace(/\/+$/, "")
    : undefined;
  const normalizedPath = path.replace(/\\/g, "/");
  const repoRelativePath =
    normalizedRepoPath && normalizedPath.startsWith(`${normalizedRepoPath}/`)
      ? normalizedPath.slice(normalizedRepoPath.length + 1)
      : normalizedPath;

  return repoRelativePath.replace(/^\.\//, "");
}

function extractOpenSpecPath(value: string): string | undefined {
  return value.match(/(?:^|\s)(openspec\/[^\s),]+)(?:[\s),]|$)/)?.[1];
}

function extractChangeId(value: string): string | undefined {
  return value.match(/(?:^|\/)openspec\/changes\/(?!archive\/)([^/\s]+)/)?.[1];
}

function extractSpecId(value: string): string | undefined {
  return value.match(
    /(?:^|\/)openspec\/(?:changes\/[^/]+\/)?specs\/(.+?)\/spec\.md/,
  )?.[1];
}

function dedupeAssociations(
  associations: ValidationAssociation[],
): ValidationAssociation[] {
  const seen = new Set<string>();
  const deduped: ValidationAssociation[] = [];

  for (const association of associations) {
    const key =
      association.kind === "file"
        ? `${association.kind}:${association.path}`
        : `${association.kind}:${association.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(association);
    }
  }

  return deduped;
}

function appendIssueId(
  group: Record<string, string[]>,
  key: string,
  issueId: string,
): void {
  group[key] ??= [];

  if (!group[key].includes(issueId)) {
    group[key].push(issueId);
  }
}
