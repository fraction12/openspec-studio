# Frontend Shell Review

## Scope
Reviewed `src/App.tsx`, `src/App.css`, `src/main.tsx`, `index.html`, and `public/*` for frontend shell and interaction-layer issues.

## Summary
- `P0`: 0
- `P1`: 1
- `P2`: 5
- `P3`: 1

## Findings

### Archive actions can be submitted multiple times while an archive is already running

- `Severity`: P1
- `Area`: Change board archive interactions
- `File`: `src/App.tsx`
- `Lines`: 666-704, 1294-1306, 1401-1443
- `Problem`: `archiveChange` and `archiveAllChanges` set `loadState` to `"loading"`, but `ChangeBoard` does not receive that state and the row-level `Archive` and bulk `Archive all` buttons remain enabled. The archive handlers also have no single-flight guard, so a double-click or repeated keyboard activation can start concurrent archive commands for the same change names.
- `Why it matters`: Archiving mutates the OpenSpec tree. A duplicate invocation can race with the first command after files have already moved, leaving the user with a command failure, stale selection/message state, or partially refreshed archive workflow.
- `Reproduction or evidence`: Put the board in `Archive ready`, double-click `Archive all`, or activate a row `Archive` button twice before the first command completes. Both handlers can enter because lines 680-704 only check repo/runtime/name count, while lines 1401-1443 expose enabled buttons throughout the loading state.
- `Recommended fix`: Add an archive-specific in-flight guard and pass disabled/busy state into `ChangeBoard`. Disable row and bulk archive actions while archiving, and ignore duplicate submissions in the handlers before invoking Tauri commands.

### Tauri menu listener can leak across input/repo changes

- `Severity`: P2
- `Area`: Desktop menu event handling
- `File`: `src/App.tsx`
- `Lines`: 297-311
- `Problem`: The `open-repository-menu` listener effect depends on `repo?.path` and `repoPathInput`, so typing in the manual path input or changing repos re-registers the listener. Because `listen(...).then(...)` is asynchronous, cleanup can run before `unlisten` is assigned, leaving the old listener registered.
- `Why it matters`: Over time, the native menu action can call `chooseRepositoryFolder` multiple times for a single menu activation, producing duplicate folder pickers or repeated load attempts. This is especially easy to trigger by typing a path, because every keystroke changes `repoPathInput`.
- `Reproduction or evidence`: In the Tauri runtime, type several characters into the manual path field, then invoke the app menu item that emits `open-repository-menu`. The effect has been recreated for each input change, and any listener promise that resolved after cleanup has no matching `unlisten` call.
- `Recommended fix`: Register this listener once with an empty dependency list, or use a cancellation flag/ref so the promise calls `nextUnlisten()` immediately if cleanup already happened.

### Bulk archive has no confirmation before mutating many changes

- `Severity`: P2
- `Area`: Bulk archive safety
- `File`: `src/App.tsx`
- `Lines`: 680-704, 1436-1443
- `Problem`: `Archive all` immediately archives every currently filtered archive-ready change with no confirmation, preview of names, or undo affordance.
- `Why it matters`: A single accidental click can move many change directories into the archive. Because the affected set is driven by the current search/filter, the user may not realize exactly which changes will be mutated.
- `Reproduction or evidence`: Open the `Archive ready` phase with more than one matching change and click `Archive all`. Lines 1436-1443 call `onArchiveAll(filteredChanges.map(...))` directly, and lines 699-703 archive each name sequentially.
- `Recommended fix`: Add a confirmation step that shows the count and names to be archived, and require explicit confirmation before invoking `archiveAllChanges`.

### Column resize handle is focusable but mouse-only

