import { rm, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const probes = [
  {
    path: "src/providers/__lint_probe_tmp__/runner-fixture.ts",
    source: "import { mergeRunnerStreamEvent } from '../../runner/studioRunnerLog';\nvoid mergeRunnerStreamEvent;\n",
    message: "Runner implementation must stay behind the Studio Runner Module seam",
  },
  {
    path: "src/providers/__lint_probe_tmp__/settings-fixture.ts",
    source: "import { createDefaultSettings } from '../../settingsModel';\nvoid createDefaultSettings;\n",
    message: "Settings UI state must stay outside provider and runner Modules",
  },
  {
    path: "src/domain/__lint_probe_tmp__/provider-fixture.ts",
    source: "import { createOpenSpecProvider } from '../../providers/openspecProvider';\nvoid createOpenSpecProvider;\n",
    message: "Provider implementation must stay behind the Provider Session seam",
  },
  {
    path: "src/domain/__lint_probe_tmp__/runner-fixture.ts",
    source: "import { mergeRunnerStreamEvent } from '../../runner/studioRunnerLog';\nvoid mergeRunnerStreamEvent;\n",
    message: "Runner implementation must stay behind the Studio Runner Module seam",
  },
  {
    path: "src/runner/__lint_probe_tmp__/provider-fixture.ts",
    source: "import { createOpenSpecProvider } from '../../providers/openspecProvider';\nvoid createOpenSpecProvider;\n",
    message: "Provider implementation must stay behind the Provider Session seam",
  },
];

const probeDirs = [...new Set(probes.map((probe) => probe.path.split("/").slice(0, -1).join("/")))];
const probePaths = probes.map((probe) => probe.path);

async function runEslint(paths) {
  return await new Promise((resolve) => {
    const child = spawn("./node_modules/.bin/eslint", ["--no-ignore", ...paths], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, output: `${stdout}${stderr}` });
    });
  });
}

async function cleanup() {
  await Promise.all(probeDirs.map((dir) => rm(dir, { recursive: true, force: true })));
}

await cleanup();

try {
  for (const dir of probeDirs) {
    await mkdir(dir, { recursive: true });
  }

  for (const probe of probes) {
    await writeFile(probe.path, probe.source);
  }

  const result = await runEslint(probePaths);
  const missingMessages = probes
    .map((probe) => probe.message)
    .filter((message) => !result.output.includes(message));
  const restrictedImportHits = result.output.match(/no-restricted-imports/g)?.length ?? 0;

  if (result.code === 0 || missingMessages.length > 0 || restrictedImportHits !== probes.length) {
    console.error("Module seam lint probes failed.");
    console.error(`Expected ${probes.length} no-restricted-imports errors, received ${restrictedImportHits}.`);
    if (missingMessages.length > 0) {
      console.error(`Missing messages:\n- ${missingMessages.join("\n- ")}`);
    }
    console.error(result.output);
    process.exitCode = 1;
  } else {
    console.log(`Module seam lint probes passed (${restrictedImportHits}/${probes.length} restricted imports blocked).`);
  }
} finally {
  await cleanup();
}
