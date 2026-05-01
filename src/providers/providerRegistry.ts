import { OpenSpecProvider } from "./openspecProvider";
import type { InvokeAdapter, ProviderIssueReporter } from "./types";

export function createBuiltInOpenSpecProvider(dependencies: {
  invoke: InvokeAdapter;
  issues: ProviderIssueReporter;
  now: () => Date;
}): OpenSpecProvider {
  // Built-in providers are deterministic adapters. Runtime/generated adapters belong to future Foundry work.
  return new OpenSpecProvider(dependencies);
}
