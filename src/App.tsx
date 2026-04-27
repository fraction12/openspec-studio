import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import "./App.css";

import {
  buildOpenSpecFileSignature,
  deriveChangeHealth,
  decideRepositoryCandidateOpen,
  extractJsonPayload,
  isPersistableLocalRepoPath,
  normalizeRecentRepoPaths,
  recentRepoSwitcherPaths,
  selectVisibleItemId,
  toVirtualChangeStatusRecord,
  toVirtualFileRecords,
  type ChangeHealth,
  type BridgeFileRecord,
  type OpenSpecFileSignature,
} from "./appModel";
import {
  indexOpenSpecWorkspace,
  type IndexedActiveChange,
  type IndexedArchivedChange,
  type IndexedSpec,
  type IndexedTaskProgress,
  type VirtualOpenSpecChangeStatusRecord,
  type VirtualOpenSpecFileRecord,
} from "./domain/openspecIndex";
import {
  createValidationCommandFailureResult,
  markValidationStaleAfterFileChange,
  parseValidationResult,
  type ValidationIssue,
  type ValidationResult,
} from "./validation/results";

type RepoState = "ready" | "no-workspace" | "cli-failure";
type BoardView = "changes" | "specs";
type ChangePhase = "active" | "archive-ready" | "archived";
type DetailTab = "proposal" | "design" | "tasks" | "spec-delta" | "status" | "archive-info";
type Health = ChangeHealth;
type ArtifactStatus = "present" | "missing" | "blocked";
type LoadState = "idle" | "loading" | "loaded" | "error";
type CandidateErrorKind = "missing" | "no-workspace" | "unavailable";

interface RepositoryValidationDto {
  path: string;
  name: string;
  has_openspec?: boolean;
  hasOpenSpec?: boolean;
  openspec_path?: string | null;
  openspecPath?: string | null;
}

interface CommandResultDto {
  stdout: string;
  stderr: string;
  status_code?: number | null;
  statusCode?: number | null;
  success: boolean;
}

interface OpenSpecGitStatusDto {
  available: boolean;
  dirty_count?: number;
  dirtyCount?: number;
  entries: string[];
  message?: string | null;
}

interface RepositoryView {
  id: string;
  name: string;
  path: string;
  branch: string;
  state: RepoState;
  summary: string;
}

interface CandidateRepoError {
  kind: CandidateErrorKind;
  path: string;
  title: string;
  message: string;
}

interface Artifact {
  id: string;
  label: string;
  path: string;
  status: ArtifactStatus;
  note: string;
}

interface TaskItem {
  label: string;
  done: boolean;
}

interface TaskGroup {
  title: string;
  items: TaskItem[];
}

interface TaskProgress {
  done: number;
  total: number;
  items: TaskItem[];
  groups: TaskGroup[];
}

interface ChangeRecord {
  id: string;
  name: string;
  title: string;
  phase: ChangePhase;
  health: Health;
  statusLabel: string;
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
}

interface ArchiveInfo {
  path: string;
  archivedDate: string | null;
  originalName: string | null;
  files: Artifact[];
}

interface SpecRecord {
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
}

interface WorkspaceView {
  changes: ChangeRecord[];
  specs: SpecRecord[];
  filesByPath: Record<string, VirtualOpenSpecFileRecord>;
  fileSignature: OpenSpecFileSignature;
  changeStatuses: VirtualOpenSpecChangeStatusRecord[];
  validation: ValidationResult | null;
}

interface OpenSpecGitStatus {
  state: "unknown" | "loading" | "clean" | "dirty" | "unavailable";
  dirtyCount: number;
  entries: string[];
  message: string;
}

const BROWSER_PREVIEW_REPO_PATH = "browser-preview://openspec-studio";
const RECENT_REPOS_STORAGE_KEY = "openspec-studio.recent-repos";
const AUTO_REFRESH_INTERVAL_MS = 15_000;

const unknownGitStatus: OpenSpecGitStatus = {
  state: "unknown",
  dirtyCount: 0,
  entries: [],
  message: "Git status has not been checked.",
};

const healthLabels: Record<Health, string> = {
  valid: "Checked",
  stale: "Check needed",
  invalid: "Needs attention",
  missing: "Incomplete",
  blocked: "Blocked",
  ready: "Ready",
};

