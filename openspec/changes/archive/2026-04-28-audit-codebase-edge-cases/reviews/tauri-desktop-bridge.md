# Tauri/Rust Desktop Integration Review

## Summary

- P0: 0
- P1: 2
- P2: 3
- P3: 1

Verification performed: `cargo test` in `src-tauri` passed with 20 unit tests.

## Findings

### Native folder picker is a no-op on non-macOS packaged targets

- Severity: P1
- Area: Tauri desktop integration / platform assumptions
- File: `src-tauri/src/bridge.rs`; `src-tauri/src/lib.rs`; `src-tauri/tauri.conf.json`
- Lines: `src-tauri/src/bridge.rs:339-348`, `src-tauri/src/lib.rs:19-35`, `src-tauri/tauri.conf.json:26-28`
- Problem: `pick_repository_folder` returns `Ok(None)` for every non-macOS build, while the app registers an "Open Repository..." menu action and the bundle config targets all platforms. `None` is also the same result shape used for a user-cancelled picker on macOS, so the frontend cannot distinguish "unsupported platform" from cancellation.
- Why it matters: The packaged Windows/Linux desktop app exposes the open-repository workflow but cannot open a native folder picker. This breaks a core onboarding/open workflow on advertised bundle targets and makes the failure silent.
- Reproduction or evidence: Build or run the Tauri app on Linux or Windows and invoke `pick_repository_folder`; the `#[cfg(not(target_os = "macos"))]` branch always returns `Ok(None)` without showing a picker or returning an error. The menu item still emits `open-repository-menu`, and the bundle configuration uses `"targets": "all"`.
- Recommended fix: Use Tauri's cross-platform dialog plugin for folder selection, or gate the native menu/bundle targets to supported platforms. If a platform is intentionally unsupported, return a typed `BridgeErrorDto` such as `unsupported_platform` instead of `None` so the UI can show an actionable message.

### Command timeout can hang forever when child processes keep stdio open

- Severity: P1
- Area: Command execution / blocking and concurrency
- File: `src-tauri/src/bridge.rs`
- Lines: `src-tauri/src/bridge.rs:614-680`
- Problem: `run_bounded_command` kills only the direct child on timeout/output overflow, then immediately calls `join_output` on reader threads. If the command spawns a descendant process that inherits stdout or stderr, killing the parent does not close those pipes; the reader thread can block waiting for EOF and the spawned blocking task never resolves. The same hang can happen without a timeout if the parent exits while a detached child keeps the inherited pipe open.
- Why it matters: OpenSpec commands are Node/CLI commands and can invoke subprocesses. A validation or archive operation that times out should return a timeout error, but this code can instead wedge a Tauri blocking worker indefinitely and leave background processes running.
- Reproduction or evidence: A command script such as `sh -c 'sleep 600 &'` or a Node wrapper that spawns a long-lived child with inherited stdio can exit or be killed while the child still owns the pipe. After `child.kill()` and `child.wait()`, `join_output(stdout_handle)` waits for the reader to finish, but EOF does not arrive until the descendant exits. The existing timeout test covers only a single direct child that does not spawn descendants.
- Recommended fix: Run commands in a killable process group/session on Unix and a Job Object on Windows, and terminate the full tree on timeout/overflow. Also make output reader joins bounded/cancellable so timeout handling cannot block indefinitely after the timeout condition is detected.

### File listing aborts or hides symlinks based on symlink targets

