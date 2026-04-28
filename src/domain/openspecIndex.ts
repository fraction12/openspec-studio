export interface VirtualOpenSpecFileRecord {
  path: string;
  kind?: "file" | "directory";
  modifiedTimeMs?: number;
  fileSize?: number;
  content?: string;
  readError?: string;
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
  artifacts: IndexedChangeArtifacts;
  touchedCapabilities: IndexedTouchedCapability[];
  taskProgress: IndexedTaskProgress;
  archiveMetadata: IndexedArchiveMetadata;
  sourceTrace: OpenSpecSourceTrace;
  modifiedTimeMs?: number;
  modifiedTimeTrace?: OpenSpecSourceTrace;
}

export interface IndexedArchiveMetadata {
  archivedDate?: string;
  originalName?: string;
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

interface OpenSpecFileBuckets {
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>;
  activeChanges: Map<string, ChangeFileBucket>;
  archivedChanges: Map<string, ChangeFileBucket>;
  specs: IndexedSpec[];
}

interface ChangeFileBucket {
  name: string;
  path: string;
  modifiedTime?: ModifiedTimeSummary;
  deltaSpecsByPath: Map<string, IndexedDeltaSpecArtifact>;
}

export function indexOpenSpecWorkspace(snapshot: {
  files: VirtualOpenSpecFileRecord[];
  changeStatuses?: VirtualOpenSpecChangeStatusRecord[];
}): IndexedOpenSpecWorkspace {
  const files = normalizeFileRecords(snapshot.files);
  const buckets = buildOpenSpecFileBuckets(files);
  const statusByChange = new Map(
    (snapshot.changeStatuses ?? []).map((status) => [
      status.changeName,
      status,
    ]),
  );

  return {
    activeChanges: Array.from(buckets.activeChanges.values())
      .sort(compareBucketsByName)
      .map((bucket) =>
        buildActiveChange(bucket, buckets.fileByPath, statusByChange),
      ),
    archivedChanges: Array.from(buckets.archivedChanges.values())
      .sort(compareBucketsByName)
      .map((bucket) => buildArchivedChange(bucket, buckets.fileByPath)),
    specs: buckets.specs,
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

function buildOpenSpecFileBuckets(
  files: NormalizedOpenSpecFileRecord[],
): OpenSpecFileBuckets {
  const fileByPath = new Map<string, NormalizedOpenSpecFileRecord>();
  const activeChanges = new Map<string, ChangeFileBucket>();
  const archivedChanges = new Map<string, ChangeFileBucket>();
  const specsByPath = new Map<string, IndexedSpec>();

  for (const file of files) {
    if (file.kind === "file") {
      fileByPath.set(file.path, file);
      addRootSpec(specsByPath, file);
    }

    const changeBucket = getChangeFileBucket(
      file,
      activeChanges,
      archivedChanges,
    );

    if (!changeBucket) {
      continue;
    }

    addModifiedTime(changeBucket, file);

    if (file.kind === "file") {
      addDeltaSpec(changeBucket, file);
    }
  }

  return {
    fileByPath,
    activeChanges,
    archivedChanges,
    specs: Array.from(specsByPath.values()).sort(compareSpecsByCapability),
  };
}

function getChangeFileBucket(
  file: NormalizedOpenSpecFileRecord,
  activeChanges: Map<string, ChangeFileBucket>,
  archivedChanges: Map<string, ChangeFileBucket>,
): ChangeFileBucket | undefined {
  const parts = file.path.split("/");

  if (parts[0] !== "openspec" || parts[1] !== "changes") {
    return undefined;
  }

  if (parts[2] === "archive") {
    return parts[3]
      ? getOrCreateChangeBucket(
          archivedChanges,
          parts[3],
          `openspec/changes/archive/${parts[3]}`,
        )
      : undefined;
  }

  return parts[2]
    ? getOrCreateChangeBucket(
        activeChanges,
        parts[2],
        `openspec/changes/${parts[2]}`,
      )
    : undefined;
}

function getOrCreateChangeBucket(
  buckets: Map<string, ChangeFileBucket>,
  name: string,
  path: string,
): ChangeFileBucket {
  const existing = buckets.get(name);

  if (existing) {
    return existing;
  }

  const bucket: ChangeFileBucket = {
    name,
    path,
    deltaSpecsByPath: new Map(),
  };
  buckets.set(name, bucket);

  return bucket;
}

function addModifiedTime(
  bucket: ChangeFileBucket,
  file: NormalizedOpenSpecFileRecord,
): void {
  if (
    !file.path.startsWith(`${bucket.path}/`) ||
    file.modifiedTimeMs === undefined
  ) {
    return;
  }

  if (
    !bucket.modifiedTime ||
    file.modifiedTimeMs > bucket.modifiedTime.modifiedTimeMs
  ) {
    bucket.modifiedTime = {
      modifiedTimeMs: file.modifiedTimeMs,
      modifiedTimeTrace: fileRecordTrace(file.path),
    };
  }
}

function addRootSpec(
  specsByPath: Map<string, IndexedSpec>,
  file: NormalizedOpenSpecFileRecord,
): void {
  const capability = extractCapability(file.path, "openspec/specs/");

  if (!capability) {
    return;
  }

  const spec: IndexedSpec = {
    capability,
    path: file.path,
    sourceTrace: fileTreeTrace(file.path),
  };

  if (file.modifiedTimeMs !== undefined) {
    spec.modifiedTimeMs = file.modifiedTimeMs;
    spec.modifiedTimeTrace = fileRecordTrace(file.path);
  }

  specsByPath.set(file.path, spec);
}

function addDeltaSpec(
  bucket: ChangeFileBucket,
  file: NormalizedOpenSpecFileRecord,
): void {
  const capability = extractCapability(file.path, `${bucket.path}/specs/`);

  if (!capability) {
    return;
  }

  const spec: IndexedDeltaSpecArtifact = {
    kind: "delta-spec",
    capability,
    exists: true,
    path: file.path,
    sourceTrace: fileTreeTrace(file.path),
  };

  if (file.modifiedTimeMs !== undefined) {
    spec.modifiedTimeMs = file.modifiedTimeMs;
    spec.modifiedTimeTrace = fileRecordTrace(file.path);
  }

  bucket.deltaSpecsByPath.set(file.path, spec);
}

function buildActiveChange(
  bucket: ChangeFileBucket,
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
  statusByChange: Map<string, VirtualOpenSpecChangeStatusRecord>,
): IndexedActiveChange {
  const { name, path } = bucket;
  const status = statusByChange.get(bucket.name);
  const artifactStatuses = new Map(
    (status?.artifacts ?? []).map((artifact) => [artifact.id, artifact]),
  );
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
    deltaSpecs: getBucketDeltaSpecs(bucket),
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

  if (bucket.modifiedTime) {
    change.modifiedTimeMs = bucket.modifiedTime.modifiedTimeMs;
    change.modifiedTimeTrace = bucket.modifiedTime.modifiedTimeTrace;
  }

  return change;
}

function buildArchivedChange(
  bucket: ChangeFileBucket,
  fileByPath: Map<string, NormalizedOpenSpecFileRecord>,
): IndexedArchivedChange {
  const { name, path } = bucket;
  const artifacts: IndexedChangeArtifacts = {
    proposal: buildRequiredArtifact("proposal", `${path}/proposal.md`, fileByPath),
    design: buildRequiredArtifact("design", `${path}/design.md`, fileByPath),
    tasks: buildRequiredArtifact("tasks", `${path}/tasks.md`, fileByPath),
    deltaSpecs: getBucketDeltaSpecs(bucket),
  };
  const change: IndexedArchivedChange = {
    name,
    path,
    state: "archived",
    artifacts,
    touchedCapabilities: artifacts.deltaSpecs.map((spec) => ({
      capability: spec.capability,
      sourceTrace: fileTreeTrace(spec.path),
    })),
    taskProgress: buildTaskProgress(artifacts.tasks.path, fileByPath),
    archiveMetadata: parseArchiveMetadata(name),
    sourceTrace: fileTreeTrace(path),
  };

  if (bucket.modifiedTime) {
    change.modifiedTimeMs = bucket.modifiedTime.modifiedTimeMs;
    change.modifiedTimeTrace = bucket.modifiedTime.modifiedTimeTrace;
  }

  return change;
}

function parseArchiveMetadata(name: string): IndexedArchiveMetadata {
  const match = /^(?<date>\d{4}-\d{2}-\d{2})-(?<originalName>.+)$/.exec(name);

  if (!match?.groups) {
    return {};
  }

  return {
    archivedDate: match.groups.date,
    originalName: match.groups.originalName,
  };
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

function getBucketDeltaSpecs(
  bucket: ChangeFileBucket,
): IndexedDeltaSpecArtifact[] {
  return Array.from(bucket.deltaSpecsByPath.values()).sort(
    compareDeltaSpecsByCapability,
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

function compareBucketsByName(
  left: ChangeFileBucket,
  right: ChangeFileBucket,
): number {
  return compareStrings(left.name, right.name);
}

function compareSpecsByCapability(left: IndexedSpec, right: IndexedSpec): number {
  return compareStrings(left.capability, right.capability);
}

function compareDeltaSpecsByCapability(
  left: IndexedDeltaSpecArtifact,
  right: IndexedDeltaSpecArtifact,
): number {
  return compareStrings(left.capability, right.capability);
}
