# Tasks

## 1. Transition Design
- [ ] 1.1 Inventory current single-change and batch archive result handling in `src/App.tsx`.
- [ ] 1.2 Define the Archive Operation Flow Module transition intent without moving provider IO or persistence side effects into the module.

## 2. Tests
- [ ] 2.1 Add tests for unsupported, stale, validation-blocked, partial, and success archive result transitions.
- [ ] 2.2 Add tests that distinguish single-change and batch archive transition details.

## 3. Implementation
- [ ] 3.1 Add `src/domain/archiveOperationFlow.ts`.
- [ ] 3.2 Rewire `App.tsx` archive handlers to apply transition intents from the new module.
- [ ] 3.3 Preserve archive validation guardrails, provider result contracts, validation snapshot persistence shape, and visible archive behavior.

## 4. Validation
- [ ] 4.1 Run focused archive operation flow and provider/archive tests.
- [ ] 4.2 Run `npm test`.
- [ ] 4.3 Run `npm run check`.
- [ ] 4.4 Run `npm run lint`.
- [ ] 4.5 Run `openspec validate deepen-archive-operation-flow --strict`.
