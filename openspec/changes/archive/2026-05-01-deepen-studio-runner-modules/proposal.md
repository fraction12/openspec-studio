## Why

Studio Runner behavior is now substantial enough that the current shallow seams slow down changes: React owns lifecycle transitions, session-secret state, status checks, dispatch persistence, stream events, and log updates, while the native bridge file owns unrelated OpenSpec and Runner implementations in one large module. Deepening these modules improves locality without changing the external app behavior.

## What Changes

- Introduce a frontend Studio Runner Session module that concentrates operational Runner state transitions, command adapters, dispatch attempt persistence, stream updates, and lifecycle log records behind a smaller interface.
- Keep durable Runner defaults and endpoint editing in their existing surfaces; this change only moves operational behavior behind a deeper module.
- Split the native Tauri bridge implementation into shared, local OpenSpec, and Studio Runner submodules while preserving the existing Tauri command names and external seam.
- Keep all visible UI behavior, payload shapes, command names, and persistence formats compatible.
- Add domain vocabulary for Studio Runner Session and Native Bridge Modules.

## Capabilities

### New Capabilities

- `studio-runner-session`: Frontend operational runner orchestration module for session setup, status, lifecycle, dispatch attempts, stream updates, and runner log persistence.
- `native-bridge-modules`: Internal Rust bridge module layout for separating shared bridge errors/command utilities, local OpenSpec operations, and Studio Runner operations behind the unchanged Tauri command seam.

### Modified Capabilities

None.

## Impact

- Affected frontend modules: `src/App.tsx`, app runner model helpers, persistence wiring, and new Runner Session module/tests.
- Affected native modules: `src-tauri/src/bridge.rs` or its replacement module tree, plus `src-tauri/src/lib.rs` command registration imports.
- No new runtime dependencies.
- No intended UI, OpenSpec, Runner payload, persistence, or Tauri command behavior changes.
