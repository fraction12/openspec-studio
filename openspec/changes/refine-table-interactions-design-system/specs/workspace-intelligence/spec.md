## ADDED Requirements

### Requirement: Spec rows are fully selectable
The system SHALL allow users to select specs by activating any selectable area of a spec table row.

#### Scenario: User clicks a spec row
- **WHEN** the user clicks anywhere on a selectable spec row
- **THEN** the app selects that spec
- **AND** the inspector shows details for the selected spec

#### Scenario: User uses keyboard navigation
- **WHEN** a selectable spec row has keyboard focus and the user presses Enter or Space
- **THEN** the app selects that spec
- **AND** the row exposes focus and selected states without changing layout dimensions

### Requirement: Spec table trust cells stay scan-focused
The system SHALL keep spec table trust cells concise and avoid secondary text beneath pill badges.

#### Scenario: Spec table renders trust state
- **WHEN** a spec appears in the specs table
- **THEN** the trust cell shows the primary trust pill
- **AND** summary or explanatory subtext is not rendered under that pill in the table cell

### Requirement: Spec inspector previews source text
The system SHALL show the selected spec source text in the side panel using the same readable preview pattern as proposal and design content.

#### Scenario: User selects a spec with source content
- **WHEN** the user selects a spec whose source file content is available
- **THEN** the spec inspector displays a readable markdown preview of that source text
- **AND** key identity, trust, path, and file actions remain visible above the preview

#### Scenario: Spec source content is unavailable
- **WHEN** the selected spec source text cannot be loaded
- **THEN** the spec inspector shows a clear empty preview state
- **AND** it preserves available metadata and file actions
