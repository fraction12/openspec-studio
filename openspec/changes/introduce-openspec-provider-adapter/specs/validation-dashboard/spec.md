## ADDED Requirements

### Requirement: Validation runs through provider capability
The validation dashboard SHALL invoke validation through the active provider when that provider declares validation support.

#### Scenario: OpenSpec validation is requested
- **WHEN** the OpenSpec provider is active and the user runs validation
- **THEN** the app runs only the allowlisted OpenSpec validation command shape
- **AND** parsed validation results are attached to the current provider-backed workspace.

#### Scenario: Active provider does not support validation
- **WHEN** the active provider has no validation capability
- **THEN** the UI does not offer provider validation as a supported action
- **AND** it does not attempt to guess a validation command.
