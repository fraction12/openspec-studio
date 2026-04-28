# validation-dashboard Specification

## Purpose
Define how OpenSpec Studio runs validation, parses and scopes validation output, communicates trust and freshness, and links actionable issues to repository, change, or spec records.
## Requirements
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

### Requirement: Validation trust state uses actionable language
The system SHALL display validation state in language that tells users what is known, what is unknown, and what action restores confidence.

#### Scenario: Validation has never run for current snapshot
- **WHEN** the selected repository has been indexed but validation has not run for the current file snapshot
- **THEN** the app labels validation as not yet checked for this snapshot
- **AND** attention counts are shown as unknown or omitted instead of claiming zero changes need attention

#### Scenario: Validation is stale
- **WHEN** OpenSpec files changed after the last validation run
- **THEN** the app explains that validation results may be outdated
- **AND** it offers a clear action to run validation again

#### Scenario: Validation passes
- **WHEN** validation completes successfully for the current snapshot
- **THEN** the app shows a clean state with the validation time or equivalent freshness cue
- **AND** attention counts may report zero only when validation is current and no linked issues exist

#### Scenario: Validation command fails
- **WHEN** the validation command cannot run or returns unrecognized output
- **THEN** the app labels the state as a validation command or output problem
- **AND** it keeps technical diagnostics available without marking every change invalid

### Requirement: Refresh and validation actions are distinct
The system SHALL distinguish file refresh from OpenSpec validation in labels, help text, and status feedback.

#### Scenario: User refreshes files
- **WHEN** the user requests a refresh
- **THEN** the app re-indexes local OpenSpec files and status data
- **AND** it does not imply that OpenSpec validation has run

#### Scenario: User runs validation
- **WHEN** the user requests validation
- **THEN** the app runs OpenSpec validation for the selected repository
- **AND** the completion message describes validation results rather than file indexing

#### Scenario: Both actions are visible
- **WHEN** refresh and validation controls appear in the same header or panel
- **THEN** their labels and visual hierarchy make their different effects clear

### Requirement: Validation details are scoped to the current selection
The system SHALL avoid showing validation messages or actions that appear to apply to hidden or stale selections.

#### Scenario: Selected record changes
- **WHEN** the user selects a different change or spec
- **THEN** validation detail areas update to messages linked to that record
- **AND** repository-level diagnostics remain visually distinct from record-level validation issues

### Requirement: Validation output reflects real OpenSpec results
The application SHALL parse OpenSpec validation JSON using OpenSpec's canonical issue fields, including `level`, and SHALL preserve warning and informational issues without treating them as errors.

#### Scenario: Warning-only validation remains checked clean
- **WHEN** OpenSpec returns `valid: true` with warning-level issues
- **THEN** Studio SHALL keep validation state as pass
- **AND** warnings SHALL remain visible as non-blocking validation issues.

#### Scenario: Root-level and item issues are both surfaced
- **WHEN** validation JSON contains both `items` and root-level `issues`
- **THEN** Studio SHALL include both sets of issues or diagnostics in the validation result.

### Requirement: Validation trust is conservative when output is incomplete
The application SHALL NOT mark specs or changes as checked valid when validation failed, is stale, has command diagnostics, has parse diagnostics, or could not be associated to specific artifacts.

#### Scenario: Failed validation without linked issues does not mark specs valid
- **WHEN** validation fails with diagnostics but no spec-specific issue associations
- **THEN** specs SHALL show a non-valid trust state
- **AND** users SHALL be able to tell that validation is not trustworthy for that snapshot.

