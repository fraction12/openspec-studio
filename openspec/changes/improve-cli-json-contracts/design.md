## Decisions

- Prefer additive JSON fields over changing existing fields.
- Preserve direct file scan fallback where JSON is unavailable.
- Record each app-side inference that should eventually become CLI-provided state.

## Risks

- Upstream JSON changes may lag app needs.
- Overfitting JSON to Studio could harm general CLI consumers.
