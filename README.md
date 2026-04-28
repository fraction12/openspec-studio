<p align="center">
  <a href="https://github.com/fraction12/openspec-studio">
    <picture>
      <source srcset="public/openspec-studio-logo.svg">
      <img src="public/openspec-studio-logo.svg" alt="OpenSpec Studio logo" width="180">
    </picture>
  </a>
</p>

<p align="center">
  <strong>A local-first desktop window into your OpenSpec workspace.</strong>
</p>

<p align="center">
  <a href="https://github.com/fraction12/openspec-studio"><img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-orange?style=flat-square" /></a>
  <a href="https://github.com/Fission-AI/OpenSpec"><img alt="Built for OpenSpec" src="https://img.shields.io/badge/built%20for-OpenSpec-blue?style=flat-square" /></a>
  <a href="https://tauri.app"><img alt="Tauri v2" src="https://img.shields.io/badge/Tauri-v2-24c8db?style=flat-square&logo=tauri" /></a>
</p>

<details>
<summary><strong>OpenSpec, but visible.</strong></summary>

OpenSpec Studio is not a replacement for OpenSpec. It is a quiet desktop companion that points at a local repo, reads its `openspec/` directory, and turns proposals, specs, tasks, validation, archive readiness, and source artifacts into a fast inspection surface.

</details>
<p></p>

Our philosophy:

```text
→ window not wizard
→ local not hosted
→ source truth not app database
→ inspection before authoring
→ native enough to stay open all day
```

> [!NOTE]
> OpenSpec Studio is early alpha. It is useful today as a local inspection workbench, but OpenSpec files and the OpenSpec CLI remain the source of truth.

<p align="center">
  Built for <a href="https://github.com/Fission-AI/OpenSpec">OpenSpec</a> — spec-driven development for AI coding assistants.
</p>

<!-- TODO: Add screenshot/GIF of opening a repo, inspecting a change, running validation, and archiving. -->

## See it in action

```text
Open a repo
  → Studio finds openspec/
  → indexes active changes, specs, archived changes, and artifact files
  → shows what is proposed, blocked, invalid, stale, or ready to archive

Select a change
  → read proposal.md, design.md, tasks.md, and spec deltas side-by-side
  → preview artifact contents without leaving the app
  → open the real source file when you need to edit

Run validation
  → Studio calls the OpenSpec CLI
  → parses structured validation output
  → keeps the UI honest about what needs attention

Archive when ready
  → Studio validates first
  → calls the OpenSpec archive flow
  → reloads from disk so the app never becomes the source of truth
```

<details>
<summary><strong>Current surfaces</strong></summary>

- Change board for active, archive-ready, archived, blocked, missing, stale, and invalid work
- Specs overview for capability-level inspection
- Artifact inspector for proposals, designs, tasks, and spec deltas
- Validation dashboard backed by the OpenSpec CLI
- Archive actions with validation-first guardrails
- OpenSpec git-status awareness for local workspace changes
- Fast sortable tables and keyboard-friendly row navigation

</details>

## Quick Start

**Requires:**

- Node.js `^20.19.0` or `>=22.12.0`
- Rust and Cargo
- OpenSpec CLI on your `PATH`

Install or update OpenSpec first:

```bash
npm install -g @fission-ai/openspec@latest
```

Clone and run Studio:

```bash
git clone https://github.com/fraction12/openspec-studio.git
cd openspec-studio
npm install
npm run tauri:dev
```

Then open any local repo that contains an `openspec/` directory.

> [!TIP]
> Studio is meant to stay open beside your editor and agent. Let the agent write specs; use Studio to inspect what exists, what changed, and what is safe to archive.

## Docs

→ **[OpenSpec](https://github.com/Fission-AI/OpenSpec)**: the upstream spec framework<br>
→ **[OpenSpec CLI](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md)**: command reference<br>
→ **[OpenSpec Workflows](https://github.com/Fission-AI/OpenSpec/blob/main/docs/workflows.md)**: propose/apply/archive patterns<br>
→ **[`openspec/`](openspec/)**: this app's own product specs and change history

## Why OpenSpec Studio?

OpenSpec is deliberately file-first and CLI-first. That is exactly right for agent workflows, but once a project has several changes and specs, you need a better way to see the state of the room.

- **See the whole workspace** — scan changes, specs, validation, archive readiness, and artifacts from one native window
- **Trust the source** — every view is derived from local OpenSpec files and CLI output
- **Move faster** — jump from a change to its proposal, design, tasks, spec deltas, and source files
- **Stay safe** — validation and archive flows keep guardrails visible instead of hiding them in terminal output
- **Keep agents honest** — review what your coding assistant actually changed before you let it continue

### How we compare

**vs. OpenSpec CLI** — The CLI remains canonical. Studio gives you a visual read model over the same files and commands.

**vs. editing Markdown directly** — Markdown stays editable in your editor. Studio adds navigation, status, validation context, and archive readiness.

**vs. a hosted dashboard** — Studio is local-first. Your repo contents stay on your machine.

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app:

```bash
npm run tauri:dev
```

Run frontend-only development:

```bash
npm run dev
```

Run checks:

```bash
npm test
npm run check
npm run build
cd src-tauri && cargo check
openspec validate --all
```

Build the desktop app bundle:

```bash
npm run tauri:build
```

## Project Status

OpenSpec Studio is alpha software. The current product direction is intentionally narrow:

```text
OpenSpec Studio = a beautiful local inspection surface for OpenSpec state.
```

Near-term focus:

- read-only clarity for changes, specs, archive, validation, tasks, and artifacts
- lightweight app-local persistence for recent repos and UI continuity
- better CLI JSON contracts where Studio needs less fragile parsing
- read-only graph/timeline ideas only if they improve inspection

Not the focus yet:

- replacing OpenSpec
- becoming the main spec writer
- hosted sync
- broad artifact editing
- guided operator workflows
- heavy app-owned databases

## Security & Local File Access

Studio reads local repositories you explicitly choose. It can:

- inspect files under `openspec/`
- run narrowly allowed OpenSpec CLI commands
- run Git status against the selected repo
- open artifact files in your system editor
- archive OpenSpec changes after validation checks

It should not treat persisted app state as source truth. If cached data and files disagree, files win.

## Contributing

This repo dogfoods OpenSpec. For larger changes, add or update an OpenSpec change under `openspec/changes/` before implementation.

Small fixes can be direct PRs. Larger features should explain:

- why the change matters
- which capability/spec it touches
- what is intentionally out of scope
- how it preserves OpenSpec files and CLI output as source truth

AI-generated code is welcome if it is reviewed, tested, and clearly verified.

## License

MIT. See [LICENSE](LICENSE).
