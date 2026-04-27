import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import "./App.css";

import {
  buildOpenSpecFileSignature,
  extractJsonPayload,
  toVirtualChangeStatusRecord,
  toVirtualFileRecords,
  type BridgeFileRecord,
  type OpenSpecFileSignature,
} from "./appModel";
import {
  indexOpenSpecWorkspace,
  type IndexedActiveChange,
  type IndexedArchivedChange,
  type IndexedSpec,
  type IndexedTaskProgress,
  type IndexedWorkflowStatusValue,
  type VirtualOpenSpecChangeStatusRecord,
  type VirtualOpenSpecFileRecord,
} from "./domain/openspecIndex";
import {
  markValidationStaleAfterFileChange,
  parseValidationResult,
  type ValidationIssue,
  type ValidationResult,
} from "./validation/results";

type RepoState = "ready" | "no-workspace" | "cli-failure";
type BoardView = "changes" | "specs";
type ChangePhase = "active" | "archive-ready" | "archived";
type DetailTab = "proposal" | "design" | "tasks" | "spec-delta" | "status";
type Health = "valid" | "stale" | "invalid" | "missing" | "blocked" | "ready";
type ArtifactStatus = "present" | "missing" | "blocked";
type LoadState = "idle" | "loading" | "loaded" | "error";

interface RepositoryValidationDto {
  path: string;
  name: string;
  has_openspec?: boolean;
  hasOpenSpec?: boolean;
  openspec_path?: string | null;
  openspecPath?: string | null;
}

interface CommandResultDto {
  stdout: string;
  stderr: string;
  status_code?: number | null;
  statusCode?: number | null;
  success: boolean;
}

interface RepositoryView {
  id: string;
  name: string;
  path: string;
  branch: string;
  state: RepoState;
  summary: string;
}

interface Artifact {
  id: string;
  label: string;
  path: string;
  status: ArtifactStatus;
  note: string;
}

interface TaskProgress {
  done: number;
  total: number;
  items: Array<{ label: string; done: boolean }>;
}

interface ChangeRecord {
  id: string;
  name: string;
  title: string;
  phase: ChangePhase;
  health: Health;
  summary: string;
  capabilities: string[];
  updatedAt: string;
  taskProgress: TaskProgress | null;
  artifacts: Artifact[];
  deltaSpecs: string[];
  validationIssues: ValidationIssue[];
  archiveReadiness: {
    ready: boolean;
    reasons: string[];
  };
}

interface SpecRecord {
  id: string;
  capability: string;
  path: string;
  health: Health;
  requirements: number;
  updatedAt: string;
  summary: string;
}

interface WorkspaceView {
  changes: ChangeRecord[];
  specs: SpecRecord[];
  filesByPath: Record<string, VirtualOpenSpecFileRecord>;
  fileSignature: OpenSpecFileSignature;
  changeStatuses: VirtualOpenSpecChangeStatusRecord[];
  validation: ValidationResult | null;
}

const DEFAULT_REPO_PATH = "/Volumes/MacSSD/Projects/openspec-studio";
const RECENT_REPOS_STORAGE_KEY = "openspec-studio.recent-repos";
const AUTO_REFRESH_INTERVAL_MS = 15_000;

const healthLabels: Record<Health, string> = {
  valid: "Valid",
  stale: "Stale",
  invalid: "Invalid",
  missing: "Missing",
  blocked: "Blocked",
  ready: "Ready",
};

const phaseLabels: Record<ChangePhase, string> = {
  active: "Active",
  "archive-ready": "Archive ready",
  archived: "Archived",
};

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "proposal", label: "Proposal" },
  { id: "design", label: "Design" },
  { id: "tasks", label: "Tasks" },
  { id: "spec-delta", label: "Spec delta" },
  { id: "status", label: "Status" },
];

const browserPreviewFiles: VirtualOpenSpecFileRecord[] = [
  {
    path: "openspec/changes/build-local-desktop-companion/proposal.md",
    kind: "file",
    modifiedTimeMs: Date.now() - 90_000,
    content:
      "## Why\n\nOpenSpec Studio is a local-first desktop companion for OpenSpec.\n\n## What Changes\n\n- Tauri shell\n- React/TypeScript UI\n- Change board and detail drill-down\n",
  },
  {
    path: "openspec/changes/build-local-desktop-companion/design.md",
    kind: "file",
    modifiedTimeMs: Date.now() - 60_000,
    content:
      "## Decisions\n\nUse Tauri with React/TypeScript. Keep the board scan-first and reveal dense detail through selection, tabs, and focused panels.\n",
  },
  {
    path: "openspec/changes/build-local-desktop-companion/tasks.md",
    kind: "file",
    modifiedTimeMs: Date.now() - 30_000,
    content: [
      "- [x] Choose v1 desktop shell: Tauri with a React/TypeScript frontend.",
      "- [x] Scaffold the app with a minimal desktop window and packaged launch path.",
      "- [x] Add basic project scripts for development, build, lint/check, and test.",
      "- [x] Document how to run the app locally and how to produce an app bundle.",
      "- [ ] Run repository-wide validation from the UI.",
    ].join("\n"),
  },
  {
    path: "openspec/changes/build-local-desktop-companion/specs/change-board/spec.md",
    kind: "file",
    modifiedTimeMs: Date.now() - 20_000,
    content:
      "### Requirement: Change board overview\nThe system SHALL provide a visual overview of OpenSpec changes.\n",
  },
  {
    path: "openspec/specs/change-board/spec.md",
    kind: "file",
    modifiedTimeMs: Date.now() - 10_000,
    content:
      "### Requirement: Change board overview\n### Requirement: Task progress summary\n",
  },
];

const browserPreviewStatuses: VirtualOpenSpecChangeStatusRecord[] = [
  {
    changeName: "build-local-desktop-companion",
    schemaName: "spec-driven",
    isComplete: false,
    artifacts: [
      { id: "proposal", status: "done" },
      { id: "design", status: "done" },
      { id: "specs", status: "done" },
      { id: "tasks", status: "ready" },
    ],
  },
];

