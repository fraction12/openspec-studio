# module-seam-linting Specification

## Purpose
TBD - created by archiving change enforce-module-seams-with-lint. Update Purpose after archive.
## Requirements
### Requirement: Module seams are lint-enforced
The lint configuration SHALL protect named source Module Seams with hard import restrictions.

#### Scenario: Domain module imports forbidden implementation detail
- **WHEN** a file under `src/domain/` imports React, Tauri packages, provider implementation, runner implementation, persistence implementation, or app shell implementation
- **THEN** `npm run lint` SHALL report an error.

#### Scenario: Provider module imports forbidden implementation detail
- **WHEN** a file under `src/providers/` imports React UI, runner implementation, app shell implementation, or settings UI state
- **THEN** `npm run lint` SHALL report an error.

#### Scenario: Runner module imports forbidden implementation detail
- **WHEN** a file under `src/runner/` imports React UI, provider implementation, app shell implementation, or settings UI state
- **THEN** `npm run lint` SHALL report an error.

#### Scenario: Pure policy module imports shell implementation
- **WHEN** a focused policy/model module such as validation or settings model code imports React, Tauri packages, or app shell implementation
- **THEN** `npm run lint` SHALL report an error.

### Requirement: Complexity and nesting are visible but incremental
The lint configuration SHALL flag high implementation complexity and deep nesting as warnings rather than errors for the first architecture enforcement pass.

#### Scenario: Function exceeds complexity threshold
- **WHEN** a linted function exceeds the configured cyclomatic complexity threshold
- **THEN** `npm run lint` SHALL report a warning
- **AND** the warning SHALL NOT fail the lint command by itself.

#### Scenario: Code exceeds nesting threshold
- **WHEN** linted code exceeds the configured maximum nesting depth
- **THEN** `npm run lint` SHALL report a warning
- **AND** the warning SHALL NOT fail the lint command by itself.

### Requirement: Architecture linting preserves module depth
Architecture lint warnings SHALL guide deepening decisions without encouraging shallow extraction.

#### Scenario: Warning is reviewed
- **WHEN** maintainers review a complexity or max-depth warning
- **THEN** they SHALL evaluate whether a deeper Module would improve locality and leverage
- **AND** they SHALL NOT split code solely to reduce a metric when the complexity would simply move to callers.

#### Scenario: Existing debt remains warning-only
- **WHEN** existing code triggers complexity or max-depth warnings during adoption
- **THEN** the change MAY leave those warnings in place
- **AND** hard seam violations SHALL still be fixed before the change is considered complete.

