import {
  buildOpenSpecFileSignature,
  buildVirtualFilesByPath,
  deriveChangeBuildStatus,
  deriveChangeHealth,
  type ChangeBuildStatusState,
  type ChangeHealth,
  type OpenSpecFileSignature,
} from "../appModel";
import {
  type IndexedActiveChange,
  type IndexedArchivedChange,
  type IndexedOpenSpecWorkspace,
  type IndexedSpec,
  type IndexedTaskProgress,
  type VirtualOpenSpecChangeStatusRecord,
  type VirtualOpenSpecFileRecord,
} from "./openspecIndex";
import type { ProviderCapabilities } from "../providers/types";
import type { ValidationIssue, ValidationResult } from "../validation/results";

export type ChangePhase = "active" | "archive-ready" | "archived";
export type DetailTab = "proposal" | "design" | "tasks" | "spec-delta" | "status" | "archive-info";
export type Health = ChangeHealth;
export type ArtifactStatus = "present" | "missing" | "blocked";

export interface Artifact {
  id: string;
  label: string;
  path: string;
  status: ArtifactStatus;
  note: string;
}

export interface TaskItem {
  label: string;
  done: boolean;
}

export interface TaskGroup {
  title: string;
  items: TaskItem[];
}

export interface TaskProgress {
  done: number;
  total: number;
  content: string | undefined;
}

export interface ChangeRecord {
  id: string;
  name: string;
  title: string;
  phase: ChangePhase;
  health: Health;
  statusLabel: string;
  buildStatus: ChangeBuildStatusState;
  summary: string;
  capabilities: string[];
  updatedAt: string;
  modifiedTimeMs: number | null;
  taskProgress: TaskProgress | null;
  artifacts: Artifact[];
  deltaSpecs: string[];
  validationIssues: ValidationIssue[];
  archiveInfo?: ArchiveInfo;
  archiveReadiness: {
    ready: boolean;
    reasons: string[];
  };
  searchText: string;
}

export interface ArchiveInfo {
  path: string;
  archivedDate: string | null;
  originalName: string | null;
  files: Artifact[];
}

export interface SpecRecord {
  id: string;
  capability: string;
  path: string;
  health: Health;
  requirements: number;
  updatedAt: string;
  modifiedTimeMs: number | null;
  summary: string;
  summaryQuality: "available" | "missing";
  validationIssues: ValidationIssue[];
  requirementsPreview: string[];
  sourceContent: string;
  searchText: string;
}

export interface WorkspaceView {
  providerId?: string;
  providerLabel?: string;
  providerCapabilities?: ProviderCapabilities;
  changes: ChangeRecord[];
  specs: SpecRecord[];
  filesByPath: Record<string, VirtualOpenSpecFileRecord>;
  fileSignature: OpenSpecFileSignature;
  changeStatuses: VirtualOpenSpecChangeStatusRecord[];
  validation: ValidationResult | null;
}

interface ValidationIssueMaps {
  byChange: Map<string, ValidationIssue[]>;
  bySpec: Map<string, ValidationIssue[]>;
}

const healthLabels: Record<Health, string> = {
  valid: "Checked",
  stale: "Check needed",
  invalid: "Needs attention",
  missing: "Incomplete",
  blocked: "Blocked",
  ready: "Ready",
};

const activeDetailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "proposal", label: "Proposal" },
  { id: "design", label: "Design" },
  { id: "tasks", label: "Tasks" },
  { id: "spec-delta", label: "Spec changes" },
  { id: "status", label: "Checks" },
];

const archiveInfoTab: { id: DetailTab; label: string } = {
  id: "archive-info",
  label: "Archive info",
};

export function buildWorkspaceView(
  indexed: IndexedOpenSpecWorkspace,
  files: VirtualOpenSpecFileRecord[],
  validation: ValidationResult | null,
  changeStatuses: VirtualOpenSpecChangeStatusRecord[],
  fileSignature = buildOpenSpecFileSignature(files),
): WorkspaceView {
  const filesByPath = buildVirtualFilesByPath(files);
  const validationIssueMaps = buildValidationIssueMaps(validation);
  const changes: ChangeRecord[] = [
    ...indexed.activeChanges.map((change) =>
      activeChangeToView(change, filesByPath, validation, validationIssueMaps),
    ),
    ...indexed.archivedChanges.map((change) => archivedChangeToView(change, filesByPath)),
  ];

  return {
    changes,
    specs: indexed.specs.map((spec) => specToView(spec, filesByPath, validation, validationIssueMaps)),
    filesByPath,
    fileSignature,
    changeStatuses,
    validation,
  };
}

