import type {
  OpenSpecFileSignature,
  RunnerDispatchAttempt,
  RunnerExecutionDefaults,
  RunnerSettings,
} from "./appModel";
import { isPersistableLocalRepoPath } from "./appModel";
import {
  normalizeRunnerDispatchAttempts,
  upsertRunnerDispatchAttempt as upsertRunnerLogAttempt,
} from "./runner/studioRunnerLog";
import {
  markValidationStaleAfterFileChange,
  type ValidationResult,
  type ValidationState,
} from "./validation/results";

export const PERSISTED_APP_STATE_VERSION = 1;
export const RECENT_REPO_LIMIT = 5;

const STORE_PATH = "openspec-studio-state.json";
const STORE_STATE_KEY = "state";

export type PersistedSortPreference = "updated-desc" | "updated-asc";

export interface PersistedAppState {
  version: 1;
  recentRepos: PersistedRecentRepo[];
  lastRepoPath?: string;
  globalPreferences: PersistedGlobalPreferences;
  repoStateByPath: Record<string, PersistedRepoState>;
  runnerSettings?: RunnerSettings;
  runnerExecutionDefaults: RunnerExecutionDefaults;
  runnerDispatchAttempts?: RunnerDispatchAttempt[];
}

export interface PersistedRecentRepo {
  path: string;
  name: string;
  lastOpenedAt: number;
}

export interface PersistedGlobalPreferences {
  density?: "comfortable" | "compact";
  theme?: "system" | "light" | "dark";
  autoRestoreLastRepo?: boolean;
  autoRefreshRepository?: boolean;
}

export interface PersistedRepoState {
  lastOpenedAt: number;
  lastSelectedChange?: string;
  lastSelectedSpec?: string;
  changeSort?: PersistedSortPreference;
  specSort?: PersistedSortPreference;
  lastValidation?: PersistedValidationSnapshot;
}

export interface PersistedValidationSnapshot {
  checkedAt: number;
  state: Exclude<ValidationState, "stale">;
  issueCount: number;
  summary: string;
  fileFingerprint: string;
  latestPath?: string | null;
  latestModifiedTimeMs?: number | null;
  result: ValidationResult;
}

interface StoreLike {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

let storePromise: Promise<StoreLike> | null = null;

export function createDefaultPersistedAppState(): PersistedAppState {
  return {
    version: PERSISTED_APP_STATE_VERSION,
    recentRepos: [],
    globalPreferences: {},
    repoStateByPath: {},
    runnerExecutionDefaults: {},
    runnerDispatchAttempts: [],
  };
}

export async function loadPersistedAppState(): Promise<PersistedAppState> {
  const store = await loadAppStateStore();
  const raw = await store.get<unknown>(STORE_STATE_KEY);

  return normalizePersistedAppState(raw);
}

export async function savePersistedAppState(state: PersistedAppState): Promise<void> {
  const store = await loadAppStateStore();
  await store.set(STORE_STATE_KEY, normalizePersistedAppState(state));
  await store.save();
}

export function normalizePersistedAppState(value: unknown): PersistedAppState {
  if (!isRecord(value) || value.version !== PERSISTED_APP_STATE_VERSION) {
    return createDefaultPersistedAppState();
  }

  const recentRepos = normalizeRecentRepos(value.recentRepos);
  const lastRepoPath =
    typeof value.lastRepoPath === "string" && isPersistableLocalRepoPath(value.lastRepoPath)
      ? value.lastRepoPath
      : recentRepos[0]?.path;
  const repoStateByPath = normalizeRepoStateByPath(value.repoStateByPath);

  return {
    version: PERSISTED_APP_STATE_VERSION,
    recentRepos,
    ...(lastRepoPath ? { lastRepoPath } : {}),
    globalPreferences: normalizeGlobalPreferences(value.globalPreferences),
    repoStateByPath,
    runnerSettings: normalizeRunnerSettings(value.runnerSettings),
    runnerExecutionDefaults: normalizeRunnerExecutionDefaults(value.runnerExecutionDefaults),
    runnerDispatchAttempts: normalizeRunnerDispatchAttempts(value.runnerDispatchAttempts),
  };
}

export function updatePersistedGlobalPreferences(
  state: PersistedAppState,
  preferences: Partial<PersistedGlobalPreferences>,
): PersistedAppState {
  return normalizePersistedAppState({
    ...state,
    globalPreferences: {
      ...state.globalPreferences,
      ...preferences,
    },
  });
}

export function rememberPersistedRepo(
  state: PersistedAppState,
  repo: { path: string; name: string },
  openedAt = Date.now(),
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repo.path)) {
    return state;
  }

  const recentRepos = normalizeRecentRepos([
    {
      path: repo.path,
      name: repo.name,
      lastOpenedAt: openedAt,
    },
    ...state.recentRepos.filter((recent) => recent.path !== repo.path),
  ]);
  const currentRepoState = state.repoStateByPath[repo.path];

  return normalizePersistedAppState({
    ...state,
    recentRepos,
    lastRepoPath: repo.path,
    repoStateByPath: {
      ...state.repoStateByPath,
      [repo.path]: {
        ...currentRepoState,
        lastOpenedAt: openedAt,
      },
    },
  });
}

