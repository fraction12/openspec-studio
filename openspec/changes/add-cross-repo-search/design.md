## Decisions

- Start with local in-memory search over indexed markdown and validation messages.
- Scope result rows by repository, change/spec, artifact type, and matched text.
- Keep search rebuildable from disk.

## Risks

- Large repositories may need incremental indexing later.
- Search snippets can become misleading if not tied to file paths.
