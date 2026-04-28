## MODIFIED Requirements

### Requirement: Tooling measures production derivation paths
Performance tooling SHALL measure the production workspace indexing and view-model derivation paths, not only filesystem scan and file read time.

#### Scenario: Performance measurement runs
- **WHEN** the performance measurement script completes
- **THEN** it SHALL report scan/read timing, production indexing timing, derived model timing where available, and derived active/archive/spec counts.
