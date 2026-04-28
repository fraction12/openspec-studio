## ADDED Requirements

### Requirement: Specs table sorts by updated time
The specs overview table SHALL sort specs by updated time with a visible updated-column sort affordance.

#### Scenario: Specs table first loads
- **WHEN** current specs are rendered
- **THEN** rows are sorted newest first by indexed spec updated time
- **AND** specs without known updated time appear after specs with known updated time.

#### Scenario: User toggles spec updated sort
- **WHEN** the user activates the specs table `Updated` column sort control
- **THEN** the specs table toggles between newest-first and oldest-first updated-time ordering
- **AND** the spec inspector remains attached to the same selected spec when that spec is still visible.
