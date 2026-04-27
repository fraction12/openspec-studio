export interface VirtualOpenSpecFileRecord {
  path: string;
  kind?: "file" | "directory";
  modifiedTimeMs?: number;
  content?: string;
}

export interface VirtualOpenSpecChangeStatusRecord {
  changeName: string;
  schemaName?: string;
  isComplete?: boolean;
  artifacts?: VirtualOpenSpecArtifactStatusRecord[];
  error?: string;
}

export interface VirtualOpenSpecArtifactStatusRecord {
  id: string;
  status: string;
  dependencies?: string[];
}

export type OpenSpecTraceSource =
  | "file-tree"
  | "markdown"
  | "file-record"
  | "cli-status"
  | "not-provided";

export interface OpenSpecSourceTrace {
  source: OpenSpecTraceSource;
  path?: string;
  changeName?: string;
}

export interface IndexedOpenSpecWorkspace {
  activeChanges: IndexedActiveChange[];
  archivedChanges: IndexedArchivedChange[];
  specs: IndexedSpec[];
}

export interface IndexedActiveChange {
  name: string;
  path: string;
  state: "active";
  artifacts: IndexedChangeArtifacts;
  touchedCapabilities: IndexedTouchedCapability[];
  taskProgress: IndexedTaskProgress;
  workflowStatus: IndexedWorkflowStatus;
  sourceTrace: OpenSpecSourceTrace;
  modifiedTimeMs?: number;
  modifiedTimeTrace?: OpenSpecSourceTrace;
}

export interface IndexedArchivedChange {
  name: string;
  path: string;
  state: "archived";
  sourceTrace: OpenSpecSourceTrace;
  modifiedTimeMs?: number;
  modifiedTimeTrace?: OpenSpecSourceTrace;
}

export interface IndexedSpec {
  capability: string;
  path: string;
  sourceTrace: OpenSpecSourceTrace;
  modifiedTimeMs?: number;
  modifiedTimeTrace?: OpenSpecSourceTrace;
}

export interface IndexedChangeArtifacts {
  proposal: IndexedRequiredChangeArtifact;
  design: IndexedRequiredChangeArtifact;
  tasks: IndexedRequiredChangeArtifact;
  deltaSpecs: IndexedDeltaSpecArtifact[];
}

export interface IndexedRequiredChangeArtifact {
  kind: "proposal" | "design" | "tasks";
  exists: boolean;
  path: string;
  sourceTrace: OpenSpecSourceTrace;
  modifiedTimeMs?: number;
  modifiedTimeTrace?: OpenSpecSourceTrace;
  workflowStatus?: string;
  workflowDependencies?: string[];
}

export interface IndexedDeltaSpecArtifact {
  kind: "delta-spec";
  capability: string;
  exists: true;
  path: string;
  sourceTrace: OpenSpecSourceTrace;
  modifiedTimeMs?: number;
  modifiedTimeTrace?: OpenSpecSourceTrace;
}

export interface IndexedTouchedCapability {
  capability: string;
  sourceTrace: OpenSpecSourceTrace;
}

export type IndexedTaskProgress =
  | {
      available: true;
      completed: number;
      total: number;
      sourceTrace: OpenSpecSourceTrace;
    }
  | {
      available: false;
      completed: 0;
      total: 0;
      sourceTrace: OpenSpecSourceTrace;
    };

export type IndexedWorkflowStatusValue =
  | "unknown"
  | "ready"
  | "blocked"
  | "complete"
  | "in-progress"
  | "error";

export interface IndexedWorkflowStatus {
  status: IndexedWorkflowStatusValue;
  sourceTrace: OpenSpecSourceTrace;
  schemaName?: string;
  error?: string;
}

interface NormalizedOpenSpecFileRecord extends VirtualOpenSpecFileRecord {
  path: string;
  kind: "file" | "directory";
}

interface ModifiedTimeSummary {
  modifiedTimeMs: number;
  modifiedTimeTrace: OpenSpecSourceTrace;
}

export function indexOpenSpecWorkspace(snapshot: {
  files: VirtualOpenSpecFileRecord[];
  changeStatuses?: VirtualOpenSpecChangeStatusRecord[];
}): IndexedOpenSpecWorkspace {
  const files = normalizeFileRecords(snapshot.files);
  const fileByPath = new Map(
    files
      .filter((file) => file.kind === "file")
      .map((file) => [file.path, file] as const),
  );
  const statusByChange = new Map(
    (snapshot.changeStatuses ?? []).map((status) => [
      status.changeName,
      status,
    ]),
  );
  const activeChangeNames = new Set<string>();
  const archivedChangeNames = new Set<string>();

  for (const file of files) {
    const parts = file.path.split("/");

    if (parts[0] !== "openspec" || parts[1] !== "changes") {
      continue;
    }

    if (parts[2] === "archive") {
      if (parts[3]) {
        archivedChangeNames.add(parts[3]);
      }
      continue;
    }

    if (parts[2]) {
      activeChangeNames.add(parts[2]);
    }
  }

  return {
    activeChanges: Array.from(activeChangeNames)
      .sort(compareStrings)
      .map((name) => buildActiveChange(name, files, fileByPath, statusByChange)),
    archivedChanges: Array.from(archivedChangeNames)
      .sort(compareStrings)
      .map((name) => buildArchivedChange(name, files)),
    specs: buildSpecs(fileByPath),
  };
}

