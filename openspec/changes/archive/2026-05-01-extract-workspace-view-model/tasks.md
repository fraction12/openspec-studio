## 1. Module Extraction

- [x] 1.1 Add Workspace View-Model vocabulary to `CONTEXT.md`.
- [x] 1.2 Create a dedicated Workspace View-Model module exporting the existing workspace projection interface and record types.
- [x] 1.3 Update `App.tsx` to import the projection module and remove duplicated projection helpers from the app shell.

## 2. Tests And Verification

- [x] 2.1 Update existing view-model tests to import projection behavior from the new module instead of the app shell.
- [x] 2.2 Run targeted tests for archived change/view-model behavior.
- [x] 2.3 Run `npm test`, `npm run check`, and `openspec validate extract-workspace-view-model --strict`.
