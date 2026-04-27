## Context

OpenSpec Studio has reached a functional read-only desktop viewer: it indexes local OpenSpec files, runs validation, shows change/spec tables, and provides detail inspectors. Two UAT passes found that the product is accurate enough to trust, but still not ergonomic enough for repeated desktop use.

The most important failure is repository onboarding. The primary flow asks users to type an absolute filesystem path, and an invalid path replaces the current workspace with a full error state. The app also exposes internal OpenSpec and CLI language before it helps users recover or understand what can be trusted.

The second class of failures is interaction and layout quality. Tables are generally usable, but filters can leave the inspector showing hidden selections, the specs inspector is sparse, side-panel gutters and scroll behavior feel cramped, and some labels/repeated states make the tool feel unfinished.

## Goals / Non-Goals

**Goals:**

- Make opening a repository feel like a native desktop workflow.
- Preserve the last valid workspace when a new repository attempt fails.
- Make launch, empty, loading, invalid-path, no-workspace, validation, and stale states actionable.
- Keep visible table rows, selected records, and inspector content synchronized.
- Normalize button labels, control sizes, gutters, scroll behavior, and type hierarchy across sidebars, tables, inspectors, tabs, and the status band.
- Make specs browsing feel like progressive drill-down rather than a thin metadata receipt.
- Remove redundant and placeholder-feeling UI copy from primary surfaces.

**Non-Goals:**

- Do not add editing, artifact authoring, multi-repo dashboards, dependency graphs, timelines, or cross-repo search.
- Do not change OpenSpec file formats or CLI behavior.
- Do not introduce a database or app-owned canonical source of truth.
- Do not hide validation or command failures; make them clearer and easier to recover from.

## Decisions

### 1. Use native folder selection as the primary repository-open action

The left sidebar should lead with a `Choose folder` button that opens a native directory picker. Manual path entry can remain behind an advanced disclosure or secondary control for power users and testing.

Alternative considered: keep the text input and add a smaller Browse button. That still makes path typing feel like the primary workflow. A desktop app should make the system picker the obvious path.

### 2. Treat repository opening as a tentative operation until it succeeds

Opening a repository should not immediately discard the current workspace. The app should validate/index the candidate folder first, then promote it to the active repository only after success or an intentional no-workspace state. If the candidate path is missing or inaccessible, the previous valid workspace remains visible and the sidebar shows inline error recovery.

Alternative considered: preserve the current full-screen error state and improve its copy. That helps recovery but still punishes a bad path by removing useful context.

### 3. Make recent repositories a switcher, not an afterthought

Recent repositories should show the current repo and other recent repos in one list. The current repo should be visibly selected. Failed candidate paths should not be persisted. On launch, the app should restore the last successful repo when possible, otherwise show a choose-folder empty state.

### 4. Define trust states in user-facing language

Validation display should distinguish:

- never run for this snapshot
- running
- clean
- failed with linked issues
- command/parse failure
- stale because local files changed

Attention counts should be unknown when validation has not run or cannot be trusted. Refresh should be described as re-indexing local files; validation should be described as running OpenSpec validation.

### 5. Synchronize filters and selection

When search, phase tabs, or view switches hide the selected change/spec, the app should either auto-select the first visible record or show a neutral empty inspector. It should not keep primary actions attached to a hidden item unless the user intentionally pins that item in a future feature.

### 6. Use a consistent inspector layout system

Inspector headers, tabs, body content, and scroll containers should share one horizontal gutter system. Scrollbars need a stable gutter and enough right padding that content does not feel pressed against the window edge. The status band should remain chrome, not compete with detail content.

### 7. Make specs drill-down richer and less placeholder-driven

The specs table should remain overview-first. Selecting a spec should reveal a structured inspector with identity, health/trust, source path actions, requirement count, summary quality, validation links, and a requirements preview when content is available. Placeholder summaries such as archived `TBD` text should be treated as missing summary content, not featured as product copy.

## Risks / Trade-offs

- **Native folder picker requires Tauri dialog integration** -> Keep manual path entry as a fallback and test both native and fallback paths.
- **Preserving the old workspace during failed opens can make state feel split** -> Make candidate errors visually scoped to the sidebar/open flow and keep the active repo label unchanged.
- **Auto-selecting visible rows may surprise users who expected hidden selection to remain active** -> Prefer auto-selection because the app does not yet have a pinning model; keep search/phase transitions predictable.
- **Copy improvements can obscure precise CLI details** -> Keep technical diagnostics available in details while using plain language in primary labels.
- **Layout polish can regress constrained widths** -> Add responsive checks for desktop and narrow widths, especially table columns, inspector tabs, and status band.

## Migration Plan

1. Add native folder-pick command/wiring and keep manual path entry as secondary.
2. Refactor repository-open state into active repository, candidate repository, and candidate error.
3. Update recent repository persistence to store only successful local repository roots and current selection.
4. Normalize validation display labels and attention semantics.
5. Fix selection synchronization for phase/search/view changes.
6. Rework inspector/layout CSS and component structure.
7. Verify with unit tests, Tauri build, and Computer Use UAT across happy path, invalid path, no-workspace path, specs, changes, search, and phase filters.

## Open Questions

- Should manual path entry be visible by default for the first internal builds, or hidden behind an advanced disclosure immediately?
- Should `Open artifact` open in the default handler or reveal in Finder by default, with the other action exposed secondarily?