- `Severity`: P2
- `Area`: Table keyboard accessibility
- `File`: `src/App.tsx`
- `Lines`: 1617-1663, 1694-1709
- `Problem`: The resize handle is rendered as a focusable `<button>` with an aria label, but the only implemented interactions are `onMouseDown` drag and `onDoubleClick` reset. Keyboard activation, arrow keys, Home/End, and Enter/Space do not resize or reset.
- `Why it matters`: Keyboard and assistive-technology users can reach a control that appears operable but cannot use it. This is a WCAG keyboard accessibility failure for a visible table control.
- `Reproduction or evidence`: Tab to the `Resize change column` or `Resize spec column` button and press Enter, Space, or arrow keys. No handler changes the width unless a mouse event occurs.
- `Recommended fix`: Implement keyboard support using an appropriate pattern, such as `role="separator"` or slider semantics with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and arrow/Home/End handlers. Keep double-click reset as a mouse convenience, not the only reset path.

### Selectable table rows use button semantics that conflict with table selection

- `Severity`: P2
- `Area`: Board table semantics and keyboard navigation
- `File`: `src/App.tsx`
- `Lines`: 1665-1730
- `Problem`: Each `<tr>` is given `role="button"`, `tabIndex={0}`, and `aria-selected`, but the surrounding table is still a native table. `aria-selected` is not meaningful on a button role, and keyboard users must tab through every row instead of using table/grid navigation.
- `Why it matters`: Screen readers can lose useful row/column semantics or fail to announce selected state consistently. Large workspaces also become tedious to navigate because every rendered row becomes a tab stop.
- `Reproduction or evidence`: Load a board with many changes/specs and navigate by keyboard or screen reader. Focus lands on each row as a button, Enter/Space selects it, but arrow-key row navigation and selected-row semantics are not implemented.
- `Recommended fix`: Either keep native table semantics and put an actual button/link in the first cell for selection, or convert the board to an ARIA grid/listbox pattern with row roles, valid `aria-selected`, roving tabindex, and arrow-key navigation.

### Tablists do not implement the ARIA tab interaction pattern

- `Severity`: P2
- `Area`: Workspace and inspector tab controls
- `File`: `src/App.tsx`
- `Lines`: 1265-1283, 1863-1875
- `Problem`: The workspace view switcher and artifact tabs use `role="tablist"`/`role="tab"` but do not provide associated `tabpanel` elements, `aria-controls`, roving `tabIndex`, or arrow-key/Home/End navigation.
- `Why it matters`: Assistive technologies expect tab widgets to expose a complete tab/tabpanel relationship and keyboard model. Without it, these controls are announced as tabs but behave like ordinary buttons.
- `Reproduction or evidence`: Focus the `Changes`/`Specs` tablist or artifact tabs and press Left/Right arrow keys. Focus does not move between tabs, and no panel is associated with the active tab.
- `Recommended fix`: Implement the full ARIA tab pattern, or remove the tab roles and expose these as segmented buttons if button behavior is the intended interaction.

### Search text leaks between Changes and Specs views

- `Severity`: P3
- `Area`: Search/filter state
- `File`: `src/App.tsx`
- `Lines`: 258-260, 1294-1315, 1501-1503
- `Problem`: A single `query` state is shared by both the Changes board and Specs browser. A search term entered for one view is silently applied to the other view after switching.
- `Why it matters`: Users can switch views and see an empty board even though the placeholder and context changed from "Search changes" to "Search specs". This looks like missing data rather than a carried-over filter.
- `Reproduction or evidence`: Search for a change name that is not part of any spec capability/summary, then switch to `Specs`. `SpecsBrowser` filters with the same query at lines 1501-1503 and shows `No matching specs`.
- `Recommended fix`: Keep separate search state per board view, or clear/confirm the query when switching between `changes` and `specs`.

## No Issues Found
- `src/main.tsx`: No frontend shell issues found; it only mounts `App` into the known `#root` element supplied by `index.html`.
- `index.html`: No issues found for this scope.
- `public/openspec-studio-logo.svg`: No UI-impacting issues found.
- `public/vite.svg` and `public/tauri.svg`: No UI-impacting issues found; they appear to be unused template assets in this frontend shell.

## Verification
- Ran `npm run check`; TypeScript completed successfully.
