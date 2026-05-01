import { describe, expect, it } from "vitest";

import type {
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
      archive: async () => undefined,
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
      archive: async () => undefined,
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

  it("reports partial archive progress after verifying each archived change", async () => {
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
      archive: async (repoPath: string, changeName: string) => {
        if (changeName === "two") {
          throw new Error("archive failed");
        }
        expect(repoPath).toBe("/repo");
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
