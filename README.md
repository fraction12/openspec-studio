<p align="center">
  <a href="https://github.com/fraction12/openspec-studio">
    <picture>
      <source srcset="public/openspec-studio-logo.svg">
      <img src="public/openspec-studio-logo.svg" alt="OpenSpec Studio logo" width="180">
    </picture>
  </a>
</p>

<p align="center">
  <strong>A local-first desktop workbench for inspecting OpenSpec repositories.</strong>
</p>

<p align="center">
  <a href="https://github.com/fraction12/openspec-studio"><img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" /></a>
  <a href="https://github.com/Fission-AI/OpenSpec"><img alt="Built for OpenSpec" src="https://img.shields.io/badge/built%20for-OpenSpec-blue?style=flat-square" /></a>
  <a href="https://tauri.app"><img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24c8db?style=flat-square&logo=tauri" /></a>
</p>

> [!IMPORTANT]
> Current alpha supports OpenSpec only. Provider adapters, Adapter Foundry, and non-OpenSpec repository dashboards are future exploration, not shipped capabilities.

OpenSpec Studio points at a local repository, reads its `openspec/` directory, and turns proposals, specs, tasks, validation, archive readiness, and source artifacts into a fast inspection surface. OpenSpec files and the OpenSpec CLI remain the source of truth.

```text
window not wizard
local not hosted
source truth not app database
inspection before authoring
native enough to stay open all day
```

## Who This Is For

OpenSpec Studio is for people already using, evaluating, or maintaining an OpenSpec workspace who want a visual workbench beside their editor and AI coding assistant.

It is a good fit if you want to:

- inspect active, archive-ready, and archived OpenSpec changes
- read proposal, design, task, and spec-delta artifacts without hunting through folders
- run OpenSpec validation and see scoped diagnostics
- archive completed changes through the OpenSpec CLI with validation guardrails
- keep local repository state visible while your editor or agent does the writing

It is not currently for:

- generic project planning outside OpenSpec
- hosted team dashboards or cloud sync
- replacing the OpenSpec CLI
- editing every artifact inside Studio
- generated/custom provider adapters
- production Windows binary distribution

## See It In Action

Studio's first public alpha does not ship a polished demo recording yet. The product flow is:

```text
Open a repo
  -> Studio finds openspec/
  -> indexes active changes, specs, archived changes, and artifact files
  -> shows what is proposed, blocked, stale, invalid, or ready to archive

Select a change
  -> read proposal.md, design.md, tasks.md, and spec deltas
  -> preview artifact contents without leaving the app
  -> open the real source file when you need to edit

Run validation
  -> Studio calls openspec validate --all --json
  -> parses structured validation output
  -> keeps the UI honest about what needs attention

Archive when ready
  -> Studio validates first
  -> calls the OpenSpec archive flow
  -> reloads from disk so the app never becomes the source of truth
```

## Current Surfaces

- Change board for active, archive-ready, archived, blocked, missing, stale, and invalid work
- Specs overview for capability-level inspection
- Artifact inspector for proposals, designs, tasks, and spec deltas
- Validation dashboard backed by the OpenSpec CLI
- Archive actions with validation-first guardrails
- OpenSpec Git-status awareness for local workspace changes
- Sortable tables and keyboard-friendly row navigation
- App-local persistence for recent repositories, selection, sorting, and validation freshness
- Optional Studio Runner dispatch for sending one selected change to a local signed runner

## Supported Platforms

The source tree is developed and tested primarily on macOS.

- **macOS:** primary alpha target.
- **Linux:** expected source-build target, but not yet packaged or deeply UATed.
- **Windows:** experimental until process-tree containment and packaging are hardened to match Unix behavior.

No public binary installers are provided yet. Build from source for now. The Tauri bundle identifier is currently `dev.openspec.studio`; treat it as alpha metadata until binary release signing/notarization is planned.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- Rust and Cargo
- Platform prerequisites for Tauri v2 development
- OpenSpec CLI available on `PATH`

Install or update OpenSpec:

```bash
npm install -g @fission-ai/openspec@latest
```

For Tauri platform setup, use the official guide for your OS: https://tauri.app/start/prerequisites/

