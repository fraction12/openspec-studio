## Overview

Create a Markdown Preview Model Module under `src/domain/` and move the parsing and bounded cache implementation out of `src/App.tsx`. The module interface should expose the parsed block type and a cached parse function so the React shell can render blocks without owning Markdown parsing policy.

## Architecture

Current shape:

```text
App.tsx
  MarkdownPreview renderer
  MarkdownBlock type
  parseMarkdownBlocks implementation
  parseMarkdownBlocksCached cache policy
```

Target shape:

```text
src/domain/markdownPreviewModel.ts
  MarkdownBlock type
  parseMarkdownPreviewBlocks(content)
  parseMarkdownPreviewBlocksCached(content)

App.tsx
  MarkdownPreview renderer only
```

## Deepening Rationale

- **Module**: Markdown Preview Model.
- **Interface**: Markdown block records plus cached and uncached parse functions.
- **Implementation**: line normalization, heading/list/paragraph/code parsing, Markdown text cleanup, and bounded cache eviction.
- **Depth**: callers learn a small block-derivation interface while parsing and caching behavior stays behind it.
- **Seam**: `src/domain/markdownPreviewModel.ts`.
- **Adapter**: none; the behavior does not vary, so no adapter seam is introduced.
- **Leverage**: App rendering and tests can exercise the same parse behavior without routing through React.
- **Locality**: future preview parsing fixes live in one module rather than in the app shell.

Deletion test: deleting the Markdown Preview Model would move parsing, text cleanup, and cache eviction back into `App.tsx` or duplicate it in tests. That means the module keeps real policy local rather than acting as a pass-through.

## Constraints

- Preserve the existing cache limit of 40 entries.
- Preserve current Markdown preview block shapes and visible rendering behavior.
- Do not add dependencies or broaden Markdown support beyond the current lightweight parser.
- Do not edit unrelated active OpenSpec changes or the existing archived-change/spec reconciliation work in the tree.

## Validation Plan

- Add focused Vitest coverage for Markdown block derivation and cache eviction.
- Run the new focused test file.
- Run `npm test`.
- Run `npm run check`.
- Run `npm run lint`.
- Run `openspec validate deepen-markdown-preview-module --strict`.
