# Add Studio Runner global settings controls

## Why
Studio Runner is now a real end-to-end capability, so model and effort choices should live where users expect durable app configuration: Settings. The Runner workspace should remain the operational cockpit for lifecycle, status, stream state, and the Runner Log rather than growing a settings panel above the log.

Codex app-server supports `model` and `effort` on `turn/start`, which is the cleanest application point for these defaults. Studio should keep the UX global for v1, and the signed dispatch event can carry the current global Runner defaults as execution metadata so Symphony can forward them to Codex without rewriting `WORKFLOW.md`, mutating command strings, or requiring a runner restart solely for model/effort changes.

## What changes
- Add global Studio Runner model and effort controls to the Settings page under an implemented Runner integration section.
- Treat these controls as global defaults for future Studio-managed runner dispatches, not ad-hoc selected-change or per-repository controls.
- Include explicit non-default model/effort selections in the signed `build.requested` event as optional execution metadata.
- Keep default selections omitted from the payload so Symphony's configured defaults remain authoritative.
- Keep runner status, endpoint, secret, lifecycle, and stream state in the Runner inspector/workspace surfaces.
- Keep the Runner Log as the primary Runner workspace event/history surface; the Runner tab may show only a compact summary/link for current defaults.
- Preserve historical log rows as immutable records of the settings actually requested for each dispatch.

## Out of scope
- Removing or shrinking the Runner Log.
- Moving runner lifecycle/status out of the inspector.
- Adding one-off per-dispatch controls in the selected-change inspector.
- Adding per-repository override hierarchy before global defaults have proven insufficient.
- Rewriting Symphony `WORKFLOW.md` or mutating the runner command from Studio for this feature.
- Supporting arbitrary free-form model IDs beyond the approved/options-backed control shape.
- Implementing the Symphony receiver/executor changes in this Studio UI/spec change, except documenting the expected contract.

## Impact
- `app-settings`: Settings integration section for global Studio Runner defaults.
- `local-desktop-shell`: Runner workspace cleanup/summary behavior and signed dispatch payload shape.
- `local-app-persistence`: App-local persistence for global Runner defaults.
- Studio Runner bridge/signing: include optional execution metadata in dispatch events when explicit repo defaults are selected.
- Symphony follow-up: parse optional execution metadata, store it on the work item, pass it to Codex `turn/start`, and echo it in stream/log metadata.
