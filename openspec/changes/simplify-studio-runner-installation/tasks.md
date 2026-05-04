# Tasks

## 1. Product/spec shaping
- [x] 1.1 Define the user-facing Studio Runner setup model and keep Symphony as implementation detail.
- [x] 1.2 Define managed/default runner mode and advanced custom runner mode.
- [x] 1.3 Define setup checklist categories for runner binary, compatibility, auth, repo readiness, endpoint, and workspace root.
- [x] 1.4 Define setup state labels and diagnostic language.
- [x] 1.5 Clarify that normal users must not clone/build a separate Symphony repo.
- [x] 1.6 Define one-install product promise: install Studio, open repo, set up Runner in app, dispatch.

## 2. Runner packaging and compatibility
- [ ] 2.1 Choose managed runner delivery strategy: bundled sidecar, first-run signed download, or managed local install.
- [ ] 2.2 Extend runner health/version protocol to expose runner identity, implementation identity, version/build, protocol, compatibility, and capabilities.
- [ ] 2.3 Add Studio-side managed runner discovery/install/update/reinstall checks.
- [ ] 2.4 Add stale/incompatible runner detection with update/restart guidance.
- [ ] 2.5 Keep advanced custom runner path/endpoint configuration available with clear user-managed labeling.
- [ ] 2.6 Remove hardcoded developer-machine runner path fallback from the normal product path; store runner repo/binary selection as runtime app state.
- [ ] 2.7 Add runner path auto-detection for managed installs, bundled sidecars, and common local source checkout locations such as `~/Documents/Projects/symphony/elixir`.
- [ ] 2.8 Make managed runner launch work from a Finder-launched app by constructing explicit PATH/toolchain/Codex executable discovery instead of relying on shell startup files.
- [ ] 2.9 Fix release packaging so `.app` build success and DMG packaging success are reported separately, with deterministic DMG sizing or a simple fallback artifact.

## 3. Setup readiness model and diagnostics
- [ ] 3.1 Add Studio-side setup readiness model for runner, auth, repository, publication, and workspace diagnostics.
- [ ] 3.2 Add Codex readiness checks with actionable, redacted diagnostics.
- [ ] 3.3 Add GitHub CLI readiness checks with actionable, redacted diagnostics.
- [ ] 3.4 Add repository readiness checks for OpenSpec artifacts, validation, GitHub remote, fetchable base branch, and safe workspace root.
- [ ] 3.5 Add event stream/readiness checks and preserve technical details without exposing secrets.
- [ ] 3.6 Add launch-environment diagnostics that mimic a clean macOS app environment and verify `codex`, runner executable, and required runner toolchain commands are discoverable.
- [ ] 3.7 Add no-agent runner smoke checks for health, unsigned dispatch rejection, signed malformed-payload validation, and port cleanup.
- [ ] 3.8 Add source-build doctor output for Node/npm, Rust/Cargo, OpenSpec CLI, Codex CLI, GitHub CLI, runner binary, endpoint conflicts, and signing prerequisites.

## 4. Setup UX
- [ ] 4.1 Build Runner workspace setup UI for not set up, checking, needs attention, ready, running, incompatible/stale, and custom/user-managed states.
- [ ] 4.2 Add setup checklist rows with user-facing summaries, fix guidance, and expandable technical details.
- [ ] 4.3 Gate Build with agent on setup readiness and show checklist blockers when setup is incomplete.
- [ ] 4.4 Keep operational runner controls in Runner workspace and durable defaults in Settings.
- [ ] 4.5 Preserve current Runner Log, event stream, session secret, lifecycle, and dispatch history surfaces.
- [ ] 4.6 Add runtime runner repository/binary chooser and repair actions: auto-detect, choose folder, build/rebuild runner, test health, view logs, and switch to custom endpoint.
- [ ] 4.7 Keep implementation details such as Symphony, Elixir, escript, HMAC, and `WORKFLOW.md` in expandable technical detail rather than primary setup copy.

## 5. Tests and validation
- [ ] 5.1 Add tests for setup state derivation and compatibility blockers.
- [ ] 5.2 Add tests for auth diagnostics and redaction behavior.
- [ ] 5.3 Add tests for repository diagnostics and custom runner mode.
- [ ] 5.4 Add bridge tests for managed runner discovery/install/update or documented alpha fallback.
- [ ] 5.5 Run TypeScript checks, relevant frontend tests, Rust tests if bridge diagnostics change, build if affected, and OpenSpec validation.
- [ ] 5.6 Add tests or scripted checks for Finder-like clean PATH launch behavior and runner toolchain discovery.
- [ ] 5.7 Add packaging validation for `.app` and DMG/fallback artifacts.
