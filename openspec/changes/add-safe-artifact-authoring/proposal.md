## Why

Studio currently opens artifacts externally. A future authoring layer should support safe in-app editing for proposals, designs, specs, and tasks without becoming a separate document store.

## What Changes

- Add markdown preview and safe artifact editing.
- Support task checkbox updates.
- Write directly to OpenSpec artifact files and refresh derived state after writes.

## Impact

- Write permissions and confirmation states in the Tauri bridge.
- Editor UI for markdown and task checkboxes.
- Strong tests around file boundaries and refresh behavior.
