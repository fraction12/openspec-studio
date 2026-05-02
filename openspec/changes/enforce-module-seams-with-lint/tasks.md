## 1. Architecture Lint Policy

- [ ] 1.1 Add scoped lint rules that hard-error on clear Module Seam import violations.
- [ ] 1.2 Add warning-level `complexity` and `max-depth` rules with documented thresholds.
- [ ] 1.3 Keep type-only Interface imports narrow; avoid broad exceptions that weaken the seam.

## 2. Adoption

- [ ] 2.1 Run `npm run lint` and fix hard Module Seam errors.
- [ ] 2.2 Document or preserve existing complexity/depth warnings as non-blocking architecture follow-up.
- [ ] 2.3 Avoid broad refactors unless a warning exposes an obvious small locality fix.

## 3. Verification

- [ ] 3.1 Run `npm run lint`.
- [ ] 3.2 Run `npm run check`.
- [ ] 3.3 Run focused tests if any source behavior changes.
- [ ] 3.4 Run `npx openspec validate enforce-module-seams-with-lint`.
