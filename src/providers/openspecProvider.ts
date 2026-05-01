import {
  activeChangeNamesFromFileRecords,
  buildOpenSpecFileSignature,
  createOpenSpecOperationIssue,
  extractJsonPayload,
  toVirtualChangeStatusRecord,
  toVirtualFileRecords,
  type BridgeFileRecord,
  type CommandLikeResult,
} from "../appModel";
import {
  indexOpenSpecWorkspace,
  type VirtualOpenSpecChangeStatusRecord,
  type VirtualOpenSpecFileRecord,
} from "../domain/openspecIndex";
import {
  createValidationCommandFailureResult,
  parseValidationResult,
  type ValidationResult,
} from "../validation/results";
import type {
  InvokeAdapter,
  ProviderCapabilities,
  ProviderDescriptor,
  ProviderDetection,
  ProviderGitStatus,
  ProviderIssueReporter,
  ProviderWorkspaceData,
} from "./types";

const STATUS_COMMAND_CONCURRENCY = 4;
const STATUS_CACHE_LIMIT = 300;

interface RepositoryValidationDto {
  path: string;
  name: string;
  has_openspec?: boolean;
  hasOpenSpec?: boolean;
}

interface CommandResultDto extends CommandLikeResult {
  stdout: string;
  stderr: string;
  success: boolean;
}

interface OpenSpecGitStatusDto {
  available: boolean;
  dirty_count?: number;
  dirtyCount?: number;
  entries: string[];
  message?: string | null;
}

interface StatusCacheEntry {
  freshnessKey: string;
  record: VirtualOpenSpecChangeStatusRecord;
}

interface OpenSpecProviderDependencies {
  invoke: InvokeAdapter;
  issues: ProviderIssueReporter;
  now: () => Date;
}

export const openSpecProviderCapabilities: ProviderCapabilities = {
  artifacts: true,
  changeStatus: true,
  validation: true,
  archive: true,
  gitStatus: true,
  writeActions: ["archive"],
};

export const openSpecProviderDescriptor: ProviderDescriptor = {
  id: "openspec",
  label: "OpenSpec",
  capabilities: openSpecProviderCapabilities,
};

export class OpenSpecProvider {
  readonly descriptor = openSpecProviderDescriptor;
  private readonly statusCache = new Map<string, StatusCacheEntry>();

  constructor(private readonly dependencies: OpenSpecProviderDependencies) {}

  async detect(repoPath: string): Promise<ProviderDetection> {
    const validation = await this.dependencies.invoke<RepositoryValidationDto>("validate_repo", {
      repoPath,
    });
    const matched = Boolean(validation.has_openspec ?? validation.hasOpenSpec);

    return {
      matched,
      path: validation.path,
      name: validation.name,
      summary: matched ? "OpenSpec workspace" : "No openspec/ directory",
      provider: matched ? this.descriptor : undefined,
    };
  }

  async index(repoPath: string): Promise<ProviderWorkspaceData> {
    const fileDtos = await this.dependencies.invoke<BridgeFileRecord[]>("list_openspec_file_records", {
      repoPath,
    });
    const files = toVirtualFileRecords(fileDtos);
    const changeStatuses = await this.loadChangeStatuses(
      repoPath,
      files,
      activeChangeNamesFromFileRecords(files),
    );
    const fileSignature = buildOpenSpecFileSignature(files);

    return {
      indexed: indexOpenSpecWorkspace({ files, changeStatuses }),
      files,
      changeStatuses,
      fileSignature,
    };
  }

  async metadataSignature(repoPath: string) {
    const metadataDtos = await this.dependencies.invoke<BridgeFileRecord[]>("list_openspec_file_metadata_records", {
      repoPath,
    });
    return buildOpenSpecFileSignature(toVirtualFileRecords(metadataDtos));
  }

  async readArtifact(repoPath: string, artifactPath: string): Promise<string> {
    const artifact = await this.dependencies.invoke<{ contents: string }>("read_openspec_artifact_file", {
      repoPath,
      artifactPath,
    });
    this.dependencies.issues.clear(
      (issue) => issue.kind === "artifact-read" && issue.repoPath === repoPath && issue.target === artifactPath,
    );
    return artifact.contents;
  }

  async validate(repoPath: string): Promise<ValidationResult> {
    const command = await this.dependencies.invoke<CommandResultDto>("run_openspec_command", {
      repoPath,
      args: ["validate", "--all", "--json"],
    });
    const rawJson = extractJsonPayload(command.stdout);

    if (rawJson !== undefined) {
      return parseValidationResult(rawJson, {
        validatedAt: this.dependencies.now(),
        repoPath,
      });
    }

    if (command.success) {
      return parseValidationResult(command.stdout || command, {
        validatedAt: this.dependencies.now(),
        repoPath,
      });
    }

    return createValidationCommandFailureResult({
      stdout: command.stdout,
      stderr: command.stderr,
      statusCode: command.status_code ?? command.statusCode ?? null,
      validatedAt: this.dependencies.now(),
      raw: command,
    });
  }

