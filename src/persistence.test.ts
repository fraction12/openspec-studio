import { describe, expect, it } from "vitest";

import type { OpenSpecFileSignature } from "./appModel";
import {
  createDefaultPersistedAppState,
  directionFromSortPreference,
  normalizePersistedAppState,
  rememberPersistedRepo,
  sortPreferenceFromDirection,
  updatePersistedRepoSelection,
  updatePersistedRepoSort,
  updatePersistedValidationSnapshot,
  validationFromPersistedSnapshot,
} from "./persistence";
import { parseValidationResult } from "./validation/results";

const currentSignature: OpenSpecFileSignature = {
  fingerprint: "openspec/specs/example/spec.md:100:20",
  latestPath: "openspec/specs/example/spec.md",
  latestModifiedTimeMs: 100,
};

describe("local app persistence", () => {
  it("drops corrupt, future-version, and invalid state", () => {
    expect(normalizePersistedAppState(null)).toEqual(createDefaultPersistedAppState());
    expect(normalizePersistedAppState({ version: 99 })).toEqual(createDefaultPersistedAppState());

    expect(
      normalizePersistedAppState({
        version: 1,
        recentRepos: ["browser-preview://openspec-studio", "/repo/one", "/repo/one"],
        lastRepoPath: "relative/path",
        globalPreferences: { density: "tiny", theme: "dark" },
        repoStateByPath: {
          "relative/path": { lastOpenedAt: 1 },
          "/repo/one": { lastOpenedAt: 2, changeSort: "updated-asc" },
        },
      }),
    ).toEqual({
      version: 1,
      recentRepos: [{ path: "/repo/one", name: "one", lastOpenedAt: 0 }],
      lastRepoPath: "/repo/one",
      globalPreferences: { theme: "dark" },
      repoStateByPath: {
        "/repo/one": { lastOpenedAt: 2, changeSort: "updated-asc" },
      },
      runnerSettings: undefined,
      runnerDispatchAttempts: [],
    });
  });

  it("caps, dedupes, and records recent repositories", () => {
    let state = createDefaultPersistedAppState();

    for (let index = 0; index < 7; index += 1) {
      state = rememberPersistedRepo(
        state,
        { path: "/repo/" + index, name: "repo-" + index },
        index,
      );
    }

    state = rememberPersistedRepo(state, { path: "/repo/3", name: "repo-3" }, 99);

    expect(state.recentRepos.map((repo) => repo.path)).toEqual([
      "/repo/3",
      "/repo/6",
      "/repo/5",
      "/repo/4",
      "/repo/2",
    ]);
    expect(state.lastRepoPath).toBe("/repo/3");
    expect(state.repoStateByPath["/repo/3"]?.lastOpenedAt).toBe(99);
  });

  it("persists selection and sort preferences per repository", () => {
    let state = rememberPersistedRepo(
      createDefaultPersistedAppState(),
      { path: "/repo/current", name: "current" },
      1,
    );

    state = updatePersistedRepoSelection(state, "/repo/current", {
      changeId: "change-one",
      specId: "spec-one",
    });
    state = updatePersistedRepoSort(state, "/repo/current", {
      changeSort: sortPreferenceFromDirection("asc"),
      specSort: sortPreferenceFromDirection("desc"),
    });

    expect(state.repoStateByPath["/repo/current"]).toMatchObject({
      lastSelectedChange: "change-one",
      lastSelectedSpec: "spec-one",
      changeSort: "updated-asc",
      specSort: "updated-desc",
    });
    expect(directionFromSortPreference(state.repoStateByPath["/repo/current"]?.changeSort)).toBe("asc");
  });


  it("persists runner settings and dispatch attempts", () => {
    const normalized = normalizePersistedAppState({
      version: 1,
      recentRepos: [],
      globalPreferences: {},
      repoStateByPath: {},
      runnerSettings: { endpoint: "http://127.0.0.1:4000/api/v1/studio-runner/events", signingSecret: "legacy-secret-should-not-persist" },
      runnerDispatchAttempts: [
        {
          eventId: "evt_demo",
          repoPath: "/repo/current",
          changeName: "add-runner",
          status: "accepted",
          message: "Accepted",
          createdAt: "2026-04-29T12:00:00.000Z",
          updatedAt: "2026-04-29T12:00:01.000Z",
          statusCode: 202,
          runId: "run_demo",
          executionStatus: "completed",
          prUrl: "https://github.com/example/repo/pull/1",
          source: "stream",
        },
      ],
    });

    expect(normalized.runnerSettings?.endpoint).toBe("http://127.0.0.1:4000/api/v1/studio-runner/events");
    expect(normalized.runnerSettings).not.toHaveProperty("signingSecret");
    expect(normalized.runnerDispatchAttempts?.[0]).toMatchObject({
      eventId: "evt_demo",
      status: "accepted",
      statusCode: 202,
      runId: "run_demo",
      executionStatus: "completed",
      prUrl: "https://github.com/example/repo/pull/1",
      source: "stream",
    });
  });

  it("restores matching validation snapshots as current cached validation", () => {
    const validation = parseValidationResult(
      { valid: true, items: [] },
      { validatedAt: new Date("2026-04-28T12:00:00.000Z") },
    );
    const state = updatePersistedValidationSnapshot(
      rememberPersistedRepo(createDefaultPersistedAppState(), { path: "/repo/current", name: "current" }),
      "/repo/current",
      validation,
      currentSignature,
    );

    const restored = validationFromPersistedSnapshot(
      state.repoStateByPath["/repo/current"]?.lastValidation,
      currentSignature,
    );

    expect(restored?.state).toBe("pass");
    expect(restored?.validatedAt).toBe("2026-04-28T12:00:00.000Z");
  });

  it("marks validation snapshots stale when the file fingerprint changes", () => {
    const validation = parseValidationResult(
      { valid: true, items: [] },
      { validatedAt: new Date("2026-04-28T12:00:00.000Z") },
    );
    const state = updatePersistedValidationSnapshot(
      rememberPersistedRepo(createDefaultPersistedAppState(), { path: "/repo/current", name: "current" }),
      "/repo/current",
      validation,
      currentSignature,
    );

    const restored = validationFromPersistedSnapshot(
      state.repoStateByPath["/repo/current"]?.lastValidation,
      {
        fingerprint: "openspec/specs/example/spec.md:200:40",
        latestPath: "openspec/specs/example/spec.md",
        latestModifiedTimeMs: 200,
      },
    );

    expect(restored?.state).toBe("stale");
    expect(restored?.previousState).toBe("pass");
    expect(restored?.staleReason?.changedPath).toBe("openspec/specs/example/spec.md");
  });
});
