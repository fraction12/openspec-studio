## ADDED Requirements

### Requirement: Validation execution
The system SHALL allow the user to run OpenSpec validation for the selected repository.

#### Scenario: User runs validation
- **WHEN** the user requests validation
- **THEN** the app runs the OpenSpec CLI validation command in the selected repository
- **AND** it captures structured output when available

#### Scenario: Validation passes
- **WHEN** validation completes successfully
- **THEN** the app marks the repository and relevant changes/specs as valid
- **AND** it records the validation time in app state

#### Scenario: Validation fails
- **WHEN** validation reports errors
- **THEN** the app displays the errors in a validation dashboard
- **AND** it links each error to the affected change, spec, or file when that relationship is available

### Requirement: Validation health on change board
The system SHALL surface validation health in the change overview.

#### Scenario: Change has validation errors
- **WHEN** validation output identifies errors for a specific change
- **THEN** the change board marks that change as invalid
- **AND** the detail view shows the associated errors

#### Scenario: Validation state is stale
- **WHEN** files change after the last validation run
- **THEN** the app marks validation state as stale
- **AND** it offers the user a way to refresh validation