export function clearWorkspaceValidationState(workspace: WorkspaceView): WorkspaceView {
  return {
    ...workspace,
    validation: null,
    changes: workspace.changes.map(clearChangeValidationState),
    specs: workspace.specs.map((spec) => ({
      ...spec,
      health: "stale",
      validationIssues: [],
    })),
  };
}

function clearChangeValidationState(change: ChangeRecord): ChangeRecord {
  if (change.phase === "archived") {
    return {
      ...change,
      validationIssues: [],
    };
  }

  const health =
    change.health === "blocked" || change.health === "missing" ? change.health : "stale";
  const buildStatus = deriveChangeBuildStatus({
    phase: change.phase,
    taskProgress: change.taskProgress,
    validation: null,
    validationIssueCount: 0,
  });

  return {
    ...change,
    health,
    statusLabel: healthLabels[health],
    buildStatus,
    validationIssues: [],
  };
}

function activeChangeToView(
  change: IndexedActiveChange,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
  validation: ValidationResult | null,
  validationIssueMaps: ValidationIssueMaps,
): ChangeRecord {
  const artifacts: Artifact[] = [
    requiredArtifact("proposal", "Proposal", change.artifacts.proposal),
    requiredArtifact("design", "Design", change.artifacts.design),
    requiredArtifact("tasks", "Tasks", change.artifacts.tasks),
    ...change.artifacts.deltaSpecs.map((spec) => ({
      id: "delta-" + spec.capability,
      label: spec.capability,
      path: spec.path,
      status: "present" as const,
      note: "Delta spec",
    })),
  ];
  const taskProgress = taskProgressToView(change.taskProgress, filesByPath[change.artifacts.tasks.path]?.content);
  const validationIssues = validationIssueMaps.byChange.get(change.name) ?? [];
  const blockingValidationIssues = validationIssues.filter(isBlockingValidationIssue);
  const missingArtifacts = artifacts.filter((artifact) => artifact.status === "missing");
  const health = deriveChangeHealth({
    workflowStatus: change.workflowStatus.status,
    missingArtifactCount: missingArtifacts.length,
    validation,
    validationIssueCount: blockingValidationIssues.length,
  });
  const archiveReady = Boolean(
    taskProgress &&
      taskProgress.total > 0 &&
      taskProgress.done === taskProgress.total,
  );
  const phase: ChangePhase = archiveReady ? "archive-ready" : "active";
  const buildStatus = deriveChangeBuildStatus({
    phase,
    taskProgress,
    validation,
    validationIssueCount: blockingValidationIssues.length,
  });

  const record: ChangeRecord = {
    id: change.name,
    name: change.name,
    title: titleize(change.name),
    phase,
    health,
    statusLabel: healthLabels[health],
    buildStatus,
    summary: summaryFromContent(filesByPath[change.artifacts.proposal.path]?.content) ?? "OpenSpec change",
    capabilities: change.touchedCapabilities.map((capability) => capability.capability),
    updatedAt: formatTime(change.modifiedTimeMs),
    modifiedTimeMs: change.modifiedTimeMs ?? null,
    taskProgress,
    artifacts,
    deltaSpecs: change.artifacts.deltaSpecs.map((spec) => spec.path),
    validationIssues,
    archiveReadiness: {
      ready: archiveReady,
      reasons: archiveReady
        ? ["All tasks are complete. Archive will run validation before changing files."]
        : readinessReasons(taskProgress),
    },
    searchText: "",
  };
  record.searchText = searchableText([
    record.title,
    record.name,
    ...record.capabilities,
  ]);

  return record;
}

