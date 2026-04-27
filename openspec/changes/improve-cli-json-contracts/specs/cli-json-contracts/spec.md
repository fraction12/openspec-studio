## ADDED Requirements

### Requirement: CLI JSON contract improvements
The system SHALL identify and propose additive OpenSpec CLI JSON output needed to reduce fragile app-side inference.

#### Scenario: App needs canonical state
- **WHEN** Studio derives important state from file scans or markdown parsing
- **THEN** the gap is documented as a candidate CLI JSON addition

#### Scenario: CLI output evolves
- **WHEN** OpenSpec CLI adds new JSON fields
- **THEN** Studio remains compatible with prior JSON output where practical

