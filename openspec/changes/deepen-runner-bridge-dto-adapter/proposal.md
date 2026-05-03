## Why

Studio Runner Session owns operational runner workflow, but it also contains bridge DTO shapes and compatibility normalization for runner status and stream events. That makes the session module broader than its interface requires and puts bridge-shape complexity next to lifecycle and dispatch coordination.

## What Changes

- Extract Runner bridge DTO types and normalization helpers into a focused Runner Bridge DTO Adapter module.
- Keep `StudioRunnerSession` responsible for workflow coordination while delegating bridge DTO conversion.
- Move DTO normalization tests to the new module interface.
- Preserve runner behavior, Tauri command names, stream event shape, dispatch payload shape, persistence shape, and visible copy.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `studio-runner-session`: clarify that bridge DTO normalization lives behind a Runner Bridge DTO Adapter while Studio Runner Session keeps owning operational workflow.

## Impact

- Affected code: `src/runner/studioRunnerSession.ts`, a new `src/runner/studioRunnerBridgeDto.ts`, and matching tests.
- No public user-facing behavior, data schema, external dependency, generated file, or deployment/runtime configuration changes are intended.
