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

#### Scenario: Validation result belongs to stale provider state
- **WHEN** a provider validation result returns after a newer repository or file snapshot is active
- **THEN** the validation dashboard ignores the stale result
- **AND** it does not attach old diagnostics to the current workspace.

### Requirement: Provider validation preserves existing OpenSpec parsing
The validation dashboard SHALL preserve current OpenSpec validation parsing and trust behavior when validation is routed through the OpenSpec provider.

#### Scenario: OpenSpec validation output is parsed
- **WHEN** the OpenSpec provider returns validation command output
- **THEN** the app parses canonical OpenSpec validation JSON, warnings, root issues, item issues, command diagnostics, and parse diagnostics the same way as the current direct validation path
- **AND** provider routing does not mark unrelated changes or specs invalid.

#### Scenario: OpenSpec validation command fails
- **WHEN** the OpenSpec provider cannot run validation or receives unparseable validation output
- **THEN** the validation dashboard shows a command problem state
- **AND** available stdout, stderr, status code, and provider identity remain inspectable.
