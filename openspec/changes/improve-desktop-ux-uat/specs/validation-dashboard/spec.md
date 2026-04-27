## ADDED Requirements

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
