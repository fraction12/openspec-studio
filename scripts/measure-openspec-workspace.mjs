#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { performance } from "node:perf_hooks";

const repoPath = process.argv[2] ?? process.cwd();
const openspecPath = join(repoPath, "openspec");
const startedAt = performance.now();
const records = [];
let markdownBytes = 0;
let markdownFilesRead = 0;

await walk(openspecPath);

const scanElapsedMs = Math.round(performance.now() - startedAt);
const markdownStartedAt = performance.now();

for (const record of records) {
  if (record.kind === "file" && record.path.endsWith(".md")) {
    const content = await readFile(join(repoPath, record.path));
    markdownBytes += content.byteLength;
    markdownFilesRead += 1;
  }
}

const readElapsedMs = Math.round(performance.now() - markdownStartedAt);

console.log(
  JSON.stringify(
    {
      repoPath,
      records: records.length,
      files: records.filter((record) => record.kind === "file").length,
      directories: records.filter((record) => record.kind === "directory").length,
      markdownFilesRead,
      markdownBytes,
      metadataScanMs: scanElapsedMs,
      markdownReadMs: readElapsedMs,
      totalMs: Math.round(performance.now() - startedAt),
    },
    null,
    2,
  ),
);

async function walk(dir) {
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
        size: metadata.size,
      });
      await walk(path);
      continue;
    }

    if (entry.isFile()) {
      records.push({
        kind: "file",
        path: relativePath,
        modifiedTimeMs: metadata.mtimeMs,
        size: metadata.size,
      });
    }
  }
}
