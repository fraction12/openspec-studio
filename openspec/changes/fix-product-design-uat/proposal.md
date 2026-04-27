## Why

OpenSpec Studio's current interface exposes the right raw areas, but the live design review found enough layout, scrolling, control, typography, status, and redundancy issues that the app still feels like a prototype. Before adding more features, the existing product surface needs a UAT-quality polish pass so the tool feels deliberate, calm, and trustworthy.

This change captures the complete 30-finding product design review as a focused implementation contract.

## What Changes

- Fix desktop shell layout so persistent navigation, headers, tabs, and footers stay stable while only intended content regions scroll.
- Normalize button, tab, input, badge, table, empty-state, and disclosure styles into a small set of reusable visual states.
- Tighten typography, labels, spacing, row density, selected states, and inspector hierarchy.
- Reduce repeated information so each repo, change, status, task, artifact, and validation fact has one clear home on the screen.
- Improve UAT flows for search/no-results, empty specs, selected rows, inspector context, status diagnostics, and task/detail drill-down.
- Preserve the product direction: operational desktop tool, progressive disclosure, no decorative noise, no new product features in this pass.

## Capabilities

### New Capabilities
- `product-design-uat`: design-quality acceptance criteria for the existing OpenSpec Studio desktop surface, covering layout stability, component consistency, visual hierarchy, status clarity, and non-redundant information architecture.

### Modified Capabilities

None. This is a product design and UAT polish pass over the current app surface rather than a new workflow capability.

## Impact

- React components and view model presentation in `src/App.tsx`.
- CSS design system/tokens and responsive layout in `src/App.css`.
- Possible small UI helper components for consistent controls, status badges, empty states, task groups, and metadata rows.
- Browser/desktop visual verification with Computer Use or browser automation.
- No OpenSpec data-model changes and no new app features beyond polishing existing views.
