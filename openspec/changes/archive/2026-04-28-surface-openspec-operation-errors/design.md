## Overview

Add a small in-memory operation error model to the React app. Each OpenSpec-backed operation that fails records a structured issue. The UI displays the latest unresolved issues in a durable status surface and, where there is a clear target, in the related change or artifact context.

This is intentionally lighter than a full operation log. It solves silent or disappearing failures without introducing persistence, filtering, or a separate diagnostics subsystem.

## Operation Issue Model

An operation issue records:

- stable id
- operation kind (`validation`, `archive`, `status`, `artifact-read`, `repository-read`)
- title and user-facing message
- optional repo path and target id/path
- optional status code
- optional stdout and stderr
- ISO timestamp

Issues remain visible until a successful repository reload clears stale operation issues, or until the user dismisses them. Successful validation clears validation issues. Successful archive reload clears archive issues for the archived target. Successful artifact preview clears its artifact-read issue.

## UI Placement

The status band gains a compact OpenSpec issues disclosure when unresolved issues exist. The collapsed surface shows the latest issue and a count. Expanding it shows issue details and raw stdout/stderr when present.

Contextual placement:

- archive failures appear in the selected change inspector/archive readiness section
- validation command failures appear in validation details
- status command failures appear through the existing change health/status messaging
- artifact read failures appear in the preview area

## Error Capture

The existing Tauri bridge already returns command result details for CLI invocations and structured bridge errors for failed reads. The frontend will normalize those into operation issues rather than replacing the current message behavior. This preserves the fast feedback users already see while adding a durable diagnostic trail.

## Non-Goals

- Persisting operation history across app restarts.
- Adding filters, search, or retry controls for the operation issue surface.
- Broadening the bridge to arbitrary OpenSpec commands.
