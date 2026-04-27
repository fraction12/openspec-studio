## 1. Visual Foundation

- [x] 1.1 Review the approved visual example and note any final adjustments before touching product code
- [x] 1.2 Update design tokens for OpenSpec-native neutrals, spacing, typography, borders, focus states, status cues, document previews, and code blocks
- [x] 1.3 Replace one-off visual values in app surfaces with the updated tokens where the intent matches

## 2. Workbench Shell And Board

- [x] 2.1 Refine the app shell so repo identity, current path, primary view switcher, and workspace actions feel compact and source-native
- [x] 2.2 Update changes and specs table styling so rows read as navigable OpenSpec artifacts with quiet hover, focus, and selected states
- [x] 2.3 Reduce redundant or dashboard-like summary treatments in board headers, filters, empty states, and row metadata
- [x] 2.4 Remove low-value copy/reveal repository actions from the left rail current source panel
- [x] 2.5 Improve archive-ready table spacing, compact change titles, resizable title column, and concise updated timestamps
- [x] 2.6 Remove the current source summary panel from the left rail
- [x] 2.7 Rebalance the table/inspector layout so default desktop widths avoid horizontal scrolling
- [x] 2.8 Replace fixed title truncation with width-based ellipsis while keeping manual column resizing
- [x] 2.9 Move specs source path metadata out of overview rows and into the inspector only
- [x] 2.10 Preserve table columns on compact widths and use horizontal scrolling instead of responsive column hiding

## 3. Inspector And Artifact Previews

- [x] 3.1 Refine inspector headers so selected item identity, source path, phase, and trust state follow a clear hierarchy
- [x] 3.2 Restyle proposal, design, tasks, spec delta, archive info, and validation previews with readable artifact-first typography
- [x] 3.3 Add code/delta styling that echoes OpenSpec examples while preserving real source text and open-file actions
- [x] 3.4 Replace the footer contents with last validation time, latest OpenSpec change, and uncommitted OpenSpec Git status

## 4. Verification

- [x] 4.1 Run unit tests and app build checks
- [x] 4.2 Run visual UAT across changes, archived changes, specs, empty states, and narrow/wide desktop widths
- [x] 4.3 Confirm no derived-data, validation, archive, or CLI behavior changed
