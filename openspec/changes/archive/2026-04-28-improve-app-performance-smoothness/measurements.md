# Performance Measurements

These local measurements use the helper scripts added with this change. They are not product telemetry.

## Baseline: Current Repository

Command:

```sh
node scripts/measure-openspec-workspace.mjs /Volumes/MacSSD/Projects/openspec-studio
```

Result:

```json
{
  "records": 183,
  "files": 107,
  "directories": 76,
  "markdownFilesRead": 88,
  "markdownBytes": 208874,
  "metadataScanMs": 9,
  "markdownReadMs": 15,
  "totalMs": 24
}
```

## Baseline: Synthetic Large Fixture

Command:

```sh
npm run perf:fixture
node scripts/measure-openspec-workspace.mjs /tmp/openspec-studio-large-fixture
```

Result:

```json
{
  "records": 2363,
  "files": 1340,
  "directories": 1023,
  "markdownFilesRead": 1340,
  "markdownBytes": 194920,
  "metadataScanMs": 56,
  "markdownReadMs": 65,
  "totalMs": 121
}
```

## Post-Implementation Verification

The helper scripts are intentionally filesystem-only, so they validate fixture shape and local scan/read costs rather than full app refresh behavior. The product path now uses metadata-only refresh before fetching Markdown content when a change is detected.

Current repository helper run:

```json
{
  "records": 184,
  "files": 108,
  "directories": 76,
  "markdownFilesRead": 89,
  "markdownBytes": 209973,
  "metadataScanMs": 13,
  "markdownReadMs": 31,
  "totalMs": 43
}
```

Synthetic fixture helper run:

```json
{
  "records": 2363,
  "files": 1340,
  "directories": 1023,
  "markdownFilesRead": 1340,
  "markdownBytes": 194920,
  "metadataScanMs": 122,
  "markdownReadMs": 137,
  "totalMs": 259
}
```

Packaged app smoke test:

- Built `OpenSpec Studio.app` and DMG successfully.
- Launched the packaged app.
- Confirmed the last repository restored, change board rendered, inspector rendered real proposal content, footer showed latest change and OpenSpec Git status, and the app used the new OpenSpec Studio icon/brand mark.

## Notes

- The large fixture intentionally has many small files, which stresses traversal, IPC payload count, status fan-out, and indexer shape more than raw byte throughput.
- Timing numbers vary with filesystem cache and machine load; use them as coarse local baselines, not strict pass/fail thresholds.