- Severity: P2
- Area: Filesystem/path edge cases
- File: `src-tauri/src/bridge.rs`
- Lines: `src-tauri/src/bridge.rs:856-865`, `src-tauri/src/bridge.rs:888-896`
- Problem: `collect_openspec_files` calls `canonicalize_path(&path)` before handling symlinks. A broken symlink under `openspec/` causes the entire file listing to fail, and a symlink whose target resolves outside `openspec/` is silently skipped because the target path fails the `starts_with(openspec_root)` check.
- Why it matters: The file index is supposed to represent the selected repository's OpenSpec tree. A single stale symlink can prevent the app from loading repository data, and an external symlink inside `openspec/` disappears from the UI instead of being visible as a symlink that is intentionally not followed.
- Reproduction or evidence: In a valid repository, create `openspec/bad-link` pointing at a missing path; `fs::canonicalize` returns an I/O error and `list_openspec_file_records` fails. Create `openspec/readme-link` pointing at `../README.md`; the symlink is skipped because its canonical target is outside `openspec_root`, even though the link entry itself is inside `openspec/`.
- Recommended fix: Branch on `symlink_metadata.file_type().is_symlink()` before canonicalizing the target. Record symlink entries by their link path without following them, optionally including target/read-error metadata. Only canonicalize non-symlink files/directories before recursing or reading content.

### Git porcelain status loses the leading status column

- Severity: P2
- Area: JSON contract / derived git status data
- File: `src-tauri/src/bridge.rs`
- Lines: `src-tauri/src/bridge.rs:817-823`, `src-tauri/src/bridge.rs:1357-1365`
- Problem: `parse_git_status_entries` calls `str::trim`, which removes leading spaces from porcelain status lines. In Git porcelain v1, the first two characters are meaningful `XY` status columns, so `" M openspec/spec.md"` becomes `"M openspec/spec.md"` and no longer distinguishes unstaged modified from staged modified.
- Why it matters: The bridge returns status entries as user-facing state. Stripping the leading column makes dirty-state details misleading and can cause later UI or automation logic to interpret the wrong git state.
- Reproduction or evidence: `git status --porcelain -- openspec` emits a leading space for unstaged-only changes. The unit test currently locks in the lossy behavior by expecting `" M openspec/changes/demo/tasks.md"` to become `"M openspec/changes/demo/tasks.md"`.
- Recommended fix: Preserve the porcelain record exactly except for the trailing newline, for example filter with `line.trim().is_empty()` but return `line.to_string()` or `line.trim_end().to_string()`. Prefer parsing `XY` into explicit fields if the frontend needs structured status.

### Desktop CSP is disabled while native invoke commands can read files and run local CLIs

- Severity: P2
- Area: Security boundaries / packaged app hardening
- File: `src-tauri/tauri.conf.json`; `src-tauri/src/lib.rs`
- Lines: `src-tauri/tauri.conf.json:22-24`, `src-tauri/src/lib.rs:39-50`
- Problem: The Tauri app sets `"csp": null` while registering invoke commands that read OpenSpec files and execute local `openspec`/`git` commands for a selected repository.
- Why it matters: Tauri's webview is the boundary in front of native capabilities. With no Content Security Policy, any future XSS, unsafe dependency behavior, or unexpected remote content inclusion has a larger path to invoke native commands exposed to the main window.
- Reproduction or evidence: The configuration explicitly disables CSP, and the invoke handler exposes commands including `archive_change`, `run_openspec_command`, `read_openspec_artifact_file`, and `get_openspec_git_status`.
- Recommended fix: Add a restrictive CSP for the packaged app, at minimum limiting scripts/styles/assets to the app origin and disallowing remote script execution. Keep native commands available only to the intended local window capability and avoid broad plugin permissions unless they are used.

### Template greet command remains exposed in the invoke surface

- Severity: P3
- Area: Tauri command surface / maintainability
- File: `src-tauri/src/lib.rs`
- Lines: `src-tauri/src/lib.rs:8-12`, `src-tauri/src/lib.rs:39-50`
- Problem: The generated `greet` demo command is still registered in the production invoke handler even though it is not part of the OpenSpec Studio product surface.
- Why it matters: This is low risk because it only formats a string, but it expands the callable native API and leaves template code in a security-sensitive boundary.
- Reproduction or evidence: `greet` is defined as a `#[tauri::command]` and included in `tauri::generate_handler!`, while no product code references it.
- Recommended fix: Remove the `greet` command and its registration once no tests or frontend code depend on it.
