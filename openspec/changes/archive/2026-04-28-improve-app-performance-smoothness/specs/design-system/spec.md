## MODIFIED Requirements

### Requirement: Table interaction styling is shared
The system SHALL use shared tokens and styles for selectable table rows.

#### Scenario: Selectable rows render
- **WHEN** a table row can open detail content
- **THEN** hover, focus, selected, and pointer states use shared row interaction tokens
- **AND** these states do not shift row dimensions
- **AND** base row geometry reserves any borders, padding, or focus affordances used by interaction states

### Requirement: Artifact-first typography
The system SHALL define typography tokens and component styles that prioritize readable OpenSpec artifacts.

#### Scenario: Markdown artifacts render
- **WHEN** proposal, design, task, or spec content is previewed
- **THEN** headings, paragraphs, lists, code, and paths use a consistent document reading scale
- **AND** source paths and artifact labels remain visible without crowding the content
- **AND** long artifact previews remain readable without creating competing vertical scroll traps
