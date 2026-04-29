## ADDED Requirements

### Requirement: Public alpha release state is clean and intentional
The repository SHALL be clean and intentional before its visibility is changed to public.

#### Scenario: Pre-public Git state check
- **WHEN** maintainers prepare to make the repository public
- **THEN** `git status --short` shows no uncommitted tracked, deleted, or untracked project files
- **AND** any OpenSpec archive/spec moves are committed intentionally
- **AND** generated build artifacts, local app data, logs, and machine-specific files are absent or ignored.

### Requirement: Public README sets an honest alpha promise
The README SHALL describe the current shipped product accurately.

#### Scenario: Visitor reads the README
- **WHEN** a new visitor reads the README
- **THEN** they can tell the app is a local-first desktop workbench for inspecting OpenSpec repos
- **AND** they can tell the current alpha supports OpenSpec only
- **AND** provider-agnostic adapters or Adapter Foundry are not presented as shipped capabilities.

### Requirement: Public docs explain who the tool is for
The public documentation SHALL identify the intended audience and non-audience.

#### Scenario: Non-OpenSpec user evaluates the repo
- **WHEN** a user who does not already use OpenSpec reads the docs
- **THEN** they understand the prerequisite of having or creating an `openspec/` workspace
- **AND** they understand this is not a generic repo planning dashboard yet.

### Requirement: Public packaging metadata is complete
The repository SHALL include enough metadata to look coherent on GitHub and in package manifests.

#### Scenario: Metadata is inspected
- **WHEN** a maintainer reviews `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`
- **THEN** license, description, repository/homepage/bugs where applicable, and final or intentionally documented identifiers are present
- **AND** the repository does not look like an accidental private prototype.

### Requirement: Local-only files are excluded from the repo
The repository SHALL avoid committing local-only state or generated noise.

#### Scenario: Hygiene scan runs
- **WHEN** maintainers scan the repo before public release
- **THEN** app state, build outputs, caches, logs, temporary files, screenshots not intended as assets, machine paths, and generated native artifacts are either absent or ignored
- **AND** intentional public assets are clearly located and referenced.

### Requirement: Public release includes a minimal security/privacy note
The repository SHALL explain the local trust boundary honestly.

#### Scenario: User evaluates local permissions
- **WHEN** a user reads security/privacy documentation
- **THEN** they understand Studio reads a user-selected local repo, stores recent repo paths and UI state locally, may persist validation diagnostics, and runs a narrow allowlist of OpenSpec/Git commands
- **AND** they understand no hosted sync is part of the current product.

### Requirement: Native platform support is not overstated
The repository SHALL not imply unsupported native guarantees.

#### Scenario: Platform support is documented
- **WHEN** a public user checks supported platforms
- **THEN** the docs distinguish tested/supported platforms from future or experimental ones
- **AND** Windows support is not promised as fully hardened until child-process tree containment matches Unix behavior or the risk is explicitly accepted.

### Requirement: Visible placeholders are removed before public release
Public-facing docs SHALL NOT contain unresolved placeholders that make the repo look unfinished.

#### Scenario: README is reviewed
- **WHEN** maintainers review the README before visibility change
- **THEN** screenshot/GIF TODOs and launch-placeholder text have either been replaced with real assets/content or removed.
