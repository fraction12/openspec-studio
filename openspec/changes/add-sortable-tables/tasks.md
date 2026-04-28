## 1. Shared Table Sorting

- [x] Add sortable column metadata to the shared table component.
- [x] Render an updated-time sort icon/control in changes and specs table headers.
- [x] Apply newest-first default sorting after filters and before row limiting.
- [x] Toggle updated-time sorting between newest first and oldest first.

## 2. Data And Interaction Safety

- [x] Sort from `modifiedTimeMs` derived from indexed OpenSpec files.
- [x] Keep row selection and keyboard navigation stable after sorting.
- [x] Preserve column resize and horizontal scroll behavior.

## 3. Verification

- [x] Add focused tests for default updated sort and toggle behavior.
- [x] Run type checks, unit tests, build, and OpenSpec validation.
