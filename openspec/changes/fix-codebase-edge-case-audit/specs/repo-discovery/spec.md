## MODIFIED Requirements

### Requirement: Search state is scoped to its data surface
The application SHALL avoid silently applying a search query from one primary data surface to another unrelated data surface.

#### Scenario: User switches between Changes and Specs
- **WHEN** the user searches Changes and then switches to Specs
- **THEN** the Specs view SHALL NOT appear empty solely because of the hidden Changes query.
