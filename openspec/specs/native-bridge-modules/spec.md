# native-bridge-modules Specification

## Purpose
TBD - created by archiving change deepen-studio-runner-modules. Update Purpose after archive.
## Requirements
### Requirement: Native bridge modules separate OpenSpec and Runner implementations
The native bridge SHALL preserve the existing Tauri command seam while separating local OpenSpec operations from Studio Runner operations into domain-focused Rust modules.

#### Scenario: Tauri command names remain stable
- **WHEN** the frontend invokes existing bridge commands for repository validation, OpenSpec commands, file records, artifact reads, Git status, Runner session secret, Runner lifecycle, Runner status, Runner stream, or Runner dispatch
- **THEN** the command names, request shapes, and response shapes SHALL remain compatible.

#### Scenario: Local OpenSpec operations are localized
- **WHEN** maintainers need to change local OpenSpec detection, command execution, archive checks, artifact reads, file collection, or Git status
- **THEN** the relevant implementation SHALL be localized in the native OpenSpec bridge module or shared command module rather than mixed with Studio Runner lifecycle implementation.

#### Scenario: Studio Runner operations are localized
- **WHEN** maintainers need to change Studio Runner session secret, lifecycle, status, stream, process, endpoint, signing, or dispatch behavior
- **THEN** the relevant implementation SHALL be localized in the native Studio Runner bridge module or shared command module rather than mixed with local OpenSpec file collection implementation.

#### Scenario: Shared bridge utilities are localized
- **WHEN** maintainers need to change bridge error mapping, bounded command execution, process tree cleanup, command validation, path normalization, or OpenSpec file traversal utilities
- **THEN** the relevant implementation SHALL be localized in the native shared bridge module rather than duplicated in the local OpenSpec or Studio Runner modules.

### Requirement: Native bridge split remains behavior-preserving
The native bridge module split SHALL NOT change timeout behavior, output bounds, process cleanup behavior, localhost endpoint restrictions, archive postcondition checks, or OpenSpec path safety checks.

#### Scenario: Existing native bridge tests run after split
- **WHEN** the Rust test suite runs
- **THEN** tests covering command execution, OpenSpec repository/file/artifact behavior, and Studio Runner lifecycle/dispatch/stream behavior SHALL pass through the new module layout.

