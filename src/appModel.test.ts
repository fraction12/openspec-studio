import { describe, expect, it } from "vitest";

import {
  buildOpenSpecFileSignature,
  decideRepositoryCandidateOpen,
  deriveChangeHealth,
  deriveValidationTrustState,
  extractJsonPayload,
  isPersistableLocalRepoPath,
  normalizeRecentRepoPaths,
  recentRepoSwitcherPaths,
  selectVisibleItemId,
  toVirtualChangeStatusRecord,
  toVirtualFileRecords,
} from "./appModel";

describe("toVirtualFileRecords", () => {
  it("normalizes bridge file records into indexer records", () => {
    expect(
      toVirtualFileRecords([
        {
          path: "openspec/changes/demo/tasks.md",
          kind: "file",
          modified_time_ms: 42,
          content: "- [x] Done",
        },
        {
          path: "openspec/changes/demo",
          kind: "directory",
          modifiedTimeMs: 41,
        },
      ]),
    ).toEqual([
      {
        path: "openspec/changes/demo/tasks.md",
        kind: "file",
        modifiedTimeMs: 42,
        content: "- [x] Done",
      },
      {
        path: "openspec/changes/demo",
        kind: "directory",
        modifiedTimeMs: 41,
        content: undefined,
      },
    ]);
  });
});

describe("extractJsonPayload", () => {
  it("extracts JSON from CLI output that includes status text", () => {
    expect(extractJsonPayload('- Loading...\n{"valid":true,"items":[]}')).toEqual({
      valid: true,
      items: [],
    });
  });

  it("returns undefined when no JSON object is present", () => {
    expect(extractJsonPayload("Change is valid")).toBeUndefined();
  });
});

describe("toVirtualChangeStatusRecord", () => {
  it("normalizes OpenSpec status JSON into indexer status records", () => {
    expect(
      toVirtualChangeStatusRecord(
        {
          changeName: "build-local-desktop-companion",
          schemaName: "spec-driven",
          isComplete: true,
          artifacts: [
            { id: "proposal", status: "done" },
            { id: "tasks", status: "blocked", dependencies: ["design"] },
          ],
        },
        "fallback",
      ),
    ).toEqual({
      changeName: "build-local-desktop-companion",
      schemaName: "spec-driven",
      isComplete: true,
      artifacts: [
        {
          id: "proposal",
          status: "done",
          dependencies: undefined,
        },
        {
          id: "tasks",
          status: "blocked",
          dependencies: ["design"],
        },
      ],
    });
  });

  it("keeps an error record when status output cannot be parsed", () => {
    expect(toVirtualChangeStatusRecord("not json", "demo")).toEqual({
      changeName: "demo",
      error: "Status output was not recognized.",
    });
  });
});

describe("buildOpenSpecFileSignature", () => {
  it("builds a stable fingerprint and records the latest changed file", () => {
    expect(
      buildOpenSpecFileSignature([
        {
          path: "openspec/changes/demo/tasks.md",
          kind: "file",
          modifiedTimeMs: 20,
        },
        {
          path: "openspec/changes/demo/proposal.md",
          kind: "file",
          modifiedTimeMs: 30,
        },
      ]),
    ).toEqual({
      fingerprint:
        "openspec/changes/demo/proposal.md:file:30|openspec/changes/demo/tasks.md:file:20",
      latestPath: "openspec/changes/demo/proposal.md",
      latestModifiedTimeMs: 30,
    });
  });
});

describe("deriveChangeHealth", () => {
  it("keeps repo-level validation failure separate from per-change health", () => {
    expect(
      deriveChangeHealth({
        workflowStatus: "in-progress",
        missingArtifactCount: 0,
        validation: {
          state: "fail",
          validatedAt: "2026-04-27T12:00:00.000Z",
          summary: { total: 3, passed: 2, failed: 1 },
          issues: [],
          diagnostics: [
            {
              id: "diagnostic-1",
              kind: "command-failure",
              message: "openspec validate failed to execute",
              severity: "error",
            },
          ],
          raw: { valid: false },
        },
        validationIssueCount: 0,
      }),
    ).toBe("stale");
  });

  it("marks a change invalid only when linked evidence exists", () => {
    expect(
      deriveChangeHealth({
        workflowStatus: "in-progress",
        missingArtifactCount: 0,
        validation: {
          state: "fail",
          validatedAt: "2026-04-27T12:00:00.000Z",
          summary: { total: 3, passed: 2, failed: 1 },
          issues: [],
          diagnostics: [],
          raw: { valid: false },
        },
        validationIssueCount: 1,
      }),
    ).toBe("invalid");
  });

  it("treats linked issues as outdated when validation is stale", () => {
    expect(
      deriveChangeHealth({
        workflowStatus: "in-progress",
        missingArtifactCount: 0,
        validation: {
          state: "stale",
          validatedAt: "2026-04-27T12:00:00.000Z",
          summary: { total: 3, passed: 2, failed: 1 },
          issues: [],
          diagnostics: [],
          raw: { valid: false },
        },
        validationIssueCount: 1,
      }),
    ).toBe("stale");
  });
});

