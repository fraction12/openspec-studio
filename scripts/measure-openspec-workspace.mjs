#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

try {
  await main();
} catch (error) {
  console.error("Error: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}

async function main() {
  const repoPath = readRepoPath(process.argv.slice(2));
  const openspecPath = join(repoPath, "openspec");
  await validateDirectory(repoPath, "Measurement target");
  await validateDirectory(openspecPath, "Measurement target openspec/ directory");

  const startedAt = performance.now();
  const records = [];
  let markdownBytes = 0;
  let markdownFilesRead = 0;

  const scanStartedAt = performance.now();
  await walk(openspecPath, repoPath, records);
  const scanElapsedMs = Math.round(performance.now() - scanStartedAt);

  const markdownStartedAt = performance.now();

  for (const record of records) {
    if (record.kind === "file" && record.path.endsWith(".md")) {
      const content = await readFile(join(repoPath, record.path), "utf8");
      record.content = content;
      markdownBytes += Buffer.byteLength(content);
      markdownFilesRead += 1;
    }
  }

  const readElapsedMs = Math.round(performance.now() - markdownStartedAt);
  const { indexOpenSpecWorkspace, close } = await loadProductionIndexer();

  let indexed;
  let productionIndexMs = 0;
  let derivedModelMs = 0;
  let derivedCounts;

  try {
    const indexStartedAt = performance.now();
    indexed = indexOpenSpecWorkspace({ files: records });
    productionIndexMs = Math.round(performance.now() - indexStartedAt);

    const modelStartedAt = performance.now();
    derivedCounts = deriveCounts(indexed);
    derivedModelMs = Math.round(performance.now() - modelStartedAt);
  } finally {
    await close();
  }

  console.log(
    JSON.stringify(
      {
        repoPath,
        records: records.length,
        files: records.filter((record) => record.kind === "file").length,
        directories: records.filter((record) => record.kind === "directory").length,
        markdownFilesRead,
        markdownBytes,
        derivedCounts,
        metadataScanMs: scanElapsedMs,
        markdownReadMs: readElapsedMs,
        productionIndexMs,
        derivedModelMs,
        totalMs: Math.round(performance.now() - startedAt),
      },
      null,
      2,
    ),
  );
}

function readRepoPath(argv) {
  if (argv.length > 1) {
    throw new Error("Expected at most one target path.");
  }

  return resolve(argv[0] ?? process.cwd());
}

async function validateDirectory(path, label) {
  let metadata;
  try {
    metadata = await stat(path);
  } catch (error) {
    throw new Error(label + " does not exist: " + path);
  }

  if (!metadata.isDirectory()) {
    throw new Error(label + " is not a directory: " + path);
  }
}

async function loadProductionIndexer() {
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const { createServer } = await import("vite");
  const server = await createServer({
    appType: "custom",
    logLevel: "silent",
    root: projectRoot,
    server: {
      middlewareMode: true,
    },
  });
  let module;
  try {
    module = await server.ssrLoadModule("/src/domain/openspecIndex.ts");
  } catch (error) {
    await server.close();
    throw error;
  }

  if (typeof module.indexOpenSpecWorkspace !== "function") {
    await server.close();
    throw new Error("Could not load production workspace indexer.");
  }

  return {
    indexOpenSpecWorkspace: module.indexOpenSpecWorkspace,
    close: () => server.close(),
  };
}

function deriveCounts(indexed) {
  return {
    activeChanges: indexed.activeChanges.length,
    archivedChanges: indexed.archivedChanges.length,
    specs: indexed.specs.length,
    activeDeltaSpecs: indexed.activeChanges.reduce(
      (total, change) => total + change.artifacts.deltaSpecs.length,
      0,
    ),
    archivedDeltaSpecs: indexed.archivedChanges.reduce(
      (total, change) => total + change.artifacts.deltaSpecs.length,
      0,
    ),
  };
}

async function walk(dir, repoPath, records) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    const relativePath = relative(repoPath, path).replaceAll("\\", "/");
    const metadata = await stat(path);

    if (entry.isDirectory()) {
      records.push({
        kind: "directory",
        path: relativePath,
        modifiedTimeMs: metadata.mtimeMs,
        fileSize: metadata.size,
      });
      await walk(path, repoPath, records);
      continue;
    }

    if (entry.isFile()) {
      records.push({
        kind: "file",
        path: relativePath,
        modifiedTimeMs: metadata.mtimeMs,
        fileSize: metadata.size,
      });
    }
  }
}
