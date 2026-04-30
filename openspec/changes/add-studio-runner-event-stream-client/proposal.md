# Add Studio Runner event stream client

## Summary

Wire OpenSpec Studio to consume the local Studio Runner SSE stream exposed by the Symphony runner and render live execution/publication status in the Runner workspace and selected-change inspector.

## Motivation

Studio can currently start the local runner and dispatch signed `build.requested` events, but its UI mostly reflects delivery/acceptance state. Symphony now exposes authoritative execution metadata through `/api/v1/studio-runner/events/stream`, including completion, blocked/failure state, workspace/session data, branch/commit metadata, and PR URL. Studio needs to subscribe to that stream so the product loop closes inside the desktop app: dispatch, observe, and open the resulting PR without polling or shell inspection.

## Scope

- Add a local-only SSE client in the Tauri/Rust bridge for Studio Runner event streams.
- Convert the configured runner events endpoint into the stream endpoint safely.
- Emit bounded runner event updates from the bridge to the React app.
- Merge stream updates into persisted runner dispatch history by event ID.
- Render every Studio Runner-related event in a unified Runner Log table and selected-change history.
- Start/reconnect/stop the stream based on runner reachability, endpoint changes, and lifecycle actions.

## Out of Scope

- Remote or non-local runner streaming.
- WebSocket transport.
- Background polling as the primary update mechanism.
- Full terminal log streaming from runner/Codex.
- Treating the Runner Log as arbitrary application telemetry unrelated to Studio Runner.
- Editing or controlling runner jobs beyond existing dispatch/start/stop actions.
