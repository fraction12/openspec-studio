import {
  createOpenSpecOperationIssue,
  type OpenSpecFileSignature,
} from "../appModel";
import { indexOpenSpecWorkspace } from "../domain/openspecIndex";
import { validationFromPersistedSnapshot } from "../persistence";
import {
  markValidationStaleAfterFileChange,
  type ValidationResult,
} from "../validation/results";
import type { OpenSpecProvider } from "./openspecProvider";
import type {
  ProviderGitStatus,
  ProviderIssueReporter,
  ProviderRepository,
  ProviderSessionArchiveResult,
  ProviderSessionArtifactResult,
  ProviderSessionLoadInput,
  ProviderSessionLoadResult,
  ProviderSessionRefreshResult,
  ProviderSessionValidationResult,
  ProviderWorkspaceBuilder,
  ProviderWorkspaceData,
  ProviderWorkspaceLike,
} from "./types";

type ProviderSessionProvider = Pick<
  OpenSpecProvider,
  "archive" | "descriptor" | "detect" | "findArchivedChangeAfterArchive" | "gitStatus" | "index" | "metadataSignature" | "readArtifact" | "validate"
>;

interface ProviderSessionDependencies<TWorkspace extends ProviderWorkspaceLike> {
  provider: ProviderSessionProvider;
  buildWorkspace: ProviderWorkspaceBuilder<TWorkspace>;
  issues: ProviderIssueReporter;
}

export class ProviderSession<TWorkspace extends ProviderWorkspaceLike> {
  private loadGeneration = 0;
  private refreshGeneration = 0;
  private artifactGeneration = 0;
  private validationGeneration = 0;
  private gitStatusGeneration = 0;
  private readonly backgroundRefreshInFlight = new Set<string>();

  constructor(private readonly dependencies: ProviderSessionDependencies<TWorkspace>) {}

  async loadRepository(
    input: ProviderSessionLoadInput<TWorkspace>,
  ): Promise<ProviderSessionLoadResult<TWorkspace>> {
    const requestId = ++this.loadGeneration;
    this.refreshGeneration += 1;
    this.artifactGeneration += 1;
    this.validationGeneration += 1;
    const candidatePath = input.repoPath.trim();

    const detection = await this.dependencies.provider.detect(candidatePath);
    if (this.loadGeneration !== requestId) {
      return { kind: "stale" };
    }

    if (!detection.matched || !detection.provider) {
      return {
        kind: "no-provider",
        path: detection.path,
        name: detection.name,
        summary: detection.summary,
      };
    }

    const workspaceData = await this.dependencies.provider.index(detection.path);
    if (this.loadGeneration !== requestId) {
      return { kind: "stale" };
    }

    const restoredValidation =
      input.currentRepoPath === detection.path
        ? validationForFileRecords(
            input.currentWorkspace?.validation ?? null,
            input.currentWorkspace?.fileSignature,
            workspaceData.fileSignature,
          )
        : validationFromPersistedSnapshot(input.persistedValidation, workspaceData.fileSignature);

    const workspace = this.buildWorkspace(workspaceData, restoredValidation);
    const repository: ProviderRepository = {
      id: detection.path,
      name: detection.name,
      path: detection.path,
      branch: "local",
      state: "ready",
      summary: detection.summary,
      providerId: detection.provider.id,
      providerLabel: detection.provider.label,
      providerCapabilities: detection.provider.capabilities,
    };

    this.dependencies.issues.clear(
      (issue) => issue.kind === "repository-read" && issue.repoPath === detection.path,
    );

    return { kind: "ready", repository, workspace };
  }

  async refreshRepositoryIfChanged(
    repoPath: string,
    currentWorkspace: TWorkspace | null,
    currentRepoPath: string | null | undefined,
  ): Promise<ProviderSessionRefreshResult<TWorkspace>> {
    if (this.backgroundRefreshInFlight.has(repoPath)) {
      return { kind: "unchanged" };
    }

    const requestId = ++this.refreshGeneration;
    this.backgroundRefreshInFlight.add(repoPath);

    try {
      const nextSignature = await this.dependencies.provider.metadataSignature(repoPath);
      if (this.refreshGeneration !== requestId || currentRepoPath !== repoPath) {
        return { kind: "stale" };
      }

      if (nextSignature.fingerprint === currentWorkspace?.fileSignature.fingerprint) {
        return { kind: "unchanged" };
      }

      const workspaceData = await this.dependencies.provider.index(repoPath);
      if (this.refreshGeneration !== requestId || currentRepoPath !== repoPath) {
        return { kind: "stale" };
      }

      const workspace = this.buildWorkspace(
        workspaceData,
        validationForFileRecords(
          currentWorkspace?.validation ?? null,
          currentWorkspace?.fileSignature,
          nextSignature,
        ),
      );
      this.dependencies.issues.clear(
        (issue) => issue.kind === "repository-read" && issue.repoPath === repoPath,
      );
      return { kind: "updated", workspace };
    } catch (error) {
      if (this.refreshGeneration === requestId && currentRepoPath === repoPath) {
        this.dependencies.issues.record(
          createOpenSpecOperationIssue({
            kind: "repository-read",
            title: "Repository refresh failed",
            message: errorMessage(error),
            fallbackMessage: "OpenSpec repository files could not be refreshed.",
            repoPath,
            target: "openspec",
          }),
        );
      }
      throw error;
    } finally {
      this.backgroundRefreshInFlight.delete(repoPath);
    }
  }

