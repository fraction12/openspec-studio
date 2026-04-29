# Contributing

Thanks for taking a look at OpenSpec Studio. This repo is public-alpha software, so the contribution bar is intentionally practical: keep changes small, source-backed, and easy to verify.

## Before You Start

- Use OpenSpec for meaningful product, behavior, architecture, or UX changes.
- Small typo, docs, or narrowly obvious bug fixes can be direct PRs.
- Keep OpenSpec files and CLI output as the source of truth. Do not introduce app-owned canonical state for OpenSpec data.
- Preserve the Tauri bridge safety boundaries: no arbitrary shell commands, no broad filesystem reads, and no unbounded command output.

## Local Setup

```bash
npm install
npm run tauri:dev
```

You also need Rust/Cargo, Tauri platform prerequisites, and the OpenSpec CLI on `PATH`.

## Checks

Run the focused checks for your change, and prefer the full set before opening a PR:

```bash
npm test
npm run check
npm run build
cd src-tauri && cargo check
cd src-tauri && cargo test
openspec validate --all
```

## Pull Requests

In your PR, include:

- what changed
- why it changed
- which OpenSpec change/spec it relates to, if any
- how you verified it
- any known limitations or follow-up work

Large refactors should be split into smaller reviewable commits or PRs.
