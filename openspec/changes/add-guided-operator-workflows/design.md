## Decisions

- Keep every operation backed by OpenSpec CLI behavior.
- Require explicit user confirmation before write operations.
- Show pending filesystem changes before finalizing apply/archive-style flows.

## Risks

- Guided flows can become a second workflow language if they invent app-only state.
- Write operations need stronger safety checks than read-mostly views.
