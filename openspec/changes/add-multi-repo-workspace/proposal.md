## Why

OpenSpec work often spans multiple local repositories. Studio should eventually summarize several repos without merging their source-of-truth files or confusing command execution roots.

## What Changes

- Add a local multi-repo workspace dashboard.
- Let users add and remove local OpenSpec repositories from a workspace.
- Summarize active changes, validation health, stale state, and archive readiness per repo and across the workspace.

## Impact

- App-local workspace preferences for repo lists only.
- Indexing model expands from one selected repo to multiple independent repos.
