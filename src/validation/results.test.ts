import { describe, expect, it } from "vitest";

import {
  createValidationCommandFailureResult,
  groupValidationIssues,
  markValidationStaleAfterFileChange,
  parseValidationResult,
} from "./results";

describe("parseValidationResult", () => {
  it("parses structured passing OpenSpec validation output", () => {
    const raw = {
      items: [
        {
          id: "build-local-desktop-companion",
          type: "change",
          valid: true,
          issues: [],
          durationMs: 18,
        },
      ],
      summary: {
        totals: {
          items: 1,
          passed: 1,
          failed: 0,
        },
      },
      version: "1.0",
    };

    const result = parseValidationResult(raw, {
      validatedAt: "2026-04-27T12:00:00.000Z",
    });

    expect(result.state).toBe("pass");
    expect(result.raw).toBe(raw);
    expect(result.summary).toEqual({ total: 1, passed: 1, failed: 0 });
    expect(result.validatedAt).toBe("2026-04-27T12:00:00.000Z");
    expect(result.issues).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it("parses failed items and links issues to change, spec, and file associations", () => {
    const raw = {
      items: [
        {
          id: "add-validation-dashboard",
          type: "change",
          valid: false,
          issues: [
            {
              code: "missing-scenario",
              message:
                "Missing scenario in openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
              path: "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
            },
          ],
        },
        {
          id: "validation-dashboard",
          type: "spec",
          valid: false,
          issues: [
            {
              message: "Requirement is incomplete",
              file: "openspec/specs/validation-dashboard/spec.md",
              severity: "warning",
            },
          ],
        },
      ],
    };

    const result = parseValidationResult(raw, {
      validatedAt: new Date("2026-04-27T12:30:00.000Z"),
    });

    expect(result.state).toBe("fail");
    expect(result.summary).toEqual({ total: 2, passed: 0, failed: 2 });
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0]).toMatchObject({
      id: "issue-1",
      message:
        "Missing scenario in openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
      severity: "error",
      code: "missing-scenario",
      path: "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
      associations: [
        {
          kind: "change",
          id: "add-validation-dashboard",
          path: "openspec/changes/add-validation-dashboard",
        },
        {
          kind: "file",
          path: "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
        },
        {
          kind: "spec",
          id: "validation-dashboard",
          path: "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
        },
      ],
    });
    expect(result.issues[1].associations).toEqual([
      {
        kind: "spec",
        id: "validation-dashboard",
        path: "openspec/specs/validation-dashboard/spec.md",
      },
      {
        kind: "file",
        path: "openspec/specs/validation-dashboard/spec.md",
      },
    ]);
  });

  it("preserves warning and info levels from real OpenSpec issue output", () => {
    const result = parseValidationResult({
      valid: true,
      items: [
        {
          id: "validation-dashboard",
          type: "spec",
          valid: true,
          issues: [
            {
              level: "WARNING",
              message: "Requirement should include another scenario",
              path: "openspec/specs/validation-dashboard/spec.md",
            },
            {
              level: "INFO",
              message: "Requirement includes optional guidance",
              path: "openspec/specs/validation-dashboard/spec.md",
            },
          ],
        },
      ],
      summary: {
        totals: {
          items: 1,
          passed: 1,
          failed: 0,
        },
      },
    });

    expect(result.state).toBe("pass");
    expect(result.summary).toEqual({ total: 1, passed: 1, failed: 0 });
    expect(result.issues.map((issue) => issue.severity)).toEqual([
      "warning",
      "info",
    ]);
  });

  it("merges root-level issues with item issues", () => {
    const result = parseValidationResult({
      items: [
        {
          id: "add-validation-dashboard",
          type: "change",
          valid: false,
          issues: [
            {
              level: "ERROR",
              message: "Missing scenario",
              path: "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
            },
          ],
        },
      ],
      issues: [
        {
          level: "WARNING",
          message: "Workspace contains deprecated proposal metadata",
          path: "openspec/changes/add-validation-dashboard/proposal.md",
        },
      ],
      summary: {
        totals: {
          items: 1,
          passed: 0,
          failed: 1,
        },
      },
    });

    expect(result.state).toBe("fail");
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map((issue) => issue.id)).toEqual([
      "issue-1",
      "issue-2",
    ]);
    expect(result.issues.map((issue) => issue.message)).toEqual([
      "Missing scenario",
      "Workspace contains deprecated proposal metadata",
    ]);
    expect(result.issues[1]).toMatchObject({
      severity: "warning",
      associations: [
        {
          kind: "file",
          path: "openspec/changes/add-validation-dashboard/proposal.md",
        },
        {
          kind: "change",
          id: "add-validation-dashboard",
          path: "openspec/changes/add-validation-dashboard",
        },
      ],
    });
  });

  it("surfaces root-level issues when itemized output has no item issues", () => {
    const result = parseValidationResult({
      items: [],
      issues: [
        {
          level: "ERROR",
          message: "Workspace schema is invalid",
        },
      ],
    });

    expect(result.state).toBe("fail");
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({
      id: "issue-1",
      message: "Workspace schema is invalid",
      severity: "error",
    });
  });

  it("models unrecognized JSON as a parse diagnostic instead of a validation issue", () => {
    const raw = { ok: false, details: ["unexpected shape"] };

    const result = parseValidationResult(raw);

    expect(result.state).toBe("fail");
    expect(result.raw).toBe(raw);
    expect(result.summary).toEqual({ total: 0, passed: 0, failed: 1 });
    expect(result.issues).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject({
      kind: "parse-failure",
      message: "Validation output was not recognized.",
      severity: "error",
    });
  });

  it("models command failures as diagnostics without linked validation issues", () => {
    const result = createValidationCommandFailureResult({
      stdout: "checking...",
      stderr: "env: node: No such file or directory",
      statusCode: 127,
      validatedAt: "2026-04-27T12:00:00.000Z",
    });

    expect(result).toMatchObject({
      state: "fail",
      validatedAt: "2026-04-27T12:00:00.000Z",
      summary: { total: 0, passed: 0, failed: 1 },
      issues: [],
      diagnostics: [
        {
          kind: "command-failure",
          message: "env: node: No such file or directory",
          statusCode: 127,
        },
      ],
    });
  });
});