  async archive(repoPath: string, changeName: string): Promise<void> {
    let recordedCommandFailure = false;

    try {
      const result = await this.dependencies.invoke<CommandResultDto>("archive_change", {
        repoPath,
        changeName,
      });

      if (!result.success) {
        this.dependencies.issues.record(
          createOpenSpecOperationIssue({
            kind: "archive",
            title: "Archive failed",
            fallbackMessage: "OpenSpec archive did not complete.",
            repoPath,
            target: changeName,
            command: result,
          }),
        );
        recordedCommandFailure = true;
        throw new Error(result.stderr || result.stdout || "OpenSpec archive did not complete.");
      }

      this.dependencies.issues.clear(
        (issue) => issue.kind === "archive" && issue.repoPath === repoPath && issue.target === changeName,
      );
    } catch (error) {
      if (!recordedCommandFailure) {
        this.dependencies.issues.record(
          createOpenSpecOperationIssue({
            kind: "archive",
            title: "Archive failed",
            message: errorMessage(error),
            fallbackMessage: "OpenSpec archive did not complete.",
            repoPath,
            target: changeName,
          }),
        );
      }
      throw error;
    }
  }

  async findArchivedChangeAfterArchive(repoPath: string, changeName: string): Promise<string | null> {
    const fileDtos = await this.dependencies.invoke<BridgeFileRecord[]>("list_openspec_file_records", {
      repoPath,
    });
    const files = toVirtualFileRecords(fileDtos);
    const activeNames = new Set(activeChangeNamesFromFileRecords(files));

    if (activeNames.has(changeName)) {
      return null;
    }

    const indexed = indexOpenSpecWorkspace({ files, changeStatuses: [] });
    return indexed.archivedChanges.find((change) => change.archiveMetadata.originalName === changeName)?.name ?? null;
  }

  async gitStatus(repoPath: string): Promise<ProviderGitStatus> {
    const status = await this.dependencies.invoke<OpenSpecGitStatusDto>("get_openspec_git_status", { repoPath });
    const dirtyCount = status.dirty_count ?? status.dirtyCount ?? status.entries.length;

    if (!status.available) {
      return {
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: status.message ?? "Git status is unavailable for this repository.",
      };
    }

    return {
      state: dirtyCount > 0 ? "dirty" : "clean",
      dirtyCount,
      entries: status.entries,
      message:
        dirtyCount > 0
          ? dirtyCount + " uncommitted OpenSpec " + (dirtyCount === 1 ? "path" : "paths")
          : "No uncommitted OpenSpec paths",
    };
  }

  private async loadChangeStatuses(
    repoPath: string,
    fileRecords: VirtualOpenSpecFileRecord[],
    changeNames: string[],
  ): Promise<VirtualOpenSpecChangeStatusRecord[]> {
    const tasks = Array.from(new Set(changeNames)).map((changeName) => async () => {
      const cacheId = statusCacheId(repoPath, changeName);
      const freshnessKey = changeStatusFreshnessKey(fileRecords, changeName);
      const cached = this.statusCache.get(cacheId);

      if (cached?.freshnessKey === freshnessKey) {
        return cached.record;
      }

      let record: VirtualOpenSpecChangeStatusRecord;

      try {
        const command = await this.dependencies.invoke<CommandResultDto>("run_openspec_command", {
          repoPath,
          args: ["status", "--change", changeName, "--json"],
        });
        const rawJson = extractJsonPayload(command.stdout);

        if (!command.success || !rawJson) {
          record = toVirtualChangeStatusRecord(
            {
              changeName,
              error:
                command.stderr ||
                command.stdout ||
                "OpenSpec status output was not recognized.",
            },
            changeName,
          );
          this.dependencies.issues.record(
            createOpenSpecOperationIssue({
              kind: "status",
              title: "Change status failed",
              fallbackMessage: "OpenSpec change status output was not recognized.",
              repoPath,
              target: changeName,
              command,
            }),
          );
        } else {
          record = toVirtualChangeStatusRecord(rawJson, changeName);
          this.dependencies.issues.clear(
            (issue) => issue.kind === "status" && issue.repoPath === repoPath && issue.target === changeName,
          );
        }
      } catch (error) {
        record = toVirtualChangeStatusRecord(
          { changeName, error: errorMessage(error) },
          changeName,
        );
        this.dependencies.issues.record(
          createOpenSpecOperationIssue({
            kind: "status",
            title: "Change status failed",
            message: errorMessage(error),
            fallbackMessage: "OpenSpec change status could not be loaded.",
            repoPath,
            target: changeName,
          }),
        );
      }

      this.statusCache.set(cacheId, { freshnessKey, record });
      pruneStatusCache(this.statusCache);
      return record;
    });

    return mapWithConcurrency(tasks, STATUS_COMMAND_CONCURRENCY);
  }
}

function statusCacheId(repoPath: string, changeName: string): string {
  return repoPath + "\0" + changeName;
}

function changeStatusFreshnessKey(
  records: VirtualOpenSpecFileRecord[],
  changeName: string,
): string {
  const prefix = "openspec/changes/" + changeName + "/";

  return records
    .filter((record) => record.kind !== "directory" && record.path.startsWith(prefix))
    .map((record) => record.path + ":" + (record.modifiedTimeMs ?? 0) + ":" + (record.fileSize ?? 0))
    .sort()
    .join("|");
}

function pruneStatusCache(cache: Map<string, StatusCacheEntry>) {
  while (cache.size > STATUS_CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;

    if (firstKey === undefined) {
      return;
    }

    cache.delete(firstKey);
  }
}

async function mapWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Unexpected error.";
}
