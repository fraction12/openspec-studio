## ADDED Requirements

### Requirement: Derived OpenSpec records use normalized paths consistently
The application SHALL use the same normalized path representation for indexing, content lookup, search, previews, and view-model derivation.

#### Scenario: Normalizable file paths include content
- **WHEN** file records contain leading `./`, backslashes, duplicate slashes, or leading slashes
- **THEN** indexed artifacts SHALL still resolve their source content.

### Requirement: Malformed root files do not create phantom changes
The application SHALL only create a change row from a real change directory or files nested beneath `openspec/changes/<change-name>/`.

#### Scenario: Root file under changes directory
- **WHEN** `openspec/changes/README.md` or `.keep` exists
- **THEN** Studio SHALL NOT create a change named `README.md` or `.keep`
- **AND** SHALL NOT request status for that phantom name.
