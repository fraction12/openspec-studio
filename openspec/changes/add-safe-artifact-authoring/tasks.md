## 1. Editing Model

- [ ] Define editable artifact types and file-boundary rules.
- [ ] Add explicit save/cancel behavior and dirty-state handling.
- [ ] Add stale-base conflict detection that preserves unsaved edits when the file changed externally.
- [ ] Reject path traversal or artifact-boundary writes before touching disk.

## 2. Authoring UI

- [ ] Add markdown editing with preview.
- [ ] Add task checkbox updates for `tasks.md`.
- [ ] Preserve external editor actions.

## 3. Verification

- [ ] Test write boundaries under `openspec/`.
- [ ] Test stale-base conflicts, canceled edits, and write failures.
- [ ] Verify refresh and validation state after writes.
