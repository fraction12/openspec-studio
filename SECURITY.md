# Security Policy

OpenSpec Studio is a local-first desktop alpha. It reads repositories you choose, stores app convenience state locally, and invokes a narrow set of OpenSpec/Git operations through the Tauri bridge.

## Reporting Vulnerabilities

Use GitHub private vulnerability reporting for `fraction12/openspec-studio` when available. If private reporting is unavailable, open a minimal public issue that asks for a private contact path and avoid posting exploit details, private repository paths, or sensitive command output.

Please include:

- affected version or commit
- operating system
- whether the issue requires a crafted repository, crafted OpenSpec files, or user action
- expected impact
- minimal reproduction details that do not expose secrets

## Local Trust Boundary

Studio can:

- read files under a selected repository's `openspec/` directory
- run allowlisted OpenSpec CLI commands for validation, status, and archive
- run Git status scoped to `openspec/`
- store recent repository paths, UI state, and validation snapshots locally
- open selected artifact files in the system editor

Studio should not:

- upload repository contents to a hosted service
- execute arbitrary repository-provided commands
- read arbitrary files outside the selected repository's `openspec/` tree for artifact previews
- treat local app cache as the canonical source of OpenSpec truth

## Stored Local Data

The Tauri store may persist recent repository paths, selected change/spec ids, sort preferences, and validation snapshots. Validation snapshots can include diagnostics, file paths, stdout, stderr, and status codes from OpenSpec commands.

Clear the app's local data directory if you need to remove persisted paths or diagnostics before sharing logs or a machine.

## Platform Notes

macOS is the primary alpha target. Linux source builds are expected but not deeply packaged. Windows is experimental until process-tree containment and packaging are hardened to match Unix behavior.