describe("recent repo path guards", () => {
  it("accepts absolute local paths and rejects browser preview identifiers", () => {
    expect(isPersistableLocalRepoPath("/Volumes/MacSSD/Projects/openspec-studio")).toBe(true);
    expect(isPersistableLocalRepoPath("browser-preview://openspec-studio")).toBe(false);
    expect(isPersistableLocalRepoPath("relative/path")).toBe(false);
  });

  it("deduplicates and filters persisted recent repository paths", () => {
    expect(
      normalizeRecentRepoPaths([
        "/repo/one",
        "browser-preview://openspec-studio",
        "/repo/two",
        "/repo/one",
        null,
      ]),
    ).toEqual(["/repo/one", "/repo/two"]);
  });

  it("presents recents as a switcher with the current repo selected first", () => {
    expect(recentRepoSwitcherPaths("/repo/current", ["/repo/one", "/repo/current", "/repo/two"])).toEqual([
      "/repo/current",
      "/repo/one",
      "/repo/two",
    ]);
  });
});

describe("repository candidate opening", () => {
  it("promotes only readable folders that contain an openspec workspace", () => {
    expect(decideRepositoryCandidateOpen({ readable: true, hasOpenSpec: true })).toEqual({
      promote: true,
      preserveActiveWorkspace: false,
    });
  });

  it("preserves the active workspace when a candidate has no openspec workspace", () => {
    expect(decideRepositoryCandidateOpen({ readable: true, hasOpenSpec: false })).toEqual({
      promote: false,
      preserveActiveWorkspace: true,
    });
  });

  it("preserves the active workspace when a candidate is not readable", () => {
    expect(decideRepositoryCandidateOpen({ readable: false, hasOpenSpec: false })).toEqual({
      promote: false,
      preserveActiveWorkspace: true,
    });
  });
});

describe("selection synchronization", () => {
  const items = [
    { id: "active-a", phase: "active", title: "Active A" },
    { id: "active-b", phase: "active", title: "Active B" },
    { id: "archived-a", phase: "archived", title: "Archived A" },
  ];

  it("keeps the current selection when it is visible", () => {
    expect(
      selectVisibleItemId(items, "active-b", (item) => item.phase === "active"),
    ).toBe("active-b");
  });

  it("selects the first visible item when filters hide the current selection", () => {
    expect(
      selectVisibleItemId(items, "archived-a", (item) => item.phase === "active"),
    ).toBe("active-a");
  });

  it("clears selection when filters have no matches", () => {
    expect(
      selectVisibleItemId(items, "active-a", (item) => item.title.includes("Missing")),
    ).toBe("");
  });
});

describe("validation trust labels", () => {
  it("uses unknown attention semantics before validation runs", () => {
    expect(deriveValidationTrustState(null)).toMatchObject({
      label: "Not checked yet",
      attentionKnown: false,
    });
  });

  it("shows current clean validation as attention-known", () => {
    expect(
      deriveValidationTrustState({
        state: "pass",
        validatedAt: "2026-04-27T12:00:00.000Z",
        summary: { total: 1, passed: 1, failed: 0 },
        issues: [],
        diagnostics: [],
        raw: { valid: true },
      }),
    ).toMatchObject({
      label: "Checked clean",
      attentionKnown: true,
    });
  });

  it("keeps command diagnostics separate from linked attention counts", () => {
    expect(
      deriveValidationTrustState({
        state: "fail",
        validatedAt: "2026-04-27T12:00:00.000Z",
        summary: { total: 0, passed: 0, failed: 0 },
        issues: [],
        diagnostics: [
          {
            id: "diagnostic-1",
            kind: "command-failure",
            message: "node could not be found",
            severity: "error",
          },
        ],
        raw: {},
      }),
    ).toMatchObject({
      label: "Validation problem",
      attentionKnown: false,
    });
  });
});