## Install And Run From Source

```bash
git clone https://github.com/fraction12/openspec-studio.git
cd openspec-studio
npm install
npm run tauri:dev
```

Then choose a local repository that contains an `openspec/` directory.

Frontend-only development is available for UI work, but local repository access, validation, archive, and file actions require the Tauri desktop runtime:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Build a local desktop bundle:

```bash
npm run tauri:build
```

## Usage Walkthrough

1. Open Studio and choose a local repository folder.
2. Confirm the workspace header shows the repository you selected.
3. Use **Changes** to scan active, archive-ready, and archived changes.
4. Select a change row to inspect proposal, design, tasks, spec deltas, validation, and archive metadata.
5. Use **Specs** to inspect current capability specs and requirement counts.
6. Run validation to refresh trust state from the OpenSpec CLI.
7. Archive from the archive-ready board when tasks are complete and validation passes.


## Optional Studio Runner

Studio can hand one selected active change to a local Studio Runner companion process. This is explicit and push-based: Studio does not poll, does not require Linear for the OpenSpec path, and does not automatically dispatch when a change becomes valid.

To use it in the current alpha:

1. Start a compatible Studio Runner endpoint locally.
2. Configure the endpoint in the selected change inspector.
3. Generate a session-only signing secret in Studio and pass the same secret to the local runner for this app session. Studio does not persist the secret after restart.
4. Run validation until the workspace is clean.
5. Click **Build with agent**.

Studio sends `build.requested` to `POST /api/v1/studio-runner/events` with `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers. The signature is HMAC-SHA256 over `webhook-id.webhook-timestamp.raw-body`. Payloads are intentionally thin: repo path, change name, validation state, and artifact paths, not full repository contents.

## Development

Run checks:

```bash
npm test
npm run check
npm run build
cd src-tauri && cargo check
cd src-tauri && cargo test
openspec validate --all
```

This repo dogfoods OpenSpec. Larger changes should add or update an OpenSpec change under `openspec/changes/` before implementation.

## Project Status

OpenSpec Studio is alpha software. The current product direction is intentionally narrow:

```text
OpenSpec Studio = a local inspection surface for OpenSpec state.
```

Near-term focus:

- read-only clarity for changes, specs, archive, validation, tasks, and artifacts
- lightweight app-local persistence for recent repos and UI continuity
- better CLI JSON contracts where Studio needs less fragile parsing
- provider adapter architecture as an internal seam, with OpenSpec as the only shipped provider
- read-only graph/timeline ideas only if they improve inspection

Explicitly parked:

- guided propose/apply workflows beyond existing validation/archive guardrails
- Adapter Foundry or generated custom providers
- hosted sync
- broad artifact editing
- npm package publishing
- public binary distribution

## Security And Privacy

Studio is local-first and has no hosted sync.

Studio can:

- read files under the `openspec/` directory in a repository you choose
- run narrowly allowed OpenSpec CLI commands for validation, status, and archive
- run Git status scoped to `openspec/`
- open artifact files in your system editor
- store recent repository paths, UI state, validation snapshots, runner settings, and bounded dispatch history in local app state

Persisted validation snapshots may include OpenSpec diagnostics with file paths and command output. Clear local app data if you want to remove those records before sharing a machine or debugging profile.

The Tauri bridge intentionally keeps command, file, and runner operations narrow: repository paths are canonicalized, artifact reads are bounded to `openspec/`, OpenSpec command shapes are allowlisted, archive validates the change name, and command output/time are bounded.

The Content Security Policy keeps production assets local and allows Tauri IPC. Localhost connection allowances remain because the same Tauri config supports development/HMR workflows; production code should not depend on hosted services.

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidance.

## Contributing

Outside contributions are welcome, but this repo is still alpha and not yet a fully contributor-optimized project. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs

→ **[OpenSpec](https://github.com/Fission-AI/OpenSpec)**: the upstream spec framework<br>
→ **[OpenSpec CLI](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md)**: command reference<br>
→ **[OpenSpec Workflows](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md)**: propose/apply/archive patterns<br>
→ **[`openspec/`](openspec/)**: this app's own product specs and change history

## License

MIT. See [LICENSE](LICENSE).
