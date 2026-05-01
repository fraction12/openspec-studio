## Context

OpenSpec Studio now has real Studio Runner behavior: endpoint configuration, session-secret setup, lifecycle start/stop/status, dispatch eligibility, pre-dispatch validation, signed dispatch requests, event stream connection, stream parsing, and log persistence. Those pieces are currently split across React state, app model helpers, persistence updates, and Tauri commands. The deletion test shows the current helpers are useful but shallow: deleting them would move status and dispatch complexity back into `App.tsx`.

The native bridge has a similar file-level issue. `src-tauri/src/bridge.rs` contains deep internal implementations, but the module as a whole is "everything native": OpenSpec repo detection, command execution, file collection, artifact reads, Git status, Studio Runner lifecycle, stream client, dispatch signing, process management, and tests all share one file.

## Goals / Non-Goals

**Goals:**

- Add a frontend Studio Runner Session module with an interface that concentrates operational runner workflow.
- Keep `App.tsx` as the composition owner for UI state while moving runner transitions, command invocation, log mutations, and DTO normalization behind the runner session seam.
- Split the Rust bridge into submodules that separate shared command/error/path utilities, local OpenSpec operations, and Studio Runner operations.
- Preserve existing Tauri command names, payload shapes, persistence state, and visible behavior.
- Keep tests focused on the new module interfaces.

**Non-Goals:**

- Do not add Runner features, settings controls, new payload fields, or new native commands.
- Do not change durable Runner defaults or endpoint placement.
- Do not change OpenSpec Provider behavior, archive behavior, or workspace indexing behavior.
- Do not change process lifecycle security rules such as localhost-only endpoints and session-only secrets.

## Decisions

### Add a frontend Studio Runner Session module

Create a module that accepts adapters for Tauri invocation, status generation, provider validation, message updates, issue recording, and persisted log updates. Its interface should expose high-level operations: configure secret, clear secret, start, stop, check status, dispatch selected change, start stream, stop stream, and receive stream/error events.

`App.tsx` will remain the owner of React rendering and repository/workspace selection, but the runner session owns the operational runner state transitions and side effects. This improves locality: future dispatch or stream fixes live behind one module interface instead of across callback clusters.

Alternative considered: move only pure DTO helpers out of `App.tsx`. That gives small test wins but does not increase depth; callers would still need to know ordering, generation guards, status transitions, and log mutation policy.

### Keep Runner policy helpers reusable

Existing pure helpers in `appModel.ts` remain reusable for readiness, payload shape, stream log merge, lifecycle log creation, and history filtering. The Studio Runner Session module will compose them rather than duplicate them.

Alternative considered: move all Runner helpers into the session module. That would make the session interface broad and reduce leverage for tests that only need pure policy.

### Split native bridge by domain module, not by command count

Replace the single bridge file with a bridge module tree:

- shared bridge module: error DTOs, bounded command execution, process termination, path helpers, and common command validation utilities;
- local OpenSpec module: repository detection, OpenSpec command execution, archive, artifact reads, file record collection, and Git status;
- Studio Runner module: session secret, process lifecycle, status, stream client, signed dispatch, endpoint normalization, and runner tests.

The external Tauri seam remains the same by registering the same command names from the new module paths. Repository folder picking stays with the local OpenSpec bridge command surface because it is still part of selecting the local repository workspace, while the shared module owns the reusable error and execution machinery underneath.

Alternative considered: move only the runner block into a submodule and leave OpenSpec plus shared helpers in `bridge.rs`. That improves some locality but leaves the file-level module still shaped as "everything else native."

## Risks / Trade-offs

- Refactor size could create churn against active Runner changes → Keep this behavior-preserving and avoid touching user-facing copy or payloads.
- Rust visibility could become noisy after splitting modules → Prefer `pub(super)` and explicit re-exports over making everything public.
- Async React state sequencing can regress if moved carelessly → Keep generation guards and refs in the Runner Session interface and verify with existing tests plus new focused tests.
- Native tests may need relocation → Keep test coverage attached to the module that owns the implementation under test.
