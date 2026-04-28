## ADDED Requirements

### Requirement: Change Board Audit Coverage
The audit SHALL inspect the change-board implementation for selection, filtering, table behavior, archive actions, trust labels, derived row state, and viewport edge cases.

#### Scenario: Reviewer records concrete change-board findings
- **WHEN** a reviewer identifies a change-board issue
- **THEN** they SHALL record the finding under `openspec/changes/audit-codebase-edge-cases/reviews/`
- **AND** the finding SHALL include severity, file references, evidence, and a recommended fix.
