import { describe, expect, it } from "vitest";

import {
  MARKDOWN_PREVIEW_BLOCK_CACHE_LIMIT,
  parseMarkdownPreviewBlocks,
  parseMarkdownPreviewBlocksCached,
} from "./markdownPreviewModel";

describe("Markdown Preview Model", () => {
  it("derives lightweight Markdown preview blocks", () => {
    const blocks = parseMarkdownPreviewBlocks([
      "# **Proposal**",
      "",
      "First paragraph",
      "continues with `code`.",
      "",
      "- **Item one**",
      "* `Item two`",
      "",
      "```ts",
      "const value = 1;",
      "```",
      "#### Tail",
    ].join("\n"));

    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "Proposal" },
      { kind: "paragraph", text: "First paragraph continues with code." },
      { kind: "list", items: ["Item one", "Item two"] },
      { kind: "code", text: "const value = 1;" },
      { kind: "heading", level: 4, text: "Tail" },
    ]);
  });

  it("returns no blocks for empty preview content", () => {
    expect(parseMarkdownPreviewBlocks("")).toEqual([]);
  });

  it("reuses cached parse results for matching content", () => {
    const content = "## Cached\n\n- item";

    expect(parseMarkdownPreviewBlocksCached(content)).toBe(parseMarkdownPreviewBlocksCached(content));
  });

  it("evicts older cached parse results after the cache limit", () => {
    const originalContent = "## cache-bound-original";
    const original = parseMarkdownPreviewBlocksCached(originalContent);

    for (let index = 0; index < MARKDOWN_PREVIEW_BLOCK_CACHE_LIMIT; index += 1) {
      parseMarkdownPreviewBlocksCached("## cache-bound-entry-" + index);
    }

    expect(parseMarkdownPreviewBlocksCached(originalContent)).not.toBe(original);
  });
});
