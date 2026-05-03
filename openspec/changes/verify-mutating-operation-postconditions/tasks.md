# Tasks

- [x] 1. Define a shared mutating-operation result shape that separates command outcome from postcondition outcome.
- [x] 2. Update the archive bridge path to classify zero-exit/no-op output as failed or postcondition-failed.
- [x] 3. After archive execution, re-index the repository from disk and verify the active change is gone before showing success.
- [x] 4. Verify an archived record exists before switching selection or showing archived-change details.
- [x] 5. Record an operation issue when the command succeeds but the postcondition is missing, including stdout/stderr/status and missing evidence.
- [x] 6. Add unit tests for zero-exit/no-op archive output.
- [x] 7. Add app/model tests for archive postcondition failure and verified archive success.
- [x] 8. Audit existing mutating bridge operations and document which ones require explicit postconditions next.
- [x] 9. Run `npm run check`, relevant JS tests, Rust bridge tests, `npm run build`, and `openspec validate verify-mutating-operation-postconditions`.
- [x] 10. Keep verbose mutating-operation diagnostics out of the footer when an OpenSpec issue badge is already shown.
