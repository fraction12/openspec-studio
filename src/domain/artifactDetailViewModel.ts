import type { OpenSpecOperationIssue } from "../appModel";
import type { ValidationResult } from "../validation/results";
import {
  artifactPathForTab,
  detailTabsForChange,
  type ArchiveInfo,
  type Artifact,
  type ChangeRecord,
  type DetailTab,
  type TaskGroup,
  type TaskItem,
} from "./workspaceViewModel";
import { normalizeWorkspaceDetailTab } from "./workspaceNavigationState";

export interface ParsedTaskProgress {
  items: TaskItem[];
  groups: TaskGroup[];
  remainingGroups: TaskGroup[];
  completedGroups: TaskGroup[];
  remainingCount: number;
  completedCount: number;
}

export type ArtifactDetail =
  | {
      kind: "archive-info";
      archiveInfo: ArchiveInfo | undefined;
      files: Artifact[];
      emptyTitle: string;
      emptyBody: string;
    }
  | {
      kind: "artifact";
      tab: "proposal" | "design";
      title: string;
      content: string;
      emptyText: string;
    }
  | {
      kind: "tasks";
      taskProgress: ChangeRecord["taskProgress"];
      taskDetail: ParsedTaskProgress;
      remainingGroups: TaskGroup[];
      completedGroups: TaskGroup[];
      remainingCount: number;
      completedCount: number;
      unavailable: boolean;
    }
  | {
      kind: "spec-delta";
      artifacts: Artifact[];
      emptyTitle: string;
      emptyBody: string;
    }
  | {
      kind: "status";
      diagnostics: ValidationResult["diagnostics"];
      validationIssues: ChangeRecord["validationIssues"];
      artifacts: Artifact[];
      archiveReadiness: ChangeRecord["archiveReadiness"];
    };

export interface ArtifactDetailViewModel {
  tabs: Array<{ id: DetailTab; label: string }>;
  selectedTab: DetailTab;
  selectedArtifactPath: string | undefined;
  selectedArtifactIssue: OpenSpecOperationIssue | undefined;
  selectedChangeIssues: OpenSpecOperationIssue[];
  detail: ArtifactDetail;
}

export function buildArtifactDetailViewModel(input: {
  change: ChangeRecord;
  requestedTab: DetailTab;
  artifactPreview: string;
  validation: ValidationResult | null;
  operationIssues: OpenSpecOperationIssue[];
}): ArtifactDetailViewModel {
  const tabs = detailTabsForChange(input.change);
  const selectedTab = normalizeWorkspaceDetailTab(input.change, input.requestedTab);
  const selectedArtifactPath = artifactPathForTab(input.change, selectedTab);
  const selectedArtifactIssue = selectedArtifactPath
    ? input.operationIssues.find(
        (issue) => issue.kind === "artifact-read" && issue.target === selectedArtifactPath,
      )
    : undefined;
  const selectedChangeIssues = input.operationIssues.filter((issue) => issue.target === input.change.name);

  return {
    tabs,
    selectedTab,
    selectedArtifactPath,
    selectedArtifactIssue,
    selectedChangeIssues,
    detail: detailForTab(input.change, selectedTab, input.artifactPreview, input.validation),
  };
}

export function parseTaskProgressContent(content: string | undefined): ParsedTaskProgress {
  if (!content) {
    return emptyTaskProgress();
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
  const items = populatedGroups.flatMap((group) => group.items);
  const remainingGroups = filterTaskGroups(populatedGroups, false);
  const completedGroups = filterTaskGroups(populatedGroups, true);

  return {
    items,
    groups: populatedGroups,
    remainingGroups,
    completedGroups,
    remainingCount: remainingGroups.reduce((total, group) => total + group.items.length, 0),
    completedCount: completedGroups.reduce((total, group) => total + group.items.length, 0),
  };
}

export function filterTaskGroups(groups: TaskGroup[], done: boolean): TaskGroup[] {
  return groups
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => item.done === done),
    }))
    .filter((group) => group.items.length > 0);
}

function detailForTab(
  change: ChangeRecord,
  tab: DetailTab,
  artifactPreview: string,
  validation: ValidationResult | null,
): ArtifactDetail {
  if (tab === "archive-info") {
    return {
      kind: "archive-info",
      archiveInfo: change.archiveInfo,
      files: change.archiveInfo?.files ?? [],
      emptyTitle: "Archive information unavailable",
      emptyBody: "No archive metadata was derived for this change.",
    };
  }

  if (tab === "proposal" || tab === "design") {
    return {
      kind: "artifact",
      tab,
      title: tab === "proposal" ? "proposal.md" : "design.md",
      content: artifactPreview,
      emptyText: "No artifact preview available.",
    };
  }

  if (tab === "tasks") {
    const taskDetail = parseTaskProgressContent(change.taskProgress?.content);

    return {
      kind: "tasks",
      taskProgress: change.taskProgress,
      taskDetail,
      remainingGroups: taskDetail.remainingGroups,
      completedGroups: taskDetail.completedGroups,
      remainingCount: taskDetail.remainingCount,
      completedCount: taskDetail.completedCount,
      unavailable: !change.taskProgress,
    };
  }

  if (tab === "spec-delta") {
    return {
      kind: "spec-delta",
      artifacts: change.artifacts.filter((artifact) => artifact.id.startsWith("delta-")),
      emptyTitle: "No spec deltas",
      emptyBody: "No delta specs are indexed for this change.",
    };
  }

  return {
    kind: "status",
    diagnostics: validation?.diagnostics ?? [],
    validationIssues: change.validationIssues,
    artifacts: change.artifacts,
    archiveReadiness: change.archiveReadiness,
  };
}

function emptyTaskProgress(): ParsedTaskProgress {
  return {
    items: [],
    groups: [],
    remainingGroups: [],
    completedGroups: [],
    remainingCount: 0,
    completedCount: 0,
  };
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}
