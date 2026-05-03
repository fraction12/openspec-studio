# project-quality-tooling Specification

## Purpose
TBD - created by archiving change add-project-linting. Update Purpose after archive.
## Requirements
### Requirement: Project lint command
The repository SHALL provide a local lint command for source and project tooling files.

#### Scenario: Developer runs lint
- **WHEN** a developer runs `npm run lint`
- **THEN** ESLint SHALL analyze TypeScript, TSX, Vite config, and local script files covered by the project lint configuration
- **AND** the command SHALL exit non-zero when lint errors are present.

#### Scenario: Generated outputs are excluded
- **WHEN** lint runs
- **THEN** generated web output, dependency directories, native build output, and local machine artifacts SHALL NOT be linted.

### Requirement: React Hooks rules are enforced
The lint configuration SHALL include React Hooks rules for React source files.

#### Scenario: Hook usage is invalid
- **WHEN** React source violates hook ordering or dependency rules covered by the configured hooks plugin
- **THEN** `npm run lint` SHALL report the issue.

