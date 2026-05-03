## ADDED Requirements

### Requirement: Public release quality checks include linting
The repository SHALL include a runnable lint command as part of its local quality toolkit before public release.

#### Scenario: Maintainer checks release readiness
- **WHEN** maintainers prepare a public release or review a source change
- **THEN** `npm run lint` SHALL be available
- **AND** it SHALL be compatible with the existing `npm run check`, `npm test`, and production build workflow.
