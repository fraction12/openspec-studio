# project-quality-tooling Specification Delta

## ADDED Requirements

### Requirement: Test coverage command
The repository SHALL provide a local command that runs the frontend test suite with coverage reporting.

#### Scenario: Developer runs coverage
- **WHEN** a developer runs the coverage command
- **THEN** the command SHALL execute the Vitest frontend test suite with coverage enabled
- **AND** it SHALL print coverage percentages in the terminal
- **AND** it SHALL exit non-zero when configured coverage thresholds are not met.

### Requirement: Coverage thresholds are scoped to useful modules
The coverage configuration SHALL focus thresholds on extracted source modules where coverage provides meaningful regression confidence.

#### Scenario: Extracted module is under-covered
- **WHEN** a threshold-targeted extracted module such as domain, runner, provider, validation, persistence, or model code falls below the configured threshold
- **THEN** the coverage command SHALL fail.

#### Scenario: Shell composition code is still decomposing
- **WHEN** broad shell/composition files such as `src/App.tsx` remain in the codebase
- **THEN** they MAY be excluded from strict initial thresholds or tracked separately
- **AND** they SHALL NOT force low-value tests solely to satisfy a global percentage.

### Requirement: Local quality gate includes coverage
The repository SHALL provide one local quality command that includes coverage alongside the existing static and validation gates.

#### Scenario: Developer runs the quality gate
- **WHEN** a developer runs the quality command
- **THEN** it SHALL run typecheck, lint, coverage, production build, Rust/Tauri tests, and OpenSpec validation
- **AND** it SHALL fail if any included gate fails.
