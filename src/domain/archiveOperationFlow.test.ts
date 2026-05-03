import { describe, expect, it } from "vitest";

import type { ProviderSessionArchiveResult } from "../providers/types";
import type { ValidationResult } from "../validation/results";
import type { WorkspaceView } from "./workspaceViewModel";
import {
  deriveArchiveOperationErrorTransition,
  deriveArchiveOperationTransition,
} from "./archiveOperationFlow";

describe("Archive Operation Flow Module", () => {
  it("derives unsupported and stale transitions without workspace side effects", () => {
    expect(
      deriveArchiveOperationTransition({ kind: "unsupported", message: "No archive support." }, { kind: "batch" }),
    ).toEqual({
      kind: "apply",
      effects: [
        { kind: "set-load-state", loadState: "loaded" },
        { kind: "set-message", message: "No archive support." },
      ],
    });

    expect(deriveArchiveOperationTransition({ kind: "stale" }, { kind: "single", changeName: "demo" })).toEqual({
      kind: "stale",
    });
  });

  it("keeps validation-blocked workspace and validation state visible", () => {
    const workspace = workspaceView("blocked-workspace");
    const validation = validationResult("fail");

    expect(
      deriveArchiveOperationTransition(
        { kind: "validation-blocked", message: "Validation found issues.", workspace, validation },
        { kind: "single", changeName: "demo" },
      ),
    ).toEqual({
      kind: "apply",
      effects: [
        { kind: "replace-workspace", workspace },
        { kind: "remember-validation", validation },
        { kind: "set-load-state", loadState: "loaded" },
        { kind: "set-message", message: "Validation found issues." },
      ],
    });
  });

  it("derives partial archive progress for single and batch archive flows", () => {
    const workspace = workspaceView("partial-workspace");
    const validation = validationResult("pass");
    const result: ProviderSessionArchiveResult<WorkspaceView> = {
      kind: "partial",
      archivedCount: 1,
      requestedCount: 3,
      message: "archive failed",
      workspace,
      validation,
    };

    expect(deriveArchiveOperationTransition(result, { kind: "single", changeName: "one" })).toEqual({
      kind: "apply",
      effects: [
        { kind: "replace-workspace", workspace },
        { kind: "remember-validation", validation },
        { kind: "set-phase", phase: "archived" },
        { kind: "set-load-state", loadState: "loaded" },
        { kind: "set-message", message: "Archived 1 of 3 changes before failure: archive failed" },
      ],
    });
    expect(deriveArchiveOperationTransition({ ...result, workspace: null, validation: null }, { kind: "batch" })).toEqual({
      kind: "apply",
      effects: [
        { kind: "set-phase", phase: "archived" },
        { kind: "set-load-state", loadState: "loaded" },
        { kind: "set-message", message: "Archived 1 of 3 changes before failure: archive failed" },
      ],
    });
  });

  it("derives single archive success selection and archive-info detail tab", () => {
    const workspace = workspaceView("archived-workspace");
    const validation = validationResult("pass");

    expect(
      deriveArchiveOperationTransition(
        {
          kind: "archived",
          archivedCount: 1,
          requestedCount: 1,
          lastArchivedChangeId: "2026-05-03-demo",
          workspace,
          validation,
        },
        { kind: "single", changeName: "demo" },
      ),
    ).toEqual({
      kind: "apply",
      effects: [
        { kind: "replace-workspace", workspace },
        { kind: "remember-validation", validation },
        { kind: "set-phase", phase: "archived" },
        { kind: "select-change", changeId: "2026-05-03-demo" },
        { kind: "set-detail-tab", tab: "archive-info" },
        { kind: "set-message", message: "Archived demo." },
        { kind: "set-load-state", loadState: "loaded" },
      ],
    });
  });

  it("falls back to empty selection when single archive success lacks an archived change ID", () => {
    const workspace = workspaceView("archived-workspace");
    const validation = validationResult("pass");

    expect(
      deriveArchiveOperationTransition(
        {
          kind: "archived",
          archivedCount: 1,
          requestedCount: 1,
          lastArchivedChangeId: null,
          workspace,
          validation,
        },
        { kind: "single", changeName: "demo" },
      ),
    ).toMatchObject({
      kind: "apply",
      effects: expect.arrayContaining([{ kind: "select-change", changeId: "" }]),
    });
  });

  it("derives batch archive success without selected-change replacement", () => {
    const workspace = workspaceView("batch-workspace");
    const validation = validationResult("pass");

    expect(
      deriveArchiveOperationTransition(
        {
          kind: "archived",
          archivedCount: 2,
          requestedCount: 2,
          lastArchivedChangeId: "2026-05-03-two",
          workspace,
          validation,
        },
        { kind: "batch" },
      ),
    ).toEqual({
      kind: "apply",
      effects: [
        { kind: "replace-workspace", workspace },
        { kind: "remember-validation", validation },
        { kind: "set-phase", phase: "archived" },
        { kind: "set-message", message: "Archived 2 changes." },
        { kind: "set-load-state", loadState: "loaded" },
      ],
    });
  });

  it("derives archive exception copy as a loaded transition", () => {
    expect(deriveArchiveOperationErrorTransition("Archive failed.")).toEqual({
      kind: "apply",
      effects: [
        { kind: "set-message", message: "Archive failed." },
        { kind: "set-load-state", loadState: "loaded" },
      ],
    });
  });
});

function workspaceView(fingerprint: string): WorkspaceView {
  return {
    changes: [],
    specs: [],
    filesByPath: {},
    fileSignature: { fingerprint, latestPath: null, latestModifiedTimeMs: null },
    changeStatuses: [],
    validation: null,
  };
}

function validationResult(state: ValidationResult["state"]): ValidationResult {
  return {
    state,
    validatedAt: "2026-05-03T00:00:00.000Z",
    summary: { total: 1, passed: state === "pass" ? 1 : 0, failed: state === "pass" ? 0 : 1 },
    diagnostics: [],
    issues: [],
    raw: {},
  };
}