export function archivedChangeToView(
  change: IndexedArchivedChange,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
): ChangeRecord {
  const requiredArtifacts = [
    requiredArtifact("proposal", "Proposal", change.artifacts.proposal),
    requiredArtifact("design", "Design", change.artifacts.design),
    requiredArtifact("tasks", "Tasks", change.artifacts.tasks),
  ].filter((artifact) => artifact.status === "present");
  const deltaArtifacts = change.artifacts.deltaSpecs.map((spec) => ({
    id: "delta-" + spec.capability,
    label: spec.capability,
    path: spec.path,
    status: "present" as const,
    note: "Archived delta spec",
  }));
  const artifacts = [...requiredArtifacts, ...deltaArtifacts];

  const record: ChangeRecord = {
    id: change.name,
    name: change.name,
    title: titleize(change.name),
    phase: "archived",
    health: "valid",
    statusLabel: "Archived",
    buildStatus: deriveChangeBuildStatus({
      phase: "archive-ready",
      taskProgress: null,
      validation: null,
      validationIssueCount: 0,
    }),
    summary: summaryFromContent(filesByPath[change.artifacts.proposal.path]?.content) ?? "Archived OpenSpec change",
    capabilities: change.touchedCapabilities.map((capability) => capability.capability),
    updatedAt: formatTime(change.modifiedTimeMs),
    modifiedTimeMs: change.modifiedTimeMs ?? null,
    taskProgress: taskProgressToView(change.taskProgress, filesByPath[change.artifacts.tasks.path]?.content),
    artifacts,
    deltaSpecs: change.artifacts.deltaSpecs.map((spec) => spec.path),
    validationIssues: [],
    archiveInfo: {
      path: change.path,
      archivedDate: change.archiveMetadata.archivedDate ?? null,
      originalName: change.archiveMetadata.originalName ?? null,
      files: artifacts,
    },
    archiveReadiness: {
      ready: true,
      reasons: ["Archived."],
    },
    searchText: "",
  };
  record.searchText = searchableText([
    record.title,
    record.name,
    ...record.capabilities,
  ]);

  return record;
}

export function detailTabsForChange(change: ChangeRecord): Array<{ id: DetailTab; label: string }> {
  if (change.phase !== "archived") {
    return activeDetailTabs;
  }

  const tabs = activeDetailTabs.filter((tab) => {
    if (tab.id === "spec-delta") {
      return change.deltaSpecs.length > 0;
    }

    if (tab.id === "status") {
      return false;
    }

    return change.artifacts.some((artifact) => artifact.id === tab.id && artifact.status === "present");
  });

  return [...tabs, archiveInfoTab];
}

export function artifactPathForTab(change: ChangeRecord | null, tab: DetailTab): string | undefined {
  if (!change) {
    return undefined;
  }

  if (tab === "proposal") {
    return change.artifacts.find((artifact) => artifact.id === "proposal" && artifact.status === "present")?.path;
  }

  if (tab === "design") {
    return change.artifacts.find((artifact) => artifact.id === "design" && artifact.status === "present")?.path;
  }

  return undefined;
}

function specToView(
  spec: IndexedSpec,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
  validation: ValidationResult | null,
  validationIssueMaps: ValidationIssueMaps,
): SpecRecord {
  const issues = validationIssueMaps.bySpec.get(spec.capability) ?? [];
  const content = filesByPath[spec.path]?.content;
  const summary = summaryFromContent(content);

  const record: SpecRecord = {
    id: spec.capability,
    capability: spec.capability,
    path: spec.path,
    health: specHealthFromValidation(validation, issues),
    requirements: countRequirements(content),
    updatedAt: formatTime(spec.modifiedTimeMs),
    modifiedTimeMs: spec.modifiedTimeMs ?? null,
    summary: summary ?? "",
    summaryQuality: summary ? "available" : "missing",
    validationIssues: issues,
    requirementsPreview: extractRequirementTitles(content, 6),
    sourceContent: content ?? "",
    searchText: "",
  };
  record.searchText = searchableText([record.capability, record.summary]);

  return record;
}

function requiredArtifact(
  id: string,
  label: string,
  artifact: { exists: boolean; path: string; workflowStatus?: string },
): Artifact {
  return {
    id,
    label,
    path: artifact.path,
    status: artifact.exists ? workflowArtifactStatus(artifact.workflowStatus) : "missing",
    note:
      artifact.workflowStatus && artifact.workflowStatus !== "done"
        ? "Progress: " + artifact.workflowStatus
        : artifact.exists
          ? ""
          : "Missing",
  };
}

