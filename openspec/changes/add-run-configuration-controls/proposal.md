# Add Studio Runner repo runner settings

## Why
The Runner workspace currently spends its top-of-page space on static explanatory cards. Those cards were useful during early setup, but the useful operator control is now repo-scoped runner configuration: choosing the default model and effort Studio should request for Studio-managed runner work from the active repository.

Codex app-server supports `model` and `effort` on `turn/start`, which is the cleanest application point for these defaults. Studio should keep the UX repo-wide, but the signed dispatch event can carry the current repo defaults as execution metadata so Symphony can forward them to Codex without rewriting `WORKFLOW.md`, mutating command strings, or requiring a runner restart solely for model/effort changes.

## What changes
- Replace the static cards above the Runner Log with a compact **Repo Runner Settings** panel.
- Add model and effort selection controls scoped to the active repository.
- Treat these controls as repo-wide defaults for future Studio-managed runner dispatches, not ad-hoc selected-change controls.
- Include explicit non-default model/effort selections in the signed `build.requested` event as optional execution metadata.
- Keep default selections omitted from the payload so Symphony's configured defaults remain authoritative.
- Keep runner status, endpoint, secret, lifecycle, and stream state in the Runner inspector.
- Keep the Runner Log below settings and preserve it as the repo-wide event/history surface.
- Preserve historical log rows as immutable records of the settings actually requested for each dispatch.

## Out of scope
- Removing or shrinking the Runner Log.
- Moving runner lifecycle/status out of the inspector.
- Building a separate settings page for runner defaults.
- Adding one-off per-dispatch controls in the selected-change inspector.
- Rewriting Symphony `WORKFLOW.md` or mutating the runner command from Studio for this feature.
- Supporting arbitrary free-form model IDs beyond the approved/options-backed control shape.
- Implementing the Symphony receiver/executor changes in this Studio UI/spec change, except documenting the expected contract.

## Impact
- `local-desktop-shell`: Runner workspace layout, repo-scoped runner settings behavior, and signed dispatch payload shape.
- `local-app-persistence`: App-local persistence for per-repository runner defaults.
- Studio Runner bridge/signing: include optional execution metadata in dispatch events when explicit repo defaults are selected.
- Symphony follow-up: parse optional execution metadata, store it on the work item, pass it to Codex `turn/start`, and echo it in stream/log metadata.
