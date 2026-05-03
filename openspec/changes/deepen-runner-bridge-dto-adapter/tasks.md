# Tasks

## 1. Runner Bridge DTO Adapter
- [x] 1.1 Extract Runner status and stream event DTO types into `src/runner/studioRunnerBridgeDto.ts`.
- [x] 1.2 Move runner status and stream event normalization helpers behind the new adapter module.
- [x] 1.3 Update `StudioRunnerSession` and app shell imports to use the adapter without changing runner workflow behavior.

## 2. Tests
- [x] 2.1 Move or add focused tests for status DTO ownership, endpoint, and lifecycle normalization.
- [x] 2.2 Move or add focused tests for stream event identity, workspace, publication, cleanup, execution-log, message, and error normalization.

## 3. Validation
- [x] 3.1 Run focused runner bridge DTO and session tests.
- [x] 3.2 Run `npm test`.
- [x] 3.3 Run `npm run check`.
- [x] 3.4 Run `npm run lint`.
- [x] 3.5 Run `openspec validate deepen-runner-bridge-dto-adapter --strict`.
