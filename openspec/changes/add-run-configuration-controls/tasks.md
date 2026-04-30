## 1. Specification
- [ ] 1.1 Define Runner workspace layout with Repo Runner Settings above Runner Log.
- [ ] 1.2 Define model/effort defaults, allowed values, and repo-wide runner scope.
- [ ] 1.3 Define dispatch-time application of explicit repo runner settings through optional execution metadata.
- [ ] 1.4 Define that default settings are omitted so Symphony `WORKFLOW.md` / configured defaults remain the fallback.
- [ ] 1.5 Define the expected Symphony follow-up contract for parsing and forwarding execution metadata to Codex `turn/start`.

## 2. Implementation
- [ ] 2.1 Add repo-scoped runner settings state to the app model and persistence layer.
- [ ] 2.2 Replace the static overview cards above Runner Log with a Repo Runner Settings panel.
- [ ] 2.3 Add model and effort controls using existing design-system patterns.
- [ ] 2.4 Serialize explicit non-default repo runner settings as optional execution metadata in Studio Runner dispatch events.
- [ ] 2.5 Keep default model/effort selections omitted from dispatch payloads.
- [ ] 2.6 Show requested/applied model and effort in Runner Log rows when available from local dispatch state or streamed runner events.
- [ ] 2.7 Keep runner status/lifecycle surfaces only in the inspector.
- [ ] 2.8 Avoid rewriting `WORKFLOW.md`, mutating `codex.command`, or requiring runner restart for model/effort-only changes.

## 3. Verification
- [ ] 3.1 Add/update app-model and persistence tests for repo runner settings.
- [ ] 3.2 Add/update dispatch payload tests for omitted defaults and included explicit execution metadata.
- [ ] 3.3 Add/update signing tests as needed to prove execution metadata is covered by the signed raw body.
- [ ] 3.4 Add/update Runner Log rendering tests for requested/applied execution settings.
- [ ] 3.5 Run TypeScript checks and targeted tests.
- [ ] 3.6 Validate this OpenSpec change.