function normalizeFileRecords(
  records: VirtualOpenSpecFileRecord[],
): NormalizedOpenSpecFileRecord[] {
  return records
    .map((record) => ({
      ...record,
      path: normalizePath(record.path),
      kind: record.kind ?? "file",
    }))
    .filter((record) => record.path.length > 0)
    .sort((left, right) => compareStrings(left.path, right.path));
}

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

function buildActiveChange(
  name: string,
  files: NormalizedOpenSpecFileRecord[],
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
  statusByChange: Map<string, VirtualOpenSpecChangeStatusRecord>,
): IndexedActiveChange {
  const path = `openspec/changes/${name}`;
  const status = statusByChange.get(name);
  const artifactStatuses = new Map(
    (status?.artifacts ?? []).map((artifact) => [artifact.id, artifact]),
  );
  const modifiedTime = getModifiedTimeForPrefix(files, `${path}/`);
  const artifacts: IndexedChangeArtifacts = {
    proposal: buildRequiredArtifact(
      "proposal",
      `${path}/proposal.md`,
      fileByPath,
      artifactStatuses.get("proposal"),
    ),
    design: buildRequiredArtifact(
      "design",
      `${path}/design.md`,
      fileByPath,
      artifactStatuses.get("design"),
    ),
    tasks: buildRequiredArtifact(
      "tasks",
      `${path}/tasks.md`,
      fileByPath,
      artifactStatuses.get("tasks"),
    ),
    deltaSpecs: buildDeltaSpecs(path, fileByPath),
  };
  const change: IndexedActiveChange = {
    name,
    path,
    state: "active",
    artifacts,
    touchedCapabilities: artifacts.deltaSpecs.map((spec) => ({
      capability: spec.capability,
      sourceTrace: fileTreeTrace(spec.path),
    })),
    taskProgress: buildTaskProgress(artifacts.tasks.path, fileByPath),
    workflowStatus: buildWorkflowStatus(name, status),
    sourceTrace: fileTreeTrace(path),
  };

  if (modifiedTime) {
    change.modifiedTimeMs = modifiedTime.modifiedTimeMs;
    change.modifiedTimeTrace = modifiedTime.modifiedTimeTrace;
  }

  return change;
}

function buildArchivedChange(
  name: string,
  files: NormalizedOpenSpecFileRecord[],
): IndexedArchivedChange {
  const path = `openspec/changes/archive/${name}`;
  const modifiedTime = getModifiedTimeForPrefix(files, `${path}/`);
  const change: IndexedArchivedChange = {
    name,
    path,
    state: "archived",
    sourceTrace: fileTreeTrace(path),
  };

  if (modifiedTime) {
    change.modifiedTimeMs = modifiedTime.modifiedTimeMs;
    change.modifiedTimeTrace = modifiedTime.modifiedTimeTrace;
  }

  return change;
}

function buildSpecs(
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
): IndexedSpec[] {
  const specs: IndexedSpec[] = [];

  for (const [path, file] of fileByPath) {
    const capability = extractCapability(path, "openspec/specs/");

    if (!capability) {
      continue;
    }

    const spec: IndexedSpec = {
      capability,
      path,
      sourceTrace: fileTreeTrace(path),
    };

    if (file.modifiedTimeMs !== undefined) {
      spec.modifiedTimeMs = file.modifiedTimeMs;
      spec.modifiedTimeTrace = fileRecordTrace(path);
    }

    specs.push(spec);
  }

  return specs.sort((left, right) =>
    compareStrings(left.capability, right.capability),
  );
}

function buildRequiredArtifact(
  kind: IndexedRequiredChangeArtifact["kind"],
  path: string,
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
  workflowStatus?: VirtualOpenSpecArtifactStatusRecord,
): IndexedRequiredChangeArtifact {
  const file = fileByPath.get(path);
  const artifact: IndexedRequiredChangeArtifact = {
    kind,
    exists: Boolean(file),
    path,
    sourceTrace: fileTreeTrace(path),
  };

  if (file?.modifiedTimeMs !== undefined) {
    artifact.modifiedTimeMs = file.modifiedTimeMs;
    artifact.modifiedTimeTrace = fileRecordTrace(path);
  }

  if (workflowStatus) {
    artifact.workflowStatus = workflowStatus.status;

    if (workflowStatus.dependencies && workflowStatus.dependencies.length > 0) {
      artifact.workflowDependencies = [...workflowStatus.dependencies];
    }
  }

  return artifact;
}