function App() {
  const [repoPathInput, setRepoPathInput] = useState(DEFAULT_REPO_PATH);
  const [repo, setRepo] = useState<RepositoryView | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [recentRepos, setRecentRepos] = useState<string[]>(readRecentRepos);
  const [view, setView] = useState<BoardView>("changes");
  const [phase, setPhase] = useState<ChangePhase>("active");
  const [query, setQuery] = useState("");
  const [selectedChangeId, setSelectedChangeId] = useState("");
  const [selectedSpecId, setSelectedSpecId] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("proposal");
  const [artifactPreview, setArtifactPreview] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("Loading local workspace...");

  useEffect(() => {
    void loadRepository(DEFAULT_REPO_PATH);
  }, []);

  useEffect(() => {
    if (!repo || repo.state !== "ready" || !workspace || !isTauriRuntime()) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRepositoryIfChanged(repo.path);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [repo?.path, repo?.state, workspace?.fileSignature.fingerprint]);

  const changes = workspace?.changes ?? [];
  const specs = workspace?.specs ?? [];
  const selectedChange =
    changes.find((change) => change.id === selectedChangeId) ??
    changes.find((change) => change.phase === phase) ??
    changes[0] ??
    null;
  const selectedSpec =
    specs.find((spec) => spec.id === selectedSpecId) ?? specs[0] ?? null;

  useEffect(() => {
    const path = artifactPathForTab(selectedChange, detailTab);

    if (!path) {
      setArtifactPreview("");
      return;
    }

    const cached = workspace?.filesByPath[path]?.content;
    if (cached !== undefined) {
      setArtifactPreview(cached);
      return;
    }

    if (!repo || !isTauriRuntime()) {
      setArtifactPreview("");
      return;
    }

    void invoke<{ contents: string }>("read_openspec_artifact_file", {
      repoPath: repo.path,
      artifactPath: path,
    })
      .then((artifact) => setArtifactPreview(artifact.contents))
      .catch(() => setArtifactPreview(""));
  }, [detailTab, repo, selectedChange, workspace]);

  async function loadRepository(repoPath: string) {
    setLoadState("loading");
    setMessage("Indexing " + repoPath);

    if (!isTauriRuntime()) {
      const indexed = indexOpenSpecWorkspace({
        files: browserPreviewFiles,
        changeStatuses: browserPreviewStatuses,
      });
      const previewRepo: RepositoryView = {
        id: DEFAULT_REPO_PATH,
        name: "openspec-studio",
        path: DEFAULT_REPO_PATH,
        branch: "browser-preview",
        state: "ready",
        summary: "Browser preview data",
      };
      const nextWorkspace = buildWorkspaceView(
        indexed,
        browserPreviewFiles,
        null,
        browserPreviewStatuses,
      );

      setRepo(previewRepo);
      setWorkspace(nextWorkspace);
      selectFirstItems(nextWorkspace);
      setLoadState("loaded");
      setMessage("Browser preview loaded. Run the Tauri app to inspect local files.");
      return;
    }

    try {
      const validation = await invoke<RepositoryValidationDto>("validate_repo", { repoPath });
      const hasOpenSpec = Boolean(validation.has_openspec ?? validation.hasOpenSpec);
      const nextRepo: RepositoryView = {
        id: validation.path,
        name: validation.name,
        path: validation.path,
        branch: "local",
        state: hasOpenSpec ? "ready" : "no-workspace",
        summary: hasOpenSpec ? "OpenSpec workspace" : "No openspec/ directory",
      };

      setRepo(nextRepo);
      setRepoPathInput(validation.path);

      if (!hasOpenSpec) {
        setWorkspace(null);
        setSelectedChangeId("");
        setSelectedSpecId("");
        setLoadState("loaded");
        setMessage("No OpenSpec workspace was found.");
        return;
      }

      rememberRecentRepo(validation.path);

      const fileDtos = await invoke<BridgeFileRecord[]>("list_openspec_file_records", {
        repoPath: validation.path,
      });
      const fileRecords = toVirtualFileRecords(fileDtos);
      const preliminaryIndex = indexOpenSpecWorkspace({ files: fileRecords });
      const changeStatuses = await loadChangeStatuses(
        validation.path,
        preliminaryIndex.activeChanges.map((change) => change.name),
      );
      const fileSignature = buildOpenSpecFileSignature(fileRecords);
      const indexed = indexOpenSpecWorkspace({ files: fileRecords, changeStatuses });
      const nextWorkspace = buildWorkspaceView(
        indexed,
        fileRecords,
        validationForFileRecords(workspace?.validation ?? null, workspace?.fileSignature, fileSignature),
        changeStatuses,
      );

      setWorkspace(nextWorkspace);
      selectFirstItems(nextWorkspace);
      setLoadState("loaded");
      setMessage("Indexed " + nextWorkspace.changes.length + " changes and " + nextWorkspace.specs.length + " specs.");
    } catch (error) {
      setRepo({
        id: repoPath,
        name: repoPath.split("/").filter(Boolean).pop() ?? repoPath,
        path: repoPath,
        branch: "local",
        state: "cli-failure",
        summary: "Unable to load repository",
      });
      setWorkspace(null);
      setLoadState("error");
      setMessage(errorMessage(error));
    }
  }

  async function runValidation() {
    if (!repo || repo.state !== "ready") {
      setMessage("Choose a valid OpenSpec repository before running validation.");
      return;
    }

    if (!isTauriRuntime()) {
      const result = parseValidationResult(
        { items: [{ id: "browser-preview", type: "change", valid: true }] },
        { validatedAt: new Date() },
      );
      const indexed = indexOpenSpecWorkspace({
        files: browserPreviewFiles,
        changeStatuses: browserPreviewStatuses,
      });
      const nextWorkspace = buildWorkspaceView(
        indexed,
        browserPreviewFiles,
        result,
        browserPreviewStatuses,
      );

      setWorkspace(nextWorkspace);
      setLoadState("loaded");
      setMessage("Browser preview validation simulated.");
      return;
    }

    setLoadState("loading");
    setMessage("Running openspec validate --all --json...");

    try {
      const command = await invoke<CommandResultDto>("run_openspec_command", {
        repoPath: repo.path,
        args: ["validate", "--all", "--json"],
      });
      const rawJson = extractJsonPayload(command.stdout) ?? {
        valid: command.success,
        issues: command.success
          ? []
          : [
              {
                message: command.stderr || command.stdout || "OpenSpec validation failed.",
              },
            ],
      };
      const result = parseValidationResult(rawJson, {
        validatedAt: new Date(),
        repoPath: repo.path,
      });
      const records = Object.values(workspace?.filesByPath ?? {});
      const changeStatuses = workspace?.changeStatuses ?? [];
      const indexed = indexOpenSpecWorkspace({ files: records, changeStatuses });
      const nextWorkspace = buildWorkspaceView(indexed, records, result, changeStatuses);

      setWorkspace(nextWorkspace);
      setLoadState("loaded");
      setMessage(result.state === "pass" ? "Validation passed." : "Validation needs attention.");
    } catch (error) {
      setLoadState("error");
      setMessage(errorMessage(error));
    }
  }

  async function openArtifact(artifact: Artifact | SpecRecord) {
    if (!repo) {
      return;
    }

    const absolutePath = absoluteArtifactPath(repo.path, artifact.path);

    if (!isTauriRuntime()) {
      setMessage("Open requested: " + artifact.path);
      return;
    }

    try {
      await openPath(absolutePath);
      setMessage("Opened " + artifact.path);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function loadChangeStatuses(
    repoPath: string,
    changeNames: string[],
  ): Promise<VirtualOpenSpecChangeStatusRecord[]> {
    return Promise.all(
      changeNames.map(async (changeName) => {
        try {
          const command = await invoke<CommandResultDto>("run_openspec_command", {
            repoPath,
            args: ["status", "--change", changeName, "--json"],
          });
          const rawJson = extractJsonPayload(command.stdout);

          if (!rawJson) {
            return toVirtualChangeStatusRecord(
              {
                changeName,
                error:
                  command.stderr ||
                  command.stdout ||
                  "OpenSpec status output was not recognized.",
              },
              changeName,
            );
          }

          return toVirtualChangeStatusRecord(rawJson, changeName);
        } catch (error) {
          return toVirtualChangeStatusRecord(
            { changeName, error: errorMessage(error) },
            changeName,
          );
        }
      }),
    );
  }

  async function refreshRepositoryIfChanged(repoPath: string) {
    try {
      const fileDtos = await invoke<BridgeFileRecord[]>("list_openspec_file_records", {
        repoPath,
      });
      const fileRecords = toVirtualFileRecords(fileDtos);
      const nextSignature = buildOpenSpecFileSignature(fileRecords);

      if (nextSignature.fingerprint === workspace?.fileSignature.fingerprint) {
        return;
      }

      const preliminaryIndex = indexOpenSpecWorkspace({ files: fileRecords });
      const changeStatuses = await loadChangeStatuses(
        repoPath,
        preliminaryIndex.activeChanges.map((change) => change.name),
      );
      const indexed = indexOpenSpecWorkspace({ files: fileRecords, changeStatuses });
      const nextWorkspace = buildWorkspaceView(
        indexed,
        fileRecords,
        validationForFileRecords(workspace?.validation ?? null, workspace?.fileSignature, nextSignature),
        changeStatuses,
      );

      setWorkspace(nextWorkspace);
      keepSelectionInWorkspace(nextWorkspace);
      setMessage("OpenSpec files changed. Workspace refreshed.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function rememberRecentRepo(repoPath: string) {
    setRecentRepos((current) => {
      const next = [repoPath, ...current.filter((path) => path !== repoPath)].slice(0, 5);
      writeRecentRepos(next);
      return next;
    });
  }

  function selectFirstItems(nextWorkspace: WorkspaceView) {
    const firstChange = nextWorkspace.changes.find((change) => change.phase === "active") ?? nextWorkspace.changes[0];
    setSelectedChangeId(firstChange?.id ?? "");
    setSelectedSpecId(nextWorkspace.specs[0]?.id ?? "");
    setDetailTab("proposal");
    setView("changes");
    setPhase("active");
    setQuery("");
  }

  function keepSelectionInWorkspace(nextWorkspace: WorkspaceView) {
    setSelectedChangeId((current) =>
      nextWorkspace.changes.some((change) => change.id === current)
        ? current
        : nextWorkspace.changes[0]?.id ?? "",
    );
    setSelectedSpecId((current) =>
      nextWorkspace.specs.some((spec) => spec.id === current)
        ? current
        : nextWorkspace.specs[0]?.id ?? "",
    );
  }

  return (
    <div className="studio-shell">
      <Sidebar
        repo={repo}
        recentRepos={recentRepos}
        repoPathInput={repoPathInput}
        loadState={loadState}
        onRepoPathInput={setRepoPathInput}
        onLoadRepo={() => void loadRepository(repoPathInput)}
        onOpenRecent={(path) => void loadRepository(path)}
      />

      <WorkspaceMain
        repo={repo}
        workspace={workspace}
        view={view}
        phase={phase}
        query={query}
        selectedChange={selectedChange}
        selectedSpec={selectedSpec}
        loadState={loadState}
        onViewChange={setView}
        onPhaseChange={setPhase}
        onQueryChange={setQuery}
        onSelectChange={(changeId) => {
          setSelectedChangeId(changeId);
          setDetailTab("proposal");
        }}
        onSelectSpec={setSelectedSpecId}
        onValidate={() => void runValidation()}
        onReload={() => repo && void loadRepository(repo.path)}
      />

      <Inspector
        repo={repo}
        workspace={workspace}
        view={view}
        selectedChange={selectedChange}
        selectedSpec={selectedSpec}
        detailTab={detailTab}
        artifactPreview={artifactPreview}
        onDetailTabChange={setDetailTab}
        onOpenArtifact={(artifact) => void openArtifact(artifact)}
        onValidate={() => void runValidation()}
      />

      <StatusBand repo={repo} workspace={workspace} loadState={loadState} message={message} />
    </div>
  );
}

function Sidebar({
  repo,
  recentRepos,
  repoPathInput,
  loadState,
  onRepoPathInput,
  onLoadRepo,
  onOpenRecent,
}: {
  repo: RepositoryView | null;
  recentRepos: string[];
  repoPathInput: string;
  loadState: LoadState;
  onRepoPathInput: (path: string) => void;
  onLoadRepo: () => void;
  onOpenRecent: (path: string) => void;
}) {
  return (
    <aside className="repo-rail" aria-label="Repository navigation">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          OS
        </span>
        <div>
          <p>OpenSpec</p>
          <strong>Studio</strong>
        </div>
      </div>

      <section className="rail-section">
        <div className="rail-heading">Local repository</div>
        <form
          className="repo-path-form"
          onSubmit={(event) => {
            event.preventDefault();
            onLoadRepo();
          }}
        >
          <label>
            <span className="sr-only">Repository path</span>
            <input
              value={repoPathInput}
              onChange={(event) => onRepoPathInput(event.currentTarget.value)}
              placeholder="/path/to/repo"
            />
          </label>
          <button type="submit" className="primary-button" disabled={loadState === "loading"}>
            {loadState === "loading" ? "Loading" : "Open"}
          </button>
        </form>
      </section>

      <section className="rail-section">
        <div className="rail-heading">Selected repo</div>
        {repo ? (
          <div className="current-repo">
            <div>
              <strong>{repo.name}</strong>
              <span>{repo.path}</span>
            </div>
            <HealthPill health={repoHealth(repo)} label={repo.summary} />
          </div>
        ) : (
          <EmptyState compact title="No repo selected" body="Enter a local path to inspect an OpenSpec workspace." />
        )}
      </section>

      <section className="rail-section">
        <div className="rail-heading">Recent repos</div>
        {recentRepos.length > 0 ? (
          <div className="recent-repos">
            {recentRepos.map((path) => (
              <button type="button" key={path} onClick={() => onOpenRecent(path)}>
                <strong>{repoNameFromPath(path)}</strong>
                <span>{path}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No recents" body="Opened repositories will appear here." />
        )}
      </section>

      <section className="rail-section rail-section-fill">
        <div className="rail-heading">Data hierarchy</div>
        <ol className="rail-steps">
          <li>Repository</li>
          <li>Changes or specs</li>
          <li>Selected detail</li>
          <li>Artifact or validation message</li>
        </ol>
      </section>
    </aside>
  );
}

function WorkspaceMain({
  repo,
  workspace,
  view,
  phase,
  query,
  selectedChange,
  selectedSpec,
  loadState,
  onViewChange,
  onPhaseChange,
  onQueryChange,
  onSelectChange,
  onSelectSpec,
  onValidate,
  onReload,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  view: BoardView;
  phase: ChangePhase;
  query: string;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  loadState: LoadState;
  onViewChange: (view: BoardView) => void;
  onPhaseChange: (phase: ChangePhase) => void;
  onQueryChange: (query: string) => void;
  onSelectChange: (changeId: string) => void;
  onSelectSpec: (specId: string) => void;
  onValidate: () => void;
  onReload: () => void;
}) {
  if (!repo) {
    return (
      <main className="workspace-main">
        <EmptyState title="Select a repository" body="Open a local repo to inspect its OpenSpec workspace." />
      </main>
    );
  }

  if (repo.state === "no-workspace") {
    return (
      <main className="workspace-main">
        <EmptyState
          tone="warning"
          title="No OpenSpec workspace found"
          body="The selected folder does not contain openspec/. Studio will not create project files without an explicit action."
        />
      </main>
    );
  }

  if (repo.state === "cli-failure" || !workspace) {
    return (
      <main className="workspace-main">
        <EmptyState
          tone="danger"
          title="Workspace unavailable"
          body="Studio could not index this repository. Check the path, filesystem permissions, and OpenSpec CLI."
          actionLabel="Retry"
          onAction={onReload}
        />
      </main>
    );
  }

  return (
    <main className="workspace-main">
      <header className="workspace-header">
        <div className="workspace-title">
          <span>{repo.branch}</span>
          <h1>{repo.name}</h1>
          <p>{repo.path}</p>
        </div>
        <div className="workspace-actions">
          <div className="segmented" role="tablist" aria-label="Workspace view">
            <button
              type="button"
              role="tab"
              aria-selected={view === "changes"}
              className={view === "changes" ? "is-active" : ""}
              onClick={() => onViewChange("changes")}
            >
              Changes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "specs"}
              className={view === "specs" ? "is-active" : ""}
              onClick={() => onViewChange("specs")}
            >
              Specs
            </button>
          </div>
          <button type="button" className="primary-outline" onClick={onReload} disabled={loadState === "loading"}>
            Refresh
          </button>
          <button type="button" className="primary-button" onClick={onValidate} disabled={loadState === "loading"}>
            Run validation
          </button>
        </div>
      </header>

      {view === "changes" ? (
        <ChangeBoard
          changes={workspace.changes}
          phase={phase}
          query={query}
          selectedChange={selectedChange}
          onPhaseChange={onPhaseChange}
          onQueryChange={onQueryChange}
          onSelectChange={onSelectChange}
        />
      ) : (
        <SpecsBrowser
          specs={workspace.specs}
          selectedSpec={selectedSpec}
          query={query}
          onQueryChange={onQueryChange}
          onSelectSpec={onSelectSpec}
        />
      )}
    </main>
  );
}

function ChangeBoard({
  changes,
  phase,
  query,
  selectedChange,
  onPhaseChange,
  onQueryChange,
  onSelectChange,
}: {
  changes: ChangeRecord[];
  phase: ChangePhase;
  query: string;
  selectedChange: ChangeRecord | null;
  onPhaseChange: (phase: ChangePhase) => void;
  onQueryChange: (query: string) => void;
  onSelectChange: (changeId: string) => void;
}) {
  const filteredChanges = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return changes.filter((change) => {
      return (
        change.phase === phase &&
        (normalizedQuery.length === 0 ||
          change.title.toLowerCase().includes(normalizedQuery) ||
          change.name.toLowerCase().includes(normalizedQuery) ||
          change.capabilities.some((capability) => capability.toLowerCase().includes(normalizedQuery)))
      );
    });
  }, [changes, phase, query]);
  const phaseCounts = useMemo(
    () => ({
      active: changes.filter((change) => change.phase === "active").length,
      "archive-ready": changes.filter((change) => change.phase === "archive-ready").length,
      archived: changes.filter((change) => change.phase === "archived").length,
    }),
    [changes],
  );

  return (
    <section className="board-panel" aria-label="Change board">
      <div className="board-toolbar">
        <div className="segmented quiet" aria-label="Change phase">
          {(Object.keys(phaseLabels) as ChangePhase[]).map((phaseKey) => (
            <button
              type="button"
              key={phaseKey}
              className={phase === phaseKey ? "is-active" : ""}
              onClick={() => onPhaseChange(phaseKey)}
            >
              {phaseLabels[phaseKey]}
              <span>{phaseCounts[phaseKey]}</span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <span className="sr-only">Search changes</span>
          <input value={query} onChange={(event) => onQueryChange(event.currentTarget.value)} placeholder="Search changes" />
        </label>
      </div>

      {filteredChanges.length === 0 ? (
        <EmptyState
          compact
          title={changes.length === 0 ? "No changes indexed" : "No matching changes"}
          body={changes.length === 0 ? "No OpenSpec changes were discovered." : "Try another phase or search."}
        />
      ) : (
        <div className="table-scroll">
          <table className="change-table">
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">Status</th>
                <th scope="col">Tasks</th>
                <th scope="col">Touched capabilities</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredChanges.map((change) => (
                <tr key={change.id} className={selectedChange?.id === change.id ? "is-selected" : ""}>
                  <td>
                    <button type="button" className="change-title-button" onClick={() => onSelectChange(change.id)}>
                      <strong>{change.title}</strong>
                      <span>{change.name}</span>
                    </button>
                  </td>
                  <td>
                    <div className="status-stack">
                      <HealthPill health={change.health} label={healthLabels[change.health]} />
                      <span>{phaseLabels[change.phase]}</span>
                    </div>
                  </td>
                  <td>
                    <TaskProgressCell progress={change.taskProgress} />
                  </td>
                  <td className="capability-cell">{formatCapabilities(change.capabilities)}</td>
                  <td className="updated-cell">{change.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SpecsBrowser({
  specs,
  selectedSpec,
  query,
  onQueryChange,
  onSelectSpec,
}: {
  specs: SpecRecord[];
  selectedSpec: SpecRecord | null;
  query: string;
  onQueryChange: (query: string) => void;
  onSelectSpec: (specId: string) => void;
}) {
  const filteredSpecs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return specs.filter(
      (spec) =>
        normalizedQuery.length === 0 ||
        spec.capability.toLowerCase().includes(normalizedQuery) ||
        spec.summary.toLowerCase().includes(normalizedQuery),
    );
  }, [query, specs]);

  return (
    <section className="board-panel" aria-label="Specs browser">
      <div className="board-toolbar">
        <div>
          <h2>Specs</h2>
          <p>Capability specs appear here after repository indexing.</p>
        </div>
        <label className="search-field">
          <span className="sr-only">Search specs</span>
          <input value={query} onChange={(event) => onQueryChange(event.currentTarget.value)} placeholder="Search specs" />
        </label>
      </div>

      {filteredSpecs.length === 0 ? (
        <EmptyState compact tone="warning" title="No specs indexed" body="No specs were found under openspec/specs." />
      ) : (
        <div className="table-scroll">
          <table className="change-table">
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Status</th>
                <th scope="col">Requirements</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredSpecs.map((spec) => (
                <tr key={spec.id} className={selectedSpec?.id === spec.id ? "is-selected" : ""}>
                  <td>
                    <button type="button" className="change-title-button" onClick={() => onSelectSpec(spec.id)}>
                      <strong>{spec.capability}</strong>
                      <span>{spec.path}</span>
                    </button>
                  </td>
                  <td>
                    <HealthPill health={spec.health} label={healthLabels[spec.health]} />
                  </td>
                  <td>{spec.requirements}</td>
                  <td className="updated-cell">{spec.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Inspector({
  repo,
  workspace,
  view,
  selectedChange,
  selectedSpec,
  detailTab,
  artifactPreview,
  onDetailTabChange,
  onOpenArtifact,
  onValidate,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  view: BoardView;
  selectedChange: ChangeRecord | null;
  selectedSpec: SpecRecord | null;
  detailTab: DetailTab;
  artifactPreview: string;
  onDetailTabChange: (tab: DetailTab) => void;
  onOpenArtifact: (artifact: Artifact | SpecRecord) => void;
  onValidate: () => void;
}) {
  if (!repo || !workspace) {
    return (
      <aside className="inspector" aria-label="Inspector">
        <EmptyState compact title="Inspector" body="Select a valid OpenSpec repository to drill into details." />
      </aside>
    );
  }

  if (view === "specs") {
    return (
      <aside className="inspector" aria-label="Spec inspector">
        {selectedSpec ? (
          <>
            <div className="inspector-header">
              <span>Capability</span>
              <h2>{selectedSpec.capability}</h2>
              <p>{selectedSpec.path}</p>
              <div className="inspector-actions">
                <HealthPill health={selectedSpec.health} label={healthLabels[selectedSpec.health]} />
                <button type="button" className="primary-outline" onClick={() => onOpenArtifact(selectedSpec)}>
                  Open spec
                </button>
              </div>
            </div>
            <section className="inspector-section">
              <h3>Summary</h3>
              <p>{selectedSpec.summary}</p>
            </section>
            <section className="inspector-section two-column-facts">
              <div>
                <span>Requirements</span>
                <strong>{selectedSpec.requirements}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{selectedSpec.updatedAt}</strong>
              </div>
            </section>
          </>
        ) : (
          <EmptyState compact tone="warning" title="No spec selected" body="Select a spec to inspect it." />
        )}
      </aside>
    );
  }

  if (!selectedChange) {
    return (
      <aside className="inspector" aria-label="Change inspector">
        <EmptyState compact title="No change selected" body="Choose a change to reveal artifacts and validation details." />
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-label="Change inspector">
      <div className="inspector-header">
        <span>{selectedChange.name}</span>
        <h2>{selectedChange.title}</h2>
        <p>{selectedChange.summary}</p>
        <div className="inspector-actions">
          <HealthPill health={selectedChange.health} label={healthLabels[selectedChange.health]} />
          <button type="button" className="primary-outline" onClick={() => onOpenArtifact(selectedChange.artifacts[0])}>
            Open artifact
          </button>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Change details">
        {detailTabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={detailTab === tab.id}
            className={detailTab === tab.id ? "is-active" : ""}
            onClick={() => onDetailTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspector-body">
        {renderDetailTab(selectedChange, detailTab, artifactPreview, onOpenArtifact, onValidate)}
      </div>
    </aside>
  );
}

function renderDetailTab(
  change: ChangeRecord,
  tab: DetailTab,
  artifactPreview: string,
  onOpenArtifact: (artifact: Artifact) => void,
  onValidate: () => void,
) {
  if (tab === "proposal" || tab === "design") {
    return (
      <section className="inspector-section">
        <h3>{tab === "proposal" ? "Proposal preview" : "Design preview"}</h3>
        <MarkdownPreview content={artifactPreview} emptyText="No preview available." />
      </section>
    );
  }

  if (tab === "tasks") {
    if (!change.taskProgress) {
      return (
        <EmptyState compact tone="warning" title="Task progress unavailable" body="tasks.md is missing." />
      );
    }

    const remainingTasks = change.taskProgress.items.filter((item) => !item.done);
    const completedTasks = change.taskProgress.items.filter((item) => item.done);

    return (
      <>
        <section className="inspector-section progress-section">
          <h3>Task progress</h3>
          <TaskProgressCell progress={change.taskProgress} expanded />
        </section>
        <section className="inspector-section">
          <div className="section-title-row">
            <h3>Remaining tasks</h3>
            <span>{remainingTasks.length}</span>
          </div>
          {remainingTasks.length > 0 ? (
            <TaskList items={remainingTasks} />
          ) : (
            <p className="muted-copy">No remaining tasks. This change is ready for final checks.</p>
          )}
        </section>
        <details className="disclosure task-history">
          <summary>
            Completed tasks <span>{completedTasks.length}</span>
          </summary>
          <TaskList items={completedTasks} compact />
        </details>
      </>
    );
  }

  if (tab === "spec-delta") {
    return change.deltaSpecs.length > 0 ? (
      <section className="inspector-section">
        <h3>Spec deltas</h3>
        <ul className="detail-list">
          {change.deltaSpecs.map((delta) => (
            <li key={delta}>{delta}</li>
          ))}
        </ul>
      </section>
    ) : (
      <EmptyState compact tone="warning" title="No spec deltas" body="No delta specs are indexed for this change." />
    );
  }

  return (
    <>
      <details className="disclosure" open>
        <summary>Validation details</summary>
        {change.validationIssues.length === 0 ? (
          <p className="muted-copy">No validation messages are linked to this change.</p>
        ) : (
          <ul className="message-list">
            {change.validationIssues.map((issue) => (
              <li key={issue.id} className={"message " + issue.severity}>
                <strong>{issue.code ?? issue.severity}</strong>
                <span>{issue.message}</span>
                {issue.path ? <code>{issue.path}</code> : null}
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="primary-outline full-width-action" onClick={onValidate}>
          Refresh validation
        </button>
      </details>

      <details className="disclosure">
        <summary>Artifacts</summary>
        <div className="artifact-list">
          {change.artifacts.map((artifact) => (
            <div className="artifact-row" key={artifact.id}>
              <div>
                <strong>{artifact.label}</strong>
                <span>{artifact.note}</span>
                <code>{artifact.path}</code>
              </div>
              <div className="artifact-actions">
                <HealthPill health={artifactHealth(artifact.status)} label={artifact.status} />
                <button
                  type="button"
                  className="primary-outline"
                  disabled={artifact.status !== "present"}
                  onClick={() => onOpenArtifact(artifact)}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>

      <details className="disclosure">
        <summary>Archive readiness</summary>
        <div className="readiness-summary">
          <HealthPill
            health={change.archiveReadiness.ready ? "ready" : "blocked"}
            label={change.archiveReadiness.ready ? "Ready to archive" : "Not ready"}
          />
          <ul className="detail-list">
            {change.archiveReadiness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}

function TaskList({
  items,
  compact = false,
}: {
  items: Array<{ label: string; done: boolean }>;
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "task-list compact" : "task-list"}>
      {items.map((item) => (
        <li key={item.label} className={item.done ? "is-done" : ""}>
          <span className="task-check" aria-hidden="true" />
          <span className="task-label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "code"; text: string };

function MarkdownPreview({
  content,
  emptyText,
}: {
  content: string;
  emptyText: string;
}) {
  const blocks = parseMarkdownBlocks(content);

  if (blocks.length === 0) {
    return <div className="markdown-preview markdown-empty">{emptyText}</div>;
  }

  return (
    <div className="markdown-preview">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <div
              key={index}
              className={"markdown-heading markdown-heading-" + Math.min(block.level, 4)}
            >
              {block.text}
            </div>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={index}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }

        if (block.kind === "code") {
          return (
            <pre key={index} className="markdown-code">
              <code>{block.text}</code>
            </pre>
          );
        }

        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: cleanMarkdownText(paragraph.join(" ")) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ kind: "list", items: listItems.map(cleanMarkdownText) });
      listItems = [];
    }
  };
  const flushCode = () => {
    if (codeLines.length > 0) {
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      codeLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: cleanMarkdownText(heading[2]),
      });
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();

  return blocks;
}

function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function StatusBand({
  repo,
  workspace,
  loadState,
  message,
}: {
  repo: RepositoryView | null;
  workspace: WorkspaceView | null;
  loadState: LoadState;
  message: string;
}) {
  const attentionCount = workspace?.changes.filter((change) => ["invalid", "missing", "blocked"].includes(change.health)).length ?? 0;
  const validationLabel = workspace?.validation
    ? workspace.validation.state === "pass"
      ? "Validation clean"
      : workspace.validation.state === "stale"
        ? "Validation stale"
        : "Validation failed"
    : "Not run";

  return (
    <footer className="status-band" aria-label="Validation status">
      <div className="status-band-item">
        <span>Repository</span>
        <strong>{repo?.name ?? "None selected"}</strong>
      </div>
      <div className="status-band-item">
        <span>Validation</span>
        <strong>{validationLabel}</strong>
      </div>
      <div className="status-band-item">
        <span>Attention</span>
        <strong>{attentionCount} changes</strong>
      </div>
      <div className="status-band-toast" aria-live="polite">
        {loadState === "loading" ? "Working..." : message}
      </div>
    </footer>
  );
}

function buildWorkspaceView(
  indexed: ReturnType<typeof indexOpenSpecWorkspace>,
  files: VirtualOpenSpecFileRecord[],
  validation: ValidationResult | null,
  changeStatuses: VirtualOpenSpecChangeStatusRecord[],
): WorkspaceView {
  const filesByPath = Object.fromEntries(files.map((file) => [file.path, file]));
  const changes: ChangeRecord[] = [
    ...indexed.activeChanges.map((change) => activeChangeToView(change, filesByPath, validation)),
    ...indexed.archivedChanges.map(archivedChangeToView),
  ];

  return {
    changes,
    specs: indexed.specs.map((spec) => specToView(spec, filesByPath, validation)),
    filesByPath,
    fileSignature: buildOpenSpecFileSignature(files),
    changeStatuses,
    validation,
  };
}

function activeChangeToView(
  change: IndexedActiveChange,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
  validation: ValidationResult | null,
): ChangeRecord {
  const artifacts: Artifact[] = [
    requiredArtifact("proposal", "Proposal", change.artifacts.proposal),
    requiredArtifact("design", "Design", change.artifacts.design),
    requiredArtifact("tasks", "Tasks", change.artifacts.tasks),
    ...change.artifacts.deltaSpecs.map((spec) => ({
      id: "delta-" + spec.capability,
      label: spec.capability,
      path: spec.path,
      status: "present" as const,
      note: "Delta spec",
    })),
  ];
  const taskProgress = taskProgressToView(change.taskProgress, filesByPath[change.artifacts.tasks.path]?.content);
  const validationIssues = issuesForChange(validation, change.name);
  const missingArtifacts = artifacts.filter((artifact) => artifact.status === "missing");
  const archiveReady = Boolean(
    taskProgress &&
      taskProgress.total > 0 &&
      taskProgress.done === taskProgress.total &&
      missingArtifacts.length === 0 &&
      validationIssues.length === 0,
  );

  return {
    id: change.name,
    name: change.name,
    title: titleize(change.name),
    phase: archiveReady ? "archive-ready" : "active",
    health: healthForChange(change.workflowStatus.status, missingArtifacts.length, validation, validationIssues.length),
    summary: summaryFromContent(filesByPath[change.artifacts.proposal.path]?.content) ?? "OpenSpec change",
    capabilities: change.touchedCapabilities.map((capability) => capability.capability),
    updatedAt: formatTime(change.modifiedTimeMs),
    taskProgress,
    artifacts,
    deltaSpecs: change.artifacts.deltaSpecs.map((spec) => spec.path),
    validationIssues,
    archiveReadiness: {
      ready: archiveReady,
      reasons: archiveReady
        ? ["All tasks are complete.", "Required artifacts exist.", "No linked validation errors are present."]
        : readinessReasons(taskProgress, missingArtifacts, validationIssues),
    },
  };
}

function archivedChangeToView(change: IndexedArchivedChange): ChangeRecord {
  return {
    id: change.name,
    name: change.name,
    title: titleize(change.name),
    phase: "archived",
    health: "valid",
    summary: "Archived OpenSpec change",
    capabilities: [],
    updatedAt: formatTime(change.modifiedTimeMs),
    taskProgress: null,
    artifacts: [],
    deltaSpecs: [],
    validationIssues: [],
    archiveReadiness: {
      ready: true,
      reasons: ["Archived change."],
    },
  };
}

function specToView(
  spec: IndexedSpec,
  filesByPath: Record<string, VirtualOpenSpecFileRecord>,
  validation: ValidationResult | null,
): SpecRecord {
  const issues = validation?.issues.filter((issue) =>
    issue.associations.some((association) => association.kind === "spec" && association.id === spec.capability),
  );

  return {
    id: spec.capability,
    capability: spec.capability,
    path: spec.path,
    health: issues && issues.length > 0 ? "invalid" : validation ? "valid" : "stale",
    requirements: countRequirements(filesByPath[spec.path]?.content),
    updatedAt: formatTime(spec.modifiedTimeMs),
    summary: summaryFromContent(filesByPath[spec.path]?.content) ?? "Capability spec",
  };
}

function requiredArtifact(
  id: string,
  label: string,
  artifact: { exists: boolean; path: string; workflowStatus?: string },
): Artifact {
  return {
    id,
    label,
    path: artifact.path,
    status: artifact.exists ? workflowArtifactStatus(artifact.workflowStatus) : "missing",
    note: artifact.workflowStatus ? "Workflow status: " + artifact.workflowStatus : artifact.exists ? "Found on disk" : "Missing",
  };
}

function workflowArtifactStatus(status: string | undefined): ArtifactStatus {
  if (status === "blocked") {
    return "blocked";
  }

  return "present";
}

function healthForChange(
  workflowStatus: IndexedWorkflowStatusValue,
  missingArtifactCount: number,
  validation: ValidationResult | null,
  validationIssueCount: number,
): Health {
  if (validationIssueCount > 0 || workflowStatus === "error") {
    return "invalid";
  }

  if (workflowStatus === "blocked") {
    return "blocked";
  }

  if (missingArtifactCount > 0) {
    return "missing";
  }

  if (!validation) {
    return "stale";
  }

  return validation.state === "pass" ? "valid" : validation.state === "fail" ? "invalid" : "stale";
}

function taskProgressToView(
  progress: IndexedTaskProgress,
  content: string | undefined,
): TaskProgress | null {
  if (!progress.available) {
    return null;
  }

  return {
    done: progress.completed,
    total: progress.total,
    items: parseTaskItems(content),
  };
}

function parseTaskItems(content: string | undefined): Array<{ label: string; done: boolean }> {
  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => /^\s*[-*+]\s+\[([ xX])\]\s+(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({
      done: match[1]?.toLowerCase() === "x",
      label: match[2] ?? "",
    }));
}

function issuesForChange(validation: ValidationResult | null, changeName: string): ValidationIssue[] {
  return (
    validation?.issues.filter((issue) =>
      issue.associations.some((association) => association.kind === "change" && association.id === changeName),
    ) ?? []
  );
}

function readinessReasons(
  taskProgress: TaskProgress | null,
  missingArtifacts: Artifact[],
  validationIssues: ValidationIssue[],
): string[] {
  const reasons: string[] = [];

  if (!taskProgress) {
    reasons.push("Task progress is unavailable.");
  } else if (taskProgress.done < taskProgress.total) {
    reasons.push(taskProgress.total - taskProgress.done + " tasks remain open.");
  }

  if (missingArtifacts.length > 0) {
    reasons.push("Missing artifacts: " + missingArtifacts.map((artifact) => artifact.label).join(", ") + ".");
  }

  if (validationIssues.length > 0) {
    reasons.push(validationIssues.length + " linked validation issues need attention.");
  }

  return reasons.length > 0 ? reasons : ["Refresh validation to confirm archive readiness."];
}

function artifactPathForTab(change: ChangeRecord | null, tab: DetailTab): string | undefined {
  if (!change) {
    return undefined;
  }

  if (tab === "proposal") {
    return change.artifacts.find((artifact) => artifact.id === "proposal")?.path;
  }

  if (tab === "design") {
    return change.artifacts.find((artifact) => artifact.id === "design")?.path;
  }

  return undefined;
}

function repoHealth(repo: RepositoryView): Health {
  if (repo.state === "ready") {
    return "valid";
  }

  return repo.state === "cli-failure" ? "invalid" : "missing";
}

function artifactHealth(status: ArtifactStatus): Health {
  if (status === "present") {
    return "valid";
  }

  return status === "blocked" ? "blocked" : "missing";
}

function countRequirements(content: string | undefined): number {
  return (content?.match(/^### Requirement:/gm) ?? []).length;
}

function summaryFromContent(content: string | undefined): string | undefined {
  const line = content
    ?.split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0 && !candidate.startsWith("#") && !candidate.startsWith("-"));

  return line;
}

function titleize(value: string): string {
  return value
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTime(modifiedTimeMs: number | undefined): string {
  if (!modifiedTimeMs) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(modifiedTimeMs));
}

function formatCapabilities(capabilities: string[]): string {
  if (capabilities.length === 0) {
    return "None";
  }

  if (capabilities.length <= 2) {
    return capabilities.join(", ");
  }

  return capabilities.slice(0, 2).join(", ") + " +" + (capabilities.length - 2);
}

function absoluteArtifactPath(repoPath: string, artifactPath: string): string {
  if (artifactPath.startsWith("/")) {
    return artifactPath;
  }

  return repoPath.replace(/\/$/, "") + "/" + artifactPath;
}

function validationForFileRecords(
  validation: ValidationResult | null,
  previousSignature: OpenSpecFileSignature | undefined,
  nextSignature: OpenSpecFileSignature,
): ValidationResult | null {
  if (!validation || !previousSignature) {
    return validation;
  }

  if (previousSignature.fingerprint === nextSignature.fingerprint) {
    return validation;
  }

  return markValidationStaleAfterFileChange(
    validation,
    nextSignature.latestPath ?? "openspec",
    nextSignature.latestModifiedTimeMs
      ? new Date(nextSignature.latestModifiedTimeMs)
      : new Date(),
  );
}

function repoNameFromPath(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function readRecentRepos(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_REPOS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function writeRecentRepos(paths: string[]) {
  try {
    window.localStorage.setItem(RECENT_REPOS_STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Recent repos are a convenience. Indexing must keep working without storage.
  }
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "Unexpected error.";
}

function EmptyState({
  title,
  body,
  tone = "neutral",
  compact = false,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  tone?: "neutral" | "warning" | "danger";
  compact?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className={"empty-state " + tone + (compact ? " compact" : "")}>
      <div className="empty-icon" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <button type="button" className="primary-outline" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function TaskProgressCell({ progress, expanded = false }: { progress: TaskProgress | null; expanded?: boolean }) {
  if (!progress || progress.total === 0) {
    return <span className="unavailable">Unavailable</span>;
  }

  const percent = Math.round((progress.done / progress.total) * 100);

  return (
    <div className={"progress-cell" + (expanded ? " expanded" : "")}>
      <div className="progress-copy">
        <strong>
          {progress.done}/{progress.total}
        </strong>
        <span>{percent}%</span>
      </div>
      <div className="progress-track" aria-label={"Task progress " + percent + " percent"}>
        <span style={{ width: percent + "%" }} />
      </div>
    </div>
  );
}

function HealthPill({ health, label }: { health: Health; label: string }) {
  return (
    <span className={"health-pill " + health}>
      <StatusDot health={health} />
      {label}
    </span>
  );
}

function StatusDot({ health }: { health: Health }) {
  return <span className={"status-dot " + health} aria-hidden="true" />;
}

export default App;
