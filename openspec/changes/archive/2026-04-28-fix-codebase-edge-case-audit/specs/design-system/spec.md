## ADDED Requirements

### Requirement: Interactive controls expose honest semantics
The UI SHALL use ARIA roles only when it implements the corresponding keyboard and relationship model.

#### Scenario: Segmented controls are not full tabs
- **WHEN** a control visually switches between app sections but does not provide tabpanel relationships
- **THEN** it SHALL use button semantics instead of incomplete ARIA tab semantics.

### Requirement: Resizable controls support keyboard input
Column resize controls SHALL support keyboard operation in addition to pointer dragging.

#### Scenario: Keyboard user resizes a column
- **WHEN** focus is on a column resize control
- **THEN** arrow keys SHALL adjust the column width within defined bounds
- **AND** a keyboard-accessible reset path SHALL be available.
