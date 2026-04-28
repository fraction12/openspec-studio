# Improve app performance and smoothness

## Summary
Make OpenSpec Studio feel fast, calm, and resilient as repositories grow by reducing expensive refresh work, bounding CLI/process behavior, preventing stale async state, and polishing layout/scroll interactions.

## Motivation
The current app works, but the audit found several paths that will become visibly rough on larger OpenSpec workspaces:

- Repository load and refresh rebuild full `openspec/` snapshots and read all Markdown content.
- Refresh runs one `openspec status --change ...` process per active change, all at once.
- Rust bridge commands perform blocking filesystem/process work directly and have no timeout or output bound.
- Auto-refresh can overlap with manual refresh, validation, or archive operations.
- React render paths eagerly parse Markdown/task detail and row filtering work.
- CSS layout has breakpoint dead zones, nested scroll traps, and hover states that can shift row geometry.

These issues are not new features; they are product-quality foundations for a desktop workbench that should stay smooth with real repositories and growing archives.

## Scope
- Add cheaper repository change detection and refresh behavior.
- Cache or bound per-change OpenSpec status loading.
- Make bridge command execution and filesystem scanning responsive and bounded.
- Prevent stale refresh/artifact-preview/git-status responses from overwriting newer state.
- Reduce avoidable React recomputation in Markdown previews, task detail, validation issue lookups, search, and resizing.
- Fix layout and scroll jank that affects perceived smoothness.
- Add verification coverage and measurement hooks for the performance-sensitive paths.

## Non-goals
- Add new product views or new OpenSpec authoring features.
- Change OpenSpec as the source of truth.
- Hide existing board columns on compact widths.
- Replace the current design language.