function workflowArtifactStatus(status: string | undefined): ArtifactStatus {
  if (status === "blocked") {
    return "blocked";
  }

  return "present";
}

function taskProgressToView(
  progress: IndexedTaskProgress,
  content: string | undefined,
): TaskProgress | null {
  if (!progress.available) {
    return null;
  }

  return {
    done: progress.completed,
    total: progress.total,
    content,
  };
}

function buildValidationIssueMaps(validation: ValidationResult | null): ValidationIssueMaps {
  const byChange = new Map<string, ValidationIssue[]>();
  const bySpec = new Map<string, ValidationIssue[]>();

  for (const issue of validation?.issues ?? []) {
    for (const association of issue.associations) {
      if (association.kind === "change") {
        const current = byChange.get(association.id);
        if (current) {
          current.push(issue);
        } else {
          byChange.set(association.id, [issue]);
        }
        continue;
      }

      if (association.kind === "spec") {
        const current = bySpec.get(association.id);
        if (current) {
          current.push(issue);
        } else {
          bySpec.set(association.id, [issue]);
        }
      }
    }
  }

  return { byChange, bySpec };
}

export function matchesChangeFilters(change: ChangeRecord, phase: ChangePhase, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    change.phase === phase &&
    (normalizedQuery.length === 0 ||
      change.searchText.includes(normalizedQuery))
  );
}

function searchableText(parts: string[]): string {
  return parts
    .filter((part) => part.length > 0)
    .join("\n")
    .toLowerCase();
}

export function matchesSpecFilters(spec: SpecRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    normalizedQuery.length === 0 ||
    spec.searchText.includes(normalizedQuery)
  );
}

function isBlockingValidationIssue(issue: ValidationIssue): boolean {
  return issue.severity === "error";
}

function specHealthFromValidation(
  validation: ValidationResult | null,
  issues: ValidationIssue[],
): Health {
  if (!validation || validation.state === "stale") {
    return "stale";
  }

  if (
    validation.diagnostics.length > 0 ||
    validation.state === "fail" ||
    issues.some(isBlockingValidationIssue)
  ) {
    return "invalid";
  }

  return "valid";
}

export function specValidationLabel(health: Health): string {
  if (health === "valid") {
    return "Valid";
  }

  if (health === "invalid") {
    return "Invalid";
  }

  return "Validate";
}

function readinessReasons(taskProgress: TaskProgress | null): string[] {
  const reasons: string[] = [];

  if (!taskProgress) {
    reasons.push("Task progress is unavailable.");
  } else if (taskProgress.done < taskProgress.total) {
    reasons.push(taskProgress.total - taskProgress.done + " tasks remain open.");
  }

  return reasons.length > 0 ? reasons : ["Complete all tasks to make this change archive-ready."];
}

export function artifactHealth(status: ArtifactStatus): Health {
  if (status === "present") {
    return "valid";
  }

  return status === "blocked" ? "blocked" : "missing";
}

function countRequirements(content: string | undefined): number {
  return (content?.match(/^### Requirement:/gm) ?? []).length;
}

function summaryFromContent(content: string | undefined): string | undefined {
  const line = content
    ?.split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0 && !candidate.startsWith("#") && !candidate.startsWith("-"));

  if (!line || isPlaceholderSummary(line)) {
    return undefined;
  }

  return line;
}

function extractRequirementTitles(content: string | undefined, limit: number): string[] {
  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => /^### Requirement:\s*(.+)$/.exec(line.trim())?.[1])
    .filter((line): line is string => Boolean(line))
    .slice(0, limit);
}

function isPlaceholderSummary(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === "tbd" ||
    normalized.startsWith("tbd ") ||
    normalized.startsWith("tbd-") ||
    normalized === "todo" ||
    normalized === "n/a" ||
    normalized.includes("placeholder") ||
    normalized.includes("to be defined")
  );
}

function titleize(value: string): string {
  return value
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatTime(modifiedTimeMs: number | undefined): string {
  if (!modifiedTimeMs) {
    return "Unknown";
  }

  const date = new Date(modifiedTimeMs);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return month + "/" + day + "/" + year + " @ " + hours + ":" + minutes;
}
