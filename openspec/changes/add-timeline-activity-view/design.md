## Decisions

- Build activity events from file modification times first.
- Add git history as optional enrichment when available.
- Treat validation runs and archive state as event sources.

## Risks

- File modification times are imperfect.
- Git history may be unavailable or expensive in large repos.
