## ADDED Requirements

### Requirement: Desktop folder selection is cross-platform
The packaged desktop app SHALL provide a native folder picker on supported Tauri desktop targets through a cross-platform dialog integration.

#### Scenario: User chooses a repository folder
- **WHEN** the user activates Choose folder from the desktop app
- **THEN** a native folder picker SHALL open
- **AND** cancellation SHALL be distinguishable from bridge failure.

### Requirement: Local command execution is bounded and narrow
The desktop bridge SHALL execute only product-supported OpenSpec command shapes through the generic command bridge, and dedicated write commands SHALL validate their own inputs.

#### Scenario: Unsupported OpenSpec arguments are rejected
- **WHEN** the frontend invokes a command shape outside Studio's supported list
- **THEN** the bridge SHALL reject it before spawning the CLI.

#### Scenario: Command timeout does not hang the bridge
- **WHEN** a local command times out or exceeds output limits
- **THEN** Studio SHALL return an error without indefinitely waiting on descendants that keep stdio open.

### Requirement: File and Git metadata preserve local reality
The desktop bridge SHALL represent symlink entries under `openspec/` without following them and SHALL preserve Git porcelain status records without stripping status columns.

#### Scenario: Broken symlink exists under openspec
- **WHEN** a broken symlink is present under `openspec/`
- **THEN** file listing SHALL continue
- **AND** the symlink record SHALL carry read/error metadata instead of aborting the repository index.

### Requirement: Packaged app uses a restrictive webview boundary
The packaged desktop app SHALL configure a restrictive Content Security Policy and SHALL expose only native commands used by the product.

#### Scenario: Packaged app loads local assets
- **WHEN** Studio runs as a packaged desktop app
- **THEN** scripts, styles, images, and fonts SHALL be limited to local app-safe sources
- **AND** unused native invoke commands SHALL NOT be registered.