describe("markValidationStaleAfterFileChange", () => {
  it("marks validation stale after a relevant OpenSpec file changes", () => {
    const result = parseValidationResult(
      {
        items: [{ id: "validation-dashboard", type: "spec", valid: true }],
      },
      { validatedAt: "2026-04-27T12:00:00.000Z" },
    );

    const stale = markValidationStaleAfterFileChange(
      result,
      "openspec/specs/validation-dashboard/spec.md",
      "2026-04-27T12:05:00.000Z",
    );

    expect(stale).toMatchObject({
      state: "stale",
      previousState: "pass",
      staleSince: "2026-04-27T12:05:00.000Z",
      staleReason: {
        changedPath: "openspec/specs/validation-dashboard/spec.md",
      },
    });
    expect(stale.raw).toBe(result.raw);
  });

  it("leaves validation untouched when unrelated files change", () => {
    const result = parseValidationResult({
      items: [{ id: "validation-dashboard", type: "spec", valid: true }],
    });

    const next = markValidationStaleAfterFileChange(
      result,
      "src/App.tsx",
      "2026-04-27T12:05:00.000Z",
    );

    expect(next).toBe(result);
  });
});

describe("groupValidationIssues", () => {
  it("groups issue ids by associated change, spec, and file", () => {
    const result = parseValidationResult({
      items: [
        {
          id: "add-validation-dashboard",
          type: "change",
          valid: false,
          issues: [
            {
              message: "Bad delta spec",
              path: "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md",
            },
          ],
        },
      ],
    });

    expect(groupValidationIssues(result)).toEqual({
      changes: { "add-validation-dashboard": ["issue-1"] },
      specs: { "validation-dashboard": ["issue-1"] },
      files: {
        "openspec/changes/add-validation-dashboard/specs/validation-dashboard/spec.md":
          ["issue-1"],
      },
    });
  });
});
