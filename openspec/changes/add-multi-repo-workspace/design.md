## Decisions

- Store only workspace membership and UI preferences in app-local state.
- Keep each repository indexed independently.
- Run commands in the correct repo root for every repo-specific action.

## Risks

- Cross-repo summaries can obscure the repo that owns an issue.
- Indexing multiple repos can introduce performance pressure.
