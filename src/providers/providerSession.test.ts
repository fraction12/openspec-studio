import { describe, expect, it } from "vitest";

import type {
  MutatingOperationResult,
  OpenSpecFileSignature,
  OpenSpecOperationIssue,
} from "../appModel";
import type {
  IndexedOpenSpecWorkspace,
  VirtualOpenSpecChangeStatusRecord,
  VirtualOpenSpecFileRecord,
} from "../domain/openspecIndex";
import { OpenSpecProvider, openSpecProviderDescriptor } from "./openspecProvider";
import { ProviderSession } from "./providerSession";
import type {
  InvokeAdapter,
  ProviderCapabilities,
  ProviderWorkspaceLike,
} from "./types";
import type { ValidationResult } from "../validation/results";

interface TestWorkspace extends ProviderWorkspaceLike {
  indexed?: IndexedOpenSpecWorkspace;
  providerId?: string;
  providerLabel?: string;
  providerCapabilities?: ProviderCapabilities;
}

const fileSignature: OpenSpecFileSignature = {
  fingerprint: "openspec/changes/add-demo/tasks.md:file:10:20",
  latestPath: "openspec/changes/add-demo/tasks.md",
  latestModifiedTimeMs: 10,
};

const passingValidation: ValidationResult = {
  state: "pass",
  issues: [],
  diagnostics: [],
  summary: { total: 0, passed: 0, failed: 0 },
  validatedAt: null,
  raw: { valid: true },
};

function archiveOperationResult(changeName = "change", overrides: Partial<MutatingOperationResult> = {}): MutatingOperationResult {
  const command = overrides.command ?? {
    stdout: "Archived " + changeName,
    stderr: "",
    statusCode: 0,
    success: true,
  };
  const postcondition = overrides.postcondition ?? {
    status: "succeeded",
    verified: true,
    missingEvidence: [],
  };

  return {
    operationKind: "archive-change",
    target: changeName,
    command,
    postcondition,
    success: command.success && postcondition.verified,
    ...overrides,
  };
}

function createIssueStore() {
  const issues: OpenSpecOperationIssue[] = [];

  return {
    issues,
    reporter: {
      record(issue: OpenSpecOperationIssue) {
        issues.push(issue);
      },
      clear(predicate: (issue: OpenSpecOperationIssue) => boolean) {
        for (let index = issues.length - 1; index >= 0; index -= 1) {
          if (predicate(issues[index])) {
            issues.splice(index, 1);
          }
        }
      },
    },
  };
}

function buildWorkspace({
  indexed,
  files,
  validation,
  changeStatuses,
  fileSignature: signature,
}: {
  indexed: IndexedOpenSpecWorkspace;
  files: VirtualOpenSpecFileRecord[];
  validation: TestWorkspace["validation"];
  changeStatuses: VirtualOpenSpecChangeStatusRecord[];
  fileSignature: OpenSpecFileSignature;
}): TestWorkspace {
  return {
    indexed,
    filesByPath: Object.fromEntries(files.map((file) => [file.path, file])),
    fileSignature: signature,
    changeStatuses,
    validation,
  };
}

function activeChange(name: string) {
  return {
    name,
    path: "openspec/changes/" + name,
    state: "active" as const,
    artifacts: {
      proposal: { kind: "proposal" as const, exists: true, path: "proposal.md", sourceTrace: { source: "file-tree" as const } },
      design: { kind: "design" as const, exists: true, path: "design.md", sourceTrace: { source: "file-tree" as const } },
      tasks: { kind: "tasks" as const, exists: true, path: "tasks.md", sourceTrace: { source: "file-tree" as const } },
      deltaSpecs: [],
    },
    touchedCapabilities: [],
    taskProgress: { available: true as const, completed: 1, total: 1, sourceTrace: { source: "markdown" as const } },
    workflowStatus: { status: "complete" as const, sourceTrace: { source: "cli-status" as const } },
    sourceTrace: { source: "file-tree" as const },
  };
}

