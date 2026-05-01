# local-desktop-shell Specification Delta

## MODIFIED Requirements
### Requirement: Signed Studio Runner dispatch
The desktop shell SHALL send Studio Runner dispatch requests with stable event identity, timestamped signatures, and at-least-once-safe semantics.

#### Scenario: Selected change cannot dispatch duplicate in-flight work
- **GIVEN** Studio knows of an accepted or running Studio Runner event for the selected repository/change
- **WHEN** the user views that change's inspector
- **THEN** Studio SHALL disable the dispatch action for that selected change
- **AND** Studio SHALL NOT send another `build.requested` event for that same repository/change from the disabled button.

#### Scenario: Running detection ignores non-run rows
- **GIVEN** the Runner Log contains lifecycle, stream, status, or diagnostic rows
- **WHEN** Studio decides whether the selected change is building
- **THEN** Studio SHALL ignore those non-run rows
- **AND** Studio SHALL only consider actual run/dispatch rows for the same repository/change.

#### Scenario: Other changes remain governed by normal eligibility
- **GIVEN** one change has an accepted or running Studio Runner event
- **WHEN** the user selects a different active change
- **THEN** Studio SHALL evaluate that different change using the normal dispatch eligibility rules
- **AND** Studio SHALL NOT disable its Build action solely because another change is running.
