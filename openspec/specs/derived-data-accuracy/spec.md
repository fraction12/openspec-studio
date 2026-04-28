# derived-data-accuracy Specification

## Purpose
Define source-of-truth guarantees for OpenSpec-derived data, including CLI execution diagnostics, validation-to-record health mapping, and regression coverage that prevents hardcoded or misleading workspace state.
## Requirements
### Requirement: Packaged CLI execution preserves runtime resolution
The system SHALL run supported OpenSpec CLI commands from the packaged desktop app with a child command environment that can resolve the installed CLI executable and its launcher runtime dependencies from standard local install locations.

#### Scenario: OpenSpec launcher depends on Node
- **WHEN** the packaged app runs an installed `openspec` executable whose launcher resolves `node` through `env`
- **THEN** the bridge provides a child PATH that includes the discovered executable directory and standard local install directories
- **AND** the command can resolve `node` without requiring the user to start the app from a terminal shell

#### Scenario: CLI runtime is unavailable
- **WHEN** the bridge cannot start or complete an allowed OpenSpec command because the executable or its runtime dependency is unavailable
- **THEN** the app surfaces the command failure as a command diagnostic
- **AND** it MUST NOT treat the command failure itself as proof that a change is invalid

### Requirement: Change health is derived from change-specific evidence
The system SHALL derive an individual change's health from real OpenSpec files, change-specific CLI status output, and validation issues explicitly associated with that change.

#### Scenario: Repository validation command fails without linked issues
- **WHEN** repository validation fails to execute or returns unrecognized output without identifying a specific change
- **THEN** the app keeps the repository validation state visible as needing attention
- **AND** it MUST NOT mark every listed change as invalid solely because of that repository-level failure

#### Scenario: Change has linked validation issues
- **WHEN** parsed validation output associates one or more errors with a specific change
- **THEN** the app marks that change invalid
- **AND** the change detail view lists the linked validation messages

#### Scenario: Change has no linked validation issues
- **WHEN** repository validation has failed or is stale but a change has no linked validation issues, no status-command error, no blocked workflow status, and no missing required artifacts
- **THEN** the app does not label that change as invalid
- **AND** it indicates the validation uncertainty at repository or stale-state scope instead

### Requirement: Visible product data is derived from the selected repository
The system SHALL ensure that the production desktop product surface displays OpenSpec data derived from the selected repository's `openspec/` files and OpenSpec CLI output, not hardcoded sample records.

#### Scenario: User opens a real repository
- **WHEN** the user selects a local repository containing `openspec/`
- **THEN** all displayed changes, task counts, touched capabilities, artifact paths, spec counts, validation state, and timestamps are derived from that repository
- **AND** the app MUST NOT mix in browser-preview or sample records

#### Scenario: Browser-only preview remains available
- **WHEN** the app is running outside the Tauri desktop runtime for developer preview
- **THEN** any preview data is explicitly identified as preview-only
- **AND** it cannot be confused with or persisted as selected-repository data in the desktop product

### Requirement: Accuracy regressions are covered by tests
The system SHALL include regression coverage for the source-of-truth behaviors that determine CLI execution, validation parsing, and change health.

#### Scenario: Packaged PATH behavior is tested
- **WHEN** bridge tests simulate command execution with limited environment PATH behavior
- **THEN** they verify that standard local install directories are included for child command resolution

#### Scenario: Health derivation is tested
- **WHEN** TypeScript tests provide repository validation failure without linked change issues
- **THEN** they verify the change is not marked invalid solely from the repository-level failure

#### Scenario: Hardcoded data path is tested or structurally isolated
- **WHEN** tests or static checks inspect the production desktop loading path
- **THEN** they verify it does not use hardcoded OpenSpec sample records as real repository data
