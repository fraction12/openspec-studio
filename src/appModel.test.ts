import { describe, expect, it } from "vitest";

import {
  buildOpenSpecFileSignature,
  deriveChangeHealth,
  extractJsonPayload,
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
          raw: { valid: false },
        },
        validationIssueCount: 1,
      }),
    ).toBe("invalid");
  });
});
