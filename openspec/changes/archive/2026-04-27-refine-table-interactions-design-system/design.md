## Context

OpenSpec Studio is now usable as a local-first desktop viewer, but much of its visual system still lives as one-off CSS values in component selectors. The UI also mixes two selection patterns: rows look selectable, but only the title button actually selects a change or spec. Specs have a richer metadata panel than before, but they no longer show the source text with the same readable preview used by proposal and design artifacts.

This change is intentionally incremental. The app does not need a component library or build-time design-token package yet; it needs a stable token layer and shared CSS primitives inside the current React/Tauri codebase.

## Goals / Non-Goals

**Goals:**

- Make table rows behave like the obvious click target.
- Simplify table status cells by removing redundant subtext below pill badges.
- Render selected spec source text in the side panel using the same document preview treatment as proposals and designs.
- Reduce button text sizes consistently across app controls.
- Introduce a practical design-token layer for colors, typography, spacing, borders, radii, shadows, and control sizes.
- Add archive-ready phase actions that can archive one change or all archive-ready changes from the table.
- Validate the resulting product feel with Computer Use UAT.

**Non-Goals:**

- Do not introduce a third-party design system, CSS-in-JS library, or token build pipeline.
- Do not redesign the entire information architecture.
- Do not add spec editing or new OpenSpec authoring features.
- Do not change derived-data rules or OpenSpec file formats.
- Do not add broad shell execution for workflow commands.

## Decisions

### 1. Use CSS custom properties as the design-token system

Define semantic and primitive tokens in `:root`, then migrate visible app CSS to use those variables. This gives the product a single source for color, type, spacing, radius, shadow, and control sizing without adding dependencies.

Alternative considered: add a JS/TS token module. That would help if tokens were consumed by canvas or runtime layout code, but today the styling surface is CSS-first.

### 2. Make table rows responsible for selection

Rows will receive `tabIndex`, `role="button"`, `aria-selected`, click handlers, and Enter/Space keyboard handling. The existing title button will become non-interactive title content to avoid nested interactive controls and awkward event propagation.

Alternative considered: stretch a button over the full row. That complicates table semantics and focus behavior more than direct row activation.

### 3. Keep table cells scan-only

Status/trust cells will show only the pill badge in tables. Secondary context belongs in inspectors, status bands, or detail sections after selection.

### 4. Show spec source as the primary drill-down body

The spec inspector should retain identity, health, path, and file action controls, then display the spec markdown preview. Metadata and validation details can remain below, but the source text becomes the main side-panel content.

### 5. Add a restricted archive bridge command

Archive buttons will call a dedicated Tauri command that runs `openspec archive <change> --yes` from the active repository and then refreshes indexed files. The bridge should validate the repository first, reject empty or path-like change names, and not expose arbitrary shell execution. `Archive all` should execute the same command sequentially for the currently archive-ready changes so failures can stop with a clear message.

Alternative considered: allow `archive` through the generic OpenSpec command bridge. A dedicated command is safer because archive is write-capable and needs narrower argument validation than read/status/validate commands.

## Risks / Trade-offs

- Row-level keyboard behavior can conflict with nested buttons -> Remove nested title buttons from table rows and keep row activation on the row.
- CSS token migration can create a large diff -> Keep migration scoped to the app stylesheet and avoid unrelated visual redesign.
- Spec previews can make the panel long -> Use the existing inspector scroll container and markdown preview constraints.
- Smaller button type can reduce readability -> Keep control height and hit area stable while reducing text size only.
- Archive actions move local files -> Restrict commands to active archive-ready changes and refresh the workspace after each successful archive run.
