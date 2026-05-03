# Tasks

## 1. Markdown Preview Model
- [x] 1.1 Extract Markdown block parsing and bounded cache policy from `src/App.tsx` into `src/domain/markdownPreviewModel.ts`.
- [x] 1.2 Update `MarkdownPreview` to render blocks from the new module interface without changing visible UI behavior.

## 2. Tests
- [x] 2.1 Add focused tests for headings, paragraphs, lists, code blocks, Markdown text cleanup, and empty input.
- [x] 2.2 Add focused tests for cached parse reuse and cache-bound eviction.

## 3. Validation
- [x] 3.1 Run the focused Markdown Preview Model tests.
- [x] 3.2 Run `npm test`.
- [x] 3.3 Run `npm run check`.
- [x] 3.4 Run `npm run lint`.
- [x] 3.5 Run `openspec validate deepen-markdown-preview-module --strict`.
