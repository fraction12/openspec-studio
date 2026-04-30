## Overview

The app already derives `ChangeRecord.buildStatus` from the Build Status rules. Runner dispatch should treat that value as the source of truth for change readiness instead of re-deriving readiness from proposal/design/tasks/validation fields.

## Design

`deriveRunnerDispatchEligibility` will accept a selected change that includes its build status kind. The function will keep the checks that are not part of change readiness:

- a real repository is open
- one active change is selected
- Studio Runner endpoint is configured
- the session secret exists
- Studio Runner is reachable

For the selected active change, dispatch eligibility will require `buildStatus.kind === "ready"`. If the selected change is active but not ready, the disabled reason will point to the Build Status value rather than listing hidden artifact or validation checks.

The dispatch flow will continue to run validation before sending the request when validation is absent or not passing. After validation updates the workspace, the flow will re-read the latest selected change and re-run eligibility. That re-check will still rely on the latest `buildStatus.kind`.

## Non-Goals

- Do not change how Build Status is derived.
- Do not add new runner capabilities or runner payload fields.
- Do not make `design.md` required through runner eligibility when Build Status says the change is ready.
