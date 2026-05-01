import { isPersistableLocalRepoPath } from "../appModel";
import {
  detailTabsForChange,
  matchesChangeFilters,
  matchesSpecFilters,
  type ChangePhase,
  type ChangeRecord,
  type DetailTab,
  type SpecRecord,
  type WorkspaceView,
} from "./workspaceViewModel";

export type BoardView = "changes" | "specs" | "runner";

export interface WorkspaceNavigationState {
  selectedChangeId: string;
  selectedSpecId: string;
  detailTab: DetailTab;
  view: BoardView;
  phase: ChangePhase;
  changesQuery: string;
  specsQuery: string;
}

export interface PersistedSelectionHints {
  lastSelectedChange?: string;
  lastSelectedSpec?: string;
}

export function initializeWorkspaceNavigation(
  workspace: WorkspaceView,
  persistedSelection: PersistedSelectionHints = {},
): WorkspaceNavigationState {
  const persistedChange = workspace.changes.find(
    (change) => change.id === persistedSelection.lastSelectedChange,
  );
  const persistedSpec = workspace.specs.find((spec) => spec.id === persistedSelection.lastSelectedSpec);
  const firstChange = firstPreferredChange(workspace.changes);

  return {
    selectedChangeId: persistedChange?.id ?? firstChange?.id ?? "",
    selectedSpecId: persistedSpec?.id ?? workspace.specs[0]?.id ?? "",
    detailTab: "proposal",
    view: "changes",
    phase: "active",
    changesQuery: "",
    specsQuery: "",
  };
}

export function retainWorkspaceNavigation(
  workspace: WorkspaceView,
  current: Pick<WorkspaceNavigationState, "selectedChangeId" | "selectedSpecId">,
): Pick<WorkspaceNavigationState, "selectedChangeId" | "selectedSpecId"> {
  return {
    selectedChangeId: workspace.changes.some((change) => change.id === current.selectedChangeId)
      ? current.selectedChangeId
      : workspace.changes[0]?.id ?? "",
    selectedSpecId: workspace.specs.some((spec) => spec.id === current.selectedSpecId)
      ? current.selectedSpecId
      : workspace.specs[0]?.id ?? "",
  };
}

export function reconcileVisibleChangeSelection(input: {
  changes: ChangeRecord[];
  selectedChangeId: string;
  phase: ChangePhase;
  query: string;
}): { selectedChangeId: string; detailTabReset: boolean } {
  const selectedChangeId = selectVisibleItemId(
    input.changes,
    input.selectedChangeId,
    (change) => matchesChangeFilters(change, input.phase, input.query),
  );

  return {
    selectedChangeId,
    detailTabReset: selectedChangeId !== input.selectedChangeId,
  };
}

export function reconcileVisibleSpecSelection(input: {
  specs: SpecRecord[];
  selectedSpecId: string;
  query: string;
}): { selectedSpecId: string } {
  return {
    selectedSpecId: selectVisibleItemId(
      input.specs,
      input.selectedSpecId,
      (spec) => matchesSpecFilters(spec, input.query),
    ),
  };
}

export function normalizeWorkspaceDetailTab(
  change: ChangeRecord | null,
  requestedTab: DetailTab,
): DetailTab {
  if (!change) {
    return requestedTab;
  }

  const tabs = detailTabsForChange(change);

  return tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : tabs[0]?.id ?? "archive-info";
}

export function derivePersistedWorkspaceSelection(input: {
  repoPath: string | null | undefined;
  repoState: string | null | undefined;
  workspaceFingerprint: string | null | undefined;
  selectedChangeId: string;
  selectedSpecId: string;
}): { repoPath: string; selection: { changeId: string; specId: string } } | null {
  void input.workspaceFingerprint;

  if (input.repoState !== "ready" || !input.repoPath || !isPersistableLocalRepoPath(input.repoPath)) {
    return null;
  }

  return {
    repoPath: input.repoPath,
    selection: {
      changeId: input.selectedChangeId,
      specId: input.selectedSpecId,
    },
  };
}

export function selectVisibleItemId<T extends { id: string }>(
  items: T[],
  currentId: string,
  isVisible: (item: T) => boolean,
): string {
  if (currentId && items.some((item) => item.id === currentId && isVisible(item))) {
    return currentId;
  }

  return items.find(isVisible)?.id ?? "";
}

function firstPreferredChange(changes: ChangeRecord[]): ChangeRecord | undefined {
  return changes.find((change) => change.phase === "active") ?? changes[0];
}
