## Why

OpenSpec Studio now has a lint command, but it still treats architecture as informal reviewer knowledge. As the workbench grows, maintainers and coding agents need mechanical feedback when code crosses named Module Seams or accumulates complexity that should move behind a deeper Interface.

## What Changes

- Add architecture lint policy that protects the domain language in `CONTEXT.md`: Spec Provider, Provider Session, Workspace View-Model, Workbench Application Modules, Studio Runner Session, and Studio Runner Log Module.
- Enforce hard lint errors for clear Module Seam violations, especially imports that pull UI, Tauri, provider, runner, or persistence implementation knowledge into the wrong Module.
- Add soft lint warnings for high cyclomatic complexity and deep nesting so maintainers see pressure to deepen Modules without being forced into shallow extraction.
- Keep the policy incremental: warnings identify deepening opportunities, while hard errors protect explicit seams.
- Document which warnings are accepted as existing debt and which new violations must be fixed before merging.

## Capabilities

### New Capabilities

- `module-seam-linting`: ESLint-backed Module Seam, complexity, and depth guardrails for source architecture.

### Modified Capabilities

- None.

## Impact

- `eslint.config.js` gains repo-specific import restrictions and complexity/depth warnings.
- No new dependency is expected for the first pass; built-in ESLint and TypeScript ESLint rules are sufficient.
- Existing source may need small import-policy fixes if any current file violates a hard seam.
- Existing complexity/depth findings may remain warnings with documented follow-up rather than blocking this change.
