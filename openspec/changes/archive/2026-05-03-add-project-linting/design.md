## Overview

This change adds ESLint as a focused developer quality tool for the existing Vite/React/TypeScript application. TypeScript remains the authoritative type check; ESLint adds fast rule-based feedback for JavaScript/TypeScript best practices and React Hooks correctness.

## Product Boundary

In scope:

- a local `npm run lint` command;
- ESLint flat config for `src/**/*.{ts,tsx}`, `scripts/**/*.mjs`, and `vite.config.ts`;
- dependency additions needed for the smallest practical setup;
- ignore coverage for generated and native build outputs.

Out of scope:

- formatting enforcement or Prettier adoption;
- Rust linting or formatting changes;
- CI wiring;
- broad code-style rewrites unrelated to lint findings;
- linting OpenSpec markdown or generated build artifacts.

## Selected Tooling

Use ESLint flat config because current ESLint versions default to flat configuration and the project is ESM. Use:

- `eslint` for the CLI/runtime;
- `@eslint/js` for core recommended JavaScript rules;
- `typescript-eslint` for parser and recommended TypeScript rules;
- `eslint-plugin-react-hooks` for React Hooks ordering/dependency checks;
- `globals` for maintained browser/node global definitions.

Do not add `eslint-plugin-react` in this pass. The React 17+ JSX transform does not need React-in-scope rules, and TypeScript already provides the most useful component typing feedback.

## Configuration Shape

The config should:

- ignore `dist`, `node_modules`, `src-tauri/target`, generated bundle outputs, and local machine artifacts;
- lint app source as browser code with JSX support;
- lint Vite config and scripts as Node code;
- apply TypeScript recommended rules without type-aware linting for the first pass, keeping lint fast and avoiding a second semantic analysis layer beside `tsc`;
- enable React Hooks recommended rules;
- avoid style-only rules that would create churn.

## Risks

- Initial lint adoption can expose noisy legacy issues. Mitigate by choosing recommended, correctness-oriented rules and making only scoped fixes required for the new command to pass.
- Type-aware linting could slow local validation. Defer it until the project has a stronger need for rules that require type information.
- Linting generated or native build outputs could produce false positives. Keep ignores explicit.

## Rejected Approaches

- Ultra-minimal ESLint plus TypeScript only: rejected because React Hooks rules are high-signal for this app.
- Full React lint plugin: rejected as unnecessary for the current JSX transform and TypeScript coverage.
- Formatting stack in the same change: rejected to keep this focused on correctness linting.