function archivedChange(originalName: string, archivedName = "2026-05-01-" + originalName) {
  return {
    name: archivedName,
    path: "openspec/changes/archive/" + archivedName,
    state: "archived" as const,
    artifacts: {
      proposal: { kind: "proposal" as const, exists: true, path: "proposal.md", sourceTrace: { source: "file-tree" as const } },
      design: { kind: "design" as const, exists: false, path: "design.md", sourceTrace: { source: "file-tree" as const } },
      tasks: { kind: "tasks" as const, exists: true, path: "tasks.md", sourceTrace: { source: "file-tree" as const } },
      deltaSpecs: [],
    },
    touchedCapabilities: [],
    taskProgress: {
      available: false as const,
      completed: 0 as const,
      total: 0 as const,
      sourceTrace: { source: "not-provided" as const },
    },
    archiveMetadata: { archivedDate: "2026-05-01", originalName },
    sourceTrace: { source: "file-tree" as const },
  };
}

function workspaceData(indexed: IndexedOpenSpecWorkspace, signature = fileSignature) {
  return {
    indexed,
    files: [],
    changeStatuses: [],
    fileSignature: signature,
  };
}

describe("OpenSpecProvider", () => {
  it("detects and indexes an OpenSpec repository through restricted bridge commands", async () => {
    const issueStore = createIssueStore();
    const commands: string[] = [];
    const invoke: InvokeAdapter = async (command, args) => {
      commands.push(command);

      if (command === "validate_repo") {
        return {
          path: "/repo",
          name: "repo",
          has_openspec: true,
        } as never;
      }

      if (command === "list_openspec_file_records") {
        return [
          {
            path: "openspec/changes/add-demo/tasks.md",
            kind: "file",
            modified_time_ms: 10,
            file_size: 20,
            content: "- [ ] Implement",
          },
        ] as never;
      }

      if (command === "run_openspec_command") {
        expect(args?.args).toEqual(["status", "--change", "add-demo", "--json"]);
        return {
          stdout: JSON.stringify({
            changeName: "add-demo",
            schemaName: "spec-driven",
            isComplete: false,
            artifacts: [{ id: "tasks", status: "ready" }],
          }),
          stderr: "",
          success: true,
          status_code: 0,
        } as never;
      }

      throw new Error("unexpected command " + command);
    };
    const provider = new OpenSpecProvider({
      invoke,
      issues: issueStore.reporter,
      now: () => new Date("2026-05-01T12:00:00.000Z"),
    });

    await expect(provider.detect("/repo")).resolves.toMatchObject({
      matched: true,
      provider: { id: "openspec" },
    });
    const workspace = await provider.index("/repo");

    expect(workspace.indexed.activeChanges[0]?.name).toBe("add-demo");
    expect(workspace.changeStatuses[0]).toMatchObject({
      changeName: "add-demo",
      schemaName: "spec-driven",
    });
    expect(commands).toEqual([
      "validate_repo",
      "list_openspec_file_records",
      "run_openspec_command",
    ]);
  });

  it("routes artifact reads through the path-bounded OpenSpec artifact command", async () => {
    const issueStore = createIssueStore();
    const invoke: InvokeAdapter = async (command, args) => {
      expect(command).toBe("read_openspec_artifact_file");
      expect(args).toEqual({
        repoPath: "/repo",
        artifactPath: "openspec/changes/add-demo/proposal.md",
      });
      return { contents: "# Proposal" } as never;
    };
    const provider = new OpenSpecProvider({
      invoke,
      issues: issueStore.reporter,
      now: () => new Date("2026-05-01T12:00:00.000Z"),
    });

    await expect(provider.readArtifact("/repo", "openspec/changes/add-demo/proposal.md")).resolves.toBe("# Proposal");
  });

  it("records zero-exit no-op archive output as a postcondition issue", async () => {
    const issueStore = createIssueStore();
    const invoke: InvokeAdapter = async (command, args) => {
      expect(command).toBe("archive_change");
      expect(args).toEqual({ repoPath: "/repo", changeName: "add-demo" });
      return {
        operation_kind: "archive-change",
        target: "add-demo",
        command: {
          stdout: "change MODIFIED failed for header\nAborted. No files were changed.",
          stderr: "",
          success: true,
          status_code: 0,
        },
        postcondition: {
          status: "no-op",
          verified: false,
          missing_evidence: ["archive output included 'Aborted. No files were changed.'"],
          message: "OpenSpec archive exited successfully, but its output reported that no files changed.",
        },
        success: false,
      } as never;
    };
    const provider = new OpenSpecProvider({
      invoke,
      issues: issueStore.reporter,
      now: () => new Date("2026-05-01T12:00:00.000Z"),
    });

    await expect(provider.archive("/repo", "add-demo")).rejects.toThrow("no files changed");

    expect(issueStore.issues[0]).toMatchObject({
      kind: "archive",
      title: "Archive postcondition failed",
      target: "add-demo",
      statusCode: 0,
      stdout: "change MODIFIED failed for header\nAborted. No files were changed.",
      missingEvidence: ["archive output included 'Aborted. No files were changed.'"],
    });
  });
});

