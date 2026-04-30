# Tasks

- [ ] 1. Define a shared mutating-operation result shape that separates command outcome from postcondition outcome.
- [ ] 2. Update the archive bridge path to classify zero-exit/no-op output as failed or postcondition-failed.
- [ ] 3. After archive execution, re-index the repository from disk and verify the active change is gone before showing success.
- [ ] 4. Verify an archived record exists before switching selection or showing archived-change details.
- [ ] 5. Record an operation issue when the command succeeds but the postcondition is missing, including stdout/stderr/status and missing evidence.
- [ ] 6. Add unit tests for zero-exit/no-op archive output.
- [ ] 7. Add app/model tests for archive postcondition failure and verified archive success.
- [ ] 8. Audit existing mutating bridge operations and document which ones require explicit postconditions next.
- [ ] 9. Run `npm run check`, relevant JS tests, Rust bridge tests, `npm run build`, and `openspec validate verify-mutating-operation-postconditions`.
