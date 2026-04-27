## Why

OpenSpec Studio v1 is read-mostly. The next workflow layer should let a user run propose, apply, archive, and validation operations from the app without replacing the OpenSpec CLI or hiding file changes.

## What Changes

- Add guided CLI-backed workflows for propose, apply, archive, and validation.
- Preview generated or modified artifacts before writes are accepted.
- Preserve OpenSpec files and CLI output as the source of truth.

## Impact

- React workflow surfaces in `src/App.tsx` or extracted UI modules.
- Tauri command bridge additions for narrowly allowed OpenSpec operations.
- No app-private workflow format.
