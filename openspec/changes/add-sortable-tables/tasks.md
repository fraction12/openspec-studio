## 1. Shared Table Sorting

- [ ] Add sortable column metadata to the shared table component.
- [ ] Render an updated-time sort icon/control in changes and specs table headers.
- [ ] Apply newest-first default sorting after filters and before row limiting.
- [ ] Toggle updated-time sorting between newest first and oldest first.

## 2. Data And Interaction Safety

- [ ] Sort from `modifiedTimeMs` derived from indexed OpenSpec files.
- [ ] Keep row selection and keyboard navigation stable after sorting.
- [ ] Preserve column resize and horizontal scroll behavior.

## 3. Verification

- [ ] Add focused tests for default updated sort and toggle behavior.
- [ ] Run type checks, unit tests, build, and OpenSpec validation.