function buildDeltaSpecs(
  changePath: string,
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
): IndexedDeltaSpecArtifact[] {
  const prefix = `${changePath}/specs/`;
  const specs: IndexedDeltaSpecArtifact[] = [];

  for (const [path, file] of fileByPath) {
    const capability = extractCapability(path, prefix);

    if (!capability) {
      continue;
    }

    const spec: IndexedDeltaSpecArtifact = {
      kind: "delta-spec",
      capability,
      exists: true,
      path,
      sourceTrace: fileTreeTrace(path),
    };

    if (file.modifiedTimeMs !== undefined) {
      spec.modifiedTimeMs = file.modifiedTimeMs;
      spec.modifiedTimeTrace = fileRecordTrace(path);
    }

    specs.push(spec);
  }

  return specs.sort((left, right) =>
    compareStrings(left.capability, right.capability),
  );
}

function extractCapability(path: string, prefix: string): string | undefined {
  if (!path.startsWith(prefix) || !path.endsWith("/spec.md")) {
    return undefined;
  }

  const capability = path.slice(prefix.length, -"/spec.md".length);
  return capability.length > 0 ? capability : undefined;
}

function buildTaskProgress(
  taskPath: string,
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
): IndexedTaskProgress {
  const taskFile = fileByPath.get(taskPath);

  if (!taskFile) {
    return {
      available: false,
      completed: 0,
      total: 0,
      sourceTrace: fileTreeTrace(taskPath),
    };
  }

  const lines = (taskFile.content ?? "").split(/\r?\n/);
  const checkboxPattern = /^\s*[-*+]\s+\[([ xX])\]\s+/;
  let completed = 0;
  let total = 0;

  for (const line of lines) {
    const match = checkboxPattern.exec(line);

    if (!match) {
      continue;
    }

    total += 1;

    if (match[1]?.toLowerCase() === "x") {
      completed += 1;
    }
  }

  return {
    available: true,
    completed,
    total,
    sourceTrace: {
      source: "markdown",
      path: taskPath,
    },
  };
}

function buildWorkflowStatus(
  changeName: string,
  status?: VirtualOpenSpecChangeStatusRecord,
): IndexedWorkflowStatus {
  if (!status) {
    return {
      status: "unknown",
      sourceTrace: {
        source: "not-provided",
        changeName,
      },
    };
  }

  const workflowStatus: IndexedWorkflowStatus = {
    status: deriveWorkflowStatus(status),
    sourceTrace: {
      source: "cli-status",
      changeName,
    },
  };

  if (status.schemaName) {
    workflowStatus.schemaName = status.schemaName;
  }

  if (status.error) {
    workflowStatus.error = status.error;
  }

  return workflowStatus;
}

function deriveWorkflowStatus(
  status: VirtualOpenSpecChangeStatusRecord,
): IndexedWorkflowStatusValue {
  if (status.error) {
    return "error";
  }

  if (status.isComplete === true) {
    return "complete";
  }

  const artifactStatuses = (status.artifacts ?? []).map((artifact) =>
    artifact.status.toLowerCase(),
  );

  if (artifactStatuses.includes("blocked")) {
    return "blocked";
  }

  if (artifactStatuses.includes("ready")) {
    return "ready";
  }

  if (
    artifactStatuses.length > 0 &&
    artifactStatuses.every((artifactStatus) => artifactStatus === "done")
  ) {
    return "complete";
  }

  return artifactStatuses.length > 0 ? "in-progress" : "unknown";
}

function getModifiedTimeForPrefix(
  files: NormalizedOpenSpecFileRecord[],
  prefix: string,
): ModifiedTimeSummary | undefined {
  let latest: ModifiedTimeSummary | undefined;

  for (const file of files) {
    if (!file.path.startsWith(prefix) || file.modifiedTimeMs === undefined) {
      continue;
    }

    if (!latest || file.modifiedTimeMs > latest.modifiedTimeMs) {
      latest = {
        modifiedTimeMs: file.modifiedTimeMs,
        modifiedTimeTrace: fileRecordTrace(file.path),
      };
    }
  }

  return latest;
}

function fileTreeTrace(path: string): OpenSpecSourceTrace {
  return {
    source: "file-tree",
    path,
  };
}

function fileRecordTrace(path: string): OpenSpecSourceTrace {
  return {
    source: "file-record",
    path,
  };
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}
