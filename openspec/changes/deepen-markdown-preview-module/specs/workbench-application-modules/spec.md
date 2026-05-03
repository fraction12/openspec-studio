## ADDED Requirements

### Requirement: Markdown Preview Model owns preview block derivation
The system SHALL provide a Markdown Preview Model Module that derives lightweight Markdown preview blocks and bounded cache behavior outside the React app shell.

#### Scenario: Markdown preview blocks are derived
- **WHEN** artifact preview content contains headings, paragraphs, lists, fenced code blocks, bold text, and inline code
- **THEN** the Markdown Preview Model SHALL derive the same ordered preview block records previously rendered by the app shell
- **AND** React callers SHALL NOT need to know parsing, text cleanup, paragraph flushing, list flushing, or code-block flushing details.

#### Scenario: Markdown preview parse results are cached within bounds
- **WHEN** Markdown preview content is parsed repeatedly
- **THEN** the Markdown Preview Model SHALL reuse cached parse results for matching content
- **AND** it SHALL cap retained parse results to the existing local cache limit.

### Requirement: Markdown Preview Model remains behavior-preserving
The Markdown Preview Model extraction SHALL NOT change visible Markdown preview behavior, artifact preview empty states, persistence state, provider behavior, runner behavior, native command names, public APIs, data schemas, external dependencies, or generated files.

#### Scenario: Existing preview rendering remains stable
- **WHEN** the app shell renders a Markdown preview
- **THEN** it SHALL render headings, paragraphs, lists, and code blocks from the Markdown Preview Model records with the same visible classes and text content used before extraction.
