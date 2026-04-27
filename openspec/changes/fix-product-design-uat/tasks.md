## 1. Layout and scroll ownership

- [x] 1.1 Refactor the desktop shell so rail, workspace header, board toolbar, inspector header, inspector tabs, and footer remain fixed within their regions.
- [x] 1.2 Limit scrolling to board content, inspector body content, long previews, and long lists.
- [x] 1.3 Remove accidental horizontal scrolling from detail tabs and navigation at normal desktop widths.
- [x] 1.4 Rebalance main board and inspector widths so dense detail does not feel cramped next to empty table canvas.
- [x] 1.5 Replace or remove the static Data hierarchy rail section with a non-redundant breadcrumb/status pattern.

## 2. Component system polish

- [x] 2.1 Define standard size tokens for toolbar buttons, compact row buttons, tabs, segmented controls, search inputs, and full-width contextual actions.
- [x] 2.2 Normalize hover, focus, selected, loading, and disabled states across buttons, tabs, inputs, badges, disclosures, and table rows.
- [x] 2.3 Add a clear/reset affordance and improved no-results copy for search fields.
- [x] 2.4 Tighten the typography scale and reduce near-duplicate font sizes and weights.
- [x] 2.5 Make table headers, empty states, section headings, and metadata labels quieter and more consistent.

## 3. Status and hierarchy cleanup

- [x] 3.1 Define and apply a status vocabulary for global validation, per-change health, artifact state, task progress, and repository state.
- [x] 3.2 Keep red/invalid treatments reserved for specific actionable failures.
- [x] 3.3 Separate task progress visuals from health/status visuals.
- [x] 3.4 Strengthen selected row state so inspector context is unambiguous.
- [x] 3.5 Improve footer/status-band presentation for repository validation state, command result, stale state, and last activity.

## 4. Inspector and detail refinement

- [x] 4.1 Flatten nested inspector card/disclosure styling so detail panes feel structured without excess borders.
- [x] 4.2 Preserve useful task grouping from `tasks.md` and prioritize remaining tasks over completed history.
- [x] 4.3 Simplify artifact rows so healthy artifacts do not repeat `Found on disk`, `present`, path, and action with equal emphasis.
- [x] 4.4 Make empty spec, no-change, no-results, and no-selection states explain the checked source and next useful action.
- [x] 4.5 Make filtered-out selected content explicit so inspector state never feels stale.

## 5. Redundancy pass

- [x] 5.1 Make the workspace header the primary home for current repository identity.
- [x] 5.2 Hide or visually distinguish the selected repository in recent repos.
- [x] 5.3 Remove repeated selected-change identity from the inspector while preserving useful slug/path metadata.
- [x] 5.4 Avoid duplicating proposal summary text in both the inspector header and Proposal tab.
- [x] 5.5 Use one validation action label and state model wherever validation is triggered.
- [x] 5.6 Avoid repeating task progress, artifact availability, and validation messages unless the second location adds new detail.

## 6. Verification

- [x] 6.1 Run existing TypeScript and Rust checks affected by UI/view model changes.
- [x] 6.2 Run `openspec validate fix-product-design-uat --strict`.
- [x] 6.3 Verify the live app with Computer Use at the default desktop window size.
- [x] 6.4 Verify constrained desktop widths for stable navigation, non-overlapping text, predictable controls, and no accidental tab/nav scrolling.
- [x] 6.5 Confirm all 30 UAT findings in `design.md` are either fixed or explicitly deferred with rationale before completing the change.
