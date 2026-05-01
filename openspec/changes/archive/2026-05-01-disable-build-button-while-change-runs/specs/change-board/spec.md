# change-board Specification Delta

## MODIFIED Requirements
### Requirement: Change detail view
The system SHALL provide a detail view for an individual change.

#### Scenario: Selected active change is already building
- **GIVEN** the user selects an active change in the inspector
- **AND** Studio Runner has an in-flight run for the same repository/change
- **WHEN** the inspector renders the primary runner action
- **THEN** the **Build with agent** button SHALL be disabled
- **AND** the button label SHALL read **Building...**
- **AND** the disabled state SHALL apply only to the selected change with the in-flight run.

#### Scenario: Building label uses a lightweight animated ellipsis
- **GIVEN** the selected change is already building
- **WHEN** the button label is shown
- **THEN** Studio SHALL animate the ellipsis in a simple, non-distracting loop
- **AND** the animation SHALL NOT change the button width or animate the whole button
- **AND** Studio SHALL show a static **Building...** label when reduced-motion preferences request it.

#### Scenario: Terminal run states re-enable normal action rules
- **GIVEN** a selected change previously had a Studio Runner run
- **WHEN** the latest known run status is completed, blocked, failed, or conflict
- **THEN** Studio SHALL stop treating that change as currently building
- **AND** the button SHALL fall back to the existing eligibility, retry, or unavailable behavior for that change.
