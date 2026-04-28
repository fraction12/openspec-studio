## ADDED Requirements

### Requirement: Desktop Integration Audit Coverage
The audit SHALL inspect local desktop integration code for command execution, child process environment, path handling, filesystem boundaries, packaging behavior, and user-facing error propagation.

#### Scenario: Reviewer records desktop integration findings
- **WHEN** a reviewer identifies a desktop integration issue
- **THEN** they SHALL record the issue with severity, file references, reproduction notes, and a recommended fix.
