## Overview

Move bridge DTO types and normalization functions out of `src/runner/studioRunnerSession.ts` into `src/runner/studioRunnerBridgeDto.ts`.

Current shape:

```text
StudioRunnerSession
  workflow: lifecycle/status/dispatch/stream coordination
  adapter policy: RunnerStatusDto, RunnerStreamEventDto, normalization
```

Target shape:

```text
Runner Bridge DTO Adapter
  DTO shapes
  snake_case/camelCase compatibility
  RunnerStatus model derivation
  RunnerStreamEventInput derivation

StudioRunnerSession
  workflow coordination
  calls adapter at bridge seams
```

## Deepening Rationale

- **Module**: Runner Bridge DTO Adapter.
- **Interface**: native bridge DTOs in, internal RunnerStatus / RunnerStreamEventInput models out.
- **Implementation**: compatibility field selection, ownership normalization, status label derivation, and stream metadata preservation.
- **Depth**: callers learn a small conversion interface while bridge compatibility detail stays behind it.
- **Seam**: `src/runner/studioRunnerBridgeDto.ts`.
- **Adapter**: the module is an adapter from native bridge DTO shape to frontend runner models.
- **Leverage**: status checks, stream listeners, and tests share the same normalization policy.
- **Locality**: future bridge field compatibility changes live in one module instead of the runner workflow owner.

Deletion test: deleting this adapter would move DTO shapes, ownership normalization, and snake/camel compatibility parsing back into `StudioRunnerSession` and its tests. The module therefore keeps real bridge policy local.

## Constraints

- Do not change Tauri command names or bridge DTO payload shape.
- Do not change RunnerStatus, Runner Log, dispatch payload, or persistence shapes.
- Do not change visible Runner labels or copy.
- Keep `StudioRunnerSession` as the workflow owner.

## Validation Plan

- Add focused tests for runner status DTO and stream event DTO normalization.
- Run focused runner bridge DTO and session tests.
- Run `npm test`.
- Run `npm run check`.
- Run `npm run lint`.
- Run `openspec validate deepen-runner-bridge-dto-adapter --strict`.
