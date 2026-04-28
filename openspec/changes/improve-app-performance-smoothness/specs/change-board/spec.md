## MODIFIED Requirements

### Requirement: Board rows communicate that they are navigable
The system SHALL make selectable board rows visually and interactively clear.

#### Scenario: User hovers or focuses a row
- **WHEN** a row can open detail content
- **THEN** hover and focus states communicate row navigation without changing row dimensions
- **AND** keyboard focus exposes the same selection behavior as pointer interaction
- **AND** row styling avoids padding, border, or layout changes that cause visible content shifts

### Requirement: Board presents a repo-native workbench
The system SHALL present changes and specs as source-backed OpenSpec artifacts rather than generic dashboard records.

#### Scenario: Board width is compact
- **WHEN** the board is narrower than the table's overview columns
- **THEN** the table preserves change/spec name, trust, tasks, capabilities, updated time, and row actions when present
- **AND** the table scrolls horizontally instead of hiding or partially clipping columns
- **AND** compact shell breakpoints do not create hidden horizontal dead zones outside the table scroller

### Requirement: Board interactions remain smooth at scale
The system SHALL keep board search, selection, scrolling, and column resizing responsive as OpenSpec workspaces grow.

#### Scenario: Many rows are visible
- **WHEN** the active, archive-ready, archived, or specs table contains many rows
- **THEN** the app avoids rendering or recalculating more row detail than needed for the visible interaction
- **AND** selecting a row updates the inspector without jank

#### Scenario: User searches rows
- **WHEN** the user types into a change or spec search field
- **THEN** filtering uses deferred or precomputed searchable text where needed
- **AND** typing remains responsive while preserving accurate results derived from current OpenSpec data

#### Scenario: User resizes the change column
- **WHEN** the user drags the change-column resize handle
- **THEN** width updates are throttled or applied through a lightweight visual path
- **AND** the table does not re-render every row on every pointer movement
