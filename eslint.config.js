import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const complexityWarningThreshold = 16;
const maxDepthWarningThreshold = 4;

const tauriRuntimeRestriction = {
  regex: "^@tauri-apps/",
  message: "Tauri runtime access belongs in the app shell or native bridge adapter seam.",
};

const reactUiRestriction = {
  regex: "^react(?:$|/)|^react-dom(?:$|/)",
  message: "React UI imports belong in app shell or rendering modules, not behind this Module Seam.",
};

const appShellRestriction = {
  group: ["../App", "../App.*", "../main", "../main.*", "./App", "./App.*", "./main", "./main.*"],
  message: "App shell implementation must not be imported behind this Module Seam.",
};

const settingsStateRestriction = {
  group: ["../settingsModel", "../settingsModel.*", "./settingsModel", "./settingsModel.*"],
  message: "Settings UI state must stay outside provider and runner Modules.",
};

const providerImplementationRestriction = {
  group: [
    "../providers/openspecProvider",
    "../providers/openspecProvider.*",
    "../providers/providerRegistry",
    "../providers/providerRegistry.*",
    "../providers/providerSession",
    "../providers/providerSession.*",
  ],
  message: "Provider implementation must stay behind the Provider Session seam.",
};

const runnerImplementationRestriction = {
  group: [
    "../runner/studioRunnerLog",
    "../runner/studioRunnerLog.*",
    "../runner/studioRunnerSession",
    "../runner/studioRunnerSession.*",
  ],
  message: "Runner implementation must stay behind the Studio Runner Module seam.",
};

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/target/**",
      "src-tauri/gen/**",
      "coverage/**",
      "openspec/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      complexity: ["warn", { max: complexityWarningThreshold }],
      "max-depth": ["warn", maxDepthWarningThreshold],
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../persistence",
              message: "Domain Modules must not import persistence implementation.",
            },
            {
              name: "../providers/types",
              allowTypeImports: true,
              message: "Domain Modules may reference provider Interface types only.",
            },
          ],
          patterns: [
            reactUiRestriction,
            tauriRuntimeRestriction,
            appShellRestriction,
            providerImplementationRestriction,
            runnerImplementationRestriction,
          ],
        },
      ],
    },
  },
  {
    files: ["src/providers/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            reactUiRestriction,
            tauriRuntimeRestriction,
            appShellRestriction,
            settingsStateRestriction,
            runnerImplementationRestriction,
          ],
        },
      ],
    },
  },
  {
    files: ["src/runner/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../providers/types",
              allowTypeImports: true,
              message: "Runner Modules may reference provider Interface types only.",
            },
          ],
          patterns: [
            reactUiRestriction,
            tauriRuntimeRestriction,
            appShellRestriction,
            settingsStateRestriction,
            providerImplementationRestriction,
          ],
        },
      ],
    },
  },
  {
    files: ["src/validation/**/*.{ts,tsx}", "src/settingsModel.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [reactUiRestriction, tauriRuntimeRestriction, appShellRestriction],
        },
      ],
    },
  },
  {
    files: ["vite.config.ts", "scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: globals.node,
    },
  },
);