const phaseLabels: Record<ChangePhase, string> = {
  active: "Active",
  "archive-ready": "Archive ready",
  archived: "Archived",
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

function App() {
  const [recentRepos, setRecentRepos] = useState<string[]>(readRecentRepos);
  const [repoPathInput, setRepoPathInput] = useState("");
  const [repo, setRepo] = useState<RepositoryView | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [candidateError, setCandidateError] = useState<CandidateRepoError | null>(null);
  const [view, setView] = useState<BoardView>("changes");
  const [phase, setPhase] = useState<ChangePhase>("active");
  const [query, setQuery] = useState("");
  const [selectedChangeId, setSelectedChangeId] = useState("");
  const [selectedSpecId, setSelectedSpecId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("proposal");
  const [artifactPreview, setArtifactPreview] = useState("");
  const [gitStatus, setGitStatus] = useState<OpenSpecGitStatus>(unknownGitStatus);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("Loading local workspace...");

  useEffect(() => {
    const lastRepoPath = recentRepos[0];

    if (lastRepoPath) {
      setRepoPathInput(lastRepoPath);
      void loadRepository(lastRepoPath);
      return;
    }

    setLoadState("loaded");
    setMessage("Choose an OpenSpec repository folder to begin.");
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlisten: (() => void) | undefined;

    void listen("open-repository-menu", () => {
      void chooseRepositoryFolder();
    }).then((nextUnlisten) => {
      unlisten = nextUnlisten;
    });

    return () => unlisten?.();
  }, [repo?.path, repoPathInput]);

  useEffect(() => {
    if (!repo || repo.state !== "ready" || !workspace || !isTauriRuntime()) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRepositoryIfChanged(repo.path);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [repo?.path, repo?.state, workspace?.fileSignature.fingerprint]);

  const changes = workspace?.changes ?? [];
  const specs = workspace?.specs ?? [];
  const selectedChange =
    changes.find(
      (change) =>
        change.id === selectedChangeId && matchesChangeFilters(change, phase, query),
    ) ?? null;
  const selectedSpec =
    specs.find((spec) => spec.id === selectedSpecId && matchesSpecFilters(spec, query)) ??
    null;

  useEffect(() => {
    if (view !== "changes") {
      return;
    }

    const nextSelectedChangeId = selectVisibleItemId(
      changes,
      selectedChangeId,
      (change) => matchesChangeFilters(change, phase, query),
    );

    if (nextSelectedChangeId !== selectedChangeId) {
      setSelectedChangeId(nextSelectedChangeId);
      setDetailTab("proposal");
    }
  }, [changes, phase, query, selectedChangeId, view]);

  useEffect(() => {
    if (view !== "specs") {
      return;
    }

    const nextSelectedSpecId = selectVisibleItemId(specs, selectedSpecId, (spec) =>
      matchesSpecFilters(spec, query),
    );

    if (nextSelectedSpecId !== selectedSpecId) {
      setSelectedSpecId(nextSelectedSpecId);
    }
  }, [query, selectedSpecId, specs, view]);

  useEffect(() => {
    if (!selectedChange) {
      return;
    }

    const tabs = detailTabsForChange(selectedChange);
    if (!tabs.some((tab) => tab.id === detailTab)) {
      setDetailTab(tabs[0]?.id ?? "archive-info");
    }
  }, [detailTab, selectedChange]);

  useEffect(() => {
    const path = artifactPathForTab(selectedChange, detailTab);

    if (!path) {
      setArtifactPreview("");
      return;
    }

    const cached = workspace?.filesByPath[path]?.content;
    if (cached !== undefined) {
      setArtifactPreview(cached);
      return;
    }

    if (!repo || !isTauriRuntime()) {
      setArtifactPreview("");
      return;
    }

    void invoke<{ contents: string }>("read_openspec_artifact_file", {
      repoPath: repo.path,
      artifactPath: path,
    })
      .then((artifact) => setArtifactPreview(artifact.contents))
      .catch(() => setArtifactPreview(""));
  }, [detailTab, repo, selectedChange, workspace]);

  async function loadRepository(repoPath: string) {
    const candidatePath = repoPath.trim();

    if (!candidatePath) {
      setCandidateError({
        kind: "missing",
        path: "",
        title: "Choose a repository folder",
        message: "Select a local folder that contains an openspec/ directory.",
      });
      setMessage("Choose a repository folder to begin.");
      return;
    }

    setLoadState("loading");
    setCandidateError(null);
    setMessage("Reading local OpenSpec files from " + candidatePath);

    if (!isTauriRuntime()) {
      const previewFiles: VirtualOpenSpecFileRecord[] = [];
      const previewStatuses: VirtualOpenSpecChangeStatusRecord[] = [];
      const indexed = indexOpenSpecWorkspace({
        files: previewFiles,
        changeStatuses: previewStatuses,
      });
      const previewRepo: RepositoryView = {
        id: BROWSER_PREVIEW_REPO_PATH,
        name: "openspec-studio",
        path: BROWSER_PREVIEW_REPO_PATH,
        branch: "browser-preview",
        state: "ready",
        summary: "Browser preview only",
      };
      const nextWorkspace = buildWorkspaceView(
        indexed,
        previewFiles,
        null,
        previewStatuses,
      );

      setRepo(previewRepo);
      setWorkspace(nextWorkspace);
      setGitStatus({
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: "Git status requires the Tauri desktop runtime.",
      });
      selectFirstItems(nextWorkspace);
      setLoadState("loaded");
      setMessage("Browser preview loaded without repository data. Run the Tauri app to inspect local files.");
      return;
    }

    try {
      const validation = await invoke<RepositoryValidationDto>("validate_repo", { repoPath: candidatePath });
      const hasOpenSpec = Boolean(validation.has_openspec ?? validation.hasOpenSpec);
      const candidateDecision = decideRepositoryCandidateOpen({
        readable: true,
        hasOpenSpec,
      });
      const isSameRepo = repo?.path === validation.path;
      const nextRepo: RepositoryView = {
        id: validation.path,
        name: validation.name,
        path: validation.path,
        branch: "local",
        state: hasOpenSpec ? "ready" : "no-workspace",
        summary: hasOpenSpec ? "OpenSpec workspace" : "No openspec/ directory",
      };

      setRepoPathInput(validation.path);
      setGitStatus(hasOpenSpec ? { ...unknownGitStatus, state: "loading", message: "Checking OpenSpec Git status..." } : unknownGitStatus);

      if (!candidateDecision.promote) {
        if (!repo) {
          setRepo(nextRepo);
          setWorkspace(null);
          setGitStatus(unknownGitStatus);
          setSelectedChangeId("");
          setSelectedSpecId("");
        }
        setCandidateError({
          kind: "no-workspace",
          path: validation.path,
          title: "No OpenSpec workspace found",
          message: "The selected folder does not contain an openspec/ directory.",
        });
        setLoadState("loaded");
        setMessage("No OpenSpec workspace was found in " + validation.path);
        return;
      }

      const fileDtos = await invoke<BridgeFileRecord[]>("list_openspec_file_records", {
        repoPath: validation.path,
      });
      const fileRecords = toVirtualFileRecords(fileDtos);
      const preliminaryIndex = indexOpenSpecWorkspace({ files: fileRecords });
      const changeStatuses = await loadChangeStatuses(
        validation.path,
        preliminaryIndex.activeChanges.map((change) => change.name),
      );
      const fileSignature = buildOpenSpecFileSignature(fileRecords);
      const indexed = indexOpenSpecWorkspace({ files: fileRecords, changeStatuses });
      const nextWorkspace = buildWorkspaceView(
        indexed,
        fileRecords,
        isSameRepo
          ? validationForFileRecords(workspace?.validation ?? null, workspace?.fileSignature, fileSignature)
          : null,
        changeStatuses,
      );

      setRepo(nextRepo);
      setWorkspace(nextWorkspace);
      setCandidateError(null);
      void loadGitStatus(validation.path);
      rememberRecentRepo(validation.path);
      if (isSameRepo) {
        keepSelectionInWorkspace(nextWorkspace);
      } else {
        selectFirstItems(nextWorkspace);
      }
      setLoadState("loaded");
      setMessage("Refreshed files: " + nextWorkspace.changes.length + " changes and " + nextWorkspace.specs.length + " specs.");
    } catch (error) {
      setCandidateError({
        kind: "unavailable",
        path: candidatePath,
        title: "Repository unavailable",
        message: errorMessage(error),
      });
      if (!repo) {
        setWorkspace(null);
        setGitStatus(unknownGitStatus);
      }
      setLoadState(repo ? "loaded" : "error");
      setMessage(errorMessage(error));
    }
  }

  async function runValidation() {
    if (!repo || repo.state !== "ready") {
      setMessage("Choose a valid OpenSpec repository before running validation.");
      return;
    }

    if (!isTauriRuntime()) {
      setMessage("Validation requires the Tauri desktop runtime and real OpenSpec files.");
      return;
    }

    setLoadState("loading");
    setMessage("Running OpenSpec validation...");

    try {
      const command = await invoke<CommandResultDto>("run_openspec_command", {
        repoPath: repo.path,
        args: ["validate", "--all", "--json"],
      });
      const rawJson = extractJsonPayload(command.stdout);
      const result =
        rawJson !== undefined
          ? parseValidationResult(rawJson, {
              validatedAt: new Date(),
              repoPath: repo.path,
            })
          : command.success
            ? parseValidationResult(command.stdout || command, {
                validatedAt: new Date(),
                repoPath: repo.path,
              })
            : createValidationCommandFailureResult({
                stdout: command.stdout,
                stderr: command.stderr,
                statusCode: command.status_code ?? command.statusCode ?? null,
                validatedAt: new Date(),
                raw: command,
              });
      const records = Object.values(workspace?.filesByPath ?? {});
      const changeStatuses = workspace?.changeStatuses ?? [];
      const indexed = indexOpenSpecWorkspace({ files: records, changeStatuses });
      const nextWorkspace = buildWorkspaceView(indexed, records, result, changeStatuses);

      setWorkspace(nextWorkspace);
      setLoadState("loaded");
      setMessage(
        result.diagnostics[0]?.message ??
          (result.state === "pass" ? "Validation checked clean." : "Validation found items that need attention."),
      );
    } catch (error) {
      setLoadState("error");
      setMessage(errorMessage(error));
    }
  }

  async function archiveChange(changeName: string) {
    if (!repo || repo.state !== "ready") {
      setMessage("Choose a valid OpenSpec repository before archiving.");
      return;
    }

    if (!isTauriRuntime()) {
      setMessage("Archive requires the Tauri desktop runtime.");
      return;
    }

    setLoadState("loading");
    setMessage("Archiving " + changeName + "...");

    try {
      await archiveOneChange(repo.path, changeName);
      await loadRepository(repo.path);
      setPhase("archived");
      setMessage("Archived " + changeName + ".");
    } catch (error) {
      setLoadState("loaded");
      setMessage(errorMessage(error));
    }
  }

  async function archiveAllChanges(changeNames: string[]) {
    if (!repo || repo.state !== "ready") {
      setMessage("Choose a valid OpenSpec repository before archiving.");
      return;
    }

    if (changeNames.length === 0) {
      setMessage("No archive-ready changes to archive.");
      return;
    }

    if (!isTauriRuntime()) {
      setMessage("Archive requires the Tauri desktop runtime.");
      return;
    }

    setLoadState("loading");
    setMessage("Archiving " + changeNames.length + " changes...");

    try {
      for (const changeName of changeNames) {
        await archiveOneChange(repo.path, changeName);
      }
      await loadRepository(repo.path);
      setPhase("archived");
      setMessage("Archived " + changeNames.length + " changes.");
    } catch (error) {
      setLoadState("loaded");
      setMessage(errorMessage(error));
    }
  }

  async function chooseRepositoryFolder() {
    if (!isTauriRuntime()) {
      setMessage("Folder selection requires the Tauri desktop runtime.");
      return;
    }

    try {
      const selectedPath = await invoke<string | null>("pick_repository_folder");

      if (!selectedPath) {
        return;
      }

      setRepoPathInput(selectedPath);
      await loadRepository(selectedPath);
    } catch (error) {
      setCandidateError({
        kind: "unavailable",
        path: repoPathInput,
        title: "Folder picker unavailable",
        message: errorMessage(error),
      });
      setMessage(errorMessage(error));
    }
  }

  async function archiveOneChange(repoPath: string, changeName: string) {
    const result = await invoke<CommandResultDto>("archive_change", {
      repoPath,
      changeName,
    });

    if (!result.success) {
      throw new Error(result.stderr || result.stdout || "OpenSpec archive did not complete.");
    }
  }

  async function loadGitStatus(repoPath: string) {
    if (!isTauriRuntime()) {
      setGitStatus({
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: "Git status requires the Tauri desktop runtime.",
      });
      return;
    }

    setGitStatus({ ...unknownGitStatus, state: "loading", message: "Checking OpenSpec Git status..." });

    try {
      const status = await invoke<OpenSpecGitStatusDto>("get_openspec_git_status", { repoPath });
      const dirtyCount = status.dirty_count ?? status.dirtyCount ?? status.entries.length;

      if (!status.available) {
        setGitStatus({
          state: "unavailable",
          dirtyCount: 0,
          entries: [],
          message: status.message ?? "Git status is unavailable for this repository.",
        });
        return;
      }

      setGitStatus({
        state: dirtyCount > 0 ? "dirty" : "clean",
        dirtyCount,
        entries: status.entries,
        message:
          dirtyCount > 0
            ? dirtyCount + " uncommitted OpenSpec " + (dirtyCount === 1 ? "path" : "paths")
            : "No uncommitted OpenSpec paths",
      });
    } catch (error) {
      setGitStatus({
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: errorMessage(error),
      });
    }
  }

  async function openArtifact(artifact: Artifact | SpecRecord) {
    if (!repo) {
      return;
    }

    const absolutePath = absoluteArtifactPath(repo.path, artifact.path);

    if (!isTauriRuntime()) {
      setMessage("Open requested: " + artifact.path);
      return;
    }

    try {
      await openPath(absolutePath);
      setMessage("Opened " + artifact.path);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function loadChangeStatuses(
    repoPath: string,
    changeNames: string[],
  ): Promise<VirtualOpenSpecChangeStatusRecord[]> {
    return Promise.all(
      changeNames.map(async (changeName) => {
        try {
          const command = await invoke<CommandResultDto>("run_openspec_command", {
            repoPath,
            args: ["status", "--change", changeName, "--json"],
          });
          const rawJson = extractJsonPayload(command.stdout);

          if (!rawJson) {
            return toVirtualChangeStatusRecord(
              {
                changeName,
                error:
                  command.stderr ||
                  command.stdout ||
                  "OpenSpec status output was not recognized.",
              },
              changeName,
            );
          }

          return toVirtualChangeStatusRecord(rawJson, changeName);
        } catch (error) {
          return toVirtualChangeStatusRecord(
            { changeName, error: errorMessage(error) },
            changeName,
          );
        }
      }),
    );
  }

  async function refreshRepositoryIfChanged(repoPath: string) {
    try {
      const fileDtos = await invoke<BridgeFileRecord[]>("list_openspec_file_records", {
        repoPath,
      });
      const fileRecords = toVirtualFileRecords(fileDtos);
      const nextSignature = buildOpenSpecFileSignature(fileRecords);

      if (nextSignature.fingerprint === workspace?.fileSignature.fingerprint) {
        void loadGitStatus(repoPath);
        return;
      }

      const preliminaryIndex = indexOpenSpecWorkspace({ files: fileRecords });
      const changeStatuses = await loadChangeStatuses(
        repoPath,
        preliminaryIndex.activeChanges.map((change) => change.name),
      );
      const indexed = indexOpenSpecWorkspace({ files: fileRecords, changeStatuses });
      const nextWorkspace = buildWorkspaceView(
        indexed,
        fileRecords,
        validationForFileRecords(workspace?.validation ?? null, workspace?.fileSignature, nextSignature),
        changeStatuses,
      );

      setWorkspace(nextWorkspace);
      keepSelectionInWorkspace(nextWorkspace);
      void loadGitStatus(repoPath);
      setMessage("OpenSpec files changed. Local files refreshed.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function rememberRecentRepo(repoPath: string) {
    if (!isPersistableLocalRepoPath(repoPath)) {
      return;
    }

    setRecentRepos((current) => {
      const next = normalizeRecentRepoPaths([
        repoPath,
        ...current.filter((path) => path !== repoPath),
      ]);
      writeRecentRepos(next);
      return next;
    });
  }

  function selectFirstItems(nextWorkspace: WorkspaceView) {
    const firstChange = nextWorkspace.changes.find((change) => change.phase === "active") ?? nextWorkspace.changes[0];
    setSelectedChangeId(firstChange?.id ?? "");
    setSelectedSpecId(nextWorkspace.specs[0]?.id ?? "");
    setDetailTab("proposal");
    setView("changes");
    setPhase("active");
    setQuery("");
  }

  function keepSelectionInWorkspace(nextWorkspace: WorkspaceView) {
    setSelectedChangeId((current) =>
      nextWorkspace.changes.some((change) => change.id === current)
        ? current
        : nextWorkspace.changes[0]?.id ?? "",
    );
    setSelectedSpecId((current) =>
      nextWorkspace.specs.some((spec) => spec.id === current)
        ? current
        : nextWorkspace.specs[0]?.id ?? "",
    );
  }

  return (
    <div className="studio-shell">
      <Sidebar
        repo={repo}
        recentRepos={recentRepos}
        candidateError={candidateError}
        repoPathInput={repoPathInput}
        loadState={loadState}
        onRepoPathInput={setRepoPathInput}
        onChooseFolder={() => void chooseRepositoryFolder()}
        onLoadRepo={() => void loadRepository(repoPathInput)}
        onOpenRecent={(path) => void loadRepository(path)}
        onRetryCandidate={(path) => void loadRepository(path)}
        onReturnToActive={() => setCandidateError(null)}
      />

      <WorkspaceMain
        repo={repo}
        workspace={workspace}
        view={view}
        phase={phase}
        query={query}
        selectedChange={selectedChange}
        selectedSpec={selectedSpec}
        loadState={loadState}
        onViewChange={setView}
        onPhaseChange={setPhase}
        onQueryChange={setQuery}
        onSelectChange={(changeId) => {
          setSelectedChangeId(changeId);
          setDetailTab("proposal");
        }}
        onSelectSpec={setSelectedSpecId}
        onChooseFolder={() => void chooseRepositoryFolder()}
        onArchiveChange={(changeName) => void archiveChange(changeName)}
        onArchiveAll={(changeNames) => void archiveAllChanges(changeNames)}
        onValidate={() => void runValidation()}
        onReload={() => repo && void loadRepository(repo.path)}
      />

      <Inspector
        repo={repo}
        workspace={workspace}
        view={view}
        selectedChange={selectedChange}
        selectedSpec={selectedSpec}
        detailTab={detailTab}
        artifactPreview={artifactPreview}
        onDetailTabChange={setDetailTab}
        onOpenArtifact={(artifact) => void openArtifact(artifact)}
        onValidate={() => void runValidation()}
      />

      <StatusBand repo={repo} workspace={workspace} gitStatus={gitStatus} loadState={loadState} message={message} />
    </div>
  );
}

function Sidebar({
  repo,
  recentRepos,
  candidateError,
  repoPathInput,
  loadState,
  onRepoPathInput,
  onChooseFolder,
  onLoadRepo,
  onOpenRecent,
  onRetryCandidate,
  onReturnToActive,
}: {
  repo: RepositoryView | null;
  recentRepos: string[];
  candidateError: CandidateRepoError | null;
  repoPathInput: string;
  loadState: LoadState;
  onRepoPathInput: (path: string) => void;
  onChooseFolder: () => void;
  onLoadRepo: () => void;
  onOpenRecent: (path: string) => void;
  onRetryCandidate: (path: string) => void;
  onReturnToActive: () => void;
}) {
  const switcherRepos = recentRepoSwitcherPaths(repo?.path, recentRepos);

  return (
    <aside className="repo-rail" aria-label="Repository navigation">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          OS
        </span>
        <div>
          <p>OpenSpec</p>
          <strong>Studio</strong>
        </div>
      </div>

      <section className="rail-section">
        <div className="rail-heading">Open repository</div>
        <div className="repo-open-stack">
          <button type="button" className="primary-button full-width-action" onClick={onChooseFolder} disabled={loadState === "loading"}>
            {loadState === "loading" ? "Opening..." : "Choose folder"}
          </button>
          <details className="manual-path">
            <summary>Enter path manually</summary>
            <form
              className="repo-path-form"
              onSubmit={(event) => {
                event.preventDefault();
                onLoadRepo();
              }}
            >
              <label>
                <span className="sr-only">Repository path</span>
                <input
                  value={repoPathInput}
                  onChange={(event) => onRepoPathInput(event.currentTarget.value)}
                  placeholder="/path/to/repo"
                />
              </label>
              <button type="submit" className="primary-outline" disabled={loadState === "loading"}>
                Open path
              </button>
            </form>
          </details>
          {candidateError ? (
            <div className={"candidate-error " + candidateError.kind}>
              <strong>{candidateError.title}</strong>
              <span>{candidateError.message}</span>
              {candidateError.path ? <code>{candidateError.path}</code> : null}
              <div className="candidate-actions">
                <button type="button" className="primary-outline" onClick={onChooseFolder}>
                  Choose folder
                </button>
                {candidateError.path ? (
                  <button type="button" className="primary-outline" onClick={() => onRetryCandidate(candidateError.path)}>
                    Retry
                  </button>
                ) : null}
                {repo?.state === "ready" ? (
                  <button type="button" className="link-button" onClick={onReturnToActive}>
                    Return to current
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rail-section">
        <div className="rail-heading">Recent sources</div>
        {switcherRepos.length > 0 ? (
          <div className="recent-repos repo-switcher">
            {switcherRepos.map((path) => (
              <button
                type="button"
                key={path}
                className={path === repo?.path ? "is-selected" : ""}
                aria-current={path === repo?.path ? "true" : undefined}
                onClick={() => onOpenRecent(path)}
              >
                <strong>{repoNameFromPath(path)}</strong>
                <span>{path}</span>
                {path === repo?.path ? <em>Current</em> : null}
              </button>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No repositories yet" body="Choose a folder to add it here." />
        )}
      </section>

    </aside>
  );
}

function WorkspaceMain({
  repo,
  workspace,
  view,
  phase,
  query,
  selectedChange,
  selectedSpec,
  loadState,
  onViewChange,
  onPhaseChange,
  onQueryChange,
  onSelectChange,
  onSelectSpec,
  onChooseFolder,
  onArchiveChange,
  onArchiveAll,
  onValidate,
  onReload,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  view: BoardView;
  phase: ChangePhase;
  query: string;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  loadState: LoadState;
  onViewChange: (view: BoardView) => void;
  onPhaseChange: (phase: ChangePhase) => void;
  onQueryChange: (query: string) => void;
  onSelectChange: (changeId: string) => void;
  onSelectSpec: (specId: string) => void;
  onChooseFolder: () => void;
  onArchiveChange: (changeName: string) => void;
  onArchiveAll: (changeNames: string[]) => void;
  onValidate: () => void;
  onReload: () => void;
}) {
  if (!repo) {
    return (
      <main className="workspace-main">
        <EmptyState
          title="Choose a repository"
          body="Open a local repository to inspect OpenSpec proposals, tasks, specs, and archive records."
          actionLabel="Choose folder"
          onAction={onChooseFolder}
        />
      </main>
    );
  }

  if (repo.state === "no-workspace") {
    return (
      <main className="workspace-main">
        <EmptyState
          tone="warning"
          title="No OpenSpec workspace found"
          body="The selected folder does not contain openspec/. Studio will not create project files without an explicit action."
          actionLabel="Choose another folder"
          onAction={onChooseFolder}
        />
      </main>
    );
  }

  if (repo.state === "cli-failure" || !workspace) {
    return (
      <main className="workspace-main">
        <EmptyState
          tone="danger"
          title="Workspace unavailable"
          body="Studio could not index this repository. Check the path, filesystem permissions, and OpenSpec CLI."
          actionLabel="Retry current repo"
          onAction={onReload}
        />
      </main>
    );
  }

  return (
    <main className="workspace-main">
      <header className="workspace-header">
        <div className="workspace-title">
          <span>OpenSpec workbench / {repo.branch}</span>
          <h1>{repo.name}</h1>
          <p>{repo.path}</p>
        </div>
        <div className="workspace-actions">
          <div className="segmented" role="tablist" aria-label="Workspace view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "changes"}
              className={view === "changes" ? "is-active" : ""}
              onClick={() => onViewChange("changes")}
            >
              Changes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "specs"}
              className={view === "specs" ? "is-active" : ""}
              onClick={() => onViewChange("specs")}
            >
              Specs
            </button>
          </div>
          <button type="button" className="primary-outline" onClick={onReload} disabled={loadState === "loading"}>
            Refresh files
          </button>
          <button type="button" className="primary-button" onClick={onValidate} disabled={loadState === "loading"}>
            Run validation
          </button>
        </div>
      </header>

      {view === "changes" ? (
        <ChangeBoard
          changes={workspace.changes}
          phase={phase}
          query={query}
          selectedChange={selectedChange}
          onPhaseChange={onPhaseChange}
          onQueryChange={onQueryChange}
          onSelectChange={onSelectChange}
          onArchiveChange={onArchiveChange}
          onArchiveAll={onArchiveAll}
        />
      ) : (
        <SpecsBrowser
          specs={workspace.specs}
          selectedSpec={selectedSpec}
          query={query}
          onQueryChange={onQueryChange}
          onSelectSpec={onSelectSpec}
        />
      )}
    </main>
  );
}

function ChangeBoard({
  changes,
  phase,
  query,
  selectedChange,
  onPhaseChange,
  onQueryChange,
  onSelectChange,
  onArchiveChange,
  onArchiveAll,
}: {
  changes: ChangeRecord[];
  phase: ChangePhase;
  query: string;
  selectedChange: ChangeRecord | null;
  onPhaseChange: (phase: ChangePhase) => void;
  onQueryChange: (query: string) => void;
  onSelectChange: (changeId: string) => void;
  onArchiveChange: (changeName: string) => void;
  onArchiveAll: (changeNames: string[]) => void;
}) {
  const [changeColumnWidth, setChangeColumnWidth] = useState(170);
  const filteredChanges = useMemo(() => {
    return changes.filter((change) => matchesChangeFilters(change, phase, query));
  }, [changes, phase, query]);
  const phaseCounts = useMemo(
    () => ({
      active: changes.filter((change) => change.phase === "active").length,
      "archive-ready": changes.filter((change) => change.phase === "archive-ready").length,
      archived: changes.filter((change) => change.phase === "archived").length,
    }),
    [changes],
  );
  function startChangeColumnResize(startX: number) {
    const startWidth = changeColumnWidth;
    const handleMouseMove = (event: MouseEvent) => {
      setChangeColumnWidth(clampNumber(startWidth + event.clientX - startX, 160, 560));
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <section className="board-panel artifact-board change-board" aria-label="Change board">
      <div className="board-toolbar board-toolbar-compact">
        <div className="segmented quiet" aria-label="Change phase">
          {(Object.keys(phaseLabels) as ChangePhase[]).map((phaseKey) => (
            <button
              type="button"
              key={phaseKey}
              className={phase === phaseKey ? "is-active" : ""}
              onClick={() => onPhaseChange(phaseKey)}
            >
              {phaseLabels[phaseKey]}
              <span>{phaseCounts[phaseKey]}</span>
            </button>
          ))}
        </div>
        <div className="board-actions">
          {phase === "archive-ready" && filteredChanges.length > 0 ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => onArchiveAll(filteredChanges.map((change) => change.name))}
            >
              Archive all
            </button>
          ) : null}
          <SearchField label="Search changes" value={query} onChange={onQueryChange} />
        </div>
      </div>

      {filteredChanges.length === 0 ? (
        <EmptyState
          compact
          title={changes.length === 0 ? "No changes indexed" : "No matching changes"}
          body={
            changes.length === 0
              ? "Checked openspec/changes/ and no changes were discovered."
              : "The current phase and search do not match any indexed changes."
          }
          actionLabel={query ? "Clear search" : undefined}
          onAction={query ? () => onQueryChange("") : undefined}
        />
      ) : (
        <div className="table-scroll">
          <table
            className={"change-table" + (phase === "archive-ready" ? " has-actions" : "")}
          >
            <colgroup>
              <col style={{ width: changeColumnWidth }} />
              <col className="trust-col" />
              <col className="tasks-col" />
              <col className="capabilities-col" />
              <col className="updated-col" />
              {phase === "archive-ready" ? <col className="action-col" /> : null}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="resizable-heading">
                  <span>Change</span>
                  <button
                    type="button"
                    className="column-resize-handle"
                    aria-label="Resize change column"
                    title="Drag to resize change column"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startChangeColumnResize(event.clientX);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setChangeColumnWidth(360);
                    }}
                  />
                </th>
                <th scope="col">Trust</th>
                <th scope="col">Tasks</th>
                <th scope="col">Capabilities</th>
                <th scope="col">Updated</th>
                {phase === "archive-ready" ? <th scope="col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredChanges.map((change) => (
                <tr
                  key={change.id}
                  role="button"
                  tabIndex={0}
                  aria-selected={selectedChange?.id === change.id}
                  className={selectedChange?.id === change.id ? "is-selected" : ""}
                  onClick={() => onSelectChange(change.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectChange(change.id);
                    }
                  }}
                >
                  <td>
                    <div className="change-title-cell artifact-title-cell">
                      <strong title={change.title}>{change.title}</strong>
                    </div>
                  </td>
                  <td>
                    <HealthPill health={change.health} label={change.statusLabel} />
                  </td>
                  <td>
                    <TaskProgressCell progress={change.taskProgress} />
                  </td>
                  <td className="capability-cell">{formatCapabilities(change.capabilities)}</td>
                  <td className="updated-cell">{change.updatedAt}</td>
                  {phase === "archive-ready" ? (
                    <td className="action-cell">
                      <button
                        type="button"
                        className="primary-outline table-action"
                        onKeyDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onArchiveChange(change.name);
                        }}
                      >
                        Archive
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SpecsBrowser({
  specs,
  selectedSpec,
  query,
  onQueryChange,
  onSelectSpec,
}: {
  specs: SpecRecord[];
  selectedSpec: SpecRecord | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectSpec: (specId: string) => void;
}) {
  const filteredSpecs = useMemo(() => {
    return specs.filter((spec) => matchesSpecFilters(spec, query));
  }, [query, specs]);

  return (
    <section className="board-panel artifact-board specs-board" aria-label="Specs board">
      <div className="board-toolbar board-toolbar-compact">
        <div>
          <h2>Specs</h2>
          <p>{specs.length} source files indexed from openspec/specs/.</p>
        </div>
        <SearchField label="Search specs" value={query} onChange={onQueryChange} />
      </div>

      {filteredSpecs.length === 0 ? (
        <EmptyState
          compact
          tone="warning"
          title={specs.length === 0 ? "No specs indexed" : "No matching specs"}
          body={
            specs.length === 0
              ? "Checked openspec/specs/ and no base specs were found."
              : "The current search does not match any indexed specs."
          }
          actionLabel={query ? "Clear search" : undefined}
          onAction={query ? () => onQueryChange("") : undefined}
        />
      ) : (
        <div className="table-scroll">
          <table className="change-table specs-table">
            <colgroup>
              <col />
              <col className="spec-trust-col" />
              <col className="spec-requirements-col" />
              <col className="spec-updated-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Spec</th>
                <th scope="col">Trust</th>
                <th scope="col">Requirements</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpecs.map((spec) => (
                <tr
                  key={spec.id}
                  role="button"
                  tabIndex={0}
                  aria-selected={selectedSpec?.id === spec.id}
                  className={selectedSpec?.id === spec.id ? "is-selected" : ""}
                  onClick={() => onSelectSpec(spec.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectSpec(spec.id);
                    }
                  }}
                >
                  <td>
                    <div className="change-title-cell artifact-title-cell">
                      <strong title={spec.capability}>{spec.capability}</strong>
                    </div>
                  </td>
                  <td>
                    <HealthPill health={spec.health} label={healthLabels[spec.health]} />
                  </td>
                  <td>{spec.requirements}</td>
                  <td className="updated-cell">{spec.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Inspector({
  repo,
  workspace,
  view,
  selectedChange,
  selectedSpec,
  detailTab,
  artifactPreview,
  onDetailTabChange,
  onOpenArtifact,
  onValidate,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  view: BoardView;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  detailTab: DetailTab;
  artifactPreview: string;
  onDetailTabChange: (tab: DetailTab) => void;
  onOpenArtifact: (artifact: Artifact | SpecRecord) => void;
  onValidate: () => void;
}) {
  if (!repo || !workspace) {
    return (
      <aside className="inspector artifact-inspector" aria-label="Artifact inspector">
        <EmptyState compact title="Artifact inspector" body="Select a valid OpenSpec repository to inspect source artifacts." />
      </aside>
    );
  }

  if (view === "specs") {
    return (
      <aside className="inspector artifact-inspector spec-inspector" aria-label="Base spec inspector">
        {selectedSpec ? (
          <>
            <div className="inspector-header">
              <span>Base spec</span>
              <h2>{selectedSpec.capability}</h2>
              <p className="path-copy">{selectedSpec.path}</p>
              <div className="inspector-actions">
                <HealthPill health={selectedSpec.health} label={healthLabels[selectedSpec.health]} />
                <button type="button" className="primary-outline" onClick={() => onOpenArtifact(selectedSpec)}>
                  Open file
                </button>
              </div>
            </div>
            <div className="inspector-body">
              <section className="inspector-section artifact-preview-section">
                <h3>Source preview</h3>
                <MarkdownPreview content={selectedSpec.sourceContent} emptyText="No spec preview available." />
              </section>
            </div>
          </>
        ) : (
          <EmptyState compact tone="warning" title="No matching spec selected" body="Adjust search or choose a visible spec." />
        )}
      </aside>
    );
  }

  if (!selectedChange) {
    return (
      <aside className="inspector artifact-inspector change-inspector" aria-label="Change artifact inspector">
        <EmptyState compact title="No change selected" body="Choose a change to reveal artifacts and validation details." />
      </aside>
    );
  }

  const tabs = detailTabsForChange(selectedChange);
  const selectedDetailTab = tabs.some((tab) => tab.id === detailTab)
    ? detailTab
    : tabs[0]?.id ?? "archive-info";
  const primaryArtifact =
    selectedChange.artifacts.find((artifact) => artifact.id === "proposal" && artifact.status === "present") ??
    selectedChange.artifacts.find((artifact) => artifact.status === "present");

  return (
    <aside className="inspector artifact-inspector change-inspector" aria-label="Change artifact inspector">
      <div className="inspector-header">
        <span>{phaseLabels[selectedChange.phase]} change</span>
        <h2>{selectedChange.title}</h2>
        <p className="path-copy">{changeSourcePath(selectedChange)}</p>
        <div className="inspector-actions">
          <HealthPill health={selectedChange.health} label={selectedChange.statusLabel} />
          <button
            type="button"
            className="primary-outline"
            disabled={!primaryArtifact}
            onClick={() => primaryArtifact && onOpenArtifact(primaryArtifact)}
          >
            {primaryArtifact?.id === "proposal" ? "Open proposal" : "Open file"}
          </button>
        </div>
      </div>

      <div className="tabs artifact-tabs" role="tablist" aria-label="Change artifacts">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={selectedDetailTab === tab.id}
            className={selectedDetailTab === tab.id ? "is-active" : ""}
            onClick={() => onDetailTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspector-body artifact-inspector-body">
        {renderDetailTab(selectedChange, selectedDetailTab, artifactPreview, workspace.validation, onOpenArtifact, onValidate)}
      </div>
    </aside>
  );
}

function renderDetailTab(
  change: ChangeRecord,
  tab: DetailTab,
  artifactPreview: string,
  validation: ValidationResult | null,
  onOpenArtifact: (artifact: Artifact) => void,
  onValidate: () => void,
) {
  if (tab === "archive-info") {
    return <ArchiveInfoPanel change={change} onOpenArtifact={onOpenArtifact} />;
  }

  if (tab === "proposal" || tab === "design") {
    return (
      <section className="inspector-section artifact-preview-section">
        <h3>{tab === "proposal" ? "proposal.md" : "design.md"}</h3>
        <MarkdownPreview content={artifactPreview} emptyText="No artifact preview available." />
      </section>
    );
  }

  if (tab === "tasks") {
    if (!change.taskProgress) {
      return (
        <EmptyState compact tone="warning" title="Task progress unavailable" body="tasks.md is missing." />
      );
    }

    const completedTasks = change.taskProgress.items.filter((item) => item.done);
    const remainingGroups = filterTaskGroups(change.taskProgress.groups, false);
    const completedGroups = filterTaskGroups(change.taskProgress.groups, true);
    const remainingCount = remainingGroups.reduce((total, group) => total + group.items.length, 0);

    return (
      <>
        <section className="inspector-section artifact-task-section">
          <div className="section-title-row">
            <h3>Open tasks</h3>
            <span>{remainingCount}</span>
          </div>
          {remainingCount > 0 ? (
            <TaskGroups groups={remainingGroups} />
          ) : (
            <p className="muted-copy">No remaining tasks. This change is ready for final checks.</p>
          )}
        </section>
        <details className="disclosure task-history">
          <summary>
            Completed tasks <span>{completedTasks.length}</span>
          </summary>
          <TaskGroups groups={completedGroups} compact />
        </details>
        <section className="inspector-section progress-section artifact-progress-section">
          <div className="section-title-row">
            <h3>tasks.md progress</h3>
            <span>{remainingCount} left</span>
          </div>
          <TaskProgressCell progress={change.taskProgress} expanded />
        </section>
      </>
    );
  }

  if (tab === "spec-delta") {
    const specArtifacts = change.artifacts.filter((artifact) => artifact.id.startsWith("delta-"));

    return specArtifacts.length > 0 ? (
      <section className="inspector-section artifact-delta-section">
        <h3>Delta specs</h3>
        <ArtifactList artifacts={specArtifacts} onOpenArtifact={onOpenArtifact} />
      </section>
    ) : (
      <EmptyState compact tone="warning" title="No spec deltas" body="No delta specs are indexed for this change." />
    );
  }

  return (
    <>
      {validation?.diagnostics.length ? (
        <details className="disclosure" open>
          <summary>OpenSpec command output</summary>
          <ul className="message-list">
            {validation.diagnostics.map((diagnostic) => (
              <li key={diagnostic.id} className="message error">
                <strong>{diagnostic.kind === "command-failure" ? "Command problem" : "Output problem"}</strong>
                <span>{diagnostic.message}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details className="disclosure" open>
        <summary>Linked check messages</summary>
        {change.validationIssues.length === 0 ? (
          <p className="muted-copy">No check messages are linked to this change.</p>
        ) : (
          <ul className="message-list">
            {change.validationIssues.map((issue) => (
              <li key={issue.id} className={"message " + issue.severity}>
                <strong>{issue.code ?? issue.severity}</strong>
                <span>{issue.message}</span>
                {issue.path ? <code>{issue.path}</code> : null}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="primary-outline full-width-action" onClick={onValidate}>
          Run validation
        </button>
      </details>

      <details className="disclosure">
        <summary>Artifact files</summary>
        <ArtifactList artifacts={change.artifacts} onOpenArtifact={onOpenArtifact} showMissing />
      </details>

      <details className="disclosure">
        <summary>Archive readiness</summary>
        <div className="readiness-summary">
          <HealthPill
            health={change.archiveReadiness.ready ? "ready" : "blocked"}
            label={change.archiveReadiness.ready ? "Ready to archive" : "Not ready"}
          />
          <ul className="detail-list">
            {change.archiveReadiness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}

export function detailTabsForChange(change: ChangeRecord): Array<{ id: DetailTab; label: string }> {
  if (change.phase !== "archived") {
    return activeDetailTabs;
  }

  const tabs = activeDetailTabs.filter((tab) => {
    if (tab.id === "status") {
      return false;
    }

    if (tab.id === "spec-delta") {
      return change.deltaSpecs.length > 0;
    }

    return change.artifacts.some((artifact) => artifact.id === tab.id && artifact.status === "present");
  });

  return [...tabs, archiveInfoTab];
}

function ArchiveInfoPanel({
  change,
  onOpenArtifact,
}: {
  change: ChangeRecord;
  onOpenArtifact: (artifact: Artifact) => void;
}) {
  const archiveInfo = change.archiveInfo;

  if (!archiveInfo) {
    return (
      <EmptyState
        compact
        tone="warning"
        title="Archive information unavailable"
        body="No archive metadata was derived for this change."
      />
    );
  }

  return (
    <>
      <section className="inspector-section two-column-facts">
        <div>
          <span>Archive folder</span>
          <strong>{archiveInfo.path}</strong>
        </div>
        <div>
          <span>Archived date</span>
          <strong>{archiveInfo.archivedDate ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Original change</span>
          <strong>{archiveInfo.originalName ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Files</span>
          <strong>{archiveInfo.files.length}</strong>
        </div>
      </section>
      <section className="inspector-section">
        <h3>Archived files</h3>
        {archiveInfo.files.length > 0 ? (
          <ArtifactList artifacts={archiveInfo.files} onOpenArtifact={onOpenArtifact} />
        ) : (
          <p className="muted-copy">No archived proposal, design, task, or spec delta files were found.</p>
        )}
      </section>
    </>
  );
}

function ArtifactList({
  artifacts,
  onOpenArtifact,
  showMissing = false,
}: {
  artifacts: Artifact[];
  onOpenArtifact: (artifact: Artifact) => void;
  showMissing?: boolean;
}) {
  const visibleArtifacts = showMissing
    ? artifacts
    : artifacts.filter((artifact) => artifact.status === "present");

  return (
    <div className="artifact-list">
      {visibleArtifacts.map((artifact) => (
        <div className="artifact-row" key={artifact.id}>
          <div>
            <strong>{artifact.label}</strong>
            <code>{artifact.path}</code>
            {artifact.note ? <span>{artifact.note}</span> : null}
          </div>
          <div className="artifact-actions">
            {artifact.status === "present" ? null : (
              <HealthPill health={artifactHealth(artifact.status)} label={artifact.status} />
            )}
            <button
              type="button"
              className="primary-outline"
              disabled={artifact.status !== "present"}
              onClick={() => onOpenArtifact(artifact)}
            >
              Open
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="search-field">
      <span className="sr-only">{label}</span>
      <input value={value} onChange={(event) => onChange(event.currentTarget.value)} placeholder={label} />
      {value ? (
        <button type="button" aria-label={"Clear " + label.toLowerCase()} onClick={() => onChange("")}>
          Clear
        </button>
      ) : null}
    </label>
  );
}

function TaskGroups({ groups, compact = false }: { groups: TaskGroup[]; compact?: boolean }) {
  return (
    <div className={compact ? "task-groups compact" : "task-groups"}>
      {groups.map((group) => (
        <section key={group.title} className="task-group">
          <h4>{group.title}</h4>
          <TaskList items={group.items} compact={compact} />
        </section>
      ))}
    </div>
  );
}

function TaskList({
  items,
  compact = false,
}: {
  items: TaskItem[];
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "task-list compact" : "task-list"}>
      {items.map((item) => (
        <li key={item.label} className={item.done ? "is-done" : ""}>
          <span className="task-check" aria-hidden="true" />
          <span className="task-label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; text: string };

function MarkdownPreview({
  content,
  emptyText,
}: {
  content: string;
  emptyText: string;
}) {
  const blocks = parseMarkdownBlocks(content);

  if (blocks.length === 0) {
    return <div className="markdown-preview markdown-empty">{emptyText}</div>;
  }

  return (
    <div className="markdown-preview">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <div
              key={index}
              className={"markdown-heading markdown-heading-" + Math.min(block.level, 4)}
            >
              {block.text}
            </div>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.kind === "code") {
          return (
            <pre key={index} className="markdown-code">
              <code>{block.text}</code>
            </pre>
          );
        }

        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: cleanMarkdownText(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ kind: "list", items: listItems.map(cleanMarkdownText) });
      listItems = [];
    }
  };
  const flushCode = () => {
    if (codeLines.length > 0) {
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      codeLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: cleanMarkdownText(heading[2]),
      });
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks;
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function StatusBand({
  repo,
  workspace,
  gitStatus,
  loadState,
  message,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  gitStatus: OpenSpecGitStatus;
  loadState: LoadState;
  message: string;
}) {
  const latestChange = latestOpenSpecChange(workspace?.changes ?? []);
  const lastValidation = formatValidationTimestamp(workspace?.validation?.validatedAt ?? null);
  const gitLabel = gitStatusLabel(gitStatus);
  const gitTitle = gitStatus.entries.length > 0 ? gitStatus.entries.join("\n") : gitStatus.message;

  return (
    <footer className="status-band" aria-label="Workspace status">
      <div className="status-band-item">
        <span>Last validation</span>
        <strong>{repo ? lastValidation : "No repo selected"}</strong>
      </div>
      <div className="status-band-item">
        <span>Latest change</span>
        <strong title={latestChange?.title ?? "No OpenSpec changes indexed"}>
          {latestChange ? latestChange.title + " · " + latestChange.updatedAt : "None indexed"}
        </strong>
      </div>
      <div className="status-band-item">
        <span>OpenSpec Git</span>
        <strong title={gitTitle}>{gitLabel}</strong>
      </div>
      <div className="status-band-toast" aria-live="polite">
        {loadState === "loading" ? "Working..." : message}
      </div>
    </footer>
  );
}

function buildWorkspaceView(
  indexed: ReturnType<typeof indexOpenSpecWorkspace>,
  files: VirtualOpenSpecFileRecord[],
  validation: ValidationResult | null,
  changeStatuses: VirtualOpenSpecChangeStatusRecord[],
): WorkspaceView {
  const filesByPath = Object.fromEntries(files.map((file) => [file.path, file]));
  const changes: ChangeRecord[] = [
    ...indexed.activeChanges.map((change) => activeChangeToView(change, filesByPath, validation)),
    ...indexed.archivedChanges.map((change) => archivedChangeToView(change, filesByPath)),
  ];

  return {
    changes,
    specs: indexed.specs.map((spec) => specToView(spec, filesByPath, validation)),
    filesByPath,
    fileSignature: buildOpenSpecFileSignature(files),
    changeStatuses,
    validation,
  };
}

function activeChangeToView(
  change: IndexedActiveChange,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
  validation: ValidationResult | null,
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
  const validationIssues = issuesForChange(validation, change.name);
  const missingArtifacts = artifacts.filter((artifact) => artifact.status === "missing");
  const health = deriveChangeHealth({
    workflowStatus: change.workflowStatus.status,
    missingArtifactCount: missingArtifacts.length,
    validation,
    validationIssueCount: validationIssues.length,
  });
  const archiveReady = Boolean(
    taskProgress &&
      taskProgress.total > 0 &&
      taskProgress.done === taskProgress.total &&
      missingArtifacts.length === 0 &&
      validationIssues.length === 0,
  );

  return {
    id: change.name,
    name: change.name,
    title: titleize(change.name),
    phase: archiveReady ? "archive-ready" : "active",
    health,
    statusLabel: healthLabels[health],
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
        ? ["All required change files are present and no linked validation errors are present."]
        : readinessReasons(taskProgress, missingArtifacts, validationIssues),
    },
  };
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

  return {
    id: change.name,
    name: change.name,
    title: titleize(change.name),
    phase: "archived",
    health: "valid",
    statusLabel: "Archived",
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
  };
}

function specToView(
  spec: IndexedSpec,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
  validation: ValidationResult | null,
): SpecRecord {
  const issues = validation?.issues.filter((issue) =>
    issue.associations.some((association) => association.kind === "spec" && association.id === spec.capability),
  ) ?? [];
  const content = filesByPath[spec.path]?.content;
  const summary = summaryFromContent(content);

  return {
    id: spec.capability,
    capability: spec.capability,
    path: spec.path,
    health:
      validation?.state === "stale"
        ? "stale"
        : issues.length > 0
          ? "invalid"
          : validation
            ? "valid"
            : "stale",
    requirements: countRequirements(content),
    updatedAt: formatTime(spec.modifiedTimeMs),
    modifiedTimeMs: spec.modifiedTimeMs ?? null,
    summary: summary ?? "",
    summaryQuality: summary ? "available" : "missing",
    validationIssues: issues,
    requirementsPreview: extractRequirementTitles(content, 6),
    sourceContent: content ?? "",
  };
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
    ...parseTaskProgressContent(content),
  };
}

function parseTaskProgressContent(content: string | undefined): { items: TaskItem[]; groups: TaskGroup[] } {
  if (!content) {
    return { items: [], groups: [] };
  }

  const groups: TaskGroup[] = [];
  let currentGroup: TaskGroup = { title: "Tasks", items: [] };

  for (const line of content.split(/\r?\n/)) {
    const heading = /^\s*#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      if (currentGroup.items.length > 0 || currentGroup.title !== "Tasks") {
        groups.push(currentGroup);
      }
      currentGroup = { title: cleanMarkdownText(heading[1] ?? "Tasks"), items: [] };
      continue;
    }

    const task = /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (!task) {
      continue;
    }

    currentGroup.items.push({
      done: task[1]?.toLowerCase() === "x",
      label: task[2] ?? "",
    });
  }

  if (currentGroup.items.length > 0 || groups.length === 0) {
    groups.push(currentGroup);
  }

  const populatedGroups = groups.filter((group) => group.items.length > 0);

  return {
    items: populatedGroups.flatMap((group) => group.items),
    groups: populatedGroups,
  };
}

function filterTaskGroups(groups: TaskGroup[], done: boolean): TaskGroup[] {
  return groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => item.done === done),
    }))
    .filter((group) => group.items.length > 0);
}

function matchesChangeFilters(change: ChangeRecord, phase: ChangePhase, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    change.phase === phase &&
    (normalizedQuery.length === 0 ||
      change.title.toLowerCase().includes(normalizedQuery) ||
      change.name.toLowerCase().includes(normalizedQuery) ||
      change.capabilities.some((capability) => capability.toLowerCase().includes(normalizedQuery)))
  );
}

function matchesSpecFilters(spec: SpecRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    normalizedQuery.length === 0 ||
    spec.capability.toLowerCase().includes(normalizedQuery) ||
    spec.summary.toLowerCase().includes(normalizedQuery)
  );
}

function issuesForChange(validation: ValidationResult | null, changeName: string): ValidationIssue[] {
  return (
    validation?.issues.filter((issue) =>
      issue.associations.some((association) => association.kind === "change" && association.id === changeName),
    ) ?? []
  );
}

function readinessReasons(
  taskProgress: TaskProgress | null,
  missingArtifacts: Artifact[],
  validationIssues: ValidationIssue[],
): string[] {
  const reasons: string[] = [];

  if (!taskProgress) {
    reasons.push("Task progress is unavailable.");
  } else if (taskProgress.done < taskProgress.total) {
    reasons.push(taskProgress.total - taskProgress.done + " tasks remain open.");
  }

  if (missingArtifacts.length > 0) {
    reasons.push("Missing files: " + missingArtifacts.map((artifact) => artifact.label).join(", ") + ".");
  }

  if (validationIssues.length > 0) {
    reasons.push(validationIssues.length + " linked validation issues need attention.");
  }

  return reasons.length > 0 ? reasons : ["Refresh validation to confirm archive readiness."];
}

function artifactPathForTab(change: ChangeRecord | null, tab: DetailTab): string | undefined {
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

function artifactHealth(status: ArtifactStatus): Health {
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

function formatTime(modifiedTimeMs: number | undefined): string {
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

function formatValidationTimestamp(value: string | null): string {
  if (!value) {
    return "Not run";
  }

  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return "Unknown";
  }

  return formatTime(time);
}

function latestOpenSpecChange(changes: ChangeRecord[]): ChangeRecord | null {
  return changes.reduce<ChangeRecord | null>((latest, change) => {
    if (!change.modifiedTimeMs) {
      return latest;
    }

    if (!latest?.modifiedTimeMs || change.modifiedTimeMs > latest.modifiedTimeMs) {
      return change;
    }

    return latest;
  }, null);
}

function gitStatusLabel(status: OpenSpecGitStatus): string {
  if (status.state === "loading") {
    return "Checking...";
  }

  if (status.state === "clean") {
    return "Clean";
  }

  if (status.state === "dirty") {
    return status.dirtyCount + " uncommitted";
  }

  if (status.state === "unavailable") {
    return "Unavailable";
  }

  return "Not checked";
}

function formatCapabilities(capabilities: string[]): string {
  if (capabilities.length === 0) {
    return "None";
  }

  if (capabilities.length <= 2) {
    return capabilities.join(", ");
  }

  return capabilities.slice(0, 2).join(", ") + " +" + (capabilities.length - 2);
}

function changeSourcePath(change: ChangeRecord): string {
  return change.archiveInfo?.path ?? "openspec/changes/" + change.name + "/";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function absoluteArtifactPath(repoPath: string, artifactPath: string): string {
  if (artifactPath.startsWith("/")) {
    return artifactPath;
  }

  return repoPath.replace(/\/$/, "") + "/" + artifactPath;
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

function repoNameFromPath(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function readRecentRepos(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_REPOS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return normalizeRecentRepoPaths(parsed);
  } catch {
    return [];
  }
}

function writeRecentRepos(paths: string[]) {
  try {
    window.localStorage.setItem(RECENT_REPOS_STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Recent repos are a convenience. Indexing must keep working without storage.
  }
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
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

function EmptyState({
  title,
  body,
  tone = "neutral",
  compact = false,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  tone?: "neutral" | "warning" | "danger";
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className={"empty-state " + tone + (compact ? " compact" : "")}>
      <div className="empty-icon" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <button type="button" className="primary-outline" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function TaskProgressCell({ progress, expanded = false }: { progress: TaskProgress | null; expanded?: boolean }) {
  if (!progress || progress.total === 0) {
    return <span className="unavailable">Unavailable</span>;
  }

  const percent = Math.round((progress.done / progress.total) * 100);

  return (
    <div className={"progress-cell" + (expanded ? " expanded" : "")}>
      <div className="progress-copy">
        <strong>
          {progress.done}/{progress.total}
        </strong>
        <span>{percent}%</span>
      </div>
      <div className="progress-track" aria-label={"Task progress " + percent + " percent"}>
        <span style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}

function HealthPill({ health, label }: { health: Health; label: string }) {
  return (
    <span className={"health-pill " + health}>
      <StatusDot health={health} />
      {label}
    </span>
  );
}

function StatusDot({ health }: { health: Health }) {
  return <span className={"status-dot " + health} aria-hidden="true" />;
}

export default App;
