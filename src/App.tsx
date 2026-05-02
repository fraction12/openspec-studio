import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openPath } from "@tauri-apps/plugin-opener";
import "./App.css";

import {
  createOpenSpecOperationIssue,
  deriveChangeBuildStatus,
  deriveRunnerBuildActionState,
  isPersistableLocalRepoPath,
  sameOpenSpecOperationScope,
  type OpenSpecOperationIssue,
  deriveRunnerDispatchEligibility,
  type RunnerDispatchAttempt,
  type RunnerDispatchEligibility,
  type RunnerSettings,
  type RunnerStatus,
} from "./appModel";
import {
  boundedRows,
  clampBoardTableWidth,
  defaultBoardTableSort,
  nextBoardTableSort,
  nextFocusedRowId,
  reconcileFocusedRowId,
  resetBoardTableWidth,
  sortAriaValue,
  sortBoardRows,
  sortButtonLabel,
  type BoardTableSortDirection,
  type BoardTableSortState,
  type BoardTableSortConfig,
} from "./domain/boardTableModel";
import {
  artifactHealth,
  buildWorkspaceView,
  clearWorkspaceValidationState,
  formatTime,
  matchesChangeFilters,
  matchesSpecFilters,
  specValidationLabel,
  type ArchiveInfo,
  type Artifact,
  type ChangePhase,
  type ChangeRecord,
  type DetailTab,
  type Health,
  type SpecRecord,
  type TaskGroup,
  type TaskItem,
  type TaskProgress,
  type WorkspaceView,
} from "./domain/workspaceViewModel";
import {
  buildArtifactDetailViewModel,
  type ArtifactDetail,
  type ArtifactDetailViewModel,
} from "./domain/artifactDetailViewModel";
import {
  deriveBrowserPreviewRepositoryTransition,
  deriveEmptyRepositoryOpenTransition,
  deriveNoProviderRepositoryTransition,
  deriveReadyRepositoryTransition,
  deriveRefreshRepositoryTransition,
  unknownGitStatus,
  type CandidateRepoError,
  type LoadState,
  type OpenSpecGitStatus,
  type RepositoryView,
} from "./domain/repositoryOpeningFlow";
import {
  derivePersistedWorkspaceSelection,
  initializeWorkspaceNavigation,
  normalizeWorkspaceDetailTab,
  reconcileVisibleChangeSelection,
  reconcileVisibleSpecSelection,
  retainWorkspaceNavigation,
  type BoardView,
  type WorkspaceNavigationState,
} from "./domain/workspaceNavigationState";
import {
  type ValidationResult,
} from "./validation/results";
import {
  createDefaultPersistedAppState,
  clearAllPersistedValidationSnapshots,
  clearPersistedRecentRepositories,
  clearPersistedValidationSnapshot,
  directionFromSortPreference,
  forgetPersistedRecentRepository,
  loadPersistedAppState,
  normalizePersistedAppState,
  rememberPersistedRepo,
  resetPersistedRepoContinuity,
  savePersistedAppState,
  sortPreferenceFromDirection,
  updatePersistedGlobalPreferences,
  updatePersistedRepoSelection,
  updatePersistedRepoSort,
  updatePersistedRunnerExecutionDefaults,
  updatePersistedValidationSnapshot,
  type PersistedAppState,
  type PersistedRecentRepo,
} from "./persistence";
import {
  beginSettingsDestructiveAction,
  cancelSettingsDestructiveAction,
  confirmSettingsDestructiveAction,
  deriveCurrentRepositorySettingsState,
  forgetRecentRepositoryActionKey,
  isSettingsActionAwaitingConfirmation,
  type SettingsDestructiveActionKey,
} from "./settingsModel";
import { ProviderSession } from "./providers/providerSession";
import { createBuiltInOpenSpecProvider } from "./providers/providerRegistry";
import type { ProviderCapabilities } from "./providers/types";
import {
  latestRunnerAttempt,
  mergeRunnerStreamEvent,
  replaceRunnerDispatchAttempt,
  runnerChangeIsBuilding,
  runnerAttemptEventLabel,
  runnerAttemptExecutionDetails,
  runnerAttemptResponseLabel,
  runnerAttemptRowKind,
  runnerAttemptStableRowId,
  runnerAttemptStateLabel,
  runnerAttemptStatusHealth,
  runnerAttemptStatusLabel,
  runnerAttemptSubject,
  runnerDispatchHistoryForRepo,
  staleRunnerAttemptsForEvidence,
  type RunnerStreamEventInput,
  type RunnerStaleEvidence,
  upsertRunnerDispatchAttempt as upsertRunnerLogAttempt,
} from "./runner/studioRunnerLog";
import {
  defaultRunnerSettings,
  runnerRepoPath,
  StudioRunnerSession,
  unknownRunnerStatus,
  type RunnerStreamEventDto,
  type RunnerStreamStatus,
} from "./runner/studioRunnerSession";

