## Why

OpenSpec Studio already runs validation and archive flows from the app. The next workflow layer should add guided propose/apply flows and enhance existing archive/validation flows with clearer confirmation, diagnostics, and previews where their behavior changes, without replacing the OpenSpec CLI or hiding file changes.

## What Changes

- Add guided CLI-backed workflows for propose and apply.
- Build on existing archive and validation flows instead of reimplementing them from scratch.
- Preview generated or modified artifacts before writes are accepted.
- Preserve OpenSpec files and CLI output as the source of truth.

## Impact

- React workflow surfaces in `src/App.tsx` or extracted UI modules.
- Tauri command bridge additions for narrowly allowed OpenSpec operations.
- No app-private workflow format.
