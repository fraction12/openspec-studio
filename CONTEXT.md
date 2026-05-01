# OpenSpec Studio Context

## Domain Terms

### Spec Provider
A deterministic adapter that can detect a supported repository shape and perform provider-backed operations such as indexing, artifact reading, validation, archive actions, change status loading, and Git status loading.

### OpenSpec Provider
The built-in Spec Provider for repositories with an `openspec/` directory. It preserves the current OpenSpec Studio behavior while keeping OpenSpec-specific filesystem and command knowledge behind the provider seam.

### Provider Session
The active repository/provider workflow owner for a loaded workspace. It coordinates provider detection, indexing, refresh, validation, archive, artifact reads, Git status, operation diagnostics, and stale-result guards for the current repository.

### Provider Workspace
The source-backed workspace state returned by a Provider Session. It carries provider identity, provider capabilities, indexed changes, specs, artifacts, validation state, file signatures, diagnostics, source paths, and modified timestamps.