export function updatePersistedRepoSelection(
  state: PersistedAppState,
  repoPath: string,
  selection: { changeId?: string; specId?: string },
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repoPath)) {
    return state;
  }

  const current = state.repoStateByPath[repoPath] ?? { lastOpenedAt: Date.now() };

  return normalizePersistedAppState({
    ...state,
    repoStateByPath: {
      ...state.repoStateByPath,
      [repoPath]: {
        ...current,
        ...(selection.changeId !== undefined ? { lastSelectedChange: selection.changeId } : {}),
        ...(selection.specId !== undefined ? { lastSelectedSpec: selection.specId } : {}),
      },
    },
  });
}

export function updatePersistedRepoSort(
  state: PersistedAppState,
  repoPath: string,
  sort: { changeSort?: PersistedSortPreference; specSort?: PersistedSortPreference },
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repoPath)) {
    return state;
  }

  const current = state.repoStateByPath[repoPath] ?? { lastOpenedAt: Date.now() };

  return normalizePersistedAppState({
    ...state,
    repoStateByPath: {
      ...state.repoStateByPath,
      [repoPath]: {
        ...current,
        ...sort,
      },
    },
  });
}

export function forgetPersistedRecentRepository(
  state: PersistedAppState,
  repoPath: string,
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repoPath)) {
    return state;
  }

  return normalizePersistedAppState({
    ...state,
    recentRepos: state.recentRepos.filter((recent) => recent.path !== repoPath),
    lastRepoPath: state.lastRepoPath === repoPath ? undefined : state.lastRepoPath,
  });
}

export function clearPersistedRecentRepositories(state: PersistedAppState): PersistedAppState {
  return normalizePersistedAppState({
    ...state,
    recentRepos: [],
    lastRepoPath: undefined,
  });
}

export function resetPersistedRepoContinuity(
  state: PersistedAppState,
  repoPath: string,
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repoPath)) {
    return state;
  }

  const current = state.repoStateByPath[repoPath];
  if (!current) {
    return state;
  }

  const remaining: PersistedRepoState = { ...current };
  delete remaining.lastSelectedChange;
  delete remaining.lastSelectedSpec;
  delete remaining.changeSort;
  delete remaining.specSort;

  return normalizePersistedAppState({
    ...state,
    repoStateByPath: {
      ...state.repoStateByPath,
      [repoPath]: remaining,
    },
  });
}

export function clearPersistedValidationSnapshot(
  state: PersistedAppState,
  repoPath: string,
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repoPath)) {
    return state;
  }

  const current = state.repoStateByPath[repoPath];
  if (!current) {
    return state;
  }

  const remaining: PersistedRepoState = { ...current };
  delete remaining.lastValidation;

  return normalizePersistedAppState({
    ...state,
    repoStateByPath: {
      ...state.repoStateByPath,
      [repoPath]: remaining,
    },
  });
}

export function clearAllPersistedValidationSnapshots(state: PersistedAppState): PersistedAppState {
  const repoStateByPath: Record<string, PersistedRepoState> = {};

  for (const [repoPath, repoState] of Object.entries(state.repoStateByPath)) {
    const remaining: PersistedRepoState = { ...repoState };
    delete remaining.lastValidation;
    repoStateByPath[repoPath] = remaining;
  }

  return normalizePersistedAppState({
    ...state,
    repoStateByPath,
  });
}

export function updatePersistedRunnerExecutionDefaults(
  state: PersistedAppState,
  defaults: RunnerExecutionDefaults,
): PersistedAppState {
  return normalizePersistedAppState({
    ...state,
    runnerExecutionDefaults: defaults,
  });
}

