#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const usage = [
  "Usage: node scripts/create-large-openspec-fixture.mjs [options]",
  "",
  "Options:",
  "  --target <path>     Fixture repository path (default: /tmp/openspec-studio-large-fixture)",
  "  --active <count>    Active change count (default: 80)",
  "  --archived <count>  Archived change count (default: 240)",
  "  --specs <count>     Baseline spec count (default: 60)",
  "  --reset             Remove the target before writing the fixture",
].join("\n");

try {
  await main();
} catch (error) {
  console.error("Error: " + (error instanceof Error ? error.message : String(error)));
  console.error("");
  console.error(usage);
  process.exitCode = 1;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = performance.now();

  if (options.reset) {
    await rm(options.target, { force: true, recursive: true });
  }

  await mkdir(join(options.target, "openspec", "changes"), { recursive: true });
  await mkdir(join(options.target, "openspec", "specs"), { recursive: true });

  for (let index = 0; index < options.specs; index += 1) {
    const capability = "capability-" + pad(index);
    await mkdir(join(options.target, "openspec", "specs", capability), { recursive: true });
    await writeFile(
      join(options.target, "openspec", "specs", capability, "spec.md"),
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

  for (let index = 0; index < options.active; index += 1) {
    await writeChange(join(options.target, "openspec", "changes", "fixture-active-" + pad(index)), index, false, options.specs);
  }

  for (let index = 0; index < options.archived; index += 1) {
    await writeChange(
      join(options.target, "openspec", "changes", "archive", "2026-04-27-fixture-archived-" + pad(index)),
      index,
      true,
      options.specs,
    );
  }

  const elapsedMs = Math.round(performance.now() - startedAt);
  console.log(
    JSON.stringify(
      {
        target: options.target,
        active: options.active,
        archived: options.archived,
        specs: options.specs,
        reset: options.reset,
        elapsedMs,
      },
      null,
      2,
    ),
  );
}

function parseArgs(argv) {
  const options = {
    target: "/tmp/openspec-studio-large-fixture",
    active: 80,
    archived: 240,
    specs: 60,
    reset: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const equalIndex = arg.indexOf("=");
    const name = equalIndex === -1 ? arg : arg.slice(0, equalIndex);
    const inlineValue = equalIndex === -1 ? undefined : arg.slice(equalIndex + 1);

    switch (name) {
      case "--reset":
        if (inlineValue !== undefined) {
          options.reset = parseBoolean("--reset", inlineValue);
        } else {
          options.reset = true;
        }
        break;
      case "--target":
        options.target = readValue(argv, index, name, inlineValue);
        if (inlineValue === undefined) {
          index += 1;
        }
        if (options.target.length === 0) {
          throw new Error("--target must not be empty");
        }
        break;
      case "--active":
      case "--archived":
      case "--specs": {
        const raw = readValue(argv, index, name, inlineValue);
        if (inlineValue === undefined) {
          index += 1;
        }
        options[name.slice(2)] = parseCount(name, raw);
        break;
      }
      default:
        if (arg.startsWith("--")) {
          throw new Error("Unknown option: " + name);
        }
        throw new Error("Unexpected positional argument: " + arg);
    }
  }

  return options;
}

function readValue(argv, index, name, inlineValue) {
  if (inlineValue !== undefined) {
    return inlineValue;
  }

  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(name + " requires a value");
  }

  return value;
}

function parseBoolean(name, value) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(name + " must be true or false when a value is provided");
}

function parseCount(name, raw) {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || raw.trim() === "") {
    throw new Error(name + " must be a non-negative integer");
  }

  return parsed;
}

async function writeChange(dir, index, archived, specCount) {
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
