## Context

The current desktop shell repeats repository paths, workbench labels, status pills, and file actions across the global header, left navigation, board inspectors, and Runner workspace. Recent changes moved runner and build readiness into clearer top-level concepts, but older UI copy still exposes `Blocked`, `Reachable`, `Trust`, `Base spec`, and inspector paths in places where they now read as duplicate or misleading.

## Goals / Non-Goals

**Goals:**

- Make the header and inspectors quieter by removing labels that do not help the immediate workflow.
- Use one runner availability vocabulary: `Online` and `Offline`, including internal UI-facing state names.
- Rename Specs trust presentation to validation presentation: `Validate`, `Valid`, and `Invalid`.
- Keep the existing app functionality, data derivation, runner controls, and validation command behavior.

**Non-Goals:**

- Add new settings, runner features, validation behavior, or filesystem actions.
- Change historical runner log event states such as `running`, `completed`, `blocked`, or `failed`.
- Remove repository paths from all contexts; paths may still appear in recent repository details or low-level diagnostics where useful.

## Decisions

- Prefer removal over relocation for redundant inspector chrome. The Specs inspector will rely on the selected spec title and source preview; the Runner inspector will rely on its actionable controls rather than repeating repository identity and runner status.
- Keep validation derivation aligned with existing validation trust data, but rename the user-facing spec column and states. A spec with no current validation snapshot shows `Validate`; a passing result shows `Valid`; a failing result associated with that spec shows `Invalid`.
- Rename runner availability states in the UI model to `online` and `offline`, with labels `Online` and `Offline`. Runner log execution states remain unchanged because they describe event outcomes, not runner availability.

## Risks / Trade-offs

- Removing paths from inspectors may make direct file discovery less immediate for power users. The trade-off is intentional; the focused inspector should prioritize readable artifact content over filesystem metadata.
- Renaming internal runner state touches model tests and dispatch eligibility checks. Keeping the shape small and updating tests around status derivation reduces regression risk.