export function updatePersistedValidationSnapshot(
  state: PersistedAppState,
  repoPath: string,
  validation: ValidationResult,
  fileSignature: OpenSpecFileSignature,
): PersistedAppState {
  if (!isPersistableLocalRepoPath(repoPath)) {
    return state;
  }

  const current = state.repoStateByPath[repoPath] ?? { lastOpenedAt: Date.now() };

  return normalizePersistedAppState({
    ...state,
    repoStateByPath: {
      ...state.repoStateByPath,
      [repoPath]: {
        ...current,
        lastValidation: createPersistedValidationSnapshot(validation, fileSignature),
      },
    },
  });
}


export function upsertRunnerDispatchAttempt(
  state: PersistedAppState,
  attempt: RunnerDispatchAttempt,
): PersistedAppState {
  const attempts = upsertRunnerLogAttempt(state.runnerDispatchAttempts, attempt);

  return normalizePersistedAppState({
    ...state,
    runnerDispatchAttempts: attempts,
  });
}

export function validationFromPersistedSnapshot(
  snapshot: PersistedValidationSnapshot | undefined,
  fileSignature: OpenSpecFileSignature,
): ValidationResult | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.fileFingerprint === fileSignature.fingerprint) {
    return snapshot.result;
  }

  return markValidationStaleAfterFileChange(
    snapshot.result,
    fileSignature.latestPath ?? snapshot.latestPath ?? "openspec",
    fileSignature.latestModifiedTimeMs
      ? new Date(fileSignature.latestModifiedTimeMs)
      : new Date(),
  );
}

export function sortPreferenceFromDirection(direction: "asc" | "desc"): PersistedSortPreference {
  return direction === "asc" ? "updated-asc" : "updated-desc";
}

export function directionFromSortPreference(
  preference: PersistedSortPreference | undefined,
): "asc" | "desc" {
  return preference === "updated-asc" ? "asc" : "desc";
}

function createPersistedValidationSnapshot(
  result: ValidationResult,
  fileSignature: OpenSpecFileSignature,
): PersistedValidationSnapshot {
  const checkedAt = result.validatedAt ? new Date(result.validatedAt).getTime() : Date.now();
  const state = result.state === "stale" ? result.previousState ?? "fail" : result.state;

  return {
    checkedAt: Number.isFinite(checkedAt) ? checkedAt : Date.now(),
    state,
    issueCount: result.issues.length,
    summary: validationSummaryText(result),
    fileFingerprint: fileSignature.fingerprint,
    latestPath: fileSignature.latestPath,
    latestModifiedTimeMs: fileSignature.latestModifiedTimeMs,
    result: {
      ...result,
      state,
      previousState: undefined,
      staleReason: undefined,
      staleSince: undefined,
    },
  };
}

function normalizeRecentRepos(value: unknown): PersistedRecentRepo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const repos: PersistedRecentRepo[] = [];

  for (const item of value) {
    const repo = normalizeRecentRepo(item);

    if (!repo || repos.some((recent) => recent.path === repo.path)) {
      continue;
    }

    repos.push(repo);

    if (repos.length === RECENT_REPO_LIMIT) {
      break;
    }
  }

  return repos;
}

function normalizeRecentRepo(value: unknown): PersistedRecentRepo | null {
  if (typeof value === "string") {
    return isPersistableLocalRepoPath(value)
      ? { path: value, name: repoNameFromPath(value), lastOpenedAt: 0 }
      : null;
  }

  if (!isRecord(value) || typeof value.path !== "string" || !isPersistableLocalRepoPath(value.path)) {
    return null;
  }

  return {
    path: value.path,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : repoNameFromPath(value.path),
    lastOpenedAt: readFiniteNumber(value.lastOpenedAt) ?? 0,
  };
}

function normalizeRepoStateByPath(value: unknown): Record<string, PersistedRepoState> {
  if (!isRecord(value)) {
    return {};
  }

  const next: Record<string, PersistedRepoState> = {};

  for (const [path, rawState] of Object.entries(value)) {
    if (!isPersistableLocalRepoPath(path)) {
      continue;
    }

    const repoState = normalizeRepoState(rawState);

    if (repoState) {
      next[path] = repoState;
    }
  }

  return next;
}

