## Why

The change inspector currently repeats runner, phase, trust, path, and file-opening controls in a way that makes the selected change feel noisy. Runner status is repository-level context, so it belongs near the workspace view switcher rather than inside every selected change inspector.

## What Changes

- Move the compact Studio Runner status pill into the workspace header, immediately before the Changes / Specs / Runner selector.
- Simplify the change inspector header to show the selected change title and a single Build with agent action.
- Remove change inspector metadata that is already represented elsewhere, including phase label, source path, Open proposal/file action, change trust pill, runner status copy, blocker list, retry action, and dispatch history.

## Impact

- Affected specs: change-board, local-desktop-shell
- Affected code: React workspace header, change inspector header, runner action panel styles
