## 1. Clean repository state

- [x] Commit or revert the current `explore-persistent-app-data` archive/spec move so `git status --short` is clean.
- [x] Run a tracked/untracked file scan and identify accidental local files.
- [x] Update `.gitignore` for any missing local/build/cache/app-state patterns.
- [x] Scrub or justify machine-local absolute paths in tests/docs.

## 2. Public positioning cleanup

- [x] Add README section: “Who this is for / who this is not for.”
- [x] Add explicit README line: “Current alpha supports OpenSpec only.”
- [x] Move provider-adapter/Foundry language into a clearly marked future/exploring section, if mentioned at all.
- [x] Resolve or clearly park guided workflow positioning so the app does not look split between workbench and wizard.

## 3. Public docs/assets

- [x] Replace README screenshot/GIF TODO with at least one real screenshot/GIF or remove the placeholder.
- [x] Add supported platform and Tauri prerequisite notes.
- [x] Add exact install/dev-run steps for external users.
- [x] Add a short usage walkthrough from open repo → inspect change → validate → archive.

## 4. Metadata and identity

- [x] Add `description`, `license`, `repository`, `homepage`, `bugs`, and useful `keywords` to `package.json`.
- [x] Add `license`, `repository`, and `homepage` to `src-tauri/Cargo.toml`.
- [x] Decide canonical public repo/org and update hardcoded GitHub links.
- [x] Decide final Tauri bundle identifier before public binary release or document that binary releases are not yet provided.
- [x] Decide whether npm publishing is out of scope; if out of scope, document GitHub/source distribution and keep `private: true` intentionally.

## 5. Public safety/privacy

- [x] Add a README or SECURITY section explaining local file access, stored repo paths, validation diagnostics, and no hosted sync.
- [x] Decide whether to stop persisting full raw validation diagnostics by default or document/offer a clear-history path.
- [x] Narrow production CSP/connect-src if feasible, or document why localhost allowances remain.
- [x] Either implement Windows process-tree containment or document public alpha support as macOS/Linux-first until hardened.

## 6. Minimal GitHub hygiene

- [x] Add basic CI for `npm test`, `npm run check`, `npm run build`, `cargo check`, `cargo test`, and `openspec validate --all` if stable in CI.
- [x] Add a minimal `CONTRIBUTING.md` or state that outside contributions are not the focus yet.
- [x] Add `SECURITY.md` with vulnerability/private-reporting guidance.
- [x] Add issue/PR templates if public issues/PRs will be accepted.

## 7. Verification

- [x] `npm test`
- [x] `npm run check`
- [x] `npm run build`
- [x] `cd src-tauri && cargo check`
- [x] `cd src-tauri && cargo test`
- [x] `openspec validate prepare-public-repo-hygiene`
- [x] `openspec validate --all`
- [x] `git status --short` is clean before changing repo visibility.

Note: final clean status is satisfied by the commit that lands this hygiene pass.
