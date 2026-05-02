## Product Direction

Chosen approach: **hard Module Seams, soft complexity warnings**.

This turns linting into an architecture feedback loop without pretending lint can measure good design on its own. Hard errors protect seams that are already named in `CONTEXT.md`; warnings highlight implementations that may need deeper Modules later.

## Intent Brief

**Proposed solution:** Use ESLint to enforce modular code, complexity, and max-depth.
**User/job:** Maintainers and coding agents need fast feedback when code crosses the wrong Module Seam or becomes hard to reason about.
**Current situation:** ESLint catches generic TypeScript and React Hooks issues, but it does not encode OpenSpec Studio's domain seams.
**Pain/opportunity:** `App.tsx` and workflow Modules can keep accumulating responsibility unless the repo has mechanical guardrails.
**Desired outcome:** Lint protects locality and leverage without creating shallow Modules just to satisfy arbitrary thresholds.
**Success signal:** New code is blocked when it imports across a forbidden seam, and warned when implementation complexity suggests a deepening opportunity.

## Product Shape

**Primary user:** maintainers and coding agents working in OpenSpec Studio.
**Primary job:** preserve Module locality and keep architecture drift visible during normal local validation.
**MVP scope:**

- import restrictions for the clearest source seams;
- `complexity` warnings;
- `max-depth` warnings;
- documented thresholds and follow-up posture.

**Non-goals:**

- no broad App shell refactor;
- no hard-failing complexity or nesting gates in this pass;
- no formatting stack;
- no Rust linting;
- no graph-level dependency tooling unless ESLint import patterns prove insufficient.

## Architecture Guardrails

The first lint policy should protect these seams:

- `src/domain/**`: pure projection and workflow policy Modules. They must not import React, Tauri packages, provider implementations, runner implementations, persistence implementation, or app shell implementation.
- `src/providers/**`: Spec Provider and Provider Session Modules. They must not import React UI, runner implementation, app shell implementation, or settings UI state.
- `src/runner/**`: Studio Runner Session and Studio Runner Log Modules. They must not import React UI, provider implementation, app shell implementation, or settings UI state.
- `src/validation/**` and focused model Modules such as `src/settingsModel.ts`: pure policy/model Modules. They must not import React, Tauri, or app shell implementation.
- `src/App.tsx`: allowed to compose Modules and Tauri adapters, but should be the only place where broad shell wiring remains until deeper Workbench Application Modules absorb more behavior.

Type-only imports may be allowed where they describe an Interface without pulling an implementation across the seam. If the current ESLint rule cannot express a needed type-only exception safely, the implementation should prefer a small local type module or defer that exception rather than weakening the seam broadly.

## Complexity And Depth Policy

Use warnings, not errors, for:

- `complexity`: start with a threshold around `16`.
- `max-depth`: start with a threshold of `4`.

Warnings should be treated as prompts for the architecture skill's deletion test:

- If extracting a Module would merely move complexity to the caller, do not split just to silence lint.
- If the warning points to mixed responsibilities across a named concept, create or deepen a Module with a smaller Interface and better locality.

Existing warnings may be documented as known debt. New or changed code should avoid increasing the warning count unless the change explicitly accepts that tradeoff.

## Engineering Fit Brief

**Relevant existing code:**

- `eslint.config.js` already uses flat config, `@eslint/js`, `typescript-eslint`, and React Hooks rules.
- `CONTEXT.md` already names the source seams this policy should protect.
- `src/App.tsx` is intentionally large and currently acts as the app shell/wiring Module.
- `src/domain`, `src/providers`, `src/runner`, `src/validation`, `src/persistence.ts`, and focused model files already form useful enforcement scopes.

**Recommended implementation approach:**

- Add scoped ESLint config blocks with `no-restricted-imports`/TypeScript ESLint import restrictions.
- Add global or scoped `complexity` and `max-depth` warning rules.
- Run `npm run lint` and fix hard seam violations.
- Preserve existing complexity/depth warnings as warnings unless a tiny local fix is obvious.

**Dependencies:** none expected.

**Testing strategy:**

- `npm run lint` proves rule syntax and current hard errors.
- `npm run check` protects type compatibility.
- Focused tests only if implementation changes source behavior.
- `npx openspec validate enforce-module-seams-with-lint` validates the OpenSpec change.

## Research Notes

- ESLint flat config supports scoped configuration by file pattern, which fits source-area-specific seam policy.
- ESLint `no-restricted-imports` supports restricted paths and import patterns, which fits hard seam import errors.
- TypeScript ESLint provides an extension rule for import restrictions when TypeScript-specific behavior is needed.
- ESLint `complexity` and `max-depth` are built-in rules; they are useful architecture signals but not proof of Module depth.

Sources:

- https://eslint.org/docs/latest/use/configure/configuration-files
- https://eslint.org/docs/latest/rules/no-restricted-imports
- https://typescript-eslint.io/rules/no-restricted-imports
- https://eslint.org/docs/latest/rules/complexity
- https://eslint.org/docs/latest/rules/max-depth

## Risks

- Over-strict import rules can block legitimate Interface types. Mitigate by allowing narrow type-only seams or moving shared Interface types to explicit type Modules.
- Complexity warnings can incentivize shallow Modules. Mitigate by keeping them warnings and evaluating them through locality/leverage, not line-count anxiety.
- `App.tsx` may show many warnings. Do not use this change to force a risky shell refactor; use warnings to seed future deepening work.