  async validate(
    repoPath: string,
    currentWorkspace: TWorkspace | null,
    currentRepoPath: string | null | undefined,
  ): Promise<ProviderSessionValidationResult<TWorkspace>> {
    if (!this.dependencies.provider.descriptor.capabilities.validation) {
      return { kind: "unsupported", message: "The active provider does not support validation." };
    }

    const requestId = ++this.validationGeneration;
    const validation = await this.dependencies.provider.validate(repoPath);
    if (this.validationGeneration !== requestId || currentRepoPath !== repoPath) {
      return { kind: "stale" };
    }

    this.recordValidationOperationResult(repoPath, validation);
    const workspace = this.rebuildCurrentWorkspace(currentWorkspace, validation);

    return { kind: "validated", validation, workspace };
  }

  async archiveChanges(
    repoPath: string,
    changeNames: string[],
    currentWorkspace: TWorkspace | null,
    currentRepoPath: string | null | undefined,
  ): Promise<ProviderSessionArchiveResult<TWorkspace>> {
    if (!this.dependencies.provider.descriptor.capabilities.archive) {
      return { kind: "unsupported", message: "The active provider does not support archive actions." };
    }

    const requestId = ++this.validationGeneration;
    let validation: ValidationResult | null = null;
    let archivedCount = 0;
    let latestWorkspace: TWorkspace | null = null;
    let lastArchivedChangeId: string | null = null;

    try {
      validation = await this.dependencies.provider.validate(repoPath);
      if (this.validationGeneration !== requestId || currentRepoPath !== repoPath) {
        return { kind: "stale" };
      }

      this.recordValidationOperationResult(repoPath, validation);
      const validatedWorkspace = this.rebuildCurrentWorkspace(currentWorkspace, validation);

      if (!canArchiveAfterValidation(validation)) {
        return {
          kind: "validation-blocked",
          message: archiveValidationFailureMessage(validation),
          validation,
          workspace: validatedWorkspace,
        };
      }

      for (const changeName of changeNames) {
        await this.dependencies.provider.archive(repoPath, changeName);
        lastArchivedChangeId = await this.dependencies.provider.findArchivedChangeAfterArchive(repoPath, changeName);
        if (!lastArchivedChangeId) {
          throw new Error("OpenSpec archive reported success, but " + changeName + " is still active.");
        }
        archivedCount += 1;
      }

      const workspaceData = await this.dependencies.provider.index(repoPath);
      if (this.validationGeneration !== requestId || currentRepoPath !== repoPath) {
        return { kind: "stale" };
      }

      latestWorkspace = this.buildWorkspace(
        workspaceData,
        validationForFileRecords(validation, currentWorkspace?.fileSignature, workspaceData.fileSignature),
      );

      return {
        kind: "archived",
        archivedCount,
        requestedCount: changeNames.length,
        lastArchivedChangeId,
        workspace: latestWorkspace,
        validation,
      };
    } catch (error) {
      if (archivedCount > 0) {
        try {
          const workspaceData = await this.dependencies.provider.index(repoPath);
          latestWorkspace = this.buildWorkspace(
            workspaceData,
            validation
              ? validationForFileRecords(validation, currentWorkspace?.fileSignature, workspaceData.fileSignature)
              : null,
          );
        } catch {
          latestWorkspace = null;
        }

        return {
          kind: "partial",
          archivedCount,
          requestedCount: changeNames.length,
          message: errorMessage(error),
          workspace: latestWorkspace,
          validation,
        };
      }

      throw error;
    }
  }

