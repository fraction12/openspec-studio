## Decisions

- Keep every operation backed by OpenSpec CLI behavior.
- Require explicit user confirmation before write operations.
- Show pending filesystem changes before finalizing propose/apply-style flows.
- Treat archive and validation as existing app flows; this change may refine their confirmation, diagnostics, or preview affordances only where the user experience differs from the current baseline.

## Risks

- Guided flows can become a second workflow language if they invent app-only state.
- Write operations need stronger safety checks than read-mostly views.
- Rescoping must avoid duplicating the shipped archive and validation command paths.