describe("ProviderSession", () => {
  it("activates the OpenSpec provider and annotates returned workspace state", async () => {
    const issueStore = createIssueStore();
    const provider = {
      descriptor: openSpecProviderDescriptor,
      detect: async () => ({
        matched: true,
        path: "/repo",
        name: "repo",
        summary: "OpenSpec workspace",
        provider: openSpecProviderDescriptor,
      }),
      index: async () => ({
        indexed: { activeChanges: [], archivedChanges: [], specs: [] },
        files: [],
        changeStatuses: [],
        fileSignature,
      }),
      metadataSignature: async () => fileSignature,
      validate: async () => passingValidation,
      archive: async (_repoPath: string, changeName: string) => archiveOperationResult(changeName),
      findArchivedChangeAfterArchive: async () => null,
      readArtifact: async () => "",
      gitStatus: async () => ({ state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" }),
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });

    const result = await session.loadRepository({ repoPath: "/repo" });

    expect(result).toMatchObject({
      kind: "ready",
      repository: {
        providerId: "openspec",
        providerLabel: "OpenSpec",
      },
      workspace: {
        providerId: "openspec",
        providerLabel: "OpenSpec",
      },
    });
  });

  it("rejects unsupported provider actions before invoking adapters", async () => {
    const issueStore = createIssueStore();
    let adapterCalls = 0;
    const unsupportedCapabilities: ProviderCapabilities = {
      artifacts: false,
      changeStatus: false,
      validation: false,
      archive: false,
      gitStatus: false,
      writeActions: [],
    };
    const provider = {
      descriptor: {
        ...openSpecProviderDescriptor,
        capabilities: unsupportedCapabilities,
      },
      detect: async () => ({ matched: false, path: "/repo", name: "repo", summary: "Unsupported" }),
      index: async () => {
        adapterCalls += 1;
        return { indexed: { activeChanges: [], archivedChanges: [], specs: [] }, files: [], changeStatuses: [], fileSignature };
      },
      metadataSignature: async () => fileSignature,
      validate: async () => {
        adapterCalls += 1;
        return passingValidation;
      },
      archive: async () => {
        adapterCalls += 1;
        return archiveOperationResult();
      },
      findArchivedChangeAfterArchive: async () => null,
      readArtifact: async () => {
        adapterCalls += 1;
        return "";
      },
      gitStatus: async () => {
        adapterCalls += 1;
        return { state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" };
      },
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });

    await expect(session.validate("/repo", null, "/repo")).resolves.toMatchObject({ kind: "unsupported" });
    await expect(session.archiveChanges("/repo", ["change"], null, "/repo")).resolves.toMatchObject({ kind: "unsupported" });
    await expect(session.readArtifact("/repo", "openspec/changes/change/proposal.md", "/repo")).resolves.toMatchObject({ kind: "unsupported" });
    await expect(session.gitStatus("/repo", "/repo")).resolves.toMatchObject({ state: "unavailable" });
    expect(adapterCalls).toBe(0);
  });

  it("marks stale repository loads when a newer load starts", async () => {
    const issueStore = createIssueStore();
    let releaseFirst: () => void = () => undefined;
    const firstLoad = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const provider = {
      descriptor: openSpecProviderDescriptor,
      detect: async (repoPath: string) => {
        if (repoPath === "/repo/one") {
          await firstLoad;
        }
        return {
          matched: true,
          path: repoPath,
          name: repoPath.split("/").pop() ?? "repo",
          summary: "OpenSpec workspace",
          provider: openSpecProviderDescriptor,
        };
      },
      index: async () => ({
        indexed: { activeChanges: [], archivedChanges: [], specs: [] },
        files: [],
        changeStatuses: [],
        fileSignature,
      }),
      metadataSignature: async () => fileSignature,
      validate: async () => passingValidation,
      archive: async (_repoPath: string, changeName: string) => archiveOperationResult(changeName),
      findArchivedChangeAfterArchive: async () => null,
      readArtifact: async () => "",
      gitStatus: async () => ({ state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" }),
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });

    const staleLoad = session.loadRepository({ repoPath: "/repo/one" });
    const currentLoad = await session.loadRepository({ repoPath: "/repo/two" });
    releaseFirst();

    await expect(staleLoad).resolves.toEqual({ kind: "stale" });
    expect(currentLoad).toMatchObject({ kind: "ready", repository: { path: "/repo/two" } });
  });

  it("records archive postcondition failure when the active change remains after re-index", async () => {
    const issueStore = createIssueStore();
    const provider = {
      descriptor: openSpecProviderDescriptor,
      detect: async () => ({
        matched: true,
        path: "/repo",
        name: "repo",
        summary: "OpenSpec workspace",
        provider: openSpecProviderDescriptor,
      }),
      index: async () => workspaceData({
        activeChanges: [activeChange("add-demo")],
        archivedChanges: [],
        specs: [],
      }),
      metadataSignature: async () => fileSignature,
      validate: async () => passingValidation,
      archive: async (_repoPath: string, changeName: string) => archiveOperationResult(changeName, {
        command: {
          stdout: "Archived add-demo",
          stderr: "",
          statusCode: 0,
          success: true,
        },
      }),
      readArtifact: async () => "",
      gitStatus: async () => ({ state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" }),
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });

    await expect(session.archiveChanges("/repo", ["add-demo"], null, "/repo")).rejects.toThrow(
      "could not verify archived state",
    );

    expect(issueStore.issues[0]).toMatchObject({
      kind: "archive",
      title: "Archive postcondition failed",
      target: "add-demo",
      statusCode: 0,
      stdout: "Archived add-demo",
      missingEvidence: [
        "active change still exists at openspec/changes/add-demo",
        "no archived change with original name add-demo was found after re-index",
      ],
    });
  });

  it("returns archived workspace only after re-index contains the archived record", async () => {
    const issueStore = createIssueStore();
    let indexCalls = 0;
    const provider = {
      descriptor: openSpecProviderDescriptor,
      detect: async () => ({
        matched: true,
        path: "/repo",
        name: "repo",
        summary: "OpenSpec workspace",
        provider: openSpecProviderDescriptor,
      }),
      index: async () => {
        indexCalls += 1;
        return workspaceData({
          activeChanges: [],
          archivedChanges: [archivedChange("add-demo")],
          specs: [],
        });
      },
      metadataSignature: async () => fileSignature,
      validate: async () => passingValidation,
      archive: async (_repoPath: string, changeName: string) => archiveOperationResult(changeName),
      readArtifact: async () => "",
      gitStatus: async () => ({ state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" }),
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });

    const result = await session.archiveChanges("/repo", ["add-demo"], null, "/repo");

    expect(result).toMatchObject({
      kind: "archived",
      archivedCount: 1,
      requestedCount: 1,
      lastArchivedChangeId: "2026-05-01-add-demo",
    });
    expect(result.kind === "archived" ? result.workspace.indexed?.archivedChanges[0]?.name : null).toBe(
      "2026-05-01-add-demo",
    );
    expect(indexCalls).toBe(1);
    expect(issueStore.issues).toEqual([]);
  });

  it("marks an in-flight background refresh stale when archive verification starts", async () => {
    const issueStore = createIssueStore();
    const refreshedSignature: OpenSpecFileSignature = {
      fingerprint: "openspec/changes/old/tasks.md:file:20:30",
      latestPath: "openspec/changes/old/tasks.md",
      latestModifiedTimeMs: 20,
    };
    let releaseMetadata: () => void = () => undefined;
    let metadataStarted: () => void = () => undefined;
    const metadataGate = new Promise<void>((resolve) => {
      releaseMetadata = resolve;
    });
    const metadataStartedPromise = new Promise<void>((resolve) => {
      metadataStarted = resolve;
    });
    const provider = {
      descriptor: openSpecProviderDescriptor,
      detect: async () => ({
        matched: true,
        path: "/repo",
        name: "repo",
        summary: "OpenSpec workspace",
        provider: openSpecProviderDescriptor,
      }),
      index: async () => workspaceData({
        activeChanges: [],
        archivedChanges: [archivedChange("add-demo")],
        specs: [],
      }),
      metadataSignature: async () => {
        metadataStarted();
        await metadataGate;
        return refreshedSignature;
      },
      validate: async () => passingValidation,
      archive: async (_repoPath: string, changeName: string) => archiveOperationResult(changeName),
      readArtifact: async () => "",
      gitStatus: async () => ({ state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" }),
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });
    const currentWorkspace = buildWorkspace({
      indexed: { activeChanges: [activeChange("add-demo")], archivedChanges: [], specs: [] },
      files: [],
      validation: passingValidation,
      changeStatuses: [],
      fileSignature,
    });

    const refresh = session.refreshRepositoryIfChanged("/repo", currentWorkspace, "/repo");
    await metadataStartedPromise;
    await expect(session.archiveChanges("/repo", ["add-demo"], currentWorkspace, "/repo")).resolves.toMatchObject({
      kind: "archived",
      lastArchivedChangeId: "2026-05-01-add-demo",
    });
    releaseMetadata();

    await expect(refresh).resolves.toEqual({ kind: "stale" });
  });

  it("reports partial archive progress after verifying each archived change", async () => {
    const issueStore = createIssueStore();
    const archivedNames = new Set<string>();
    const provider = {
      descriptor: openSpecProviderDescriptor,
      detect: async () => ({
        matched: true,
        path: "/repo",
        name: "repo",
        summary: "OpenSpec workspace",
        provider: openSpecProviderDescriptor,
      }),
      index: async () => workspaceData({
        activeChanges: [],
        archivedChanges: Array.from(archivedNames).map((name) => archivedChange(name)),
        specs: [],
      }),
      metadataSignature: async () => fileSignature,
      validate: async () => passingValidation,
      archive: async (repoPath: string, changeName: string) => {
        if (changeName === "two") {
          throw new Error("archive failed");
        }
        expect(repoPath).toBe("/repo");
        archivedNames.add(changeName);
        return archiveOperationResult(changeName);
      },
      findArchivedChangeAfterArchive: async (_repoPath: string, changeName: string) => (
        changeName === "one" ? "2026-05-01-one" : null
      ),
      readArtifact: async () => "",
      gitStatus: async () => ({ state: "clean" as const, dirtyCount: 0, entries: [], message: "Clean" }),
    };
    const session = new ProviderSession<TestWorkspace>({
      provider,
      issues: issueStore.reporter,
      buildWorkspace,
    });

    await expect(session.archiveChanges("/repo", ["one", "two"], null, "/repo")).resolves.toMatchObject({
      kind: "partial",
      archivedCount: 1,
      requestedCount: 2,
      message: "archive failed",
    });
  });
});
