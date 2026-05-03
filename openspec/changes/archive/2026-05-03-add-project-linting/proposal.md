## Why

OpenSpec Studio has TypeScript checks, tests, and production builds, but no dedicated lint command for fast static feedback on frontend source and local tooling files. A small ESLint setup will catch common JavaScript/TypeScript and React Hooks mistakes before they reach build or review.

## What Changes

- Add a project lint command that runs ESLint against TypeScript and TSX source/config files.
- Add a flat ESLint configuration scoped to the Vite/React/TypeScript app, local scripts, tests, and Vite config.
- Use the smallest practical dependency set: ESLint core rules, TypeScript ESLint rules, React Hooks rules, and maintained globals definitions.
- Exclude generated output, native build artifacts, dependencies, and OpenSpec content from linting.
- Keep linting additive and compatible with existing `npm run check`, `npm test`, and `npm run tauri:build` workflows.

## Capabilities

### New Capabilities

- `project-quality-tooling`: Local developer quality commands and linting boundaries.

### Modified Capabilities

- `public-release-hygiene`: Public release readiness includes a runnable lint command for source and tooling files.

## Impact

- `package.json` and `package-lock.json` gain lint tooling and the `lint` script.
- A new `eslint.config.js` defines source globs, globals, ignores, and rules.
- Existing source may need small fixes if the initial lint run exposes real issues.
