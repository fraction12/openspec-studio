import { describe, expect, it } from "vitest";

import {
  beginSettingsDestructiveAction,
  cancelSettingsDestructiveAction,
  confirmSettingsDestructiveAction,
  deriveCurrentRepositorySettingsState,
  forgetRecentRepositoryActionKey,
  isSettingsActionAwaitingConfirmation,
  type SettingsDestructiveActionKey,
} from "./settingsModel";

describe("settings interaction model", () => {
  it("requires confirm before a destructive action can mutate state", () => {
    const action = "clear-recent-repositories";
    let pendingAction: SettingsDestructiveActionKey | null = null;

    expect(confirmSettingsDestructiveAction(pendingAction, action)).toEqual({
      confirmed: false,
      pendingAction: null,
    });

    pendingAction = beginSettingsDestructiveAction(action);
    expect(isSettingsActionAwaitingConfirmation(pendingAction, action)).toBe(true);

    pendingAction = cancelSettingsDestructiveAction(pendingAction, action);
    expect(pendingAction).toBeNull();

    pendingAction = beginSettingsDestructiveAction(action);
    expect(confirmSettingsDestructiveAction(pendingAction, action)).toEqual({
      confirmed: true,
      pendingAction: null,
    });
  });

  it("keeps separate confirmation state per recent repository row", () => {
    const first = forgetRecentRepositoryActionKey("/repo/one");
    const second = forgetRecentRepositoryActionKey("/repo/two");
    const pendingAction = beginSettingsDestructiveAction(first);

    expect(isSettingsActionAwaitingConfirmation(pendingAction, first)).toBe(true);
    expect(isSettingsActionAwaitingConfirmation(pendingAction, second)).toBe(false);
    expect(confirmSettingsDestructiveAction(pendingAction, second)).toEqual({
      confirmed: false,
      pendingAction,
    });
  });

  it("models no-active-repository Settings states without disabling app-wide controls", () => {
    expect(
      deriveCurrentRepositorySettingsState({
        repoReady: false,
        hasCurrentValidationSnapshot: false,
      }),
    ).toEqual({
      continuityAvailable: false,
      currentValidationAvailable: false,
      inactiveReason: "Open a valid repository to reset current-repository continuity.",
      currentValidationReason: "Open a valid repository to clear its validation cache.",
    });

    expect(
      deriveCurrentRepositorySettingsState({
        repoReady: true,
        hasCurrentValidationSnapshot: false,
      }),
    ).toMatchObject({
      continuityAvailable: true,
      currentValidationAvailable: false,
      inactiveReason: null,
    });
  });
});
