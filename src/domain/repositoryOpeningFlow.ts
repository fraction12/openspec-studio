import type {
  ProviderSessionLoadResult,
  ProviderSessionRefreshResult,
} from "../providers/types";
import { indexOpenSpecWorkspace, type VirtualOpenSpecChangeStatusRecord, type VirtualOpenSpecFileRecord } from "./openspecIndex";
import { buildWorkspaceView, type WorkspaceView } from "./workspaceViewModel";
import type { ProviderCapabilities } from "../providers/types";

export type RepoState = "ready" | "no-workspace" | "cli-failure";
export type LoadState = "idle" | "loading" | "loaded" | "error";
export type CandidateErrorKind = "missing" | "no-workspace" | "unavailable";

export interface RepositoryView {
  id: string;
  name: string;
  path: string;
  branch: string;
  state: RepoState;
  summary: string;
  providerId?: string;
  providerLabel?: string;
  providerCapabilities?: ProviderCapabilities;
}

export interface CandidateRepoError {
  kind: CandidateErrorKind;
  path: string;
  title: string;
  message: string;
}

export interface OpenSpecGitStatus {
  state: "unknown" | "loading" | "clean" | "dirty" | "unavailable";
  dirtyCount: number;
  entries: string[];
  message: string;
}

export type RepositoryNavigationMode = "initialize" | "keep" | "restore";

export const BROWSER_PREVIEW_REPO_PATH = "browser-preview://openspec-studio";

export const unknownGitStatus: OpenSpecGitStatus = {
  state: "unknown",
  dirtyCount: 0,
  entries: [],
  message: "Git status has not been checked.",
};

export function deriveEmptyRepositoryOpenTransition(): {
  candidateError: CandidateRepoError;
  message: string;
} {
  return {
    candidateError: {
      kind: "missing",
      path: "",
      title: "Choose a repository folder",
      message: "Select a local folder that contains an openspec/ directory.",
    },
    message: "Choose a repository folder to begin.",
  };
}

export function deriveBrowserPreviewRepositoryTransition(): {
  repository: RepositoryView;
  workspace: WorkspaceView;
  gitStatus: OpenSpecGitStatus;
  navigationMode: "initialize";
  loadState: "loaded";
  message: string;
} {
  const previewFiles: VirtualOpenSpecFileRecord[] = [];
  const previewStatuses: VirtualOpenSpecChangeStatusRecord[] = [];
  const indexed = indexOpenSpecWorkspace({
    files: previewFiles,
    changeStatuses: previewStatuses,
  });
  const repository: RepositoryView = {
    id: BROWSER_PREVIEW_REPO_PATH,
    name: "openspec-studio",
    path: BROWSER_PREVIEW_REPO_PATH,
    branch: "browser-preview",
    state: "ready",
    summary: "Browser preview only",
  };
  const workspace = buildWorkspaceView(indexed, previewFiles, null, previewStatuses);

  return {
    repository,
    workspace,
    gitStatus: {
      state: "unavailable",
      dirtyCount: 0,
      entries: [],
      message: "Git status requires the Tauri desktop runtime.",
    },
    navigationMode: "initialize",
    loadState: "loaded",
    message: "Browser preview loaded without repository data. Run the Tauri app to inspect local files.",
  };
}

export function deriveNoProviderRepositoryTransition(
  result: Extract<ProviderSessionLoadResult<WorkspaceView>, { kind: "no-provider" }>,
  options: { hasActiveRepository: boolean },
): {
  repository?: RepositoryView;
  candidateError: CandidateRepoError;
  workspaceAction: "clear" | "preserve";
  selectionAction: "clear" | "preserve";
  gitStatusAction: "reset" | "preserve";
  loadState: "loaded";
  message: string;
} {
  return {
    repository: options.hasActiveRepository
      ? undefined
      : {
          id: result.path,
          name: result.name,
          path: result.path,
          branch: "local",
          state: "no-workspace",
          summary: result.summary,
        },
    candidateError: {
      kind: "no-workspace",
      path: result.path,
      title: "No OpenSpec workspace found",
      message: "The selected folder does not contain an openspec/ directory.",
    },
    workspaceAction: options.hasActiveRepository ? "preserve" : "clear",
    selectionAction: options.hasActiveRepository ? "preserve" : "clear",
    gitStatusAction: options.hasActiveRepository ? "preserve" : "reset",
    loadState: "loaded",
    message: "No OpenSpec workspace was found in " + result.path,
  };
}

export function deriveReadyRepositoryTransition(
  result: Extract<ProviderSessionLoadResult<WorkspaceView>, { kind: "ready" }>,
  options: { currentRepoPath?: string | null },
): {
  repository: RepositoryView;
  workspace: WorkspaceView;
  candidateError: null;
  gitStatus: OpenSpecGitStatus;
  navigationMode: "keep" | "restore";
  rememberRecentRepo: { path: string; name: string };
  shouldRefreshGitStatus: true;
  loadState: "loaded";
  message: string;
} {
  return {
    repository: result.repository,
    workspace: result.workspace,
    candidateError: null,
    gitStatus: {
      ...unknownGitStatus,
      state: "loading",
      message: "Checking OpenSpec Git status...",
    },
    navigationMode: options.currentRepoPath === result.repository.path ? "keep" : "restore",
    rememberRecentRepo: {
      path: result.repository.path,
      name: result.repository.name,
    },
    shouldRefreshGitStatus: true,
    loadState: "loaded",
    message:
      "Refreshed files: " +
      result.workspace.changes.length +
      " changes and " +
      result.workspace.specs.length +
      " specs.",
  };
}

export function deriveRefreshRepositoryTransition(
  result: ProviderSessionRefreshResult<WorkspaceView>,
):
  | {
      kind: "unchanged";
      shouldRefreshGitStatus: true;
      gitStatusQuiet: true;
    }
  | {
      kind: "updated";
      workspace: WorkspaceView;
      navigationMode: "keep";
      shouldRefreshGitStatus: true;
      gitStatusQuiet: true;
      message: string;
    }
  | {
      kind: "stale";
    } {
  if (result.kind === "stale") {
    return { kind: "stale" };
  }

  if (result.kind === "unchanged") {
    return {
      kind: "unchanged",
      shouldRefreshGitStatus: true,
      gitStatusQuiet: true,
    };
  }

  return {
    kind: "updated",
    workspace: result.workspace,
    navigationMode: "keep",
    shouldRefreshGitStatus: true,
    gitStatusQuiet: true,
    message: "OpenSpec files changed. Local files refreshed.",
  };
}
