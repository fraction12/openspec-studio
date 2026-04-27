## Why

Studio should avoid fragile markdown or terminal-output parsing where OpenSpec CLI JSON can provide canonical state. Any missing JSON fields should be captured deliberately instead of hard-coded around.

## What Changes

- Identify OpenSpec CLI JSON gaps needed by Studio.
- Propose structured output additions for status, list, show, validate, archive readiness, and workflow actions.
- Keep compatibility with existing output.

## Impact

- May create upstream OpenSpec CLI proposals.
- Reduces app-side inference and parsing fragility.
