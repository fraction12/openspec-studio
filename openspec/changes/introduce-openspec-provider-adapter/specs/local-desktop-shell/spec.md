## ADDED Requirements

### Requirement: Repository loading uses provider activation
The desktop shell SHALL activate a deterministic spec provider when opening a repository instead of hard-coding all workspace behavior directly into the shell.

#### Scenario: OpenSpec repo is selected
- **WHEN** the user opens a repository containing an `openspec/` directory under the selected repo root
- **THEN** the app activates the built-in OpenSpec provider
- **AND** the repository is shown as a ready workspace using provider-derived state.

#### Scenario: No provider matches
- **WHEN** the user opens a repository that no built-in provider detects
- **THEN** the app shows a no-workspace or unsupported-workspace state
- **AND** it does not create provider files automatically.

#### Scenario: Provider detection fails
- **WHEN** provider detection cannot read the selected folder or cannot validate repository shape
- **THEN** the app shows an actionable repository-unavailable state
- **AND** the previous ready workspace remains intact when one exists.

### Requirement: Provider identity is visible to app state
The desktop shell SHALL carry the active provider identity in repository or workspace state.

#### Scenario: Provider-backed workspace loads
- **WHEN** a repository is successfully indexed by a provider
- **THEN** app state records the provider id and provider label
- **AND** diagnostics/actions can be attributed to that provider.

#### Scenario: Provider capabilities are recorded
- **WHEN** a provider-backed workspace loads
- **THEN** app state records the provider's artifact, validation, archive, status, and Git capabilities
- **AND** global actions use those capabilities to decide whether an operation is available.

### Requirement: Provider activation preserves desktop bridge safety
The desktop shell SHALL keep native command and filesystem execution behind the existing restricted Tauri bridge when provider architecture is introduced.

#### Scenario: OpenSpec provider invokes bridge commands
- **WHEN** the OpenSpec provider validates, reads files, reads artifacts, loads status, archives, or checks Git status
- **THEN** it uses the same narrow bridge operations already used by the app
- **AND** the provider layer does not introduce arbitrary command execution.

#### Scenario: Unsupported provider action is requested
- **WHEN** no active provider supports a requested operation
- **THEN** the shell rejects the operation before invoking the bridge
- **AND** the rejection is surfaced as a provider capability problem rather than a silent no-op.
