# Design

## Visual Direction
The mark should feel like OpenSpec rather than a generic editor icon:

- Restrained neutral foundation using black, off-white, and soft borders.
- A spec/document card as the primary object, echoing `proposal.md`, `design.md`, `tasks.md`, and spec deltas.
- Minimal delta rows using plus/minus semantics as quiet accents.
- Monospace "OS" detail for small-size recognition and continuity with the current rail mark.

## Asset Strategy
Keep one hand-authored SVG source as the canonical visual asset, then generate platform icons from it through the Tauri CLI. The SVG should remain simple enough to inspect and edit without a design tool.

## Integration
- Store the source app icon in `src-tauri/icons/openspec-studio-icon.svg`.
- Generate Tauri's existing icon outputs in `src-tauri/icons/`.
- Store a web-served copy in `public/openspec-studio-logo.svg`.
- Replace the left rail text badge with the logo asset while preserving the existing brand text.

## Risks
- Fine delta details can disappear below 32px. The OS monogram and document silhouette must remain legible at small sizes.
- The logo should not introduce a loud palette that conflicts with the OpenSpec-native visual language already implemented.
