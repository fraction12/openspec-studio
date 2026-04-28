#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const target = args.get("--target") ?? "/tmp/openspec-studio-large-fixture";
const activeCount = numberArg("--active", 80);
const archivedCount = numberArg("--archived", 240);
const specCount = numberArg("--specs", 60);
const reset = process.argv.includes("--reset");
const startedAt = performance.now();

if (reset) {
  await rm(target, { force: true, recursive: true });
}

await mkdir(join(target, "openspec", "changes"), { recursive: true });
await mkdir(join(target, "openspec", "specs"), { recursive: true });

for (let index = 0; index < specCount; index += 1) {
  const capability = "capability-" + pad(index);
  await mkdir(join(target, "openspec", "specs", capability), { recursive: true });
  await writeFile(
    join(target, "openspec", "specs", capability, "spec.md"),
    [
      "# " + capability + " Specification",
      "",
      "## Purpose",
      "Synthetic fixture capability for OpenSpec Studio performance checks.",
      "",
      "## Requirements",
      "### Requirement: Fixture behavior " + index,
      "The system SHALL preserve fixture behavior " + index + ".",
      "",
      "#### Scenario: Fixture scenario",
      "- **WHEN** fixture data is indexed",
      "- **THEN** this requirement remains readable",
      "",
    ].join("\n"),
  );
}

for (let index = 0; index < activeCount; index += 1) {
  await writeChange(join(target, "openspec", "changes", "fixture-active-" + pad(index)), index, false);
}

for (let index = 0; index < archivedCount; index += 1) {
  await writeChange(
    join(target, "openspec", "changes", "archive", "2026-04-27-fixture-archived-" + pad(index)),
    index,
    true,
  );
}

const elapsedMs = Math.round(performance.now() - startedAt);
console.log(
  JSON.stringify(
    {
      target,
      active: activeCount,
      archived: archivedCount,
      specs: specCount,
      elapsedMs,
    },
    null,
    2,
  ),
);

function numberArg(name) {
  const raw = args.get(name);
  if (!raw) {
    return name === "--active" ? 80 : name === "--archived" ? 240 : 60;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(name + " must be a non-negative integer");
  }

  return parsed;
}

async function writeChange(dir, index, archived) {
  const capability = "capability-" + pad(index % Math.max(specCount, 1));
  await mkdir(join(dir, "specs", capability), { recursive: true });
  await writeFile(
    join(dir, "proposal.md"),
    [
      "# " + (archived ? "Archived" : "Active") + " fixture change " + index,
      "",
      "## Why",
      "Create repeatable OpenSpec Studio performance data.",
      "",
      "## What Changes",
      "- Update " + capability + ".",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(dir, "design.md"),
    [
      "# Design",
      "",
      "This synthetic design file gives the preview renderer enough content to parse.",
      "",
      "```txt",
      "openspec/changes/fixture-" + pad(index) + "/",
      "```",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(dir, "tasks.md"),
    [
      "# Tasks",
      "",
      "- [x] Task 1",
      "- [x] Task 2",
      "- [ ] Task 3",
      "- [ ] Task 4",
      "",
    ].join("\n"),
  );
  await writeFile(
    join(dir, "specs", capability, "spec.md"),
    [
      "## MODIFIED Requirements",
      "",
      "### Requirement: Fixture behavior",
      "The system SHALL index fixture behavior efficiently.",
      "",
      "#### Scenario: Fixture indexing",
      "- **WHEN** fixture files are loaded",
      "- **THEN** derived data remains accurate",
      "",
    ].join("\n"),
  );
}

function pad(value) {
  return String(value).padStart(4, "0");
}