interface BoardTableColumn<T> {
  id: string;
  label: string;
  colClassName?: string;
  cellClassName?: string;
  sortable?: BoardTableSortConfig<T>;
  render: (row: T) => ReactNode;
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

const AUTO_REFRESH_INTERVAL_MS = 15_000;
const MAX_OPERATION_ISSUES = 6;
const MARKDOWN_BLOCK_CACHE_LIMIT = 40;
const ROW_RENDER_BATCH_SIZE = 250;

type MainSurface = "workbench" | "settings";

const phaseLabels: Record<ChangePhase, string> = {
  active: "Active",
  "archive-ready": "Archive ready",
  archived: "Archived",
};

function App() {
  const [persistedAppState, setPersistedAppState] = useState<PersistedAppState>(
    createDefaultPersistedAppState,
  );
  const [repo, setRepo] = useState<RepositoryView | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [candidateError, setCandidateError] = useState<CandidateRepoError | null>(null);
  const [view, setView] = useState<BoardView>("changes");
  const [phase, setPhase] = useState<ChangePhase>("active");
  const [changesQuery, setChangesQuery] = useState("");
  const [specsQuery, setSpecsQuery] = useState("");
  const [mainSurface, setMainSurface] = useState<MainSurface>("workbench");
  const [selectedChangeId, setSelectedChangeId] = useState("");
  const [selectedSpecId, setSelectedSpecId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("proposal");
  const [artifactPreview, setArtifactPreview] = useState("");
  const [gitStatus, setGitStatus] = useState<OpenSpecGitStatus>(unknownGitStatus);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [validationBusy, setValidationBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [runnerSettings, setRunnerSettings] = useState<RunnerSettings>(defaultRunnerSettings);
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus>(unknownRunnerStatus);
  const [runnerSessionSecretConfigured, setRunnerSessionSecretConfigured] = useState(false);
  const [runnerDispatchBusy, setRunnerDispatchBusy] = useState(false);
  const [runnerLifecycleBusy, setRunnerLifecycleBusy] = useState(false);
  const [runnerStreamStatus, setRunnerStreamStatus] = useState<RunnerStreamStatus>("disconnected");
  const [message, setMessage] = useState("Loading local workspace...");
  const [operationIssues, setOperationIssues] = useState<OpenSpecOperationIssue[]>([]);
  const runnerSessionSecretConfiguredRef = useRef(runnerSessionSecretConfigured);
  const archiveInFlightRef = useRef(false);
  const persistenceReadyRef = useRef(false);
  const chooseRepositoryFolderRef = useRef<() => Promise<void>>(async () => undefined);
  const providerSessionRef = useRef<ProviderSession<WorkspaceView> | null>(null);
  const runnerSessionRef = useRef<StudioRunnerSession | null>(null);
  const persistedAppStateRef = useRef<PersistedAppState>(persistedAppState);
  const workspaceRef = useRef<WorkspaceView | null>(workspace);
  const repoRef = useRef<RepositoryView | null>(repo);
  const gitStatusRef = useRef<OpenSpecGitStatus>(gitStatus);
  const selectedChangeIdRef = useRef(selectedChangeId);
  const selectedSpecIdRef = useRef(selectedSpecId);
  const runnerSettingsRef = useRef<RunnerSettings>(runnerSettings);
  const runnerStatusRef = useRef<RunnerStatus>(runnerStatus);
  const runnerStreamStatusRef = useRef<RunnerStreamStatus>(runnerStreamStatus);
  const repoPathRef = useRef<string | null>(repo?.path ?? null);
  const deferredChangesQuery = useDeferredValue(changesQuery);
  const deferredSpecsQuery = useDeferredValue(specsQuery);

  const recentRepos = persistedAppState.recentRepos;
  const activeRepoState = repo?.path ? persistedAppState.repoStateByPath[repo.path] : undefined;

  persistedAppStateRef.current = persistedAppState;
  workspaceRef.current = workspace;
  repoRef.current = repo;
  gitStatusRef.current = gitStatus;
  selectedChangeIdRef.current = selectedChangeId;
  selectedSpecIdRef.current = selectedSpecId;
  runnerSettingsRef.current = runnerSettings;
  runnerStatusRef.current = runnerStatus;
  runnerStreamStatusRef.current = runnerStreamStatus;
  repoPathRef.current = repo?.path ?? null;
  runnerSessionSecretConfiguredRef.current = runnerSessionSecretConfigured;
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

  function getProviderSession() {
    if (!providerSessionRef.current) {
      const issues = {
        record: recordOperationIssue,
        clear: clearOperationIssues,
      };
      providerSessionRef.current = new ProviderSession<WorkspaceView>({
        provider: createBuiltInOpenSpecProvider({
          invoke,
          issues,
          now: () => new Date(),
        }),
        issues,
        buildWorkspace: ({ indexed, files, validation, changeStatuses, fileSignature }) =>
          buildWorkspaceView(indexed, files, validation, changeStatuses, fileSignature),
      });
    }

    return providerSessionRef.current;
  }

  function getRunnerSession() {
    if (!runnerSessionRef.current) {
      runnerSessionRef.current = new StudioRunnerSession({
        invoke,
        isTauriRuntime,
        getSettings: () => runnerSettingsRef.current,
        updateSettings: updateRunnerSettings,
        getRunnerExecutionDefaults: () => persistedAppStateRef.current.runnerExecutionDefaults,
        getStatus: () => runnerStatusRef.current,
        setStatus: (status) => {
          runnerStatusRef.current = status;
          setRunnerStatus(status);
        },
        getStreamStatus: () => runnerStreamStatusRef.current,
        getCurrentRepoPath: () => repoPathRef.current,
        isSessionSecretConfigured: () => runnerSessionSecretConfiguredRef.current,
        setSessionSecretConfigured: (configured) => {
          runnerSessionSecretConfiguredRef.current = configured;
          setRunnerSessionSecretConfigured(configured);
        },
        setDispatchBusy: setRunnerDispatchBusy,
        setLifecycleBusy: setRunnerLifecycleBusy,
        setStreamStatus: setRunnerStreamStatus,
        setMessage,
        getRunnerRepoPath: runnerRepoPath,
        getWorkspace: () => workspaceRef.current,
        setWorkspace: (nextWorkspace) => {
          workspaceRef.current = nextWorkspace;
          setWorkspace(nextWorkspace);
        },
        getGitStatus: () => gitStatusRef.current,
        validateWorkspace: (repoPath) =>
          getProviderSession().validate(repoPath, workspaceRef.current, repoRef.current?.path),
        rememberValidationSnapshot,
        rememberRunnerAttempt,
        replaceRunnerAttempt,
        mergeRunnerStreamEvent: rememberRunnerStreamEvent,
        reconcileRunnerAttempts,
        recordOperationIssue,
        clearRunnerDispatchIssues: (repoPath, changeName) =>
          clearOperationIssues(
            (issue) => issue.kind === "runner-dispatch" && issue.repoPath === repoPath && issue.target === changeName,
          ),
        errorMessage,
      });
    }

    return runnerSessionRef.current;
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

    const autoRestoreLastRepo = initialState.globalPreferences.autoRestoreLastRepo !== false;
    const lastRepoPath = autoRestoreLastRepo
      ? initialState.lastRepoPath ?? initialState.recentRepos[0]?.path
      : undefined;

    if (lastRepoPath) {
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
      setMessage("Settings could not be saved: " + errorMessage(error));
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

  function updateSettingsGlobalPreferences(
    preferences: Partial<PersistedAppState["globalPreferences"]>,
  ) {
    updatePersistedState((current) => updatePersistedGlobalPreferences(current, preferences));
    setMessage("Settings saved.");
  }

  function updateSettingsRunnerExecutionDefaults(
    defaults: PersistedAppState["runnerExecutionDefaults"],
  ) {
    updatePersistedState((current) => updatePersistedRunnerExecutionDefaults(current, defaults));
    setMessage("Runner defaults saved for future dispatches.");
  }

  function forgetSettingsRecentRepository(repoPath: string) {
    updatePersistedState((current) => forgetPersistedRecentRepository(current, repoPath));
    setMessage("Removed recent repository history.");
  }

  function clearSettingsRecentRepositories() {
    updatePersistedState(clearPersistedRecentRepositories);
    setMessage("Cleared recent repository history and launch restore target.");
  }

  function resetSettingsCurrentRepoContinuity() {
    const repoPath = repoRef.current?.path;
    if (!repoPath) {
      setMessage("Open a valid repository before resetting current repository continuity.");
      return;
    }

    updatePersistedState((current) => resetPersistedRepoContinuity(current, repoPath));
    setMessage("Reset persisted selection and sort continuity for the current repository.");
  }

  function clearSettingsCurrentValidationSnapshot() {
    const repoPath = repoRef.current?.path;
    if (!repoPath) {
      setMessage("Open a valid repository before clearing its validation cache.");
      return;
    }

    updatePersistedState((current) => clearPersistedValidationSnapshot(current, repoPath));
    clearCurrentWorkspaceValidation(repoPath);
    setMessage("Cleared the current repository validation cache.");
  }

  function clearSettingsAllValidationSnapshots() {
    updatePersistedState(clearAllPersistedValidationSnapshots);
    clearCurrentWorkspaceValidation(repoRef.current?.path ?? null);
    setMessage("Cleared all app-local validation caches.");
  }

  function clearCurrentWorkspaceValidation(repoPath: string | null) {
    if (!repoPath || repoRef.current?.path !== repoPath || !workspaceRef.current) {
      return;
    }

    const nextWorkspace = clearWorkspaceValidationState(workspaceRef.current);
    workspaceRef.current = nextWorkspace;
    setWorkspace(nextWorkspace);
  }

  function rememberRunnerAttempt(attempt: RunnerDispatchAttempt) {
    updatePersistedState((current) => ({
      ...current,
      runnerDispatchAttempts: upsertRunnerLogAttempt(current.runnerDispatchAttempts, attempt),
    }));
  }

  function replaceRunnerAttempt(eventId: string, attempt: RunnerDispatchAttempt) {
    updatePersistedState((current) => ({
      ...current,
      runnerDispatchAttempts: replaceRunnerDispatchAttempt(current.runnerDispatchAttempts, eventId, attempt),
    }));
  }

  function rememberRunnerStreamEvent(event: RunnerStreamEventInput) {
    updatePersistedState((current) => ({
      ...current,
      runnerDispatchAttempts: mergeRunnerStreamEvent(current.runnerDispatchAttempts, event, repoPathRef.current),
    }));
  }

  function reconcileRunnerAttempts(evidence: RunnerStaleEvidence) {
    updatePersistedState((current) => ({
      ...current,
      runnerDispatchAttempts: staleRunnerAttemptsForEvidence(current.runnerDispatchAttempts, evidence),
    }));
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
    if (!isTauriRuntime()) {
      return;
    }

    let disposed = false;
    let unlistenEvent: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    void listen<RunnerStreamEventDto>("studio-runner-event", (event) => {
      if (disposed) {
        return;
      }
      getRunnerSession().handleStreamEvent(event.payload);
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }
      unlistenEvent = nextUnlisten;
    });

    void listen<string>("studio-runner-stream-error", (event) => {
      if (disposed) {
        return;
      }
      getRunnerSession().handleStreamError(event.payload, repoPathRef.current);
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
        return;
      }
      unlistenError = nextUnlisten;
    });

    return () => {
      disposed = true;
      unlistenEvent?.();
      unlistenError?.();
    };
  }, []);

  useEffect(() => {
    if (runnerStatus.state === "online" && repo?.path) {
      void getRunnerSession().startStream(repo, { quiet: true });
      return;
    }

    void getRunnerSession().stopStream();
  }, [runnerStatus.state, runnerSettings.endpoint, repo?.path]);

  useEffect(() => {
    void getRunnerSession().checkStatus({ quiet: true });
  }, [runnerSettings.endpoint, runnerSessionSecretConfigured]);

  useEffect(() => {
    if (
      !repo ||
      repo.state !== "ready" ||
      !workspace ||
      !isTauriRuntime() ||
      persistedAppState.globalPreferences.autoRefreshRepository === false
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRepositoryIfChanged(repo.path);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [
    persistedAppState.globalPreferences.autoRefreshRepository,
    repo?.path,
    repo?.state,
    workspace?.fileSignature.fingerprint,
  ]);

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
  const selectedChangeRunnerEligibility = deriveRunnerDispatchEligibility({
    repoReady: Boolean(repo && repo.state === "ready" && isPersistableLocalRepoPath(repo.path)),
    change: selectedChange,
    runnerSettings,
    runnerStatus,
    sessionSecretConfigured: runnerSessionSecretConfigured,
  });
  const selectedChangeBuilding = useMemo(
    () => runnerChangeIsBuilding(persistedAppState.runnerDispatchAttempts, repo?.path, selectedChange?.name),
    [persistedAppState.runnerDispatchAttempts, repo?.path, selectedChange?.name],
  );
  const repoRunnerDispatchHistory = useMemo(
    () => runnerDispatchHistoryForRepo(persistedAppState.runnerDispatchAttempts, repo?.path),
    [persistedAppState.runnerDispatchAttempts, repo?.path],
  );
  const selectedChangeDetailModel = useMemo(
    () =>
      selectedChange
        ? buildArtifactDetailViewModel({
            change: selectedChange,
            requestedTab: detailTab,
            artifactPreview,
            validation: workspace?.validation ?? null,
            operationIssues,
          })
        : null,
    [artifactPreview, detailTab, operationIssues, selectedChange, workspace?.validation],
  );

  useEffect(() => {
    if (view !== "changes") {
      return;
    }

    const nextSelection = reconcileVisibleChangeSelection({
      changes,
      selectedChangeId,
      phase,
      query: deferredChangesQuery,
    });

    if (nextSelection.selectedChangeId !== selectedChangeId) {
      setSelectedChangeId(nextSelection.selectedChangeId);
      setDetailTab("proposal");
    }
  }, [changes, phase, deferredChangesQuery, selectedChangeId, view]);

  useEffect(() => {
    if (view !== "specs") {
      return;
    }

    const nextSelection = reconcileVisibleSpecSelection({
      specs,
      selectedSpecId,
      query: deferredSpecsQuery,
    });

    if (nextSelection.selectedSpecId !== selectedSpecId) {
      setSelectedSpecId(nextSelection.selectedSpecId);
    }
  }, [deferredSpecsQuery, selectedSpecId, specs, view]);

  useEffect(() => {
    if (!selectedChange) {
      return;
    }

    const nextDetailTab = normalizeWorkspaceDetailTab(selectedChange, detailTab);
    if (nextDetailTab !== detailTab) {
      setDetailTab(nextDetailTab);
    }
  }, [detailTab, selectedChange]);

  useEffect(() => {
    if (!repo || repo.state !== "ready" || !workspace) {
      return;
    }

    const payload = derivePersistedWorkspaceSelection({
      repoPath: repo.path,
      repoState: repo.state,
      workspaceFingerprint: workspace.fileSignature.fingerprint,
      selectedChangeId,
      selectedSpecId,
    });

    if (!payload) {
      return;
    }

    updatePersistedState((current) =>
      updatePersistedRepoSelection(current, payload.repoPath, payload.selection),
    );
  }, [repo?.path, repo?.state, selectedChangeId, selectedSpecId, workspace?.fileSignature.fingerprint]);

  useEffect(() => {
    const path = selectedChangeDetailModel?.selectedArtifactPath;

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
    void getProviderSession()
      .readArtifact(repoPath, path, repoRef.current?.path)
      .then((artifact) => {
        if (artifact.kind === "read") {
          setArtifactPreview(artifact.contents);
        } else if (artifact.kind === "unsupported") {
          setArtifactPreview("");
          setMessage(artifact.message);
        }
      })
      .catch((error) => {
        if (repoRef.current?.path === repoPath) {
          setArtifactPreview("");
          setMessage(errorMessage(error));
        }
      });
  }, [repo, selectedChangeDetailModel?.selectedArtifactPath, workspace]);

  async function loadRepository(repoPath: string) {
    const candidatePath = repoPath.trim();

    if (!candidatePath) {
      const transition = deriveEmptyRepositoryOpenTransition();
      setCandidateError(transition.candidateError);
      setMessage(transition.message);
      return;
    }

    setLoadState("loading");
    setCandidateError(null);
    setMessage("Reading local OpenSpec files from " + candidatePath);

    if (!isTauriRuntime()) {
      const transition = deriveBrowserPreviewRepositoryTransition();

      repoRef.current = transition.repository;
      workspaceRef.current = transition.workspace;
      setRepo(transition.repository);
      setWorkspace(transition.workspace);
      setGitStatus(transition.gitStatus);
      applyWorkspaceNavigation(initializeWorkspaceNavigation(transition.workspace));
      setLoadState(transition.loadState);
      setMessage(transition.message);
      return;
    }

    try {
      const result = await getProviderSession().loadRepository({
        repoPath: candidatePath,
        currentRepoPath: repoRef.current?.path,
        currentWorkspace: workspaceRef.current,
        persistedValidation: persistedAppStateRef.current.repoStateByPath[candidatePath]?.lastValidation,
      });

      if (result.kind === "stale") {
        return;
      }

      if (result.kind === "no-provider") {
        const transition = deriveNoProviderRepositoryTransition(result, {
          hasActiveRepository: Boolean(repo),
        });
        if (transition.repository) {
          repoRef.current = transition.repository;
          workspaceRef.current = null;
          setRepo(transition.repository);
          setWorkspace(null);
          setGitStatus(unknownGitStatus);
          setSelectedChangeId("");
          setSelectedSpecId("");
        }
        setCandidateError(transition.candidateError);
        setLoadState(transition.loadState);
        setMessage(transition.message);
        return;
      }

      const persistedRepoState = persistedAppStateRef.current.repoStateByPath[result.repository.path];
      const transition = deriveReadyRepositoryTransition(result, {
        currentRepoPath: repo?.path,
      });

      setGitStatus(transition.gitStatus);
      repoRef.current = transition.repository;
      workspaceRef.current = transition.workspace;
      setRepo(transition.repository);
      setWorkspace(transition.workspace);
      setCandidateError(transition.candidateError);
      void loadGitStatus(transition.repository.path);
      rememberRecentRepo(transition.rememberRecentRepo.path, transition.rememberRecentRepo.name);
      if (transition.navigationMode === "keep") {
        keepSelectionInWorkspace(transition.workspace);
      } else {
        restorePersistedSelection(transition.workspace, persistedRepoState);
      }
      setLoadState(transition.loadState);
      setMessage(transition.message);
    } catch (error) {
      setCandidateError({
        kind: "unavailable",
        path: candidatePath,
        title: "Repository unavailable",
        message: errorMessage(error),
      });
      getProviderSession().recordRepositoryReadFailure(candidatePath, error);
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
    setValidationBusy(true);
    setMessage("Running OpenSpec validation...");
    const repoPath = repo.path;

    try {
      const result = await getProviderSession().validate(repoPath, workspaceRef.current, repoRef.current?.path);
      if (result.kind === "stale") {
        return;
      }

      if (result.kind === "unsupported") {
        setMessage(result.message);
        setLoadState("loaded");
        return;
      }

      workspaceRef.current = result.workspace;
      setWorkspace(result.workspace);
      rememberValidationSnapshot(repoPath, result.validation);
      setLoadState("loaded");
      setMessage(
        result.validation.diagnostics[0]?.message ??
          (result.validation.state === "pass" ? "Validation checked clean." : "Validation found items that need attention."),
      );
    } catch (error) {
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
    } finally {
      setValidationBusy(false);
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
      const result = await getProviderSession().archiveChanges(repoPath, [changeName], workspaceRef.current, repoRef.current?.path);
      if (result.kind === "stale") {
        return;
      }

      if (result.kind === "unsupported") {
        setLoadState("loaded");
        setMessage(result.message);
        return;
      }

      if (result.kind === "validation-blocked") {
        workspaceRef.current = result.workspace;
        setWorkspace(result.workspace);
        rememberValidationSnapshot(repoPath, result.validation);
        setLoadState("loaded");
        setMessage(result.message);
        return;
      }

      if (result.kind === "partial") {
        if (result.workspace) {
          workspaceRef.current = result.workspace;
          setWorkspace(result.workspace);
        }
        if (result.validation) {
          rememberValidationSnapshot(repoPath, result.validation);
        }
        setPhase("archived");
        setLoadState("loaded");
        setMessage(
          "Archived " + result.archivedCount + " of " + result.requestedCount + " changes before failure: " + result.message,
        );
        return;
      }

      workspaceRef.current = result.workspace;
      setWorkspace(result.workspace);
      rememberValidationSnapshot(repoPath, result.validation);
      setPhase("archived");
      setSelectedChangeId(result.lastArchivedChangeId ?? "");
      setDetailTab("archive-info");
      setMessage("Archived " + changeName + ".");
      setLoadState("loaded");
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

    try {
      const result = await getProviderSession().archiveChanges(repoPath, uniqueChangeNames, workspaceRef.current, repoRef.current?.path);
      if (result.kind === "stale") {
        return;
      }

      if (result.kind === "unsupported") {
        setLoadState("loaded");
        setMessage(result.message);
        return;
      }

      if (result.kind === "validation-blocked") {
        workspaceRef.current = result.workspace;
        setWorkspace(result.workspace);
        rememberValidationSnapshot(repoPath, result.validation);
        setLoadState("loaded");
        setMessage(result.message);
        return;
      }

      if (result.kind === "partial") {
        if (result.workspace) {
          workspaceRef.current = result.workspace;
          setWorkspace(result.workspace);
        }
        if (result.validation) {
          rememberValidationSnapshot(repoPath, result.validation);
        }
        setPhase("archived");
        setLoadState("loaded");
        setMessage(
          "Archived " +
            result.archivedCount +
            " of " +
            result.requestedCount +
            " changes before failure: " +
            result.message,
        );
        return;
      }

      workspaceRef.current = result.workspace;
      setWorkspace(result.workspace);
      rememberValidationSnapshot(repoPath, result.validation);
      setPhase("archived");
      setMessage("Archived " + uniqueChangeNames.length + " changes.");
      setLoadState("loaded");
    } catch (error) {
      setMessage(errorMessage(error));
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

      await loadRepository(selectedPath);
    } catch (error) {
      setCandidateError({
        kind: "unavailable",
        path: "",
        title: "Folder picker unavailable",
        message: errorMessage(error),
      });
      setMessage(errorMessage(error));
    }
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
      const status = await getProviderSession().gitStatus(repoPath, repoRef.current?.path);
      if (status === "stale") {
        return;
      }

      const nextStatus: OpenSpecGitStatus = status;

      if (!options.quiet || !areGitStatusesEqual(gitStatusRef.current, nextStatus)) {
        setGitStatus(nextStatus);
      }
    } catch (error) {
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

  async function refreshRepositoryIfChanged(repoPath: string) {
    try {
      const result = await getProviderSession().refreshRepositoryIfChanged(
        repoPath,
        workspaceRef.current,
        repoRef.current?.path,
      );

      if (result.kind === "stale") {
        return;
      }

      const transition = deriveRefreshRepositoryTransition(result);

      if (transition.kind === "stale") {
        return;
      }

      if (transition.kind === "unchanged") {
        void loadGitStatus(repoPath, { quiet: true });
        return;
      }

      workspaceRef.current = transition.workspace;
      setWorkspace(transition.workspace);
      keepSelectionInWorkspace(transition.workspace);
      void loadGitStatus(repoPath, { quiet: transition.gitStatusQuiet });
      setMessage(transition.message);
    } catch (error) {
      if (repoRef.current?.path === repoPath) {
        setMessage(errorMessage(error));
      }
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

  function restorePersistedSelection(
    nextWorkspace: WorkspaceView,
    persistedRepoState: PersistedAppState["repoStateByPath"][string] | undefined,
  ) {
    applyWorkspaceNavigation(initializeWorkspaceNavigation(nextWorkspace, {
      lastSelectedChange: persistedRepoState?.lastSelectedChange,
      lastSelectedSpec: persistedRepoState?.lastSelectedSpec,
    }));
  }

  function keepSelectionInWorkspace(nextWorkspace: WorkspaceView) {
    const nextSelection = retainWorkspaceNavigation(nextWorkspace, {
      selectedChangeId: selectedChangeIdRef.current,
      selectedSpecId: selectedSpecIdRef.current,
    });

    setSelectedChangeId(nextSelection.selectedChangeId);
    setSelectedSpecId(nextSelection.selectedSpecId);
  }

  function applyWorkspaceNavigation(nextNavigation: WorkspaceNavigationState) {
    setSelectedChangeId(nextNavigation.selectedChangeId);
    setSelectedSpecId(nextNavigation.selectedSpecId);
    setDetailTab(nextNavigation.detailTab);
    setView(nextNavigation.view);
    setPhase(nextNavigation.phase);
    setChangesQuery(nextNavigation.changesQuery);
    setSpecsQuery(nextNavigation.specsQuery);
  }

  return (
    <div className="studio-shell">
      <Sidebar
        repo={repo}
        recentRepos={recentRepos}
        candidateError={candidateError}
        loadState={loadState}
        settingsOpen={mainSurface === "settings"}
        onChooseFolder={() => void chooseRepositoryFolder()}
        onOpenRecent={(path) => void loadRepository(path)}
        onRetryCandidate={(path) => void loadRepository(path)}
        onReturnToActive={() => setCandidateError(null)}
        onOpenSettings={() => setMainSurface("settings")}
      />

      {mainSurface === "settings" ? (
        <SettingsPage
          repo={repo}
          workspace={workspace}
          persistedAppState={persistedAppState}
          onClose={() => setMainSurface("workbench")}
          onGlobalPreferencesChange={updateSettingsGlobalPreferences}
          onRunnerExecutionDefaultsChange={updateSettingsRunnerExecutionDefaults}
          onForgetRecentRepository={forgetSettingsRecentRepository}
          onClearRecentRepositories={clearSettingsRecentRepositories}
          onResetCurrentRepoContinuity={resetSettingsCurrentRepoContinuity}
          onClearCurrentValidation={clearSettingsCurrentValidationSnapshot}
          onClearAllValidation={clearSettingsAllValidationSnapshots}
        />
      ) : (
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
          runnerStatus={runnerStatus}
          changeSortDirection={changeSortDirection}
          specSortDirection={specSortDirection}
          loadState={loadState}
          archiveBusy={archiveBusy}
          providerCapabilities={workspace?.providerCapabilities ?? repo?.providerCapabilities}
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
          runnerAllDispatchHistory={repoRunnerDispatchHistory}
          runnerStreamStatus={runnerStreamStatus}
          validationBusy={validationBusy}
        />
      )}

      <Inspector
        repo={repo}
        workspace={workspace}
        view={view}
        selectedChange={selectedChange}
        selectedSpec={selectedSpec}
        runnerStatus={runnerStatus}
        runnerDispatchEligibility={selectedChangeRunnerEligibility}
        runnerSettings={runnerSettings}
        runnerSessionSecretConfigured={runnerSessionSecretConfigured}
        runnerDispatchBusy={runnerDispatchBusy || runnerLifecycleBusy}
        selectedChangeBuilding={selectedChangeBuilding}
        runnerStreamStatus={runnerStreamStatus}
        artifactDetailModel={selectedChangeDetailModel}
        onDetailTabChange={setDetailTab}
        onOpenArtifact={(artifact) => void openArtifact(artifact)}
        onValidate={() => void runValidation()}
        onRunnerSettingsChange={updateRunnerSettings}
        onConfigureRunnerSessionSecret={() => void getRunnerSession().configureSessionSecret(repo)}
        onClearRunnerSessionSecret={() => void getRunnerSession().clearSessionSecret()}
        onCheckRunnerStatus={() => void getRunnerSession().checkStatus()}
        onStartRunner={() => void getRunnerSession().startRunner(repo)}
        onStopRunner={() => void getRunnerSession().stopRunner(repo)}
        onReconnectRunnerStream={() => void getRunnerSession().startStream(repo)}
        onDispatchRunner={() => void getRunnerSession().dispatchSelectedChange({ repo, selectedChange })}
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

function BuildingActionLabel() {
  return (
    <span className="building-action-label">
      Building
      <span className="building-ellipsis" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </span>
  );
}

function Sidebar({
  repo,
  recentRepos,
  candidateError,
  loadState,
  settingsOpen,
  onChooseFolder,
  onOpenRecent,
  onRetryCandidate,
  onReturnToActive,
  onOpenSettings,
}: {
  repo: RepositoryView | null;
  recentRepos: PersistedRecentRepo[];
  candidateError: CandidateRepoError | null;
  loadState: LoadState;
  settingsOpen: boolean;
  onChooseFolder: () => void;
  onOpenRecent: (path: string) => void;
  onRetryCandidate: (path: string) => void;
  onReturnToActive: () => void;
  onOpenSettings: () => void;
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

      <section className="rail-section rail-recent-section">
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

      <div className="rail-settings-slot">
        <button
          type="button"
          className={settingsOpen ? "rail-settings-button is-selected" : "rail-settings-button"}
          aria-current={settingsOpen ? "page" : undefined}
          onClick={onOpenSettings}
        >
          <strong>Settings</strong>
        </button>
      </div>
    </aside>
  );
}

function SettingsPage({
  repo,
  workspace,
  persistedAppState,
  onClose,
  onGlobalPreferencesChange,
  onRunnerExecutionDefaultsChange,
  onForgetRecentRepository,
  onClearRecentRepositories,
  onResetCurrentRepoContinuity,
  onClearCurrentValidation,
  onClearAllValidation,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  persistedAppState: PersistedAppState;
  onClose: () => void;
  onGlobalPreferencesChange: (preferences: Partial<PersistedAppState["globalPreferences"]>) => void;
  onRunnerExecutionDefaultsChange: (defaults: PersistedAppState["runnerExecutionDefaults"]) => void;
  onForgetRecentRepository: (repoPath: string) => void;
  onClearRecentRepositories: () => void;
  onResetCurrentRepoContinuity: () => void;
  onClearCurrentValidation: () => void;
  onClearAllValidation: () => void;
}) {
  const [pendingAction, setPendingAction] = useState<SettingsDestructiveActionKey | null>(null);
  const [feedback, setFeedback] = useState("");
  const runnerDefaults = persistedAppState.runnerExecutionDefaults;
  const storedRunnerModel =
    runnerDefaults.runnerModel && runnerDefaults.runnerModel !== "default"
      ? runnerDefaults.runnerModel
      : "";
  const [runnerModelMode, setRunnerModelMode] = useState(storedRunnerModel ? "custom" : "default");
  const [customRunnerModel, setCustomRunnerModel] = useState(storedRunnerModel);
  const repoReady = repo?.state === "ready";
  const currentRepoState = repo?.path ? persistedAppState.repoStateByPath[repo.path] : undefined;
  const currentRepoSettingsState = deriveCurrentRepositorySettingsState({
    repoReady,
    hasCurrentValidationSnapshot: Boolean(currentRepoState?.lastValidation || workspace?.validation),
  });
  const autoRestoreLastRepo = persistedAppState.globalPreferences.autoRestoreLastRepo !== false;
  const autoRefreshRepository = persistedAppState.globalPreferences.autoRefreshRepository !== false;

  useEffect(() => {
    const nextStoredRunnerModel =
      runnerDefaults.runnerModel && runnerDefaults.runnerModel !== "default"
        ? runnerDefaults.runnerModel
        : "";
    setCustomRunnerModel(nextStoredRunnerModel);
    setRunnerModelMode(nextStoredRunnerModel ? "custom" : "default");
  }, [runnerDefaults.runnerModel]);

  function updateFeedback(message: string) {
    setFeedback(message);
  }

  function updateRunnerModelMode(mode: string) {
    setRunnerModelMode(mode);
    if (mode === "default") {
      onRunnerExecutionDefaultsChange({
        ...runnerDefaults,
        runnerModel: "default",
      });
      updateFeedback("Runner model default saved.");
      return;
    }

    if (customRunnerModel.trim()) {
      onRunnerExecutionDefaultsChange({
        ...runnerDefaults,
        runnerModel: customRunnerModel.trim(),
      });
      updateFeedback("Runner custom model saved.");
    } else {
      updateFeedback("Enter a custom model id to send one with future runner dispatches.");
    }
  }

  function updateCustomRunnerModel(value: string) {
    setCustomRunnerModel(value);
    onRunnerExecutionDefaultsChange({
      ...runnerDefaults,
      runnerModel: value.trim() || "default",
    });
    updateFeedback(value.trim() ? "Runner custom model saved." : "Runner model default saved.");
  }

  function updateRunnerEffort(value: string) {
    if (value !== "default" && value !== "low" && value !== "medium" && value !== "high") {
      return;
    }

    onRunnerExecutionDefaultsChange({
      ...runnerDefaults,
      runnerEffort: value,
    });
    updateFeedback("Runner effort default saved.");
  }

  return (
    <main className="workspace-main settings-main" aria-label="Settings">
      <header className="workspace-header settings-header">
        <div className="workspace-title">
          <h1>Settings</h1>
          <p>Local app behavior and app-owned data for this Studio install.</p>
        </div>
        <button type="button" className="primary-outline" onClick={onClose}>
          Return to workbench
        </button>
      </header>

      <div className="settings-scroll">
        {feedback ? (
          <div className="settings-feedback" role="status" aria-live="polite">
            {feedback}
          </div>
        ) : null}

        <SettingsSection
          title="App"
          description="These preferences apply immediately and keep manual actions available."
        >
          <SettingsToggle
            title="Reopen last repository on launch"
            description="When enabled, Studio tries the last successful repository before showing the chooser."
            checked={autoRestoreLastRepo}
            onChange={(checked) => {
              onGlobalPreferencesChange({ autoRestoreLastRepo: checked });
              updateFeedback("Launch restore preference saved.");
            }}
          />
          <SettingsToggle
            title="Refresh active repository automatically"
            description="When enabled, Studio refreshes the active repository in the background. Manual refresh stays available."
            checked={autoRefreshRepository}
            onChange={(checked) => {
              onGlobalPreferencesChange({ autoRefreshRepository: checked });
              updateFeedback("Automatic refresh preference saved.");
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Repositories"
          description="Recent repository history is local to Studio and does not touch project files."
        >
          <SettingsValueRow
            title="Launch restore target"
            description={persistedAppState.lastRepoPath ?? "No launch restore target is stored."}
          />
          {persistedAppState.recentRepos.length > 0 ? (
            <div className="settings-repo-list" aria-label="Recent repositories">
              {persistedAppState.recentRepos.map((recent) => (
                <SettingsActionRow
                  key={recent.path}
                  title={recent.name}
                  description={recent.path}
                  actionLabel="Remove"
                  confirmLabel="Confirm"
                  actionKey={forgetRecentRepositoryActionKey(recent.path)}
                  pendingAction={pendingAction}
                  setPendingAction={setPendingAction}
                  onConfirm={() => {
                    onForgetRecentRepository(recent.path);
                    updateFeedback("Removed " + recent.name + " from recent repositories.");
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyState compact title="No recent repositories" body="Repository history will appear after a folder is opened." />
          )}
          <SettingsActionRow
            title="Clear recent repositories"
            description="Remove recent repository history and the launch restore target from app-local state."
            actionLabel="Clear history"
            confirmLabel="Confirm"
            actionKey="clear-recent-repositories"
            pendingAction={pendingAction}
            setPendingAction={setPendingAction}
            disabled={persistedAppState.recentRepos.length === 0 && !persistedAppState.lastRepoPath}
            disabledReason="No repository history is stored."
            onConfirm={() => {
              onClearRecentRepositories();
              updateFeedback("Cleared recent repository history.");
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Current Repository"
          description="These controls affect persisted continuity for the active repository only."
        >
          <SettingsValueRow
            title={repoReady && repo ? repo.name : "No active repository"}
            description={repoReady && repo ? repo.path : "Open a valid repository to enable current-repository controls."}
          />
          <SettingsActionRow
            title="Reset selection and sort continuity"
            description="Clear stored selected change, selected spec, and table sort preferences for future restoration."
            actionLabel="Reset continuity"
            confirmLabel="Confirm"
            actionKey="reset-current-repository-continuity"
            pendingAction={pendingAction}
            setPendingAction={setPendingAction}
            disabled={!currentRepoSettingsState.continuityAvailable}
            disabledReason={currentRepoSettingsState.inactiveReason ?? undefined}
            onConfirm={() => {
              onResetCurrentRepoContinuity();
              updateFeedback("Reset current repository continuity.");
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Validation And Diagnostics"
          description="Cached validation data may include local paths, stdout, stderr, status codes, and parsed diagnostics. Clearing cache never edits OpenSpec files."
        >
          <SettingsActionRow
            title="Clear current validation cache"
            description="Remove the app-local validation snapshot for the active repository and make the current workspace untrusted until validation runs again."
            actionLabel="Clear current"
            confirmLabel="Confirm"
            actionKey="clear-current-validation-cache"
            pendingAction={pendingAction}
            setPendingAction={setPendingAction}
            disabled={!currentRepoSettingsState.currentValidationAvailable}
            disabledReason={currentRepoSettingsState.currentValidationReason ?? undefined}
            onConfirm={() => {
              onClearCurrentValidation();
              updateFeedback("Cleared current repository validation cache.");
            }}
          />
          <SettingsActionRow
            title="Clear all validation caches"
            description="Remove app-local validation snapshots for every persisted repository."
            actionLabel="Clear all"
            confirmLabel="Confirm"
            actionKey="clear-all-validation-caches"
            pendingAction={pendingAction}
            setPendingAction={setPendingAction}
            onConfirm={() => {
              onClearAllValidation();
              updateFeedback("Cleared all validation caches.");
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Integrations"
          description="Durable defaults for implemented integrations. Operational Runner controls stay in the Runner workspace."
        >
          <div className="settings-field-row">
            <div>
              <strong>Studio Runner model</strong>
              <p>Use the configured default or send a custom model id with future Studio-managed dispatches.</p>
            </div>
            <div className="settings-runner-model-control">
              <label>
                <span>Model source</span>
                <select value={runnerModelMode} onChange={(event) => updateRunnerModelMode(event.target.value)}>
                  <option value="default">Default</option>
                  <option value="custom">Custom model id</option>
                </select>
              </label>
              {runnerModelMode === "custom" ? (
                <label>
                  <span>Custom model id</span>
                  <input
                    value={customRunnerModel}
                    placeholder="model id"
                    onChange={(event) => updateCustomRunnerModel(event.target.value)}
                  />
                </label>
              ) : null}
            </div>
          </div>
          <div className="settings-field-row">
            <div>
              <strong>Studio Runner effort</strong>
              <p>Default means the Runner uses the Symphony or Codex configured effort.</p>
            </div>
            <label className="settings-select-control">
              <span>Effort</span>
              <select
                value={runnerDefaults.runnerEffort ?? "default"}
                onChange={(event) => updateRunnerEffort(event.target.value)}
              >
                <option value="default">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
        </SettingsSection>
      </div>
    </main>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function SettingsToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-toggle-row">
      <span>
        <strong>{title}</strong>
        <p>{description}</p>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function SettingsValueRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="settings-value-row">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function SettingsActionRow({
  title,
  description,
  actionLabel,
  confirmLabel,
  actionKey,
  pendingAction,
  setPendingAction,
  disabled = false,
  disabledReason,
  onConfirm,
}: {
  title: string;
  description: string;
  actionLabel: string;
  confirmLabel: string;
  actionKey: SettingsDestructiveActionKey;
  pendingAction: SettingsDestructiveActionKey | null;
  setPendingAction: (action: SettingsDestructiveActionKey | null) => void;
  disabled?: boolean;
  disabledReason?: string;
  onConfirm: () => void;
}) {
  const awaitingConfirmation = isSettingsActionAwaitingConfirmation(pendingAction, actionKey);

  return (
    <div className={awaitingConfirmation ? "settings-action-row is-confirming" : "settings-action-row"}>
      <div>
        <strong>{title}</strong>
        <p>{disabled && disabledReason ? disabledReason : description}</p>
      </div>
      {awaitingConfirmation ? (
        <div className="settings-confirm-actions">
          <button
            type="button"
            className="primary-button"
            autoFocus
            onClick={() => {
              const result = confirmSettingsDestructiveAction(pendingAction, actionKey);
              setPendingAction(result.pendingAction);
              if (result.confirmed) {
                onConfirm();
              }
            }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="primary-outline"
            onClick={() => setPendingAction(cancelSettingsDestructiveAction(pendingAction, actionKey))}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="primary-outline"
          disabled={disabled}
          onClick={() => setPendingAction(beginSettingsDestructiveAction(actionKey))}
        >
          {actionLabel}
        </button>
      )}
    </div>
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
  runnerStatus,
  changeSortDirection,
  specSortDirection,
  loadState,
  archiveBusy,
  validationBusy,
  providerCapabilities,
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
  runnerAllDispatchHistory,
  runnerStreamStatus,
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
  runnerStatus: RunnerStatus;
  changeSortDirection: BoardTableSortDirection;
  specSortDirection: BoardTableSortDirection;
  loadState: LoadState;
  archiveBusy: boolean;
  validationBusy: boolean;
  providerCapabilities?: ProviderCapabilities;
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
  runnerAllDispatchHistory: RunnerDispatchAttempt[];
  runnerStreamStatus: RunnerStreamStatus;
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
          <h1>{repo.name}</h1>
        </div>
        <div className="workspace-actions">
          <div className="workspace-runner-status" title={runnerStatus.detail}>
            <HealthPill health={runnerHealth(runnerStatus)} label={runnerStatusLabel(runnerStatus)} />
          </div>
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
            <button
              type="button"
              aria-pressed={view === "runner"}
              className={view === "runner" ? "is-active" : ""}
              onClick={() => onViewChange("runner")}
            >
              Runner
            </button>
          </div>
          <button type="button" className="primary-outline" onClick={onReload} disabled={loadState === "loading"}>
            Refresh files
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onValidate}
            disabled={loadState === "loading" || !(providerCapabilities?.validation ?? false)}
          >
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
          validationBusy={validationBusy}
          archiveSupported={providerCapabilities?.archive ?? false}
          onPhaseChange={onPhaseChange}
          onQueryChange={onChangesQueryChange}
          onSelectChange={onSelectChange}
          onSortDirectionChange={onChangeSortDirection}
          onArchiveChange={onArchiveChange}
          onArchiveAll={onArchiveAll}
        />
      ) : view === "specs" ? (
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
      ) : (
        <RunnerWorkspace history={runnerAllDispatchHistory} streamStatus={runnerStreamStatus} />
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
  validationBusy,
  archiveSupported,
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
  validationBusy: boolean;
  archiveSupported: boolean;
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
        id: "build-status",
        label: "Build Status",
        colClassName: "build-status-col",
        render: (change) => {
          const status = validationBusy
            ? deriveChangeBuildStatus({
                phase: change.phase,
                taskProgress: change.taskProgress,
                validation: null,
                validationIssueCount: 0,
                validationRunning: true,
              })
            : change.buildStatus;

          return <HealthPill health={status.health} label={status.label} />;
        },
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

    if (phase === "archive-ready" && archiveSupported) {
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
  }, [archiveBusy, onArchiveChange, phase, validationBusy]);

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
          {phase === "archive-ready" && archiveSupported && filteredChanges.length > 0 ? (
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
        id: "validation",
        label: "Validation",
        colClassName: "spec-validation-col",
        render: (spec) => <HealthPill health={spec.health} label={specValidationLabel(spec.health)} />,
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
      <div className="board-toolbar board-toolbar-compact specs-toolbar">
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
    const nextFocusRowId = reconcileFocusedRowId(bounded.rows, focusRowId, selectedId);

    if (nextFocusRowId !== focusRowId) {
      setFocusRowId(nextFocusRowId);
    }
  }, [bounded.rows, focusRowId, selectedId]);

  function focusTableRow(rowId: string) {
    setFocusRowId(rowId);
    window.requestAnimationFrame(() => rowRefs.current.get(rowId)?.focus());
  }

  function moveRowFocus(currentId: string, direction: "next" | "previous" | "first" | "last") {
    const nextRowId = nextFocusedRowId(bounded.rows, currentId, direction);

    if (!nextRowId) {
      return;
    }

    focusTableRow(nextRowId);
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
      updateCssWidth(clampBoardTableWidth(startWidth + event.clientX - startX, resize));
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

    const nextWidth = clampBoardTableWidth(width, resize);
    tableRef.current?.style.setProperty(resize.cssVariable, nextWidth + "px");
    setResizedWidth(nextWidth);
  }

  function resetColumnWidth() {
    if (!resize) {
      return;
    }

    updateColumnWidth(resetBoardTableWidth(resize));
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

    const nextSortState = nextBoardTableSort(column, activeSortState);

    if (!nextSortState) {
      return;
    }

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
  runnerStatus,
  runnerDispatchEligibility,
  runnerSettings,
  runnerSessionSecretConfigured,
  runnerDispatchBusy,
  selectedChangeBuilding,
  runnerStreamStatus,
  artifactDetailModel,
  onDetailTabChange,
  onOpenArtifact,
  onValidate,
  onRunnerSettingsChange,
  onConfigureRunnerSessionSecret,
  onClearRunnerSessionSecret,
  onCheckRunnerStatus,
  onStartRunner,
  onStopRunner,
  onReconnectRunnerStream,
  onDispatchRunner,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  view: BoardView;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  runnerStatus: RunnerStatus;
  runnerDispatchEligibility: RunnerDispatchEligibility;
  runnerSettings: RunnerSettings;
  runnerSessionSecretConfigured: boolean;
  runnerDispatchBusy: boolean;
  selectedChangeBuilding: boolean;
  runnerStreamStatus: "disconnected" | "connecting" | "connected" | "error";
  artifactDetailModel: ArtifactDetailViewModel | null;
  onDetailTabChange: (tab: DetailTab) => void;
  onOpenArtifact: (artifact: Artifact | SpecRecord) => void;
  onValidate: () => void;
  onRunnerSettingsChange: (settings: RunnerSettings) => void;
  onConfigureRunnerSessionSecret: () => void;
  onClearRunnerSessionSecret: () => void;
  onCheckRunnerStatus: () => void;
  onStartRunner: () => void;
  onStopRunner: () => void;
  onReconnectRunnerStream: () => void;
  onDispatchRunner: () => void;
}) {
  if (!repo || !workspace) {
    return (
      <aside className="inspector artifact-inspector" aria-label="Artifact inspector">
        <EmptyState compact title="Artifact inspector" body="Select a valid OpenSpec repository to inspect source artifacts." />
      </aside>
    );
  }


  if (view === "runner") {
    return (
        <RunnerInspector
          settings={runnerSettings}
          status={runnerStatus}
        sessionSecretConfigured={runnerSessionSecretConfigured}
        busy={runnerDispatchBusy}
        onSettingsChange={onRunnerSettingsChange}
        onConfigureSessionSecret={onConfigureRunnerSessionSecret}
        onClearSessionSecret={onClearRunnerSessionSecret}
        onCheckStatus={onCheckRunnerStatus}
        onStartRunner={onStartRunner}
        onStopRunner={onStopRunner}
        streamStatus={runnerStreamStatus}
        onReconnectStream={onReconnectRunnerStream}
      />
    );
  }

  if (view === "specs") {
    return (
      <aside className="inspector artifact-inspector spec-inspector" aria-label="Spec inspector">
        {selectedSpec ? (
          <>
            <div className="inspector-header">
              <h2>{selectedSpec.capability}</h2>
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

  if (!artifactDetailModel) {
    return (
      <aside className="inspector artifact-inspector change-inspector" aria-label="Change artifact inspector">
        <EmptyState compact title="No change selected" body="Choose a change to reveal artifacts and validation details." />
      </aside>
    );
  }

  const tabs = artifactDetailModel?.tabs ?? [];
  const selectedDetailTab = artifactDetailModel?.selectedTab ?? "proposal";
  const selectedChangeIssues = artifactDetailModel?.selectedChangeIssues ?? [];
  const runnerActionState = deriveRunnerBuildActionState({
    dispatchBusy: runnerDispatchBusy,
    selectedChangeBuilding,
    eligibility: runnerDispatchEligibility,
  });

  return (
    <aside className="inspector artifact-inspector change-inspector" aria-label="Change artifact inspector">
      <div className="inspector-header change-inspector-header">
        <h2>{selectedChange.title}</h2>
        {selectedChange.phase === "active" ? (
          <div className="inspector-actions">
            <button
              type="button"
              className="primary-button"
              disabled={runnerActionState.disabled}
              title={runnerActionState.title}
              aria-label={runnerActionState.ariaLabel}
              onClick={onDispatchRunner}
            >
              {runnerActionState.building ? <BuildingActionLabel /> : runnerActionState.label}
            </button>
          </div>
        ) : null}
      </div>

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
          artifactDetailModel.detail,
          onOpenArtifact,
          onValidate,
          artifactDetailModel.selectedArtifactIssue,
        )}
      </div>
    </aside>
  );
}

function RunnerWorkspace({ history, streamStatus }: { history: RunnerDispatchAttempt[]; streamStatus: RunnerStreamStatus }) {
  return (
    <section className="board-panel runner-board" aria-label="Studio Runner workspace">
      <div className="board-toolbar board-toolbar-compact">
        <div>
          <h2>Studio Runner</h2>
          <p>One local runner per repo/session. Start it from the inspector, then dispatch eligible selected changes.</p>
        </div>
      </div>
      <div className="runner-main-content">
        <div className="runner-overview">
          <section className="inspector-section runner-overview-card">
            <h3>Execution model</h3>
            <p>Studio sends a signed, thin `build.requested` event. The runner reads OpenSpec artifacts from disk and owns execution.</p>
          </section>
          <section className="inspector-section runner-overview-card">
            <h3>Safety boundary</h3>
            <p>Endpoints stay localhost-only, the signing secret is session-only, and dispatch is never automatic.</p>
          </section>
        </div>

        <RunnerLogTable history={history} streamStatus={streamStatus} />
      </div>
    </section>
  );
}

function RunnerLogTable({ history, streamStatus }: { history: RunnerDispatchAttempt[]; streamStatus: RunnerStreamStatus }) {
  const latestAttempt = latestRunnerAttempt(history);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(() => new Set());

  function toggleExpanded(rowId: string) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, rowId: string) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    toggleExpanded(rowId);
  }

  return (
    <section className="runner-log-panel" aria-label="Studio Runner log">
      <div className="runner-log-header">
        <div>
          <span>Runner log</span>
          <h3>Runner Log</h3>
          <p>All Studio Runner dispatch, lifecycle, stream, completion, blocked, and failure events for this repository.</p>
        </div>
        {latestAttempt ? (
          <div className="runner-log-latest">
            <span>Latest</span>
            <strong>{latestAttempt.changeName}</strong>
            <p>{runnerAttemptStateLabel(latestAttempt)} · {runnerAttemptResponseLabel(latestAttempt)}</p>
          </div>
        ) : null}
      </div>

      {history.length === 0 ? (
        <EmptyState
          compact
          title="No runner events yet"
          body="Start the runner or dispatch an eligible change and Studio Runner events will appear here."
        />
      ) : (
        <div className="table-scroll">
          <table className="change-table runner-requests-table" aria-label="runner log events table">
            <colgroup>
              <col className="runner-expand-col" />
              <col className="runner-event-col" />
              <col className="runner-status-col" />
              <col className="runner-subject-col" />
              <col className="runner-response-col" />
              <col className="runner-updated-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col"><span>Details</span></th>
                <th scope="col"><span>Event</span></th>
                <th scope="col"><span>State</span></th>
                <th scope="col"><span>Subject</span></th>
                <th scope="col"><span>Message</span></th>
                <th scope="col"><span>Updated</span></th>
              </tr>
            </thead>
            <tbody>
              {history.map((attempt) => {
                const rowId = runnerAttemptStableRowId(attempt);
                const expanded = expandedRows.has(rowId);
                return (
                  <Fragment key={rowId}>
                    <tr
                      key={rowId}
                      role="row"
                      tabIndex={0}
                      aria-selected={expanded}
                      aria-expanded={expanded}
                      className={expanded ? "runner-log-row is-expanded is-selected" : "runner-log-row"}
                      onClick={() => toggleExpanded(rowId)}
                      onKeyDown={(event) => handleRowKeyDown(event, rowId)}
                    >
                      <td className="runner-expand-cell">
                        <button
                          type="button"
                          className="runner-expand-button"
                          aria-expanded={expanded}
                          aria-label={(expanded ? "Collapse " : "Expand ") + runnerAttemptEventLabel(attempt)}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpanded(rowId);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <span aria-hidden="true">{expanded ? "-" : "+"}</span>
                        </button>
                      </td>
                      <td className="runner-event-cell">
                        <div className="runner-event-summary">
                          <strong>{runnerAttemptEventLabel(attempt)}</strong>
                          <code title={attempt.eventId}>{attempt.runId || attempt.eventId}</code>
                        </div>
                      </td>
                      <td className="runner-state-cell">
                        <RunnerAttemptStatusPill attempt={attempt} />
                      </td>
                      <td className="runner-subject-cell">
                        <div className="runner-subject-summary">
                          <strong title={runnerAttemptSubject(attempt)}>{runnerAttemptSubject(attempt)}</strong>
                          {attempt.repoChangeKey ? <span>{attempt.repoChangeKey}</span> : null}
                        </div>
                      </td>
                      <td className="runner-response-cell">
                        <RunnerAttemptMessageCell attempt={attempt} />
                      </td>
                      <td className="updated-cell">{formatRunnerDateTime(attempt.updatedAt)}</td>
                    </tr>
                    {expanded ? (
                      <tr key={rowId + "-details"} className="runner-detail-row">
                        <td colSpan={6}>
                          <RunnerLogRowDetails attempt={attempt} streamStatus={streamStatus} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RunnerAttemptStatusPill({ attempt }: { attempt: RunnerDispatchAttempt }) {
  return <HealthPill health={runnerAttemptStatusHealth(attempt)} label={runnerAttemptStatusLabel(attempt)} />;
}

function RunnerAttemptMessageCell({ attempt }: { attempt: RunnerDispatchAttempt }) {
  const response = runnerAttemptResponseLabel(attempt);
  return (
    <div className="runner-message-cell">
      <span>{attempt.message}</span>
      {attempt.prUrl ? (
        <a
          href={attempt.prUrl}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openPath(attempt.prUrl || "");
          }}
        >
          {response}
        </a>
      ) : response !== attempt.message ? (
        <small>{response}</small>
      ) : null}
      {(attempt.repeatCount ?? 0) > 1 ? (
        <small>
          Repeated {attempt.repeatCount} times
          {attempt.latestRecordedAt ? " · latest " + formatRunnerDateTime(attempt.latestRecordedAt) : ""}
        </small>
      ) : null}
    </div>
  );
}

function RunnerLogRowDetails({
  attempt,
  streamStatus,
}: {
  attempt: RunnerDispatchAttempt;
  streamStatus: RunnerStreamStatus;
}) {
  if (runnerAttemptRowKind(attempt) !== "run") {
    return (
      <div className="runner-row-details">
        <RunnerMetadataSection
          title="Operational Event"
          items={[
            ["Kind", runnerAttemptRowKind(attempt)],
            ["State", runnerAttemptStateLabel(attempt)],
            ["Event", attempt.eventName],
            ["Endpoint", attempt.endpoint],
            ["Message", attempt.message],
            ["First seen", attempt.firstRecordedAt],
            ["Latest", attempt.latestRecordedAt ?? attempt.updatedAt],
            ["Repeat count", attempt.repeatCount && attempt.repeatCount > 1 ? String(attempt.repeatCount) : null],
            ["Error", attempt.error],
          ]}
        />
      </div>
    );
  }

  const details = runnerAttemptExecutionDetails(attempt, { streamStatus });
  return (
    <div className="runner-row-details">
      <div className="runner-detail-columns">
        <RunnerMetadataSection
          title="Run Identity"
          items={[
            ["Event ID", attempt.eventId],
            ["Run ID", attempt.runId],
            ["Change", attempt.changeName],
            ["Repo/change", attempt.repoChangeKey],
            ["Recorded", attempt.recordedAt],
            ["State", runnerAttemptStateLabel(attempt)],
          ]}
        />
        <RunnerMetadataSection
          title="Workspace"
          items={[
            ["Workspace path", attempt.workspacePath],
            ["Workspace status", attempt.workspaceStatus],
            ["Created", attempt.workspaceCreatedAt],
            ["Updated", attempt.workspaceUpdatedAt],
            ["Session", attempt.sessionId],
          ]}
        />
        <RunnerMetadataSection
          title="Publication"
          items={[
            ["Source repo", attempt.sourceRepoPath],
            ["Base commit", attempt.baseCommitSha],
            ["Branch", attempt.branchName],
            ["Commit", attempt.commitSha],
            ["PR", attempt.prUrl],
            ["PR state", attempt.prState],
            ["Merged", attempt.prMergedAt],
            ["Closed", attempt.prClosedAt],
          ]}
        />
        <RunnerMetadataSection
          title="Cleanup"
          items={[
            ["Eligible", attempt.cleanupEligible === undefined || attempt.cleanupEligible === null ? null : String(attempt.cleanupEligible)],
            ["Reason", attempt.cleanupReason],
            ["Status", attempt.cleanupStatus],
            ["Error", attempt.cleanupError],
          ]}
        />
      </div>

      {attempt.error ? (
        <div className="runner-log-notice error">
          <strong>Run error</strong>
          <span>{attempt.error}</span>
        </div>
      ) : null}

      <section className="runner-execution-section" aria-label="Runner execution details">
        <div className="runner-execution-heading">
          <h4>Execution Details</h4>
          {details.truncated ? <span>Truncated</span> : null}
        </div>
        <RunnerExecutionAvailability reason={details.unavailableReason} streamStatus={streamStatus} />
        {details.droppedEntryCount > 0 ? (
          <div className="runner-log-notice">
            <strong>Retention bound reached</strong>
            <span>{details.droppedEntryCount} older execution entries were dropped from this local view.</span>
          </div>
        ) : null}
        {details.entries.length > 0 ? (
          <ol className="runner-execution-list">
            {details.entries.map((entry, index) => (
              <li key={[entry.sequence ?? index, entry.recordedAt, entry.source, entry.message].join("|")}>
                <div className="runner-execution-entry-header">
                  <span>{formatRunnerDateTime(entry.recordedAt)}</span>
                  <strong>{entry.source}{entry.phase ? " · " + entry.phase : ""}</strong>
                  <em>{entry.derived ? "Summary milestone" : entry.level}</em>
                </div>
                <p>{entry.message}</p>
                {entry.details !== undefined ? <pre>{formatRunnerEntryDetails(entry.details)}</pre> : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="runner-log-notice">
            <strong>No execution entries</strong>
            <span>No bounded execution detail entries are available for this run.</span>
          </div>
        )}
      </section>
    </div>
  );
}

function RunnerExecutionAvailability({
  reason,
  streamStatus,
}: {
  reason: string | null;
  streamStatus: RunnerStreamStatus;
}) {
  if (!reason && streamStatus !== "connecting") {
    return null;
  }

  const copy =
    streamStatus === "connecting"
      ? ["Loading", "Execution details are loading from the runner stream."]
      : reason === "disconnected"
        ? ["Disconnected", "The runner stream is disconnected; showing the latest summary metadata Studio already has."]
        : reason === "error"
          ? ["Stream error", "The runner stream reported an error; detailed execution logs may be stale."]
          : reason === "empty"
            ? ["Empty", "The runner did not provide execution entries for this run."]
            : ["Not yet provided", "Studio Runner does not provide first-class structured execution-log entries yet; showing summary-derived milestones."];

  return (
    <div className={"runner-log-notice " + (reason === "error" ? "error" : "")}>
      <strong>{copy[0]}</strong>
      <span>{copy[1]}</span>
    </div>
  );
}

function RunnerMetadataSection({
  title,
  items,
}: {
  title: string;
  items: Array<[string, string | null | undefined]>;
}) {
  const visibleItems = items.filter(([, value]) => value !== null && value !== undefined && value !== "");
  return (
    <section className="runner-metadata-section">
      <h4>{title}</h4>
      {visibleItems.length > 0 ? (
        <dl>
          {visibleItems.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{renderRunnerMetadataValue(String(value))}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Not provided by runner.</p>
      )}
    </section>
  );
}

function renderRunnerMetadataValue(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return <a href={value} onClick={(event) => { event.preventDefault(); void openPath(value); }}>{value}</a>;
  }

  return <span>{value}</span>;
}

function formatRunnerEntryDetails(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function RunnerInspector({
  settings,
  status,
  sessionSecretConfigured,
  busy,
  onSettingsChange,
  onConfigureSessionSecret,
  onClearSessionSecret,
  onCheckStatus,
  onStartRunner,
  onStopRunner,
  streamStatus,
  onReconnectStream,
}: {
  settings: RunnerSettings;
  status: RunnerStatus;
  sessionSecretConfigured: boolean;
  busy: boolean;
  onSettingsChange: (settings: RunnerSettings) => void;
  onConfigureSessionSecret: () => void;
  onClearSessionSecret: () => void;
  onCheckStatus: () => void;
  onStartRunner: () => void;
  onStopRunner: () => void;
  streamStatus: "disconnected" | "connecting" | "connected" | "error";
  onReconnectStream: () => void;
}) {
  const statusNotice = runnerOwnershipNotice(status, sessionSecretConfigured);
  const statusMatchesCurrentEndpoint = !status.endpoint || status.endpoint === settings.endpoint.trim();
  const primaryDisabled =
    busy ||
    (statusMatchesCurrentEndpoint && (status.ownership === "custom" || status.ownership === "occupied"));
  const primaryLabel =
    status.state === "starting"
      ? "Starting..."
      : status.state === "online" && status.canRestart
        ? "Restart runner"
        : "Start runner";
  return (
    <aside className="inspector artifact-inspector runner-inspector" aria-label="Studio Runner inspector">
      <div className="inspector-header">
        <h2>Studio Runner</h2>
        <p>Start one local runner for this repository, then dispatch selected changes from the change inspector.</p>
      </div>
      <div className="inspector-body artifact-inspector-body">
        <section className="inspector-section">
          <h3>Status</h3>
          <p role="status">{status.detail}</p>
          {statusNotice ? <p className="muted-copy">{statusNotice}</p> : null}
          <div className="section-actions">
            <button type="button" className="primary-button" onClick={onStartRunner} disabled={primaryDisabled}>
              {primaryLabel}
            </button>
            <button type="button" className="primary-outline" onClick={onCheckStatus} disabled={busy}>
              Check status
            </button>
            {status.canStop ? (
              <button type="button" className="link-button" onClick={onStopRunner} disabled={busy}>
                Stop runner
              </button>
            ) : null}
          </div>
        </section>
        <section className="inspector-section">
          <h3>Endpoint</h3>
          <label className="field-control">
            <span>Events endpoint</span>
            <input
              value={settings.endpoint}
              onChange={(event) => onSettingsChange({ ...settings, endpoint: event.target.value })}
              placeholder="http://127.0.0.1:4000/api/v1/studio-runner/events"
            />
          </label>
          <p className="muted-copy">Localhost only for the alpha. Studio derives health from the events endpoint.</p>
        </section>
        <section className="inspector-section">
          <h3>Session secret</h3>
          <p>{sessionSecretConfigured ? "Configured for this app session." : "Not generated yet."}</p>
          <div className="section-actions">
            <button type="button" className="primary-outline" onClick={onConfigureSessionSecret} disabled={busy}>
              {sessionSecretConfigured ? "Regenerate session secret" : "Generate session secret"}
            </button>
            {sessionSecretConfigured ? (
              <button type="button" className="link-button" onClick={onClearSessionSecret} disabled={busy}>
                Clear session secret
              </button>
            ) : null}
          </div>
        </section>
        <section className="inspector-section">
          <div className="section-title-row">
            <h3>Event stream</h3>
            <HealthPill health={streamStatus === "connected" ? "valid" : streamStatus === "error" ? "invalid" : "stale"} label={streamStatus} />
          </div>
          <p className="muted-copy">Live Studio Runner events feed the Runner Log without polling.</p>
          <div className="section-actions">
            <button type="button" className="link-button" onClick={onReconnectStream} disabled={busy || status.state !== "online"}>
              Reconnect stream
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

function runnerHealth(status: RunnerStatus): Health {
  if (status.ownership === "occupied") {
    return "invalid";
  }
  if (status.ownership === "recovered") {
    return "stale";
  }
  if (status.state === "online") {
    return "valid";
  }
  if (status.state === "checking" || status.state === "starting") {
    return "stale";
  }
  return "stale";
}

function runnerStatusLabel(status: RunnerStatus): string {
  return status.label || (status.state === "online" ? "Online" : "Offline");
}

function runnerOwnershipNotice(status: RunnerStatus, sessionSecretConfigured = true): string | null {
  if (status.ownership === "recovered") {
    if (!sessionSecretConfigured) {
      return "Studio found an existing local Studio Runner for this repository, restart the runner to fix secret mismatch.";
    }
    return "Studio found an existing local Studio Runner for this repository.";
  }
  if (status.ownership === "custom") {
    return "This compatible runner is user-managed; Studio will not stop or restart it.";
  }
  if (status.ownership === "occupied") {
    return "Another process owns the configured port. Stop it outside Studio or choose another endpoint.";
  }
  return null;
}

function formatRunnerDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderDetailTab(
  detail: ArtifactDetail,
  onOpenArtifact: (artifact: Artifact) => void,
  onValidate: () => void,
  artifactIssue?: OpenSpecOperationIssue,
) {
  if (detail.kind === "archive-info") {
    return (
      <ArchiveInfoPanel
        archiveInfo={detail.archiveInfo}
        emptyTitle={detail.emptyTitle}
        emptyBody={detail.emptyBody}
        onOpenArtifact={onOpenArtifact}
      />
    );
  }

  if (detail.kind === "artifact") {
    return (
      <section className="inspector-section artifact-preview-section">
        <h3>{detail.title}</h3>
        {artifactIssue ? <OperationIssueCallout issue={artifactIssue} /> : null}
        <MarkdownPreview content={detail.content} emptyText={detail.emptyText} />
      </section>
    );
  }

  if (detail.kind === "tasks") {
    if (detail.unavailable) {
      return (
        <EmptyState compact tone="warning" title="Task progress unavailable" body="tasks.md is missing." />
      );
    }

    return (
      <>
        <section className="inspector-section artifact-task-section">
          <div className="section-title-row">
            <h3>Open tasks</h3>
            <span>{detail.remainingCount}</span>
          </div>
          {detail.remainingCount > 0 ? (
            <TaskGroups groups={detail.remainingGroups} />
          ) : (
            <p className="muted-copy">No remaining tasks. This change is ready for final checks.</p>
          )}
        </section>
        <details className="disclosure task-history">
          <summary>
            Completed tasks <span>{detail.completedCount}</span>
          </summary>
          <TaskGroups groups={detail.completedGroups} compact />
        </details>
        <section className="inspector-section progress-section artifact-progress-section">
          <div className="section-title-row">
            <h3>tasks.md progress</h3>
            <span>{detail.remainingCount} left</span>
          </div>
          <TaskProgressCell progress={detail.taskProgress} expanded />
        </section>
      </>
    );
  }

  if (detail.kind === "spec-delta") {
    return detail.artifacts.length > 0 ? (
      <section className="inspector-section artifact-delta-section">
        <h3>Delta specs</h3>
        <ArtifactList artifacts={detail.artifacts} onOpenArtifact={onOpenArtifact} />
      </section>
    ) : (
      <EmptyState compact tone="warning" title={detail.emptyTitle} body={detail.emptyBody} />
    );
  }

  return (
    <>
      {detail.diagnostics.length ? (
        <details className="disclosure" open>
          <summary>OpenSpec command output</summary>
          <ul className="message-list">
            {detail.diagnostics.map((diagnostic) => (
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
        {detail.validationIssues.length === 0 ? (
          <p className="muted-copy">No check messages are linked to this change.</p>
        ) : (
          <ul className="message-list">
            {detail.validationIssues.map((issue) => (
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
        <ArtifactList artifacts={detail.artifacts} onOpenArtifact={onOpenArtifact} showMissing />
      </details>

      <details className="disclosure">
        <summary>Archive readiness</summary>
        <div className="readiness-summary">
          <HealthPill
            health={detail.archiveReadiness.ready ? "ready" : "blocked"}
            label={detail.archiveReadiness.ready ? "Ready to archive" : "Not ready"}
          />
          <ul className="detail-list">
            {detail.archiveReadiness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}

function ArchiveInfoPanel({
  archiveInfo,
  emptyTitle,
  emptyBody,
  onOpenArtifact,
}: {
  archiveInfo: ArchiveInfo | undefined;
  emptyTitle: string;
  emptyBody: string;
  onOpenArtifact: (artifact: Artifact) => void;
}) {
  if (!archiveInfo) {
    return (
      <EmptyState
        compact
        tone="warning"
        title={emptyTitle}
        body={emptyBody}
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
  const footerMessage = loadState === "loading" ? "Working..." : operationIssues.length > 0 ? "" : message;

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
      {footerMessage ? (
        <div className="status-band-toast" aria-live="polite">
          {footerMessage}
        </div>
      ) : null}
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

function areGitStatusesEqual(left: OpenSpecGitStatus, right: OpenSpecGitStatus): boolean {
  return (
    left.state === right.state &&
    left.dirtyCount === right.dirtyCount &&
    left.message === right.message &&
    left.entries.length === right.entries.length &&
    left.entries.every((entry, index) => entry === right.entries[index])
  );
}

function absoluteArtifactPath(repoPath: string, artifactPath: string): string {
  if (artifactPath.startsWith("/")) {
    return artifactPath;
  }

  return repoPath.replace(/\/$/, "") + "/" + artifactPath;
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
