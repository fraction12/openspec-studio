## ADDED Requirements

### Requirement: Change tables sort by updated time
The change board SHALL sort change rows by updated time with a visible updated-column sort affordance.

#### Scenario: Change table first loads
- **WHEN** changes are rendered in the active, archive-ready, or archived table
- **THEN** rows are sorted newest first by their indexed updated time
- **AND** rows without known updated time appear after rows with known updated time.

#### Scenario: User toggles updated sort
- **WHEN** the user activates the `Updated` column sort control
- **THEN** the table toggles between newest-first and oldest-first updated-time ordering
- **AND** the updated column header shows the active direction with a sort icon or equivalent visual affordance.

#### Scenario: Sorting changes visible row order
- **WHEN** sorting changes the order of visible changes
- **THEN** current selection remains attached to the same change when that change is still visible
- **AND** keyboard row navigation follows the newly sorted visual order.

#### Scenario: Shared table behavior remains intact
- **WHEN** updated-time sorting is active
- **THEN** full-row selection, keyboard activation, row limiting, horizontal scrolling, and column resizing continue to use the shared board table behavior.
