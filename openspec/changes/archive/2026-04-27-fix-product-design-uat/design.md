## Context

OpenSpec Studio is moving from a functional prototype toward a credible local desktop product. The current app has the major surfaces in place: repository rail, change/spec board, inspector, validation status, artifact previews, and task drill-down. The design review found that the product feels rough not because of missing features, but because the same information appears in too many places, persistent UI can scroll unexpectedly, controls are not governed by a consistent scale, and status semantics are visually noisy.

This pass should make the existing app feel like a calm operational tool: stable navigation, predictable controls, readable hierarchy, clear status ownership, and one home for each fact.

## Goals / Non-Goals

**Goals:**

- Resolve the complete 30-finding product design and UAT review.
- Stabilize desktop shell layout so navigation, headers, tabs, and status bars do not get pushed by content.
- Create a small practical component/token system for buttons, inputs, tabs, badges, tables, disclosures, empty states, and focus states.
- Reduce duplicated information across the rail, board, inspector, and footer.
- Improve scanability without adding marketing-style decoration or new workflows.
- Verify with live app review across normal desktop and constrained widths.

**Non-Goals:**

- Do not add updater behavior, editing flows, multi-repo dashboards, timeline views, or new OpenSpec operations.
- Do not change OpenSpec data semantics; `fix-derived-data-accuracy` owns data correctness.
- Do not redesign the brand or introduce decorative visual assets.
- Do not hide useful context purely for minimalism; remove repetition only when the same fact has no distinct job.

## Decisions

### 1. Use fixed application regions with local scrolling

The desktop shell should have stable regions:

- left repo rail
- main workspace header
- board toolbar
- board content
- inspector header
- inspector tabs
- inspector body
- footer/system status

Only board content, long inspector bodies, and long previews/lists should scroll. Persistent navigation, tabs, headers, and footer status should not become scroll containers under normal desktop widths.

### 2. Define a small control scale

Controls should use a compact set of sizes and states:

- toolbar buttons
- compact row buttons
- tabs/segmented controls
- text inputs/search
- full-width contextual actions

Primary treatment should be rare. Secondary and outline treatments should be visually quieter and consistent. Focus, hover, selected, disabled, and loading states should be visible without changing layout.

### 3. Make every fact have one home

Each fact should appear fully in one place. Other surfaces may show compact references or aggregates only when they serve a different task.

Examples:

- current repository identity belongs in the main header
- repo switching belongs in the rail
- global validation state belongs in the footer/status area
- change-specific health belongs on the row and detail diagnostics only when tied to change-specific evidence
- proposal body belongs in the Proposal tab, not duplicated in the inspector header

### 4. Keep the board scannable and the inspector explanatory

The board is for comparison and triage. The inspector is for drill-down. The same field should not be equally loud in both places. Board rows should show compact status/progress/capability signals; inspector sections should explain the selected item with richer context and grouped detail.

### 5. Treat empty and no-result states as product states

Empty states should say what source was checked and what the user can do next. They should not rely on decorative icons or leave large blank areas without context.

## 30 UAT Findings

### Layout and Scroll Ownership

1. **Global scroll area owns too much of the app.** The desktop app appears as one large scroll area, which makes persistent regions feel unstable.
2. **Inspector body, markdown preview, task list, and tab row can create competing scroll behavior.** These need explicit boundaries so scrolling feels intentional.
3. **Tabs are allowed to horizontally scroll at normal desktop widths.** Detail tabs should fit predictably or use a deliberate overflow pattern later.
4. **The center board has excessive blank canvas while the inspector is cramped.** The current grid gives too much space to empty table area and not enough to dense detail.
5. **Left rail is too prominent for mostly static metadata.** The rail should focus on repo switching and app context, not persistent instruction text.
6. **Specs empty state leaves an under-informative blank workspace.** It should clarify that `openspec/specs/` was checked and no base specs exist.
7. **Footer status band is visually underpowered for important system state.** It should read as a stable status bar with severity, result, and timestamp.

### Controls and Interaction States

8. **Button sizes are inconsistent.** Primary, outline, segmented, tab, and row buttons use several heights without a clear scale.
9. **Button hierarchy is muddled.** `Run validation`, `Refresh validation`, `Open artifact`, and row `Open` actions compete instead of following context.
10. **Focus states are visually heavy and inconsistent.** Search fields, segmented controls, and tabs need one standard focus treatment.
11. **Search lacks a clear/reset affordance.** No-results recovery is slower than it should be.
12. **Selected row state is too subtle.** The inspector depends on row selection, so the selected row needs stronger but still calm emphasis.

### Typography, Labels, and Status Language

13. **Too many near-neighbor font sizes are in use.** The UI needs a tighter type scale for labels, body, strong body, section titles, and page titles.
14. **Table headers feel overly loud.** Uppercase, high-weight labels add noise to an otherwise quiet operational surface.
15. **Status vocabulary mixes different meanings.** `Invalid`, `Active`, `Validation failed`, `Not run`, `OpenSpec workspace`, and `present` need a consistent taxonomy.
16. **Red status dominates when evidence is unclear.** Red should mean a specific actionable failure, not unknown, stale, or command-failed state.
17. **Long paths and technical strings are treated inconsistently.** Paths need predictable monospace, truncation/wrap, and placement rules.

### Component and Content Polish

18. **Nested cards make the inspector feel busy.** Sections inside cards inside panels create too many borders.
19. **Task list is readable but loses structure.** Remaining tasks should preserve headings or grouping from `tasks.md` rather than flattening everything.
20. **Progress visuals mix completion and health semantics.** Progress bars should communicate task completion only; health belongs elsewhere.
21. **Artifact rows repeat availability too heavily.** `Found on disk`, path, `present`, and `Open` are more than needed for healthy artifacts.
22. **Empty-state icons feel decorative but not meaningful.** Empty states should rely on concise source/action copy and restrained visuals.
23. **Inspector context can feel stale when filters hide the selected row.** Filtering to no results while retaining a selected inspector needs explicit context.

### Redundancy and Information Architecture

24. **Repository identity is repeated in too many places.** The same repo appears in the path input, selected repo card, recent repos, main header, and footer.
25. **The selected repo appears as a normal recent repo.** The current repo should be hidden from recents or marked differently.
26. **Selected change identity repeats across row and inspector.** Title, slug, and metadata need clear roles rather than repetition.
27. **Proposal summary repeats immediately.** Inspector header summary often duplicates the first paragraph shown again in the Proposal tab.
28. **Validation action appears with different labels.** `Run validation` and `Refresh validation` are the same action but read as separate concepts.
29. **Task progress repeats without adding value.** The Tasks tab repeats the row metric before showing the detail; it should lead with grouped work or combine metric into the section header.
30. **Data hierarchy rail text repeats the visible layout.** Static explanation should be removed, reduced, or turned into an actual breadcrumb/status control.

## Risks / Trade-offs

- **Polish can accidentally become a redesign.** Keep changes scoped to existing surfaces and measurable UAT findings.
- **Removing duplicated text can remove useful orientation.** Preserve compact metadata where it has a distinct job, but avoid repeating full paths, summaries, and statuses.
- **Tighter scrolling can create hidden overflow bugs.** Verify with real content, long task lists, long paths, empty states, and narrower windows.
- **Status taxonomy overlaps with data accuracy work.** Coordinate with `fix-derived-data-accuracy`; this change owns presentation and vocabulary, while that change owns underlying truth.
