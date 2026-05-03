# public-release-hygiene Specification Delta

## ADDED Requirements

### Requirement: Public release quality checks include coverage
Public release readiness SHALL include a runnable local coverage gate for the TypeScript application source.

#### Scenario: Maintainer verifies release readiness
- **WHEN** a maintainer runs the documented local quality gate before release
- **THEN** frontend test coverage SHALL be checked against the configured thresholds
- **AND** Rust/Tauri bridge tests and OpenSpec validation SHALL remain part of the same release-readiness flow.
