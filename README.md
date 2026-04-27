# OpenSpec Studio

A local-first desktop companion for OpenSpec.

OpenSpec Studio points at a local repository, reads its `openspec/` workspace, and gives a visual overview of changes, specs, artifacts, validation state, and archive readiness without replacing the OpenSpec CLI.

## Development

OpenSpec Studio is a Tauri v2 desktop app with a React/TypeScript frontend.

### Prerequisites

- Node.js and npm
- Rust and Cargo
- The `openspec` CLI available on your `PATH` for repository validation features

### Install

```sh
npm install
```

### Run Locally

Run the desktop app in development mode:

```sh
npm run tauri:dev
```

For frontend-only iteration:

```sh
npm run dev
```

### Usage Walkthrough

1. Open a local repository that contains an `openspec/` directory.
2. Scan the change board for active, archive-ready, archived, missing, blocked, stale, or invalid work.
3. Select a change to drill into proposal, design, tasks, spec deltas, artifacts, and validation messages.
4. Switch to the Specs view when you want a capability-level overview.
5. Run validation from the toolbar to refresh OpenSpec health, then open artifacts in your editor when you need to inspect or change source files.

### Checks

```sh
npm run check
npm run test
cd src-tauri && cargo check
```

### Build

Build the frontend:

```sh
npm run build
```

Build the desktop app bundle:

```sh
npm run tauri:build
```
