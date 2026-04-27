## Context

The first OpenSpec Studio implementation already indexes real files and calls the OpenSpec CLI, but the live packaged app exposed two accuracy failures during review:

- the bridge can locate the `openspec` executable while still failing to provide the executable's runtime dependencies, such as `node`, in the child PATH
- the UI can turn a repository-level validation failure into a per-change `Invalid` badge even when no validation issue is linked to the selected change

There is also browser-preview sample data embedded in the React entry path. That helped early UI development, but it now conflicts with the product rule that visible desktop state must come from the selected repository.

## Goals / Non-Goals

**Goals:**

- Make packaged CLI execution behave like a normal local shell for supported OpenSpec commands while keeping command allow-listing intact.
- Distinguish command execution errors, repository validation state, and individual change health.
- Ensure change health is traceable to real OpenSpec files, CLI status output, or linked validation issues.
- Remove or clearly isolate hardcoded sample records from production desktop behavior.
- Add regression tests around the exact review findings before expanding the product.

**Non-Goals:**

- Do not add updater behavior, editing flows, multi-repo workspaces, or new visualizations.
- Do not change OpenSpec CLI behavior or file formats.
- Do not introduce a persistent project database or app-owned source of truth.
- Do not hide command failures by pretending stale or missing data is valid.

## Decisions

### 1. Normalize the child command environment in the bridge

The Rust bridge should keep discovering command candidates from the current PATH plus standard local install directories. When it runs a candidate, it should also provide a child PATH containing the candidate's directory, the known local install directories, and the existing PATH entries.

This addresses launcher scripts that use `#!/usr/bin/env node`: finding `openspec` is not sufficient if `node` is unavailable to the child process.

Alternative considered: invoke `/opt/homebrew/bin/node` directly with the OpenSpec package entrypoint. That would be more brittle because package-manager layouts vary. Preserving normal executable launch semantics with a richer PATH is safer.

### 2. Treat CLI failure as diagnostic state, not validation truth

If `openspec validate --all --json` does not return parseable structured validation output, the app should surface a validation-command failure state with the captured stderr/stdout. It must not convert that failure into linked validation errors for every change unless the output actually identifies those changes.

Per-change health should use this precedence:

1. explicit status-command error for that change
2. linked validation issues for that change
3. blocked workflow status
4. missing required artifacts
5. stale or unknown repository validation state
6. clean state when validation passed and no change-specific problems exist

Alternative considered: keep using repository validation failure as a global invalid badge. That made the board alarming but inaccurate, and it contradicted the detail pane when no linked issue existed.

### 3. Preserve source traces for derived fields

Where practical, state that feeds user-facing health should keep enough trace information to explain whether it came from file scanning, `openspec status`, or `openspec validate`. The UI does not need a new feature-heavy provenance panel in this change, but the data model and tests should make the source clear.

### 4. Remove or quarantine browser-preview data

The production Tauri runtime must never use hardcoded sample records. If a browser-only preview remains for developer convenience, it must be explicitly labeled as a preview path and kept out of desktop data loading. Tests or code structure should make it hard to accidentally route the product through sample records.

## Risks / Trade-offs

- **PATH normalization may still miss unusual installs** -> Keep standard directories centralized and covered by tests; surface command diagnostics if the runtime is genuinely unavailable.
- **Separating repo and change health may make the board less visually urgent** -> Keep repository validation failure visible in the footer/status area while avoiding false per-change invalid badges.
- **Validation parser ambiguity** -> Prefer structured JSON. For unrecognized output, show a command/parse diagnostic instead of inventing associations.
- **Browser preview removal may slow visual iteration** -> If retained, isolate it behind explicit non-Tauri preview code and unmistakable labels.
