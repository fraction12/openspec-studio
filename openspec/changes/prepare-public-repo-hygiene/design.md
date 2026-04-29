## Overview

This change defines the minimum public-readiness pass for OpenSpec Studio. It intentionally does not require the repo to be a mature contributor ecosystem. Instead, it prevents the obvious public-release mistakes: dirty worktree, local artifacts, unclear product promise, missing metadata, TODOs in README, unsafe-looking native permissions, or accidental private paths.

## Readiness Levels

### Level 1: Public-safe alpha

The repo can be made public without embarrassment. A visitor understands what the tool is, how to run it, what it supports, and what it does not support. The repo state is clean and intentional.

### Level 2: Contributor-ready OSS

The repo is structured for outside PRs: modular architecture, strong UI tests, contribution docs, CI, issue templates, roadmap discipline, and low contributor confusion.

This change targets **Level 1**. Level 2 can follow later.

## Findings Incorporated

### Product/positioning

- Launch as OpenSpec-specific alpha only.
- Do not claim provider-agnostic support yet.
- Add “Who this is for / not for.”
- Clarify that provider adapters are future/internal direction.
- Resolve roadmap confusion around guided workflows vs inspection workbench.

### Docs/packaging

- Worktree must be clean.
- Add or update metadata: `package.json`, `src-tauri/Cargo.toml`, `tauri.conf.json`.
- Add screenshots/GIF and remove README TODOs.
- Add basic public repo hygiene files where useful.
- Decide canonical repo/org and hardcoded URLs.
- Decide whether npm publishing is out of scope.

### Code/tests

- Build/test health is strong enough for source-visible alpha.
- `App.tsx` is large and should be refactored before contributor-heavy launch, but that is not required before simply making the repo public if the limitation is acknowledged.
- CI is recommended before accepting public PRs.

### Security/native

- No direct arbitrary command/path traversal blocker was found in the inspected native bridge.
- Rust bridge command/path allowlists are a strength.
- Windows process-tree containment is weaker than Unix because process-group termination is Unix-only while bundle targets currently say `all`.
- CSP/capabilities and persisted local metadata deserve a small hardening/privacy pass.

## Implementation Strategy

1. Freeze the public story: OpenSpec-specific local desktop inspection workbench.
2. Clean and commit the current OpenSpec archive/spec state.
3. Run a repo hygiene scan and update `.gitignore` where needed.
4. Update metadata and README.
5. Add a screenshot/GIF or remove public placeholder copy until one exists.
6. Add a short privacy/security section.
7. Decide supported platforms and Tauri bundle identifier before a binary release.
8. Add minimal CI/scaffolding if the repo will invite PRs.
9. Re-run all gates.

## Security Boundary Notes

Do not loosen the current Rust bridge while doing public cleanup. Preserve:

- fixed Tauri command list
- OpenSpec command allowlist
- change-name validation
- path canonicalization
- artifact reads bounded to `openspec/`
- symlink non-recursion
- command timeout/output limits

For Windows, either implement equivalent child-process tree termination or state that public alpha is macOS/Linux-first until Windows containment is handled.
