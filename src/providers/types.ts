import type {
  MutatingOperationResult,
  OpenSpecFileSignature,
  OpenSpecOperationIssue,
} from "../appModel";
import type {
  IndexedOpenSpecWorkspace,
  VirtualOpenSpecChangeStatusRecord,
  VirtualOpenSpecFileRecord,
} from "../domain/openspecIndex";
import type { PersistedValidationSnapshot } from "../persistence";
import type { ValidationResult } from "../validation/results";

export type ProviderId = "openspec";

export interface ProviderCapabilities {
  artifacts: boolean;
  changeStatus: boolean;
  validation: boolean;
  archive: boolean;
  gitStatus: boolean;
  writeActions: string[];
}

export interface ProviderDescriptor {
  id: ProviderId;
  label: string;
  capabilities: ProviderCapabilities;
}

export interface ProviderRepository {
  id: string;
  name: string;
  path: string;
  branch: string;
  state: "ready";
  summary: string;
  providerId: ProviderId;
  providerLabel: string;
  providerCapabilities: ProviderCapabilities;
}

export interface ProviderDetection {
  matched: boolean;
  path: string;
  name: string;
  summary: string;
  provider?: ProviderDescriptor;
}

export interface ProviderWorkspaceData {
  indexed: IndexedOpenSpecWorkspace;
  files: VirtualOpenSpecFileRecord[];
  changeStatuses: VirtualOpenSpecChangeStatusRecord[];
  fileSignature: OpenSpecFileSignature;
}

export interface ProviderWorkspaceLike {
  filesByPath: Record<string, VirtualOpenSpecFileRecord>;
  fileSignature: OpenSpecFileSignature;
  changeStatuses: VirtualOpenSpecChangeStatusRecord[];
  validation: ValidationResult | null;
}

export interface ProviderGitStatus {
  state: "unknown" | "loading" | "clean" | "dirty" | "unavailable";
  dirtyCount: number;
  entries: string[];
  message: string;
}

export type InvokeAdapter = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export interface ProviderIssueReporter {
  record(issue: OpenSpecOperationIssue): void;
  clear(predicate: (issue: OpenSpecOperationIssue) => boolean): void;
}

export type ProviderArchiveOperationResult = MutatingOperationResult;

export interface ProviderWorkspaceBuilder<TWorkspace extends ProviderWorkspaceLike> {
  (input: {
    indexed: IndexedOpenSpecWorkspace;
    files: VirtualOpenSpecFileRecord[];
    validation: ValidationResult | null;
    changeStatuses: VirtualOpenSpecChangeStatusRecord[];
    fileSignature: OpenSpecFileSignature;
  }): TWorkspace;
}

export interface ProviderSessionLoadInput<TWorkspace extends ProviderWorkspaceLike> {
  repoPath: string;
  currentRepoPath?: string | null;
  currentWorkspace?: TWorkspace | null;
  persistedValidation?: PersistedValidationSnapshot;
}

export type ProviderSessionLoadResult<TWorkspace extends ProviderWorkspaceLike> =
  | {
      kind: "ready";
      repository: ProviderRepository;
      workspace: TWorkspace;
    }
  | {
      kind: "no-provider";
      path: string;
      name: string;
      summary: string;
    }
  | {
      kind: "stale";
    };

export type ProviderSessionRefreshResult<TWorkspace extends ProviderWorkspaceLike> =
  | {
      kind: "updated";
      workspace: TWorkspace;
    }
  | {
      kind: "unchanged";
    }
  | {
      kind: "stale";
    };

export type ProviderSessionValidationResult<TWorkspace extends ProviderWorkspaceLike> =
  | {
      kind: "validated";
      validation: ValidationResult;
      workspace: TWorkspace;
    }
  | {
      kind: "unsupported";
      message: string;
    }
  | {
      kind: "stale";
    };

export type ProviderSessionArchiveResult<TWorkspace extends ProviderWorkspaceLike> =
  | {
      kind: "archived";
      archivedCount: number;
      requestedCount: number;
      lastArchivedChangeId: string | null;
      workspace: TWorkspace;
      validation: ValidationResult;
    }
  | {
      kind: "validation-blocked";
      message: string;
      validation: ValidationResult;
      workspace: TWorkspace;
    }
  | {
      kind: "partial";
      archivedCount: number;
      requestedCount: number;
      message: string;
      workspace: TWorkspace | null;
      validation: ValidationResult | null;
    }
  | {
      kind: "unsupported";
      message: string;
    }
  | {
      kind: "stale";
    };

export type ProviderSessionArtifactResult =
  | {
      kind: "read";
      contents: string;
    }
  | {
      kind: "unsupported";
      message: string;
    }
  | {
      kind: "stale";
    };
