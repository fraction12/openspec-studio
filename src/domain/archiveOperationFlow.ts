import type { ProviderSessionArchiveResult } from "../providers/types";
import type { ValidationResult } from "../validation/results";
import type { ChangePhase, DetailTab, WorkspaceView } from "./workspaceViewModel";

export type ArchiveOperationMode =
  | { kind: "single"; changeName: string }
  | { kind: "batch" };

export type ArchiveOperationEffect =
  | { kind: "replace-workspace"; workspace: WorkspaceView }
  | { kind: "remember-validation"; validation: ValidationResult }
  | { kind: "set-phase"; phase: ChangePhase }
  | { kind: "select-change"; changeId: string }
  | { kind: "set-detail-tab"; tab: DetailTab }
  | { kind: "set-load-state"; loadState: "loaded" }
  | { kind: "set-message"; message: string };

export type ArchiveOperationTransition =
  | { kind: "stale" }
  | { kind: "apply"; effects: ArchiveOperationEffect[] };

export function deriveArchiveOperationTransition(
  result: ProviderSessionArchiveResult<WorkspaceView>,
  mode: ArchiveOperationMode,
): ArchiveOperationTransition {
  if (result.kind === "stale") {
    return { kind: "stale" };
  }

  if (result.kind === "unsupported") {
    return {
      kind: "apply",
      effects: [
        { kind: "set-load-state", loadState: "loaded" },
        { kind: "set-message", message: result.message },
      ],
    };
  }

  if (result.kind === "validation-blocked") {
    return {
      kind: "apply",
      effects: [
        { kind: "replace-workspace", workspace: result.workspace },
        { kind: "remember-validation", validation: result.validation },
        { kind: "set-load-state", loadState: "loaded" },
        { kind: "set-message", message: result.message },
      ],
    };
  }

  if (result.kind === "partial") {
    const effects: ArchiveOperationEffect[] = [];

    if (result.workspace) {
      effects.push({ kind: "replace-workspace", workspace: result.workspace });
    }

    if (result.validation) {
      effects.push({ kind: "remember-validation", validation: result.validation });
    }

    effects.push(
      { kind: "set-phase", phase: "archived" },
      { kind: "set-load-state", loadState: "loaded" },
      {
        kind: "set-message",
        message: "Archived " + result.archivedCount + " of " + result.requestedCount + " changes before failure: " + result.message,
      },
    );

    return {
      kind: "apply",
      effects,
    };
  }

  if (mode.kind === "single") {
    return {
      kind: "apply",
      effects: [
        { kind: "replace-workspace", workspace: result.workspace },
        { kind: "remember-validation", validation: result.validation },
        { kind: "set-phase", phase: "archived" },
        { kind: "select-change", changeId: result.lastArchivedChangeId ?? "" },
        { kind: "set-detail-tab", tab: "archive-info" },
        { kind: "set-message", message: "Archived " + mode.changeName + "." },
        { kind: "set-load-state", loadState: "loaded" },
      ],
    };
  }

  return {
    kind: "apply",
    effects: [
      { kind: "replace-workspace", workspace: result.workspace },
      { kind: "remember-validation", validation: result.validation },
      { kind: "set-phase", phase: "archived" },
      { kind: "set-message", message: "Archived " + result.requestedCount + " changes." },
      { kind: "set-load-state", loadState: "loaded" },
    ],
  };
}

export function deriveArchiveOperationErrorTransition(message: string): ArchiveOperationTransition {
  return {
    kind: "apply",
    effects: [
      { kind: "set-message", message },
      { kind: "set-load-state", loadState: "loaded" },
    ],
  };
}