function normalizeRepoState(value: unknown): PersistedRepoState | null {
  if (!isRecord(value)) {
    return null;
  }

  const lastOpenedAt = readFiniteNumber(value.lastOpenedAt) ?? 0;
  const state: PersistedRepoState = { lastOpenedAt };
  const lastSelectedChange = readNonEmptyString(value.lastSelectedChange);
  const lastSelectedSpec = readNonEmptyString(value.lastSelectedSpec);
  const changeSort = normalizeSortPreference(value.changeSort);
  const specSort = normalizeSortPreference(value.specSort);
  const lastValidation = normalizeValidationSnapshot(value.lastValidation);

  if (lastSelectedChange) {
    state.lastSelectedChange = lastSelectedChange;
  }

  if (lastSelectedSpec) {
    state.lastSelectedSpec = lastSelectedSpec;
  }

  if (changeSort) {
    state.changeSort = changeSort;
  }

  if (specSort) {
    state.specSort = specSort;
  }

  if (lastValidation) {
    state.lastValidation = lastValidation;
  }

  return state;
}

function normalizeValidationSnapshot(value: unknown): PersistedValidationSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.result)) {
    return undefined;
  }

  const state = value.state === "pass" || value.state === "fail" ? value.state : undefined;
  const checkedAt = readFiniteNumber(value.checkedAt);
  const fileFingerprint = readNonEmptyString(value.fileFingerprint);

  if (!state || checkedAt === undefined || !fileFingerprint || !isValidationResultLike(value.result)) {
    return undefined;
  }

  return {
    checkedAt,
    state,
    issueCount: readFiniteNumber(value.issueCount) ?? 0,
    summary: typeof value.summary === "string" ? value.summary : "",
    fileFingerprint,
    latestPath: typeof value.latestPath === "string" ? value.latestPath : null,
    latestModifiedTimeMs: readFiniteNumber(value.latestModifiedTimeMs) ?? null,
    result: value.result,
  };
}


function normalizeRunnerSettings(value: unknown): RunnerSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const endpoint = readNonEmptyString(value.endpoint);

  return endpoint ? { endpoint } : undefined;
}

function normalizeRunnerExecutionDefaults(value: unknown): RunnerExecutionDefaults {
  if (!isRecord(value)) {
    return {};
  }

  const defaults: RunnerExecutionDefaults = {};
  const runnerModel = readNonEmptyString(value.runnerModel)?.trim();

  if (runnerModel) {
    defaults.runnerModel = runnerModel;
  }

  if (
    value.runnerEffort === "default" ||
    value.runnerEffort === "low" ||
    value.runnerEffort === "medium" ||
    value.runnerEffort === "high"
  ) {
    defaults.runnerEffort = value.runnerEffort;
  }

  return defaults;
}

function normalizeGlobalPreferences(value: unknown): PersistedGlobalPreferences {
  if (!isRecord(value)) {
    return {};
  }

  const preferences: PersistedGlobalPreferences = {};

  if (value.density === "comfortable" || value.density === "compact") {
    preferences.density = value.density;
  }

  if (value.theme === "system" || value.theme === "light" || value.theme === "dark") {
    preferences.theme = value.theme;
  }

  if (typeof value.autoRestoreLastRepo === "boolean") {
    preferences.autoRestoreLastRepo = value.autoRestoreLastRepo;
  }

  if (typeof value.autoRefreshRepository === "boolean") {
    preferences.autoRefreshRepository = value.autoRefreshRepository;
  }

  return preferences;
}

function normalizeSortPreference(value: unknown): PersistedSortPreference | undefined {
  return value === "updated-desc" || value === "updated-asc" ? value : undefined;
}

function validationSummaryText(result: ValidationResult): string {
  if (result.diagnostics.length > 0) {
    return result.diagnostics[0]?.message ?? "Validation command failed.";
  }

  if (result.state === "pass") {
    return "Validation passed.";
  }

  return result.issues.length === 1
    ? "Validation found 1 issue."
    : "Validation found " + result.issues.length + " issues.";
}

function isValidationResultLike(value: unknown): value is ValidationResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.state === "pass" || value.state === "fail" || value.state === "stale") &&
    (typeof value.validatedAt === "string" || value.validatedAt === null) &&
    isRecord(value.summary) &&
    Array.isArray(value.issues) &&
    Array.isArray(value.diagnostics)
  );
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function repoNameFromPath(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function loadAppStateStore(): Promise<StoreLike> {
  if (!storePromise) {
    storePromise = import("@tauri-apps/plugin-store").then(({ load }) =>
      load(STORE_PATH, { autoSave: false, defaults: {} }),
    );
  }

  return storePromise;
}
