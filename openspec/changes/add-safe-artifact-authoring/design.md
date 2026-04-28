## Decisions

- Edits write directly to the selected repository's OpenSpec files.
- Keep external editor support as a first-class fallback.
- Refresh validation and artifact status after writes.
- Save operations compare against the loaded base snapshot and reject stale writes when the file changed externally.
- Writes stay inside the selected repository's `openspec/` tree and target only the selected artifact path.

## Risks

- In-app editing can create data loss if save/refresh boundaries are unclear.
- Markdown editing can grow into IDE scope if not constrained.
- External edits, canceled saves, path traversal, and write failures need explicit UI states so users do not lose changes or trust stale validation.
