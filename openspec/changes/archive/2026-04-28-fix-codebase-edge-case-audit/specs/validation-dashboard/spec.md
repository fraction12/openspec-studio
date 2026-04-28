## ADDED Requirements

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
