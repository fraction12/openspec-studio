## Decisions

- Edits write directly to the selected repository's OpenSpec files.
- Keep external editor support as a first-class fallback.
- Refresh validation and artifact status after writes.

## Risks

- In-app editing can create data loss if save/refresh boundaries are unclear.
- Markdown editing can grow into IDE scope if not constrained.
