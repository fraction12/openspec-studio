# local-desktop-shell Specification Delta

## MODIFIED Requirements
### Requirement: Local Studio Runner workspace
The desktop shell SHALL provide Studio Runner as a first-class workspace-level surface, separate from selected change details, for local runner configuration, lifecycle, status, event streaming, execution-log inspection, setup diagnostics, and a repo-wide Runner Log.

#### Scenario: Runner Log rows expand from the whole summary row
- **GIVEN** the Runner Log contains one or more rows
- **WHEN** the user clicks a summary row or activates it with Enter or Space
- **THEN** Studio SHALL expand or collapse that row's details
- **AND** the dedicated details control SHALL remain accessible without triggering a double toggle.

#### Scenario: Runner Log avoids horizontal overflow
- **GIVEN** Runner Log rows include long event IDs, endpoints, messages, or timestamps
- **WHEN** the Runner workspace renders the table
- **THEN** Studio SHALL keep the table within the available panel width without horizontal scrolling
- **AND** long Event, Subject, and Message values SHALL wrap or truncate cleanly without overlapping adjacent columns.

#### Scenario: Stream subjects are scan-friendly
- **GIVEN** the Runner Log contains stream lifecycle rows with an events endpoint
- **WHEN** the Subject column renders those rows
- **THEN** Studio SHALL show a concise stream subject label in the table
- **AND** Studio SHALL keep the raw endpoint available in the expanded row details.
