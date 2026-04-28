## MODIFIED Requirements

### Requirement: Table interaction styling is shared
The system SHALL use shared tokens and styles for selectable table rows.

#### Scenario: Board tables share component behavior
- **WHEN** multiple board views render source-backed artifact tables
- **THEN** they share the same table component or table behavior layer
- **AND** visual states, row limits, keyboard activation, scrolling, and optional resize affordances remain consistent across table contexts
