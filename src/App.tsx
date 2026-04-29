import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import "./App.css";

import {
  activeChangeNamesFromFileRecords,
  buildVirtualFilesByPath,
  buildOpenSpecFileSignature,
  deriveChangeHealth,
  decideRepositoryCandidateOpen,
  createOpenSpecOperationIssue,
  extractJsonPayload,
  isPersistableLocalRepoPath,
  selectVisibleItemId,
  sameOpenSpecOperationScope,
  toVirtualChangeStatusRecord,
  toVirtualFileRecords,
  type ChangeHealth,
  type BridgeFileRecord,
  type OpenSpecOperationIssue,
  type OpenSpecFileSignature,
  buildRunnerDispatchPayload,
  deriveRunnerDispatchEligibility,
  runnerDispatchHistoryForChange,
  type RunnerDispatchAttempt,
  type RunnerDispatchEligibility,
  type RunnerDispatchRequestInput,
  type RunnerSettings,
  type RunnerStatus,
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
import {
  createDefaultPersistedAppState,
  directionFromSortPreference,
  loadPersistedAppState,
  normalizePersistedAppState,
  rememberPersistedRepo,
  savePersistedAppState,
  sortPreferenceFromDirection,
  updatePersistedRepoSelection,
  updatePersistedRepoSort,
  updatePersistedValidationSnapshot,
  upsertRunnerDispatchAttempt,
  validationFromPersistedSnapshot,
  type PersistedAppState,
  type PersistedRecentRepo,
} from "./persistence";

type RepoState = "ready" | "no-workspace" | "cli-failure";
type BoardView = "changes" | "specs";
type ChangePhase = "active" | "archive-ready" | "archived";
type DetailTab = "proposal" | "design" | "tasks" | "spec-delta" | "status" | "archive-info";
type Health = ChangeHealth;
type ArtifactStatus = "present" | "missing" | "blocked";
type LoadState = "idle" | "loading" | "loaded" | "error";
type CandidateErrorKind = "missing" | "no-workspace" | "unavailable";
export type BoardTableSortDirection = "asc" | "desc";

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


interface RunnerStatusDto {
  configured: boolean;
  reachable: boolean;
  status: string;
  endpoint?: string | null;
  status_code?: number | null;
  statusCode?: number | null;
  message: string;
  response_body?: string | null;
  responseBody?: string | null;
  managed?: boolean;
  pid?: number | null;
}

interface RunnerLifecycleResponseDto {
  started: boolean;
  endpoint: string;
  port: number;
  pid?: number | null;
  message: string;
}

interface RunnerDispatchResponseDto {
  event_id: string;
  eventId?: string;
  status_code: number;
  statusCode?: number;
  accepted: boolean;
  message: string;
  response_body?: string | null;
  responseBody?: string | null;
  run_id?: string | null;
  runId?: string | null;
}

interface RunnerDispatchRequestDto {
  eventId: string;
  repoPath: string;
  repoName: string;
  changeName: string;
  artifactPaths: string[];
  validation: {
    state: ValidationResult["state"];
    checkedAt: string | null;
    issueCount: number;
  };
  gitRef: string;
  requestedBy: string;
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
  content: string | undefined;
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
  searchText: string;
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
  searchText: string;
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

interface ValidationIssueMaps {
  byChange: Map<string, ValidationIssue[]>;
  bySpec: Map<string, ValidationIssue[]>;
}

interface StatusCacheEntry {
  freshnessKey: string;
  record: VirtualOpenSpecChangeStatusRecord;
}

interface BoundedRows<T> {
  rows: T[];
  hiddenCount: number;
}

interface BoardTableSortConfig<T> {
  defaultDirection?: BoardTableSortDirection;
  getValue: (row: T) => number | null | undefined;
}

interface BoardTableColumn<T> {
  id: string;
  label: string;
  colClassName?: string;
  cellClassName?: string;
  sortable?: BoardTableSortConfig<T>;
  render: (row: T) => ReactNode;
}

interface BoardTableSortState {
  columnId: string;
  direction: BoardTableSortDirection;
}

interface BoardTableResizeConfig {
  columnId: string;
  cssVariable: string;
  defaultWidth: number;
  resetWidth: number;
  minWidth: number;
  maxWidth: number;
  ariaLabel: string;
  title: string;
}

const BROWSER_PREVIEW_REPO_PATH = "browser-preview://openspec-studio";
const AUTO_REFRESH_INTERVAL_MS = 15_000;
const STATUS_COMMAND_CONCURRENCY = 4;
const MAX_OPERATION_ISSUES = 6;
const STATUS_CACHE_LIMIT = 300;
const MARKDOWN_BLOCK_CACHE_LIMIT = 40;
const ROW_RENDER_BATCH_SIZE = 250;

const defaultRunnerSettings: RunnerSettings = {
  endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events",
};

const unknownRunnerStatus: RunnerStatus = {
  state: "not-configured",
  label: "Runner not configured",
  detail: "Add a local Studio Runner endpoint and generate a session secret to enable Build with agent.",
};

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
  const [persistedAppState, setPersistedAppState] = useState<PersistedAppState>(
    createDefaultPersistedAppState,
  );
  const [repoPathInput, setRepoPathInput] = useState("");
  const [repo, setRepo] = useState<RepositoryView | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [candidateError, setCandidateError] = useState<CandidateRepoError | null>(null);
  const [view, setView] = useState<BoardView>("changes");
  const [phase, setPhase] = useState<ChangePhase>("active");
  const [changesQuery, setChangesQuery] = useState("");
  const [specsQuery, setSpecsQuery] = useState("");
  const [selectedChangeId, setSelectedChangeId] = useState("");
  const [selectedSpecId, setSelectedSpecId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("proposal");
  const [artifactPreview, setArtifactPreview] = useState("");
  const [gitStatus, setGitStatus] = useState<OpenSpecGitStatus>(unknownGitStatus);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [runnerSettings, setRunnerSettings] = useState<RunnerSettings>(defaultRunnerSettings);
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus>(unknownRunnerStatus);
  const [runnerSessionSecretConfigured, setRunnerSessionSecretConfigured] = useState(false);
  const [runnerDispatchBusy, setRunnerDispatchBusy] = useState(false);
  const [runnerLifecycleBusy, setRunnerLifecycleBusy] = useState(false);
  const [message, setMessage] = useState("Loading local workspace...");
  const [operationIssues, setOperationIssues] = useState<OpenSpecOperationIssue[]>([]);
  const repoLoadGenerationRef = useRef(0);
  const refreshGenerationRef = useRef(0);
  const gitStatusGenerationRef = useRef(0);
  const runnerStatusGenerationRef = useRef(0);
  const artifactPreviewGenerationRef = useRef(0);
  const validationGenerationRef = useRef(0);
  const archiveInFlightRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const chooseRepositoryFolderRef = useRef<() => Promise<void>>(async () => undefined);
  const statusCacheRef = useRef<Map<string, StatusCacheEntry>>(new Map());
  const backgroundRefreshInFlightRef = useRef<Set<string>>(new Set());
  const persistedAppStateRef = useRef<PersistedAppState>(persistedAppState);
  const workspaceRef = useRef<WorkspaceView | null>(workspace);
  const repoRef = useRef<RepositoryView | null>(repo);
  const gitStatusRef = useRef<OpenSpecGitStatus>(gitStatus);
  const runnerSettingsRef = useRef<RunnerSettings>(runnerSettings);
  const deferredChangesQuery = useDeferredValue(changesQuery);
  const deferredSpecsQuery = useDeferredValue(specsQuery);

  const recentRepos = persistedAppState.recentRepos;
  const activeRepoState = repo?.path ? persistedAppState.repoStateByPath[repo.path] : undefined;

  persistedAppStateRef.current = persistedAppState;
  workspaceRef.current = workspace;
  repoRef.current = repo;
  gitStatusRef.current = gitStatus;
  runnerSettingsRef.current = runnerSettings;
  chooseRepositoryFolderRef.current = chooseRepositoryFolder;

  function recordOperationIssue(issue: OpenSpecOperationIssue) {
    setOperationIssues((current) => [
      issue,
      ...current.filter((existing) => !sameOpenSpecOperationScope(existing, issue)),
    ].slice(0, MAX_OPERATION_ISSUES));
  }

  function clearOperationIssues(predicate: (issue: OpenSpecOperationIssue) => boolean) {
    setOperationIssues((current) => current.filter((issue) => !predicate(issue)));
  }

  function dismissOperationIssue(issueId: string) {
    setOperationIssues((current) => current.filter((issue) => issue.id !== issueId));
  }

  async function initializeAppPersistence() {
    let initialState = createDefaultPersistedAppState();

    if (isTauriRuntime()) {
      try {
        initialState = await loadPersistedAppState();
      } catch (error) {
        console.warn("OpenSpec Studio persistence could not be loaded.", error);
      }
    }

    persistenceReadyRef.current = true;
    persistedAppStateRef.current = initialState;
    setPersistedAppState(initialState);
    setRunnerSettings(initialState.runnerSettings ?? defaultRunnerSettings);

    const lastRepoPath = initialState.lastRepoPath ?? initialState.recentRepos[0]?.path;

    if (lastRepoPath) {
      setRepoPathInput(lastRepoPath);
      await loadRepository(lastRepoPath);
      return;
    }

    setLoadState("loaded");
    setMessage("Choose an OpenSpec repository folder to begin.");
  }

  function updatePersistedState(updater: (state: PersistedAppState) => PersistedAppState) {
    const nextState = normalizePersistedAppState(updater(persistedAppStateRef.current));

    persistedAppStateRef.current = nextState;
    setPersistedAppState(nextState);

    if (!persistenceReadyRef.current || !isTauriRuntime()) {
      return;
    }

    void savePersistedAppState(nextState).catch((error) => {
      console.warn("OpenSpec Studio persistence could not be saved.", error);
    });
  }

  function updateRunnerSettings(nextSettings: RunnerSettings) {
    const normalized = {
      endpoint: nextSettings.endpoint.trim(),
    };

    setRunnerSettings(normalized);
    updatePersistedState((current) => ({
      ...current,
      runnerSettings: normalized,
    }));
  }

  async function configureRunnerSessionSecret() {
    if (!isTauriRuntime()) {
      setMessage("Studio Runner session setup requires the Tauri desktop runtime.");
      return;
    }

    try {
      const secret = createRunnerSessionSecret();
      await invoke("configure_studio_runner_session_secret", { secret });
      setRunnerSessionSecretConfigured(true);
      setMessage("Studio Runner session secret generated for this app session.");
      await checkRunnerStatus({ quiet: true });
    } catch (error) {
      setRunnerSessionSecretConfigured(false);
      setMessage("Studio Runner session setup failed: " + errorMessage(error));
    }
  }

  async function clearRunnerSessionSecret() {
    if (isTauriRuntime()) {
      try {
        await invoke("clear_studio_runner_session_secret");
      } catch (error) {
        console.warn("Studio Runner session secret could not be cleared.", error);
      }
    }
    setRunnerSessionSecretConfigured(false);
    setRunnerStatus(unknownRunnerStatus);
    setMessage("Studio Runner session secret cleared.");
  }

  async function startRunner() {
    if (!isTauriRuntime()) {
      setMessage("Starting Studio Runner requires the Tauri desktop runtime.");
      return;
    }
    if (!runnerSessionSecretConfigured) {
      try {
        const secret = createRunnerSessionSecret();
        await invoke("configure_studio_runner_session_secret", { secret });
        setRunnerSessionSecretConfigured(true);
      } catch (error) {
        setRunnerSessionSecretConfigured(false);
        setMessage("Studio Runner session setup failed: " + errorMessage(error));
        return;
      }
    }
    const endpoint = runnerSettingsRef.current.endpoint.trim() || defaultRunnerSettings.endpoint;
    if (!runnerSettingsRef.current.endpoint.trim()) {
      updateRunnerSettings(defaultRunnerSettings);
    }
    setRunnerLifecycleBusy(true);
    setRunnerStatus({
      state: "starting",
      label: "Starting runner",
      detail: "Starting local Studio Runner and waiting for health check.",
    });
    try {
      const dto = await invoke<RunnerLifecycleResponseDto>("start_studio_runner", {
        request: {
          repoPath: runnerRepoPath(),
          endpoint,
        },
      });
      setMessage(dto.message);
      await checkRunnerStatus({ quiet: true });
    } catch (error) {
      const nextStatus: RunnerStatus = {
        state: "unavailable",
        label: "Runner unavailable",
        detail: errorMessage(error),
      };
      setRunnerStatus(nextStatus);
      setMessage("Studio Runner start failed: " + errorMessage(error));
    } finally {
      setRunnerLifecycleBusy(false);
    }
  }

  async function stopRunner() {
    if (!isTauriRuntime()) {
      setMessage("Stopping Studio Runner requires the Tauri desktop runtime.");
      return;
    }
    setRunnerLifecycleBusy(true);
    try {
      const dto = await invoke<RunnerLifecycleResponseDto>("stop_studio_runner");
      setMessage(dto.message);
      setRunnerStatus(unknownRunnerStatus);
    } catch (error) {
      setMessage("Studio Runner stop failed: " + errorMessage(error));
    } finally {
      setRunnerLifecycleBusy(false);
    }
  }

  async function checkRunnerStatus(options: { quiet?: boolean } = {}) {
    const settings = runnerSettingsRef.current;
    const requestId = ++runnerStatusGenerationRef.current;

    if (!settings.endpoint.trim() || !runnerSessionSecretConfigured) {
      const nextStatus = { ...unknownRunnerStatus };
      if (!options.quiet) {
        setMessage(nextStatus.detail);
      }
      setRunnerStatus(nextStatus);
      return nextStatus;
    }

    if (!isTauriRuntime()) {
      const nextStatus: RunnerStatus = {
        state: "unavailable",
        label: "Desktop runtime required",
        detail: "Runner status checks require the Tauri desktop runtime.",
      };
      setRunnerStatus(nextStatus);
      if (!options.quiet) {
        setMessage(nextStatus.detail);
      }
      return nextStatus;
    }

    if (!options.quiet) {
      setRunnerStatus({
        state: "checking",
        label: "Checking runner",
        detail: "Checking the configured Studio Runner endpoint.",
      });
    }

    try {
      const dto = await invoke<RunnerStatusDto>("check_studio_runner_status", {
        settings,
      });
      if (runnerStatusGenerationRef.current !== requestId) {
        return runnerStatus;
      }
      const nextStatus = runnerStatusFromDto(dto);
      setRunnerStatus(nextStatus);
      if (!options.quiet) {
        setMessage(nextStatus.detail);
      }
      return nextStatus;
    } catch (error) {
      if (runnerStatusGenerationRef.current !== requestId) {
        return runnerStatus;
      }
      const nextStatus: RunnerStatus = {
        state: "unavailable",
        label: "Runner unavailable",
        detail: errorMessage(error),
      };
      setRunnerStatus(nextStatus);
      if (!options.quiet) {
        setMessage(nextStatus.detail);
      }
      return nextStatus;
    }
  }

  async function dispatchSelectedChange(options: { retryAttempt?: RunnerDispatchAttempt } = {}) {
    if (!repo || repo.state !== "ready" || !workspace || !selectedChange) {
      setMessage("Select an active OpenSpec change before dispatching.");
      return;
    }

    if (!isTauriRuntime()) {
      setMessage("Build with agent requires the Tauri desktop runtime.");
      return;
    }

    const initialEligibility = deriveRunnerDispatchEligibility({
      repoReady: true,
      change: selectedChange,
      validation: workspace.validation,
      runnerSettings,
      runnerStatus,
      sessionSecretConfigured: runnerSessionSecretConfigured,
    });

    if (!options.retryAttempt && !initialEligibility.eligible) {
      setMessage(initialEligibility.reasons[0] ?? "This change is not ready for runner dispatch.");
      return;
    }

    setRunnerDispatchBusy(true);
    setMessage(options.retryAttempt ? "Retrying Studio Runner dispatch..." : "Preparing Studio Runner dispatch...");
    const repoPath = repo.path;
    const changeName = selectedChange.name;

    let pendingAttempt: RunnerDispatchAttempt | undefined;

    try {
      let validation = workspaceRef.current?.validation ?? null;
      if (!validation || validation.state !== "pass") {
        setMessage("Validating before Studio Runner dispatch...");
        validation = await runValidationCommand(repoPath);
        applyValidationResult(validation);
        recordValidationOperationResult(repoPath, validation);
        rememberValidationSnapshot(repoPath, validation);
      }

      const latestChange = workspaceRef.current?.changes.find((change) => change.name === changeName) ?? selectedChange;
      const latestEligibility = deriveRunnerDispatchEligibility({
        repoReady: true,
        change: latestChange,
        validation,
        runnerSettings,
        runnerStatus: runnerStatus.state === "reachable"
          ? runnerStatus
          : await checkRunnerStatus({ quiet: true }),
        sessionSecretConfigured: runnerSessionSecretConfigured,
      });

      if (!latestEligibility.eligible) {
        setMessage(latestEligibility.reasons[0] ?? "This change is not ready for runner dispatch.");
        return;
      }

      const eventId = options.retryAttempt?.eventId ?? createRunnerEventId();
      const payload = buildRunnerDispatchPayload({
        eventId,
        repo,
        change: latestChange,
        validation,
        gitStatus: gitStatusRef.current,
      });
      pendingAttempt = createRunnerDispatchAttempt({
        eventId,
        repoPath,
        changeName,
        payload,
        status: "pending",
        message: options.retryAttempt ? "Retrying dispatch." : "Dispatch queued.",
        previousAttempt: options.retryAttempt,
      });

      rememberRunnerDispatchAttempt(pendingAttempt);
      setMessage("Sending signed build.requested to Studio Runner...");

      const response = await invoke<RunnerDispatchResponseDto>("dispatch_studio_runner_event", {
        settings: runnerSettings,
        request: toRunnerDispatchRequestDto(payload),
      });
      const accepted = Boolean(response.accepted);
      const statusCode = response.status_code ?? response.statusCode;
      const responseBody = response.response_body ?? response.responseBody ?? null;
      const runId = response.run_id ?? response.runId ?? extractRunId(responseBody);
      const nextAttempt = createRunnerDispatchAttempt({
        ...pendingAttempt,
        status: accepted ? "accepted" : "failed",
        statusCode,
        runId,
        responseBody,
        message: response.message,
      });

      rememberRunnerDispatchAttempt(nextAttempt);
      clearOperationIssues(
        (issue) => issue.kind === "runner-dispatch" && issue.repoPath === repoPath && issue.target === changeName,
      );
      setMessage(
        accepted
          ? "Studio Runner accepted " + changeName + (runId ? " as " + runId + "." : ".")
          : "Studio Runner dispatch failed: " + response.message,
      );
    } catch (error) {
      if (pendingAttempt) {
        const failedAttempt = createRunnerDispatchAttempt({
          ...pendingAttempt,
          status: "failed",
          message: errorMessage(error),
        });
        rememberRunnerDispatchAttempt(failedAttempt);
      }
      recordOperationIssue(
        createOpenSpecOperationIssue({
          kind: "runner-dispatch",
          title: "Runner dispatch failed",
          message: errorMessage(error),
          fallbackMessage: "Studio Runner dispatch did not complete.",
          repoPath,
          target: changeName,
        }),
      );
      setMessage("Studio Runner dispatch failed: " + errorMessage(error));
    } finally {
      setRunnerDispatchBusy(false);
    }
  }

  function rememberRunnerDispatchAttempt(attempt: RunnerDispatchAttempt) {
    updatePersistedState((current) => upsertRunnerDispatchAttempt(current, attempt));
  }

  useEffect(() => {
    void initializeAppPersistence();
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen("open-repository-menu", () => {
      void chooseRepositoryFolderRef.current();
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }

      unlisten = nextUnlisten;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    void checkRunnerStatus({ quiet: true });
  }, [runnerSettings.endpoint, runnerSessionSecretConfigured]);

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
  const changeSortDirection = directionFromSortPreference(activeRepoState?.changeSort);
  const specSortDirection = directionFromSortPreference(activeRepoState?.specSort);
  const selectedChange =
    changes.find(
      (change) =>
        change.id === selectedChangeId && matchesChangeFilters(change, phase, deferredChangesQuery),
    ) ?? null;
  const selectedSpec =
    specs.find((spec) => spec.id === selectedSpecId && matchesSpecFilters(spec, deferredSpecsQuery)) ??
    null;
  const selectedChangeDispatchHistory = selectedChange
    ? runnerDispatchHistoryForChange(
        persistedAppState.runnerDispatchAttempts,
        repo?.path,
        selectedChange.name,
      )
    : [];
  const selectedChangeRunnerEligibility = deriveRunnerDispatchEligibility({
    repoReady: Boolean(repo && repo.state === "ready" && isPersistableLocalRepoPath(repo.path)),
    change: selectedChange,
    validation: workspace?.validation ?? null,
    runnerSettings,
    runnerStatus,
    sessionSecretConfigured: runnerSessionSecretConfigured,
  });

  useEffect(() => {
    if (view !== "changes") {
      return;
    }

    const nextSelectedChangeId = selectVisibleItemId(
      changes,
      selectedChangeId,
      (change) => matchesChangeFilters(change, phase, deferredChangesQuery),
    );

    if (nextSelectedChangeId !== selectedChangeId) {
      setSelectedChangeId(nextSelectedChangeId);
      setDetailTab("proposal");
    }
  }, [changes, phase, deferredChangesQuery, selectedChangeId, view]);

  useEffect(() => {
    if (view !== "specs") {
      return;
    }

    const nextSelectedSpecId = selectVisibleItemId(specs, selectedSpecId, (spec) =>
      matchesSpecFilters(spec, deferredSpecsQuery),
    );

    if (nextSelectedSpecId !== selectedSpecId) {
      setSelectedSpecId(nextSelectedSpecId);
    }
  }, [deferredSpecsQuery, selectedSpecId, specs, view]);

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
    if (!repo || repo.state !== "ready" || !workspace) {
      return;
    }

    updatePersistedState((current) =>
      updatePersistedRepoSelection(current, repo.path, {
        changeId: selectedChangeId,
        specId: selectedSpecId,
      }),
    );
  }, [repo?.path, repo?.state, selectedChangeId, selectedSpecId, workspace?.fileSignature.fingerprint]);

  useEffect(() => {
    const requestId = ++artifactPreviewGenerationRef.current;
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

    const repoPath = repo.path;
    void invoke<{ contents: string }>("read_openspec_artifact_file", {
      repoPath,
      artifactPath: path,
    })
      .then((artifact) => {
        if (artifactPreviewGenerationRef.current === requestId && repoRef.current?.path === repoPath) {
          setArtifactPreview(artifact.contents);
          clearOperationIssues(
            (issue) => issue.kind === "artifact-read" && issue.repoPath === repoPath && issue.target === path,
          );
        }
      })
      .catch((error) => {
        if (artifactPreviewGenerationRef.current === requestId && repoRef.current?.path === repoPath) {
          recordOperationIssue(
            createOpenSpecOperationIssue({
              kind: "artifact-read",
              title: "Artifact read failed",
              message: errorMessage(error),
              fallbackMessage: "OpenSpec artifact could not be read.",
              repoPath,
              target: path,
            }),
          );
          setArtifactPreview("");
        }
      });
  }, [detailTab, repo, selectedChange, workspace]);

  async function loadRepository(repoPath: string) {
    const requestId = ++repoLoadGenerationRef.current;
    refreshGenerationRef.current += 1;
    artifactPreviewGenerationRef.current += 1;
    validationGenerationRef.current += 1;
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

      if (repoLoadGenerationRef.current !== requestId) {
        return;
      }

      repoRef.current = previewRepo;
      workspaceRef.current = nextWorkspace;
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
      if (repoLoadGenerationRef.current !== requestId) {
        return;
      }

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
          repoRef.current = nextRepo;
          workspaceRef.current = null;
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
      if (repoLoadGenerationRef.current !== requestId) {
        return;
      }

      const fileRecords = toVirtualFileRecords(fileDtos);
      const changeStatuses = await loadChangeStatuses(
        validation.path,
        fileRecords,
        activeChangeNamesFromFileRecords(fileRecords),
      );
      if (repoLoadGenerationRef.current !== requestId) {
        return;
      }

      const fileSignature = buildOpenSpecFileSignature(fileRecords);
      const indexed = indexOpenSpecWorkspace({ files: fileRecords, changeStatuses });
      const persistedRepoState = persistedAppStateRef.current.repoStateByPath[validation.path];
      const restoredValidation = isSameRepo
        ? validationForFileRecords(workspaceRef.current?.validation ?? null, workspaceRef.current?.fileSignature, fileSignature)
        : validationFromPersistedSnapshot(persistedRepoState?.lastValidation, fileSignature);
      const nextWorkspace = buildWorkspaceView(
        indexed,
        fileRecords,
        restoredValidation,
        changeStatuses,
        fileSignature,
      );

      repoRef.current = nextRepo;
      workspaceRef.current = nextWorkspace;
      setRepo(nextRepo);
      setWorkspace(nextWorkspace);
      setCandidateError(null);
      clearOperationIssues(
        (issue) => issue.kind === "repository-read" && issue.repoPath === validation.path,
      );
      void loadGitStatus(validation.path);
      rememberRecentRepo(validation.path, validation.name);
      if (isSameRepo) {
        keepSelectionInWorkspace(nextWorkspace);
      } else {
        restorePersistedSelection(nextWorkspace, persistedRepoState);
      }
      setLoadState("loaded");
      setMessage("Refreshed files: " + nextWorkspace.changes.length + " changes and " + nextWorkspace.specs.length + " specs.");
    } catch (error) {
      if (repoLoadGenerationRef.current !== requestId) {
        return;
      }

      setCandidateError({
        kind: "unavailable",
        path: candidatePath,
        title: "Repository unavailable",
        message: errorMessage(error),
      });
      recordOperationIssue(
        createOpenSpecOperationIssue({
          kind: "repository-read",
          title: "Repository read failed",
          message: errorMessage(error),
          fallbackMessage: "OpenSpec repository files could not be read.",
          repoPath: candidatePath,
          target: "openspec",
        }),
      );
      if (!repo) {
        workspaceRef.current = null;
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
    const requestId = ++validationGenerationRef.current;
    const repoPath = repo.path;

    try {
      const result = await runValidationCommand(repoPath);
      if (validationGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      applyValidationResult(result);
      recordValidationOperationResult(repoPath, result);
      rememberValidationSnapshot(repoPath, result);
      setLoadState("loaded");
      setMessage(
        result.diagnostics[0]?.message ??
          (result.state === "pass" ? "Validation checked clean." : "Validation found items that need attention."),
      );
    } catch (error) {
      if (validationGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      setLoadState("error");
      recordOperationIssue(
        createOpenSpecOperationIssue({
          kind: "validation",
          title: "Validation failed",
          message: errorMessage(error),
          fallbackMessage: "OpenSpec validation did not complete cleanly.",
          repoPath,
          target: "validate --all",
        }),
      );
      setMessage(errorMessage(error));
    }
  }

  async function archiveChange(changeName: string) {
    if (archiveInFlightRef.current) {
      setMessage("Archive already in progress.");
      return;
    }

    if (!repo || repo.state !== "ready") {
      setMessage("Choose a valid OpenSpec repository before archiving.");
      return;
    }

    if (!isTauriRuntime()) {
      setMessage("Archive requires the Tauri desktop runtime.");
      return;
    }

    archiveInFlightRef.current = true;
    setArchiveBusy(true);
    setLoadState("loading");
    setMessage("Validating before archiving " + changeName + "...");
    const repoPath = repo.path;

    try {
      const validation = await runValidationCommand(repoPath);
      applyValidationResult(validation);
      recordValidationOperationResult(repoPath, validation);
      rememberValidationSnapshot(repoPath, validation);

      if (!canArchiveAfterValidation(validation)) {
        setLoadState("loaded");
        setMessage(archiveValidationFailureMessage(validation));
        return;
      }

      setMessage("Archiving " + changeName + "...");
      await archiveOneChange(repoPath, changeName);
      await loadRepository(repoPath);
      setPhase("archived");
      setMessage("Archived " + changeName + ".");
    } catch (error) {
      setLoadState("loaded");
      setMessage(errorMessage(error));
    } finally {
      archiveInFlightRef.current = false;
      setArchiveBusy(false);
    }
  }

  async function archiveAllChanges(changeNames: string[]) {
    if (archiveInFlightRef.current) {
      setMessage("Archive already in progress.");
      return;
    }

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

    const uniqueChangeNames = Array.from(new Set(changeNames));

    if (!confirmArchiveChanges(uniqueChangeNames)) {
      setMessage("Bulk archive canceled.");
      return;
    }

    archiveInFlightRef.current = true;
    setArchiveBusy(true);
    setLoadState("loading");
    setMessage("Validating before archiving " + uniqueChangeNames.length + " changes...");
    const repoPath = repo.path;
    let archivedCount = 0;

    try {
      const validation = await runValidationCommand(repoPath);
      applyValidationResult(validation);
      recordValidationOperationResult(repoPath, validation);
      rememberValidationSnapshot(repoPath, validation);

      if (!canArchiveAfterValidation(validation)) {
        setLoadState("loaded");
        setMessage(archiveValidationFailureMessage(validation));
        return;
      }

      setMessage("Archiving " + uniqueChangeNames.length + " changes...");
      for (const changeName of uniqueChangeNames) {
        await archiveOneChange(repoPath, changeName);
        archivedCount += 1;
      }
      await loadRepository(repoPath);
      setPhase("archived");
      setMessage("Archived " + uniqueChangeNames.length + " changes.");
    } catch (error) {
      if (archivedCount > 0) {
        await loadRepository(repoPath);
        setPhase("archived");
        setMessage(
          "Archived " +
            archivedCount +
            " of " +
            uniqueChangeNames.length +
            " changes before failure: " +
            errorMessage(error),
        );
      } else {
        setMessage(errorMessage(error));
      }
      setLoadState("loaded");
    } finally {
      archiveInFlightRef.current = false;
      setArchiveBusy(false);
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
    let recordedCommandFailure = false;

    try {
      const result = await invoke<CommandResultDto>("archive_change", {
        repoPath,
        changeName,
      });

      if (!result.success) {
        recordOperationIssue(
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

      clearOperationIssues(
        (issue) => issue.kind === "archive" && issue.repoPath === repoPath && issue.target === changeName,
      );
    } catch (error) {
      if (!recordedCommandFailure) {
        recordOperationIssue(
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

  async function runValidationCommand(repoPath: string): Promise<ValidationResult> {
    const command = await invoke<CommandResultDto>("run_openspec_command", {
      repoPath,
      args: ["validate", "--all", "--json"],
    });
    const rawJson = extractJsonPayload(command.stdout);

    if (rawJson !== undefined) {
      return parseValidationResult(rawJson, {
        validatedAt: new Date(),
        repoPath,
      });
    }

    if (command.success) {
      return parseValidationResult(command.stdout || command, {
        validatedAt: new Date(),
        repoPath,
      });
    }

    return createValidationCommandFailureResult({
      stdout: command.stdout,
      stderr: command.stderr,
      statusCode: command.status_code ?? command.statusCode ?? null,
      validatedAt: new Date(),
      raw: command,
    });
  }

  function applyValidationResult(result: ValidationResult) {
    const activeWorkspace = workspaceRef.current;
    const records = Object.values(activeWorkspace?.filesByPath ?? {});
    const changeStatuses = activeWorkspace?.changeStatuses ?? [];
    const indexed = indexOpenSpecWorkspace({ files: records, changeStatuses });
    const nextWorkspace = buildWorkspaceView(indexed, records, result, changeStatuses);

    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
  }

  function recordValidationOperationResult(repoPath: string, result: ValidationResult) {
    if (result.diagnostics.length === 0) {
      clearOperationIssues((issue) => issue.kind === "validation" && issue.repoPath === repoPath);
      return;
    }

    const diagnostic = result.diagnostics[0];
    recordOperationIssue(
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

  function rememberValidationSnapshot(repoPath: string, result: ValidationResult) {
    const fileSignature = workspaceRef.current?.fileSignature;

    if (!fileSignature) {
      return;
    }

    updatePersistedState((current) =>
      updatePersistedValidationSnapshot(current, repoPath, result, fileSignature),
    );
  }

  async function loadGitStatus(repoPath: string, options: { quiet?: boolean } = {}) {
    const requestId = ++gitStatusGenerationRef.current;

    if (!isTauriRuntime()) {
      const nextStatus: OpenSpecGitStatus = {
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: "Git status requires the Tauri desktop runtime.",
      };

      if (!options.quiet || !areGitStatusesEqual(gitStatusRef.current, nextStatus)) {
        setGitStatus(nextStatus);
      }
      return;
    }

    if (!options.quiet) {
      setGitStatus({ ...unknownGitStatus, state: "loading", message: "Checking OpenSpec Git status..." });
    }

    try {
      const status = await invoke<OpenSpecGitStatusDto>("get_openspec_git_status", { repoPath });
      if (gitStatusGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      const dirtyCount = status.dirty_count ?? status.dirtyCount ?? status.entries.length;
      let nextStatus: OpenSpecGitStatus;

      if (!status.available) {
        nextStatus = {
          state: "unavailable",
          dirtyCount: 0,
          entries: [],
          message: status.message ?? "Git status is unavailable for this repository.",
        };
        if (!options.quiet || !areGitStatusesEqual(gitStatusRef.current, nextStatus)) {
          setGitStatus(nextStatus);
        }
        return;
      }

      nextStatus = {
        state: dirtyCount > 0 ? "dirty" : "clean",
        dirtyCount,
        entries: status.entries,
        message:
          dirtyCount > 0
            ? dirtyCount + " uncommitted OpenSpec " + (dirtyCount === 1 ? "path" : "paths")
            : "No uncommitted OpenSpec paths",
      };

      if (!options.quiet || !areGitStatusesEqual(gitStatusRef.current, nextStatus)) {
        setGitStatus(nextStatus);
      }
    } catch (error) {
      if (gitStatusGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      const nextStatus: OpenSpecGitStatus = {
        state: "unavailable",
        dirtyCount: 0,
        entries: [],
        message: errorMessage(error),
      };

      if (!options.quiet || !areGitStatusesEqual(gitStatusRef.current, nextStatus)) {
        setGitStatus(nextStatus);
      }
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
    fileRecords: VirtualOpenSpecFileRecord[],
    changeNames: string[],
  ): Promise<VirtualOpenSpecChangeStatusRecord[]> {
    const tasks = Array.from(new Set(changeNames)).map((changeName) => async () => {
      const cacheId = statusCacheId(repoPath, changeName);
      const freshnessKey = changeStatusFreshnessKey(fileRecords, changeName);
      const cached = statusCacheRef.current.get(cacheId);

      if (cached?.freshnessKey === freshnessKey) {
        return cached.record;
      }

      let record: VirtualOpenSpecChangeStatusRecord;

      try {
        const command = await invoke<CommandResultDto>("run_openspec_command", {
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
          recordOperationIssue(
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
          clearOperationIssues(
            (issue) => issue.kind === "status" && issue.repoPath === repoPath && issue.target === changeName,
          );
        }
      } catch (error) {
        record = toVirtualChangeStatusRecord(
          { changeName, error: errorMessage(error) },
          changeName,
        );
        recordOperationIssue(
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

      statusCacheRef.current.set(cacheId, { freshnessKey, record });
      pruneStatusCache(statusCacheRef.current);
      return record;
    });

    return mapWithConcurrency(tasks, STATUS_COMMAND_CONCURRENCY);
  }

  async function refreshRepositoryIfChanged(repoPath: string) {
    if (backgroundRefreshInFlightRef.current.has(repoPath)) {
      return;
    }

    const requestId = ++refreshGenerationRef.current;
    backgroundRefreshInFlightRef.current.add(repoPath);

    try {
      const metadataDtos = await invoke<BridgeFileRecord[]>("list_openspec_file_metadata_records", {
        repoPath,
      });
      if (refreshGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      const metadataRecords = toVirtualFileRecords(metadataDtos);
      const nextSignature = buildOpenSpecFileSignature(metadataRecords);
      const currentWorkspace = workspaceRef.current;

      if (nextSignature.fingerprint === currentWorkspace?.fileSignature.fingerprint) {
        void loadGitStatus(repoPath, { quiet: true });
        return;
      }

      const fileDtos = await invoke<BridgeFileRecord[]>("list_openspec_file_records", {
        repoPath,
      });
      if (refreshGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      const fileRecords = toVirtualFileRecords(fileDtos);
      const changeStatuses = await loadChangeStatuses(
        repoPath,
        fileRecords,
        activeChangeNamesFromFileRecords(fileRecords),
      );
      if (refreshGenerationRef.current !== requestId || repoRef.current?.path !== repoPath) {
        return;
      }

      const indexed = indexOpenSpecWorkspace({ files: fileRecords, changeStatuses });
      const nextWorkspace = buildWorkspaceView(
        indexed,
        fileRecords,
        validationForFileRecords(currentWorkspace?.validation ?? null, currentWorkspace?.fileSignature, nextSignature),
        changeStatuses,
        nextSignature,
      );

      workspaceRef.current = nextWorkspace;
      setWorkspace(nextWorkspace);
      keepSelectionInWorkspace(nextWorkspace);
      clearOperationIssues(
        (issue) => issue.kind === "repository-read" && issue.repoPath === repoPath,
      );
      void loadGitStatus(repoPath, { quiet: true });
      setMessage("OpenSpec files changed. Local files refreshed.");
    } catch (error) {
      if (refreshGenerationRef.current === requestId && repoRef.current?.path === repoPath) {
        recordOperationIssue(
          createOpenSpecOperationIssue({
            kind: "repository-read",
            title: "Repository refresh failed",
            message: errorMessage(error),
            fallbackMessage: "OpenSpec repository files could not be refreshed.",
            repoPath,
            target: "openspec",
          }),
        );
        setMessage(errorMessage(error));
      }
    } finally {
      backgroundRefreshInFlightRef.current.delete(repoPath);
    }
  }

  function rememberRecentRepo(repoPath: string, repoName: string) {
    if (!isPersistableLocalRepoPath(repoPath)) {
      return;
    }

    updatePersistedState((current) =>
      rememberPersistedRepo(current, { path: repoPath, name: repoName }),
    );
  }

  function selectFirstItems(nextWorkspace: WorkspaceView) {
    const firstChange = nextWorkspace.changes.find((change) => change.phase === "active") ?? nextWorkspace.changes[0];
    setSelectedChangeId(firstChange?.id ?? "");
    setSelectedSpecId(nextWorkspace.specs[0]?.id ?? "");
    setDetailTab("proposal");
    setView("changes");
    setPhase("active");
    setChangesQuery("");
    setSpecsQuery("");
  }

  function restorePersistedSelection(
    nextWorkspace: WorkspaceView,
    persistedRepoState: PersistedAppState["repoStateByPath"][string] | undefined,
  ) {
    const persistedChange = nextWorkspace.changes.find(
      (change) => change.id === persistedRepoState?.lastSelectedChange,
    );
    const persistedSpec = nextWorkspace.specs.find(
      (spec) => spec.id === persistedRepoState?.lastSelectedSpec,
    );
    const firstChange = nextWorkspace.changes.find((change) => change.phase === "active") ?? nextWorkspace.changes[0];

    setSelectedChangeId(persistedChange?.id ?? firstChange?.id ?? "");
    setSelectedSpecId(persistedSpec?.id ?? nextWorkspace.specs[0]?.id ?? "");
    setDetailTab("proposal");
    setView("changes");
    setPhase("active");
    setChangesQuery("");
    setSpecsQuery("");
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
        changesQuery={changesQuery}
        specsQuery={specsQuery}
        changesFilterQuery={deferredChangesQuery}
        specsFilterQuery={deferredSpecsQuery}
        selectedChange={selectedChange}
        selectedSpec={selectedSpec}
        changeSortDirection={changeSortDirection}
        specSortDirection={specSortDirection}
        loadState={loadState}
        archiveBusy={archiveBusy}
        onViewChange={setView}
        onPhaseChange={setPhase}
        onChangesQueryChange={setChangesQuery}
        onSpecsQueryChange={setSpecsQuery}
        onSelectChange={(changeId) => {
          setSelectedChangeId(changeId);
          setDetailTab("proposal");
        }}
        onSelectSpec={setSelectedSpecId}
        onChangeSortDirection={(direction) =>
          updatePersistedState((current) =>
            updatePersistedRepoSort(current, repo?.path ?? "", {
              changeSort: sortPreferenceFromDirection(direction),
            }),
          )
        }
        onSpecSortDirection={(direction) =>
          updatePersistedState((current) =>
            updatePersistedRepoSort(current, repo?.path ?? "", {
              specSort: sortPreferenceFromDirection(direction),
            }),
          )
        }
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
        runnerSettings={runnerSettings}
        runnerStatus={runnerStatus}
        runnerDispatchEligibility={selectedChangeRunnerEligibility}
        runnerDispatchHistory={selectedChangeDispatchHistory}
        runnerSessionSecretConfigured={runnerSessionSecretConfigured}
        runnerDispatchBusy={runnerDispatchBusy || runnerLifecycleBusy}
        detailTab={detailTab}
        artifactPreview={artifactPreview}
        operationIssues={operationIssues}
        onDetailTabChange={setDetailTab}
        onOpenArtifact={(artifact) => void openArtifact(artifact)}
        onValidate={() => void runValidation()}
        onRunnerSettingsChange={updateRunnerSettings}
        onConfigureRunnerSessionSecret={() => void configureRunnerSessionSecret()}
        onClearRunnerSessionSecret={() => void clearRunnerSessionSecret()}
        onCheckRunnerStatus={() => void checkRunnerStatus()}
        onStartRunner={() => void startRunner()}
        onStopRunner={() => void stopRunner()}
        onDispatchRunner={() => void dispatchSelectedChange()}
        onRetryRunnerDispatch={(attempt) => void dispatchSelectedChange({ retryAttempt: attempt })}
      />

      <StatusBand
        repo={repo}
        workspace={workspace}
        gitStatus={gitStatus}
        loadState={loadState}
        message={message}
        operationIssues={operationIssues}
        onDismissIssue={dismissOperationIssue}
      />
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
  recentRepos: PersistedRecentRepo[];
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
  const switcherRepos = recentRepoSwitcherRepos(repo, recentRepos);

  return (
    <aside className="repo-rail" aria-label="Repository navigation">
      <div className="brand">
        <img className="brand-mark" src="/openspec-studio-logo.svg" alt="" aria-hidden="true" />
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
            {switcherRepos.map((recent) => (
              <button
                type="button"
                key={recent.path}
                className={recent.path === repo?.path ? "is-selected" : ""}
                aria-current={recent.path === repo?.path ? "true" : undefined}
                onClick={() => onOpenRecent(recent.path)}
              >
                <strong>{recent.name}</strong>
                <span>{recent.path}</span>
                {recent.path === repo?.path ? <em>Current</em> : null}
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
  changesQuery,
  specsQuery,
  changesFilterQuery,
  specsFilterQuery,
  selectedChange,
  selectedSpec,
  changeSortDirection,
  specSortDirection,
  loadState,
  archiveBusy,
  onViewChange,
  onPhaseChange,
  onChangesQueryChange,
  onSpecsQueryChange,
  onSelectChange,
  onSelectSpec,
  onChangeSortDirection,
  onSpecSortDirection,
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
  changesQuery: string;
  specsQuery: string;
  changesFilterQuery: string;
  specsFilterQuery: string;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  changeSortDirection: BoardTableSortDirection;
  specSortDirection: BoardTableSortDirection;
  loadState: LoadState;
  archiveBusy: boolean;
  onViewChange: (view: BoardView) => void;
  onPhaseChange: (phase: ChangePhase) => void;
  onChangesQueryChange: (query: string) => void;
  onSpecsQueryChange: (query: string) => void;
  onSelectChange: (changeId: string) => void;
  onSelectSpec: (specId: string) => void;
  onChangeSortDirection: (direction: BoardTableSortDirection) => void;
  onSpecSortDirection: (direction: BoardTableSortDirection) => void;
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
          <div className="segmented" aria-label="Workspace view">
            <button
              type="button"
              aria-pressed={view === "changes"}
              className={view === "changes" ? "is-active" : ""}
              onClick={() => onViewChange("changes")}
            >
              Changes
            </button>
            <button
              type="button"
              aria-pressed={view === "specs"}
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
          query={changesQuery}
          filterQuery={changesFilterQuery}
          selectedChange={selectedChange}
          sortDirection={changeSortDirection}
          archiveBusy={archiveBusy}
          onPhaseChange={onPhaseChange}
          onQueryChange={onChangesQueryChange}
          onSelectChange={onSelectChange}
          onSortDirectionChange={onChangeSortDirection}
          onArchiveChange={onArchiveChange}
          onArchiveAll={onArchiveAll}
        />
      ) : (
        <SpecsBrowser
          specs={workspace.specs}
          selectedSpec={selectedSpec}
          query={specsQuery}
          filterQuery={specsFilterQuery}
          sortDirection={specSortDirection}
          onQueryChange={onSpecsQueryChange}
          onSelectSpec={onSelectSpec}
          onSortDirectionChange={onSpecSortDirection}
        />
      )}
    </main>
  );
}

function ChangeBoard({
  changes,
  phase,
  query,
  filterQuery,
  selectedChange,
  sortDirection,
  archiveBusy,
  onPhaseChange,
  onQueryChange,
  onSelectChange,
  onSortDirectionChange,
  onArchiveChange,
  onArchiveAll,
}: {
  changes: ChangeRecord[];
  phase: ChangePhase;
  query: string;
  filterQuery: string;
  selectedChange: ChangeRecord | null;
  sortDirection: BoardTableSortDirection;
  archiveBusy: boolean;
  onPhaseChange: (phase: ChangePhase) => void;
  onQueryChange: (query: string) => void;
  onSelectChange: (changeId: string) => void;
  onSortDirectionChange: (direction: BoardTableSortDirection) => void;
  onArchiveChange: (changeName: string) => void;
  onArchiveAll: (changeNames: string[]) => void;
}) {
  const filteredChanges = useMemo(() => {
    return changes.filter((change) => matchesChangeFilters(change, phase, filterQuery));
  }, [changes, phase, filterQuery]);
  const phaseCounts = useMemo(
    () => ({
      active: changes.filter((change) => change.phase === "active").length,
      "archive-ready": changes.filter((change) => change.phase === "archive-ready").length,
      archived: changes.filter((change) => change.phase === "archived").length,
    }),
    [changes],
  );
  const columns = useMemo<BoardTableColumn<ChangeRecord>[]>(() => {
    const nextColumns: BoardTableColumn<ChangeRecord>[] = [
      {
        id: "change",
        label: "Change",
        render: (change) => (
          <div className="change-title-cell artifact-title-cell">
            <strong title={change.title}>{change.title}</strong>
          </div>
        ),
      },
      {
        id: "trust",
        label: "Trust",
        colClassName: "trust-col",
        render: (change) => <HealthPill health={change.health} label={change.statusLabel} />,
      },
      {
        id: "tasks",
        label: "Tasks",
        colClassName: "tasks-col",
        render: (change) => <TaskProgressCell progress={change.taskProgress} />,
      },
      {
        id: "capabilities",
        label: "Capabilities",
        colClassName: "capabilities-col",
        cellClassName: "capability-cell",
        render: (change) => formatCapabilities(change.capabilities),
      },
      {
        id: "updated",
        label: "Updated",
        colClassName: "updated-col",
        cellClassName: "updated-cell",
        sortable: {
          defaultDirection: "desc",
          getValue: (change) => change.modifiedTimeMs,
        },
        render: (change) => change.updatedAt,
      },
    ];

    if (phase === "archive-ready") {
      nextColumns.push({
        id: "action",
        label: "Action",
        colClassName: "action-col",
        cellClassName: "action-cell",
        render: (change) => (
          <button
            type="button"
            className="primary-outline table-action"
            disabled={archiveBusy}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onArchiveChange(change.name);
            }}
          >
            Archive
          </button>
        ),
      });
    }

    return nextColumns;
  }, [archiveBusy, onArchiveChange, phase]);

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
              disabled={archiveBusy}
              onClick={() => onArchiveAll(filteredChanges.map((change) => change.name))}
            >
              {archiveBusy ? "Archiving..." : "Archive all"}
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
        <BoardTable
          rows={filteredChanges}
          columns={columns}
          selectedId={selectedChange?.id ?? ""}
          onSelect={onSelectChange}
          sortState={{ columnId: "updated", direction: sortDirection }}
          onSortStateChange={(state) => {
            if (state?.columnId === "updated") {
              onSortDirectionChange(state.direction);
            }
          }}
          tableClassName={phase === "archive-ready" ? "has-actions" : ""}
          resetKey={phase + "\n" + filterQuery}
          itemLabel="changes"
          resize={{
            columnId: "change",
            cssVariable: "--change-column-width",
            defaultWidth: 170,
            resetWidth: 360,
            minWidth: 160,
            maxWidth: 560,
            ariaLabel: "Resize change column",
            title: "Drag or use arrow keys to resize change column",
          }}
        />
      )}
    </section>
  );
}

function SpecsBrowser({
  specs,
  selectedSpec,
  query,
  filterQuery,
  sortDirection,
  onQueryChange,
  onSelectSpec,
  onSortDirectionChange,
}: {
  specs: SpecRecord[];
  selectedSpec: SpecRecord | null;
  query: string;
  filterQuery: string;
  sortDirection: BoardTableSortDirection;
  onQueryChange: (query: string) => void;
  onSelectSpec: (specId: string) => void;
  onSortDirectionChange: (direction: BoardTableSortDirection) => void;
}) {
  const filteredSpecs = useMemo(() => {
    return specs.filter((spec) => matchesSpecFilters(spec, filterQuery));
  }, [filterQuery, specs]);
  const columns = useMemo<BoardTableColumn<SpecRecord>[]>(
    () => [
      {
        id: "spec",
        label: "Spec",
        render: (spec) => (
          <div className="change-title-cell artifact-title-cell">
            <strong title={spec.capability}>{spec.capability}</strong>
          </div>
        ),
      },
      {
        id: "trust",
        label: "Trust",
        colClassName: "spec-trust-col",
        render: (spec) => <HealthPill health={spec.health} label={healthLabels[spec.health]} />,
      },
      {
        id: "requirements",
        label: "Requirements",
        colClassName: "spec-requirements-col",
        render: (spec) => spec.requirements,
      },
      {
        id: "updated",
        label: "Updated",
        colClassName: "spec-updated-col",
        cellClassName: "updated-cell",
        sortable: {
          defaultDirection: "desc",
          getValue: (spec) => spec.modifiedTimeMs,
        },
        render: (spec) => spec.updatedAt,
      },
    ],
    [],
  );

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
        <BoardTable
          rows={filteredSpecs}
          columns={columns}
          selectedId={selectedSpec?.id ?? ""}
          onSelect={onSelectSpec}
          sortState={{ columnId: "updated", direction: sortDirection }}
          onSortStateChange={(state) => {
            if (state?.columnId === "updated") {
              onSortDirectionChange(state.direction);
            }
          }}
          tableClassName="specs-table"
          resetKey={filterQuery}
          itemLabel="specs"
          resize={{
            columnId: "spec",
            cssVariable: "--spec-column-width",
            defaultWidth: 320,
            resetWidth: 420,
            minWidth: 180,
            maxWidth: 640,
            ariaLabel: "Resize spec column",
            title: "Drag or use arrow keys to resize spec column",
          }}
        />
      )}
    </section>
  );
}

function BoardTable<T extends { id: string }>({
  rows,
  columns,
  selectedId,
  onSelect,
  sortState: controlledSortState,
  onSortStateChange,
  tableClassName,
  resetKey,
  itemLabel,
  resize,
}: {
  rows: T[];
  columns: BoardTableColumn<T>[];
  selectedId: string;
  onSelect: (id: string) => void;
  sortState?: BoardTableSortState | null;
  onSortStateChange?: (state: BoardTableSortState | null) => void;
  tableClassName?: string;
  resetKey: string;
  itemLabel: string;
  resize?: BoardTableResizeConfig;
}) {
  const [rowLimit, setRowLimit] = useState(ROW_RENDER_BATCH_SIZE);
  const [resizedWidth, setResizedWidth] = useState(resize?.defaultWidth ?? 0);
  const [focusRowId, setFocusRowId] = useState(selectedId || rows[0]?.id || "");
  const [internalSortState, setInternalSortState] = useState<BoardTableSortState | null>(() =>
    defaultBoardTableSort(columns),
  );
  const activeSortState = controlledSortState !== undefined ? controlledSortState : internalSortState;
  const tableRef = useRef<HTMLTableElement | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const sortedRows = useMemo(() => sortBoardRows(rows, columns, activeSortState), [columns, rows, activeSortState]);
  const bounded = useMemo(
    () => boundedRows(sortedRows, selectedId, rowLimit),
    [rowLimit, selectedId, sortedRows],
  );

  useEffect(() => {
    setRowLimit(ROW_RENDER_BATCH_SIZE);
  }, [resetKey]);

  useEffect(() => {
    if (controlledSortState !== undefined) {
      return;
    }

    setInternalSortState((current) => {
      if (current && columns.some((column) => column.id === current.columnId && column.sortable)) {
        return current;
      }

      return defaultBoardTableSort(columns);
    });
  }, [columns, controlledSortState]);

  useEffect(() => {
    if (selectedId && bounded.rows.some((row) => row.id === selectedId)) {
      setFocusRowId(selectedId);
      return;
    }

    if (!bounded.rows.some((row) => row.id === focusRowId)) {
      setFocusRowId(bounded.rows[0]?.id ?? "");
    }
  }, [bounded.rows, focusRowId, selectedId]);

  function focusTableRow(rowId: string) {
    setFocusRowId(rowId);
    window.requestAnimationFrame(() => rowRefs.current.get(rowId)?.focus());
  }

  function moveRowFocus(currentId: string, direction: "next" | "previous" | "first" | "last") {
    if (bounded.rows.length === 0) {
      return;
    }

    const currentIndex = bounded.rows.findIndex((row) => row.id === currentId);
    let nextIndex = currentIndex >= 0 ? currentIndex : 0;

    if (direction === "first") {
      nextIndex = 0;
    } else if (direction === "last") {
      nextIndex = bounded.rows.length - 1;
    } else if (direction === "next") {
      nextIndex = Math.min(nextIndex + 1, bounded.rows.length - 1);
    } else {
      nextIndex = Math.max(nextIndex - 1, 0);
    }

    focusTableRow(bounded.rows[nextIndex].id);
  }

  function startColumnResize(startX: number) {
    if (!resize) {
      return;
    }

    const startWidth = resizedWidth;
    const table = tableRef.current;
    let nextWidth = startWidth;
    let animationFrame = 0;
    const updateCssWidth = (width: number) => {
      nextWidth = width;

      if (animationFrame) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        table?.style.setProperty(resize.cssVariable, nextWidth + "px");
        animationFrame = 0;
      });
    };
    const handleMouseMove = (event: MouseEvent) => {
      updateCssWidth(clampNumber(startWidth + event.clientX - startX, resize.minWidth, resize.maxWidth));
    };
    const handleMouseUp = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      table?.style.setProperty(resize.cssVariable, nextWidth + "px");
      setResizedWidth(nextWidth);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function updateColumnWidth(width: number) {
    if (!resize) {
      return;
    }

    const nextWidth = clampNumber(width, resize.minWidth, resize.maxWidth);
    tableRef.current?.style.setProperty(resize.cssVariable, nextWidth + "px");
    setResizedWidth(nextWidth);
  }

  function resetColumnWidth() {
    if (!resize) {
      return;
    }

    updateColumnWidth(resize.resetWidth);
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!resize) {
      return;
    }

    const step = event.shiftKey ? 40 : 16;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateColumnWidth(resizedWidth - step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      updateColumnWidth(resizedWidth + step);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateColumnWidth(resize.minWidth);
    } else if (event.key === "End") {
      event.preventDefault();
      updateColumnWidth(resize.maxWidth);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      resetColumnWidth();
    }
  }

  function toggleColumnSort(column: BoardTableColumn<T>) {
    if (!column.sortable) {
      return;
    }

    const nextSortState = {
      columnId: column.id,
      direction:
        activeSortState?.columnId === column.id
          ? nextTableSortDirection(activeSortState.direction)
          : column.sortable?.defaultDirection ?? "desc",
    };

    if (controlledSortState === undefined) {
      setInternalSortState(nextSortState);
    }

    onSortStateChange?.(nextSortState);
  }

  return (
    <div className="table-scroll">
      <table
        ref={tableRef}
        role="grid"
        aria-label={itemLabel + " table"}
        aria-rowcount={sortedRows.length}
        className={["change-table", tableClassName].filter(Boolean).join(" ")}
      >
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.id}
              className={column.colClassName}
              style={
                resize?.columnId === column.id
                  ? { width: "var(" + resize.cssVariable + ", " + resizedWidth + "px)" }
                  : undefined
              }
            />
          ))}
        </colgroup>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((column) => (
              <th
                key={column.id}
                role="columnheader"
                scope="col"
                aria-sort={sortAriaValue(column, activeSortState)}
                className={[
                  resize?.columnId === column.id ? "resizable-heading" : "",
                  column.sortable ? "sortable-heading" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className="table-sort-button"
                    aria-label={sortButtonLabel(column, activeSortState)}
                    onClick={() => toggleColumnSort(column)}
                  >
                    <span>{column.label}</span>
                    <span
                      className={[
                        "sort-icon",
                        activeSortState?.columnId === column.id ? "is-active" : "",
                        activeSortState?.columnId === column.id ? "is-" + activeSortState.direction : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
                {resize?.columnId === column.id ? (
                  <button
                    type="button"
                    className="column-resize-handle"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={resize.ariaLabel}
                    aria-valuemin={resize.minWidth}
                    aria-valuemax={resize.maxWidth}
                    aria-valuenow={resizedWidth}
                    title={resize.title}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startColumnResize(event.clientX);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      resetColumnWidth();
                    }}
                    onKeyDown={handleResizeKeyDown}
                  />
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {bounded.rows.map((row) => (
            <tr
              key={row.id}
              ref={(element) => {
                if (element) {
                  rowRefs.current.set(row.id, element);
                } else {
                  rowRefs.current.delete(row.id);
                }
              }}
              role="row"
              tabIndex={focusRowId === row.id ? 0 : -1}
              aria-selected={selectedId === row.id}
              className={selectedId === row.id ? "is-selected" : ""}
              onClick={() => {
                setFocusRowId(row.id);
                onSelect(row.id);
              }}
              onFocus={() => setFocusRowId(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row.id);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveRowFocus(row.id, "next");
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveRowFocus(row.id, "previous");
                } else if (event.key === "Home") {
                  event.preventDefault();
                  moveRowFocus(row.id, "first");
                } else if (event.key === "End") {
                  event.preventDefault();
                  moveRowFocus(row.id, "last");
                }
              }}
            >
              {columns.map((column) => (
                <td key={column.id} role="gridcell" className={column.cellClassName}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {bounded.hiddenCount > 0 ? (
        <div className="bounded-row-notice">
          <span>
            Showing {bounded.rows.length} of {sortedRows.length} matching {itemLabel}.
          </span>
          <button
            type="button"
            className="link-button"
            onClick={() => setRowLimit((current) => current + ROW_RENDER_BATCH_SIZE)}
          >
            Show more
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Inspector({
  repo,
  workspace,
  view,
  selectedChange,
  selectedSpec,
  runnerSettings,
  runnerStatus,
  runnerDispatchEligibility,
  runnerDispatchHistory,
  runnerSessionSecretConfigured,
  runnerDispatchBusy,
  detailTab,
  artifactPreview,
  operationIssues,
  onDetailTabChange,
  onOpenArtifact,
  onValidate,
  onRunnerSettingsChange,
  onConfigureRunnerSessionSecret,
  onClearRunnerSessionSecret,
  onCheckRunnerStatus,
  onStartRunner,
  onStopRunner,
  onDispatchRunner,
  onRetryRunnerDispatch,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  view: BoardView;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  runnerSettings: RunnerSettings;
  runnerStatus: RunnerStatus;
  runnerDispatchEligibility: RunnerDispatchEligibility;
  runnerDispatchHistory: RunnerDispatchAttempt[];
  runnerSessionSecretConfigured: boolean;
  runnerDispatchBusy: boolean;
  detailTab: DetailTab;
  artifactPreview: string;
  operationIssues: OpenSpecOperationIssue[];
  onDetailTabChange: (tab: DetailTab) => void;
  onOpenArtifact: (artifact: Artifact | SpecRecord) => void;
  onValidate: () => void;
  onRunnerSettingsChange: (settings: RunnerSettings) => void;
  onConfigureRunnerSessionSecret: () => void;
  onClearRunnerSessionSecret: () => void;
  onCheckRunnerStatus: () => void;
  onStartRunner: () => void;
  onStopRunner: () => void;
  onDispatchRunner: () => void;
  onRetryRunnerDispatch: (attempt: RunnerDispatchAttempt) => void;
}) {
  const tabs = selectedChange ? detailTabsForChange(selectedChange) : [];
  const selectedDetailTab =
    selectedChange && tabs.some((tab) => tab.id === detailTab)
      ? detailTab
      : tabs[0]?.id ?? "archive-info";
  const selectedTaskDetail = useMemo(
    () =>
      selectedDetailTab === "tasks" && selectedChange?.taskProgress
        ? parseTaskProgressContent(selectedChange.taskProgress.content)
        : { items: [], groups: [] },
    [selectedChange?.taskProgress, selectedDetailTab],
  );
  const selectedChangeIssues = selectedChange
    ? operationIssues.filter((issue) => issue.target === selectedChange.name)
    : [];
  const selectedArtifactPath = selectedChange ? artifactPathForTab(selectedChange, selectedDetailTab) : undefined;
  const selectedArtifactIssue = selectedArtifactPath
    ? operationIssues.find((issue) => issue.kind === "artifact-read" && issue.target === selectedArtifactPath)
    : undefined;

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

      <RunnerDispatchPanel
        settings={runnerSettings}
        status={runnerStatus}
        eligibility={runnerDispatchEligibility}
        history={runnerDispatchHistory}
        sessionSecretConfigured={runnerSessionSecretConfigured}
        busy={runnerDispatchBusy}
        onSettingsChange={onRunnerSettingsChange}
        onConfigureSessionSecret={onConfigureRunnerSessionSecret}
        onClearSessionSecret={onClearRunnerSessionSecret}
        onCheckStatus={onCheckRunnerStatus}
        onStartRunner={onStartRunner}
        onStopRunner={onStopRunner}
        onDispatch={onDispatchRunner}
        onRetry={onRetryRunnerDispatch}
      />

      <div className="tabs artifact-tabs" aria-label="Change artifacts">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            aria-pressed={selectedDetailTab === tab.id}
            className={selectedDetailTab === tab.id ? "is-active" : ""}
            onClick={() => onDetailTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspector-body artifact-inspector-body">
        {selectedChangeIssues.length > 0 ? (
          <section className="inspector-section operation-context-section">
            <h3>OpenSpec issues</h3>
            <OperationIssueList issues={selectedChangeIssues} />
          </section>
        ) : null}
        {renderDetailTab(
          selectedChange,
          selectedDetailTab,
          artifactPreview,
          workspace.validation,
          selectedTaskDetail,
          onOpenArtifact,
          onValidate,
          selectedArtifactIssue,
        )}
      </div>
    </aside>
  );
}

function RunnerDispatchPanel({
  settings,
  status,
  eligibility,
  history,
  sessionSecretConfigured,
  busy,
  onSettingsChange,
  onConfigureSessionSecret,
  onClearSessionSecret,
  onCheckStatus,
  onStartRunner,
  onStopRunner,
  onDispatch,
  onRetry,
}: {
  settings: RunnerSettings;
  status: RunnerStatus;
  eligibility: RunnerDispatchEligibility;
  history: RunnerDispatchAttempt[];
  sessionSecretConfigured: boolean;
  busy: boolean;
  onSettingsChange: (settings: RunnerSettings) => void;
  onConfigureSessionSecret: () => void;
  onClearSessionSecret: () => void;
  onCheckStatus: () => void;
  onStartRunner: () => void;
  onStopRunner: () => void;
  onDispatch: () => void;
  onRetry: (attempt: RunnerDispatchAttempt) => void;
}) {
  const latestFailedAttempt = history.find((attempt) => attempt.status === "failed");

  return (
    <section className="runner-dispatch-panel" aria-label="Studio Runner dispatch">
      <div className="runner-dispatch-heading">
        <div>
          <span>Studio Runner</span>
          <strong>{status.label}</strong>
          <p>{status.detail}</p>
        </div>
        <HealthPill
          health={status.state === "reachable" ? "valid" : status.state === "checking" || status.state === "starting" ? "stale" : "blocked"}
          label={status.state === "reachable" ? "Reachable" : status.state === "starting" ? "Starting" : status.state === "checking" ? "Checking" : "Blocked"}
        />
      </div>
      <div className="runner-settings-grid">
        <label>
          <span>Endpoint</span>
          <input
            value={settings.endpoint}
            onChange={(event) => onSettingsChange({ ...settings, endpoint: event.target.value })}
            placeholder="http://127.0.0.1:4000/api/v1/studio-runner/events"
          />
        </label>
        <div className="runner-session-secret-card">
          <span>Session secret</span>
          <strong>{sessionSecretConfigured ? "Configured for this session" : "Not generated"}</strong>
          <p>Studio generates this secret and keeps it in memory only. It is not saved after restart.</p>
          <div className="runner-session-actions">
            <button type="button" className="primary-outline" onClick={onConfigureSessionSecret} disabled={busy}>
              {sessionSecretConfigured ? "Regenerate session secret" : "Generate session secret"}
            </button>
            {sessionSecretConfigured ? (
              <button type="button" className="link-button" onClick={onClearSessionSecret} disabled={busy}>
                Clear session secret
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {!eligibility.eligible ? (
        <ul className="runner-blockers">
          {eligibility.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <div className="runner-actions">
        <button type="button" className="primary-outline" onClick={onStartRunner} disabled={busy}>
          {status.state === "reachable" ? "Restart runner" : "Start runner"}
        </button>
        <button type="button" className="primary-outline" onClick={onCheckStatus} disabled={busy}>
          Check runner
        </button>
        {status.managed ? (
          <button type="button" className="link-button" onClick={onStopRunner} disabled={busy}>
            Stop runner
          </button>
        ) : null}
        <button type="button" className="primary-button" onClick={onDispatch} disabled={busy || !eligibility.eligible}>
          {busy ? "Dispatching..." : "Build with agent"}
        </button>
      </div>
      {history.length > 0 ? (
        <details className="runner-history" open>
          <summary>Dispatch history <span>{history.length}</span></summary>
          <ul>
            {history.map((attempt) => (
              <li key={attempt.eventId}>
                <div>
                  <strong>{runnerAttemptLabel(attempt)}</strong>
                  <span>{formatRunnerDateTime(attempt.updatedAt)}</span>
                </div>
                <code>{attempt.eventId}</code>
                <p>{attempt.message}</p>
                {attempt.runId ? <span>Run: {attempt.runId}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {latestFailedAttempt ? (
        <button type="button" className="link-button" onClick={() => onRetry(latestFailedAttempt)} disabled={busy}>
          Retry failed dispatch
        </button>
      ) : null}
    </section>
  );
}


function formatRunnerDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function runnerAttemptLabel(attempt: RunnerDispatchAttempt): string {
  if (attempt.status === "accepted") {
    return "Accepted";
  }
  if (attempt.status === "pending") {
    return "Pending";
  }
  return "Failed";
}

function renderDetailTab(
  change: ChangeRecord,
  tab: DetailTab,
  artifactPreview: string,
  validation: ValidationResult | null,
  taskDetail: { items: TaskItem[]; groups: TaskGroup[] },
  onOpenArtifact: (artifact: Artifact) => void,
  onValidate: () => void,
  artifactIssue?: OpenSpecOperationIssue,
) {
  if (tab === "archive-info") {
    return <ArchiveInfoPanel change={change} onOpenArtifact={onOpenArtifact} />;
  }

  if (tab === "proposal" || tab === "design") {
    return (
      <section className="inspector-section artifact-preview-section">
        <h3>{tab === "proposal" ? "proposal.md" : "design.md"}</h3>
        {artifactIssue ? <OperationIssueCallout issue={artifactIssue} /> : null}
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

    const completedTasks = taskDetail.items.filter((item) => item.done);
    const remainingGroups = filterTaskGroups(taskDetail.groups, false);
    const completedGroups = filterTaskGroups(taskDetail.groups, true);
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

const markdownBlockCache = new Map<string, MarkdownBlock[]>();

function MarkdownPreview({
  content,
  emptyText,
}: {
  content: string;
  emptyText: string;
}) {
  const blocks = useMemo(() => parseMarkdownBlocksCached(content), [content]);

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

function parseMarkdownBlocksCached(content: string): MarkdownBlock[] {
  const cached = markdownBlockCache.get(content);

  if (cached) {
    return cached;
  }

  const blocks = parseMarkdownBlocks(content);
  markdownBlockCache.set(content, blocks);

  while (markdownBlockCache.size > MARKDOWN_BLOCK_CACHE_LIMIT) {
    const firstKey = markdownBlockCache.keys().next().value;

    if (firstKey === undefined) {
      break;
    }

    markdownBlockCache.delete(firstKey);
  }

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
  operationIssues,
  onDismissIssue,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  gitStatus: OpenSpecGitStatus;
  loadState: LoadState;
  message: string;
  operationIssues: OpenSpecOperationIssue[];
  onDismissIssue: (issueId: string) => void;
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
      {operationIssues.length > 0 ? (
        <OpenSpecIssuePanel issues={operationIssues} onDismissIssue={onDismissIssue} />
      ) : null}
    </footer>
  );
}

function OpenSpecIssuePanel({
  issues,
  onDismissIssue,
}: {
  issues: OpenSpecOperationIssue[];
  onDismissIssue: (issueId: string) => void;
}) {
  const latest = issues[0];

  if (!latest) {
    return null;
  }

  return (
    <details className="status-band-issues">
      <summary>
        <span>OpenSpec issue</span>
        <strong>{issues.length === 1 ? latest.title : issues.length + " issues"}</strong>
      </summary>
      <OperationIssueList issues={issues} onDismissIssue={onDismissIssue} />
    </details>
  );
}

function OperationIssueList({
  issues,
  onDismissIssue,
}: {
  issues: OpenSpecOperationIssue[];
  onDismissIssue?: (issueId: string) => void;
}) {
  return (
    <ul className="operation-issue-list">
      {issues.map((issue) => (
        <li key={issue.id}>
          <OperationIssueCallout issue={issue} onDismissIssue={onDismissIssue} />
        </li>
      ))}
    </ul>
  );
}

function OperationIssueCallout({
  issue,
  onDismissIssue,
}: {
  issue: OpenSpecOperationIssue;
  onDismissIssue?: (issueId: string) => void;
}) {
  const hasRawOutput = Boolean(issue.stdout || issue.stderr);

  return (
    <article className="operation-issue-callout">
      <div className="operation-issue-header">
        <div>
          <strong>{issue.title}</strong>
          <span>{formatIssueTimestamp(issue.occurredAt)}</span>
        </div>
        {onDismissIssue ? (
          <button type="button" className="link-button" onClick={() => onDismissIssue(issue.id)}>
            Dismiss
          </button>
        ) : null}
      </div>
      <p>{issue.message}</p>
      <div className="operation-issue-meta">
        <span>{operationKindLabel(issue.kind)}</span>
        {issue.target ? <code>{issue.target}</code> : null}
        {issue.statusCode !== undefined && issue.statusCode !== null ? <span>exit {issue.statusCode}</span> : null}
      </div>
      {hasRawOutput ? (
        <details className="operation-output">
          <summary>OpenSpec output</summary>
          {issue.stderr ? (
            <>
              <span>stderr</span>
              <pre>{issue.stderr}</pre>
            </>
          ) : null}
          {issue.stdout ? (
            <>
              <span>stdout</span>
              <pre>{issue.stdout}</pre>
            </>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

export function buildWorkspaceView(
  indexed: ReturnType<typeof indexOpenSpecWorkspace>,
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

  const record: ChangeRecord = {
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

function matchesChangeFilters(change: ChangeRecord, phase: ChangePhase, query: string): boolean {
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

function matchesSpecFilters(spec: SpecRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  return (
    normalizedQuery.length === 0 ||
    spec.searchText.includes(normalizedQuery)
  );
}

function isBlockingValidationIssue(issue: ValidationIssue): boolean {
  return issue.severity === "error";
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

function readinessReasons(taskProgress: TaskProgress | null): string[] {
  const reasons: string[] = [];

  if (!taskProgress) {
    reasons.push("Task progress is unavailable.");
  } else if (taskProgress.done < taskProgress.total) {
    reasons.push(taskProgress.total - taskProgress.done + " tasks remain open.");
  }

  return reasons.length > 0 ? reasons : ["Complete all tasks to make this change archive-ready."];
}

function confirmArchiveChanges(changeNames: string[]): boolean {
  if (typeof window.confirm !== "function") {
    return true;
  }

  return window.confirm(
    "Archive " +
      changeNames.length +
      " archive-ready " +
      (changeNames.length === 1 ? "change" : "changes") +
      "?\n\n" +
      changeNames.join("\n"),
  );
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

function formatIssueTimestamp(value: string): string {
  const time = Date.parse(value);

  if (Number.isNaN(time)) {
    return "Unknown";
  }

  return formatTime(time);
}

function operationKindLabel(kind: OpenSpecOperationIssue["kind"]): string {
  const labels: Record<OpenSpecOperationIssue["kind"], string> = {
    validation: "validation",
    archive: "archive",
    status: "change status",
    "artifact-read": "artifact read",
    "repository-read": "repository read",
    "runner-dispatch": "runner dispatch",
  };

  return labels[kind];
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

function areGitStatusesEqual(left: OpenSpecGitStatus, right: OpenSpecGitStatus): boolean {
  return (
    left.state === right.state &&
    left.dirtyCount === right.dirtyCount &&
    left.message === right.message &&
    left.entries.length === right.entries.length &&
    left.entries.every((entry, index) => entry === right.entries[index])
  );
}

function defaultBoardTableSort<T>(columns: BoardTableColumn<T>[]): BoardTableSortState | null {
  const column = columns.find((candidate) => candidate.sortable);

  if (!column?.sortable) {
    return null;
  }

  return {
    columnId: column.id,
    direction: column.sortable.defaultDirection ?? "desc",
  };
}

function sortBoardRows<T extends { id: string }>(
  rows: T[],
  columns: BoardTableColumn<T>[],
  sortState: BoardTableSortState | null,
): T[] {
  if (!sortState) {
    return rows;
  }

  const column = columns.find((candidate) => candidate.id === sortState.columnId);

  if (!column?.sortable) {
    return rows;
  }

  return sortRowsByNumericValue(rows, sortState.direction, column.sortable.getValue);
}

export function sortRowsByUpdatedTime<T extends { modifiedTimeMs?: number | null }>(
  rows: T[],
  direction: BoardTableSortDirection,
): T[] {
  return sortRowsByNumericValue(rows, direction, (row) => row.modifiedTimeMs);
}

function sortRowsByNumericValue<T>(
  rows: T[],
  direction: BoardTableSortDirection,
  getValue: (row: T) => number | null | undefined,
): T[] {
  return rows
    .map((row, index) => ({ index, row, value: getValue(row) }))
    .sort((left, right) => {
      const leftKnown = typeof left.value === "number" && Number.isFinite(left.value);
      const rightKnown = typeof right.value === "number" && Number.isFinite(right.value);

      if (!leftKnown && !rightKnown) {
        return left.index - right.index;
      }

      if (!leftKnown) {
        return 1;
      }

      if (!rightKnown) {
        return -1;
      }

      const diff = left.value! - right.value!;

      if (diff === 0) {
        return left.index - right.index;
      }

      return direction === "asc" ? diff : -diff;
    })
    .map(({ row }) => row);
}

export function nextTableSortDirection(direction: BoardTableSortDirection): BoardTableSortDirection {
  return direction === "desc" ? "asc" : "desc";
}

function sortAriaValue<T>(column: BoardTableColumn<T>, sortState: BoardTableSortState | null) {
  if (!column.sortable) {
    return undefined;
  }

  if (sortState?.columnId !== column.id) {
    return "none" as const;
  }

  return sortState.direction === "desc" ? "descending" : "ascending";
}

function sortButtonLabel<T>(column: BoardTableColumn<T>, sortState: BoardTableSortState | null): string {
  if (sortState?.columnId !== column.id) {
    return "Sort by " + column.label;
  }

  const current = sortState.direction === "desc" ? "newest first" : "oldest first";
  const next = nextTableSortDirection(sortState.direction) === "desc" ? "newest first" : "oldest first";

  return column.label + ": sorted " + current + ". Activate to sort " + next + ".";
}

function boundedRows<T extends { id: string }>(
  rows: T[],
  selectedId: string,
  limit: number,
): BoundedRows<T> {
  if (rows.length <= limit) {
    return { rows, hiddenCount: 0 };
  }

  const bounded = rows.slice(0, limit);
  const selectedIndex = selectedId ? rows.findIndex((row) => row.id === selectedId) : -1;

  if (selectedIndex >= limit) {
    bounded.push(rows[selectedIndex]);
  }

  return {
    rows: bounded,
    hiddenCount: rows.length - bounded.length,
  };
}

function runnerStatusFromDto(dto: RunnerStatusDto): RunnerStatus {
  if (!dto.configured) {
    return { ...unknownRunnerStatus };
  }

  if (dto.reachable) {
    return {
      state: "reachable",
      label: "Runner reachable",
      detail: dto.message || "Studio Runner responded to health check.",
      statusCode: dto.status_code ?? dto.statusCode ?? null,
      endpoint: dto.endpoint ?? undefined,
      managed: Boolean(dto.managed),
      pid: dto.pid ?? null,
    };
  }

  return {
    state: "unavailable",
    label: "Runner unavailable",
    detail: dto.message || "Studio Runner did not respond successfully.",
    statusCode: dto.status_code ?? dto.statusCode ?? null,
    endpoint: dto.endpoint ?? undefined,
    managed: Boolean(dto.managed),
    pid: dto.pid ?? null,
  };
}



function runnerRepoPath(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENSPEC_STUDIO_RUNNER_REPO) {
    return import.meta.env.VITE_OPENSPEC_STUDIO_RUNNER_REPO;
  }

  return "/Volumes/MacSSD/Projects/symphony/elixir";
}

function createRunnerSessionSecret(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function toRunnerDispatchRequestDto(request: RunnerDispatchRequestInput): RunnerDispatchRequestDto {
  return {
    eventId: request.eventId,
    repoPath: request.repoPath,
    repoName: request.repoName,
    changeName: request.changeName,
    artifactPaths: request.artifactPaths,
    validation: request.validation,
    gitRef: request.gitRef,
    requestedBy: request.requestedBy,
  };
}

function createRunnerEventId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return "evt_" + random.replace(/-/g, "");
}

function createRunnerDispatchAttempt(input: {
  eventId: string;
  repoPath: string;
  changeName: string;
  payload?: unknown;
  status: RunnerDispatchAttempt["status"];
  message: string;
  statusCode?: number | null;
  responseBody?: string | null;
  runId?: string | null;
  previousAttempt?: RunnerDispatchAttempt;
}): RunnerDispatchAttempt {
  return {
    eventId: input.eventId,
    repoPath: input.repoPath,
    changeName: input.changeName,
    status: input.status,
    message: input.message,
    statusCode: input.statusCode ?? null,
    responseBody: input.responseBody ?? null,
    runId: input.runId ?? null,
    payload: input.payload ?? input.previousAttempt?.payload,
    createdAt: input.previousAttempt?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function extractRunId(responseBody: string | null): string | null {
  if (!responseBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(responseBody) as unknown;
    if (parsed && typeof parsed === "object" && "run_id" in parsed && typeof parsed.run_id === "string") {
      return parsed.run_id;
    }
    if (parsed && typeof parsed === "object" && "runId" in parsed && typeof parsed.runId === "string") {
      return parsed.runId;
    }
  } catch {
    return null;
  }

  return null;
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

function recentRepoSwitcherRepos(
  repo: RepositoryView | null,
  recentRepos: PersistedRecentRepo[],
): PersistedRecentRepo[] {
  const currentRepo =
    repo && isPersistableLocalRepoPath(repo.path)
      ? [{ path: repo.path, name: repo.name, lastOpenedAt: Date.now() }]
      : [];
  const repos: PersistedRecentRepo[] = [];

  for (const recent of [...currentRepo, ...recentRepos]) {
    if (!repos.some((candidate) => candidate.path === recent.path)) {
      repos.push(recent);
    }
  }

  return repos;
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
