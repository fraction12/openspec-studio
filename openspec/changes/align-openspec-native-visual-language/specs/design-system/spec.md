## ADDED Requirements

### Requirement: OpenSpec-native visual language
The system SHALL express a restrained, text-first visual language that feels native to OpenSpec.

#### Scenario: Primary app surfaces render
- **WHEN** the app renders navigation, boards, inspectors, and document previews
- **THEN** the visual design uses calm neutral surfaces, subtle borders, quiet control states, and limited semantic accents
- **AND** decorative elements do not compete with OpenSpec artifacts, source paths, or markdown content

#### Scenario: Status cues render
- **WHEN** validation, readiness, archive, stale, blocked, or missing states are shown
- **THEN** status styling uses compact trust cues
- **AND** semantic color is reserved for state recognition and action urgency
- **AND** status presentation does not dominate artifact content

### Requirement: Artifact-first typography
The system SHALL define typography tokens and component styles that prioritize readable OpenSpec artifacts.

#### Scenario: Markdown artifacts render
- **WHEN** proposal, design, task, or spec content is previewed
- **THEN** headings, paragraphs, lists, code, and paths use a consistent document reading scale
- **AND** source paths and artifact labels remain visible without crowding the content

#### Scenario: Code and delta content render
- **WHEN** code blocks, tree output, CLI snippets, or spec deltas are shown
- **THEN** monospace styling, line height, and block spacing make the content scannable
- **AND** added, modified, removed, and neutral lines are visually distinguishable without relying on loud backgrounds

### Requirement: Reviewable visual examples
The system SHALL keep proposal-stage visual examples available before implementation of broad visual direction changes.

#### Scenario: A visual-language change is proposed
- **WHEN** an OpenSpec change significantly alters app visual direction
- **THEN** the change includes at least one static visual review artifact
- **AND** the artifact demonstrates the intended hierarchy, surfaces, controls, table rows, and detail preview treatment
