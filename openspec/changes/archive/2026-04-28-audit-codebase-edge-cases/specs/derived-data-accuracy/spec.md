## ADDED Requirements

### Requirement: Derived Data Audit Coverage
The audit SHALL inspect all derived OpenSpec data paths for hard-coded assumptions, stale state, missing-file handling, malformed artifact handling, and incorrect health/status computation.

#### Scenario: Reviewer records derived-data findings
- **WHEN** a reviewer identifies a derived-data issue
- **THEN** they SHALL record the issue with the source file, observed behavior, expected behavior, and recommended correction.
