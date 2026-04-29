## 1. Clean repository state

- [ ] Commit or revert the current `explore-persistent-app-data` archive/spec move so `git status --short` is clean.
- [ ] Run a tracked/untracked file scan and identify accidental local files.
- [ ] Update `.gitignore` for any missing local/build/cache/app-state patterns.
- [ ] Scrub or justify machine-local absolute paths in tests/docs.

## 2. Public positioning cleanup

- [ ] Add README section: “Who this is for / who this is not for.”
- [ ] Add explicit README line: “Current alpha supports OpenSpec only.”
- [ ] Move provider-adapter/Foundry language into a clearly marked future/exploring section, if mentioned at all.
- [ ] Resolve or clearly park guided workflow positioning so the app does not look split between workbench and wizard.

## 3. Public docs/assets

- [ ] Replace README screenshot/GIF TODO with at least one real screenshot/GIF or remove the placeholder.
- [ ] Add supported platform and Tauri prerequisite notes.
- [ ] Add exact install/dev-run steps for external users.
- [ ] Add a short usage walkthrough from open repo → inspect change → validate → archive.

## 4. Metadata and identity

- [ ] Add `description`, `license`, `repository`, `homepage`, `bugs`, and useful `keywords` to `package.json`.
- [ ] Add `license`, `repository`, and `homepage` to `src-tauri/Cargo.toml`.
- [ ] Decide canonical public repo/org and update hardcoded GitHub links.
- [ ] Decide final Tauri bundle identifier before public binary release or document that binary releases are not yet provided.
- [ ] Decide whether npm publishing is out of scope; if out of scope, document GitHub/source distribution and keep `private: true` intentionally.

## 5. Public safety/privacy

- [ ] Add a README or SECURITY section explaining local file access, stored repo paths, validation diagnostics, and no hosted sync.
- [ ] Decide whether to stop persisting full raw validation diagnostics by default or document/offer a clear-history path.
- [ ] Narrow production CSP/connect-src if feasible, or document why localhost allowances remain.
- [ ] Either implement Windows process-tree containment or document public alpha support as macOS/Linux-first until hardened.

## 6. Minimal GitHub hygiene

- [ ] Add basic CI for `npm test`, `npm run check`, `npm run build`, `cargo check`, `cargo test`, and `openspec validate --all` if stable in CI.
- [ ] Add a minimal `CONTRIBUTING.md` or state that outside contributions are not the focus yet.
- [ ] Add `SECURITY.md` with vulnerability/private-reporting guidance.
- [ ] Add issue/PR templates if public issues/PRs will be accepted.

## 7. Verification

- [ ] `npm test`
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] `cd src-tauri && cargo check`
- [ ] `cd src-tauri && cargo test`
- [ ] `openspec validate prepare-public-repo-hygiene`
- [ ] `openspec validate --all`
- [ ] `git status --short` is clean before changing repo visibility.