  async readArtifact(
    repoPath: string,
    artifactPath: string,
    currentRepoPath: string | null | undefined,
  ): Promise<ProviderSessionArtifactResult> {
    if (!this.dependencies.provider.descriptor.capabilities.artifacts) {
      return { kind: "unsupported", message: "The active provider does not support artifact reads." };
    }

    const requestId = ++this.artifactGeneration;

    try {
      const contents = await this.dependencies.provider.readArtifact(repoPath, artifactPath);
      if (this.artifactGeneration !== requestId || currentRepoPath !== repoPath) {
        return { kind: "stale" };
      }

      return { kind: "read", contents };
    } catch (error) {
      if (this.artifactGeneration === requestId && currentRepoPath === repoPath) {
        this.dependencies.issues.record(
          createOpenSpecOperationIssue({
            kind: "artifact-read",
            title: "Artifact read failed",
            message: errorMessage(error),
            fallbackMessage: "OpenSpec artifact could not be read.",
            repoPath,
            target: artifactPath,
          }),
        );
      }
      throw error;
    }
  }

  async gitStatus(
    repoPath: string,
    currentRepoPath: string | null | undefined,
  ): Promise<ProviderGitStatus | "stale"> {
    if (!this.dependencies.provider.descriptor.capabilities.gitStatus) {
      return {
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: "The active provider does not support Git status.",
      };
    }

    const requestId = ++this.gitStatusGeneration;
    const status = await this.dependencies.provider.gitStatus(repoPath);
    if (this.gitStatusGeneration !== requestId || currentRepoPath !== repoPath) {
      return "stale";
    }

    return status;
  }

  recordRepositoryReadFailure(repoPath: string, error: unknown) {
    this.dependencies.issues.record(
      createOpenSpecOperationIssue({
        kind: "repository-read",
        title: "Repository read failed",
        message: errorMessage(error),
        fallbackMessage: "OpenSpec repository files could not be read.",
        repoPath,
        target: "openspec",
      }),
    );
  }

  private buildWorkspace(
    workspaceData: ProviderWorkspaceData,
    validation: ValidationResult | null,
  ): TWorkspace {
    const workspace = this.dependencies.buildWorkspace({
      indexed: workspaceData.indexed,
      files: workspaceData.files,
      validation,
      changeStatuses: workspaceData.changeStatuses,
      fileSignature: workspaceData.fileSignature,
    });
    return {
      ...workspace,
      providerId: this.dependencies.provider.descriptor.id,
      providerLabel: this.dependencies.provider.descriptor.label,
      providerCapabilities: this.dependencies.provider.descriptor.capabilities,
    };
  }

  private rebuildCurrentWorkspace(
    currentWorkspace: TWorkspace | null,
    validation: ValidationResult,
  ): TWorkspace {
    const records = Object.values(currentWorkspace?.filesByPath ?? {});
    const changeStatuses = currentWorkspace?.changeStatuses ?? [];
    return this.dependencies.buildWorkspace({
      indexed: indexOpenSpecWorkspace({ files: records, changeStatuses }),
      files: records,
      validation,
      changeStatuses,
      fileSignature: currentWorkspace?.fileSignature ?? {
        fingerprint: "",
        latestPath: null,
        latestModifiedTimeMs: null,
      },
    });
  }

  private recordValidationOperationResult(repoPath: string, result: ValidationResult) {
    if (result.diagnostics.length === 0) {
      this.dependencies.issues.clear((issue) => issue.kind === "validation" && issue.repoPath === repoPath);
      return;
    }

    const diagnostic = result.diagnostics[0];
    this.dependencies.issues.record(
      createOpenSpecOperationIssue({
        kind: "validation",
        title: "Validation failed",
        message: diagnostic?.message,
        fallbackMessage: "OpenSpec validation did not complete cleanly.",
        repoPath,
        target: "validate --all",
        command: diagnostic
          ? {
              stdout: diagnostic.stdout,
              stderr: diagnostic.stderr,
              statusCode: diagnostic.statusCode,
            }
          : null,
      }),
    );
  }
}

function validationForFileRecords(
  validation: ValidationResult | null,
  previousSignature: OpenSpecFileSignature | undefined,
  nextSignature: OpenSpecFileSignature,
): ValidationResult | null {
  if (!validation || !previousSignature) {
    return validation;
  }

  if (previousSignature.fingerprint === nextSignature.fingerprint) {
    return validation;
  }

  return markValidationStaleAfterFileChange(
    validation,
    nextSignature.latestPath ?? "openspec",
    nextSignature.latestModifiedTimeMs
      ? new Date(nextSignature.latestModifiedTimeMs)
      : new Date(),
  );
}

function canArchiveAfterValidation(validation: ValidationResult): boolean {
  return validation.state === "pass" && validation.diagnostics.length === 0;
}

function archiveValidationFailureMessage(validation: ValidationResult): string {
  return (
    validation.diagnostics[0]?.message ??
    "Validation must pass before archiving. Review the validation tab for details."
  );
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
