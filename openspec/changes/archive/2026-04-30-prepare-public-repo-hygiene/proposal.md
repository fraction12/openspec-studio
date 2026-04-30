## Why

OpenSpec Studio is close to being safe to make public as a source-available/open-source alpha, but the goal is not to become fully contributor-ready yet. The immediate bar is simpler and stricter:

> If the repo becomes public, nothing should look sloppy, accidental, private, confusing, or embarrassing.

The code builds and tests pass, but repo hygiene and public-facing launch details still need a deliberate pass: clean worktree, no random local artifacts, proper ignore rules, package metadata, README clarity, screenshot/demo proof, basic security/privacy notes, and a clear OpenSpec-only alpha positioning.

## What Changes

- Add a public-release hygiene checklist and requirements for making the repo safe to make public.
- Separate **public-safe alpha** requirements from **full contributor-ready OSS** requirements.
- Require a clean intentional Git state before visibility changes.
- Require metadata/docs cleanup so the project looks coherent on GitHub.
- Require local/privacy/security review items to be addressed or explicitly documented.
- Keep positioning honest: current alpha supports OpenSpec only.

## Scope

### In scope for public-safe alpha

- Clean Git working tree and intentional commits.
- `.gitignore`/repo scan for local-only files, build artifacts, app state, generated folders, logs, screenshots, and private paths.
- README cleanup: remove TODOs, add supported platforms/prereqs, add screenshot/GIF, clarify OpenSpec-only alpha.
- Package metadata in `package.json`, `Cargo.toml`, and Tauri config.
- Basic GitHub hygiene: repo description/topics and at least minimal issue/PR/CI scaffolding if public PRs are possible.
- Security/privacy note: local file access, stored repo paths, validation diagnostics, and command boundaries.
- Native hardening decision for Windows process containment or supported-platform limitation.

### Not required for this change

- Full contributor community program.
- Broad provider-agnostic positioning.
- Adapter Foundry.
- Refactoring the entire frontend architecture before visibility change.
- Publishing binary installers or npm packages unless explicitly chosen.

## Public Launch Bar

This change treats the first public release as a **clean alpha**:

- good enough that an engineer can inspect the repo without seeing obvious sloppiness
- honest about current limitations
- safe from accidental local/private file leakage
- not over-positioned as a universal spec platform
- not necessarily optimized for outside contribution yet

## Impact

- README and public docs.
- Package/Tauri/Cargo metadata.
- `.gitignore` and repository file hygiene.
- OpenSpec roadmap clarity.
- Optional GitHub workflow/templates.
- Security/privacy documentation and hardening notes.
