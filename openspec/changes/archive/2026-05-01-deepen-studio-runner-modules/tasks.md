## 1. Domain Vocabulary

- [x] 1.1 Add Studio Runner Session and Native Bridge Module terms to `CONTEXT.md`.

## 2. Frontend Studio Runner Session

- [x] 2.1 Create a frontend Studio Runner Session module with command adapters, DTO normalization, status transitions, session-secret operations, lifecycle operations, dispatch coordination, stream operations, and log mutation helpers.
- [x] 2.2 Update `App.tsx` to use the Studio Runner Session module while keeping UI rendering and repository/workspace selection in the app shell.
- [x] 2.3 Add focused tests for the Studio Runner Session module and keep existing app model Runner policy tests passing.

## 3. Native Bridge Modules

- [x] 3.1 Split shared bridge error, command execution, process termination, path, and dialog utilities into a native bridge module tree.
- [x] 3.2 Move local OpenSpec repository, command, archive, artifact, file record, and Git status behavior into a native OpenSpec bridge module.
- [x] 3.3 Move Studio Runner session, lifecycle, status, stream, endpoint, signing, process, and dispatch behavior into a native Studio Runner bridge module.
- [x] 3.4 Preserve existing Tauri command registrations and command names.

## 4. Verification

- [x] 4.1 Run frontend Runner/session and app model tests.
- [x] 4.2 Run `npm test -- --run`, `npm run check`, `cd src-tauri && cargo test`, `cd src-tauri && cargo check`, and `openspec validate deepen-studio-runner-modules --strict`.
- [x] 4.3 Run `openspec validate --all --strict`.
