export type SettingsDestructiveActionKind =
  | "clear-recent-repositories"
  | "reset-current-repository-continuity"
  | "clear-current-validation-cache"
  | "clear-all-validation-caches";

export type SettingsDestructiveActionKey =
  | SettingsDestructiveActionKind
  | `forget-recent-repository:${string}`;

export interface CurrentRepositorySettingsState {
  continuityAvailable: boolean;
  currentValidationAvailable: boolean;
  inactiveReason: string | null;
  currentValidationReason: string | null;
}

export function forgetRecentRepositoryActionKey(repoPath: string): SettingsDestructiveActionKey {
  return `forget-recent-repository:${repoPath}`;
}

export function beginSettingsDestructiveAction(
  action: SettingsDestructiveActionKey,
): SettingsDestructiveActionKey {
  return action;
}

export function cancelSettingsDestructiveAction(
  pendingAction: SettingsDestructiveActionKey | null,
  action: SettingsDestructiveActionKey,
): SettingsDestructiveActionKey | null {
  return pendingAction === action ? null : pendingAction;
}

export function confirmSettingsDestructiveAction(
  pendingAction: SettingsDestructiveActionKey | null,
  action: SettingsDestructiveActionKey,
): { confirmed: boolean; pendingAction: SettingsDestructiveActionKey | null } {
  return {
    confirmed: pendingAction === action,
    pendingAction: pendingAction === action ? null : pendingAction,
  };
}

export function isSettingsActionAwaitingConfirmation(
  pendingAction: SettingsDestructiveActionKey | null,
  action: SettingsDestructiveActionKey,
): boolean {
  return pendingAction === action;
}

export function deriveCurrentRepositorySettingsState({
  repoReady,
  hasCurrentValidationSnapshot,
}: {
  repoReady: boolean;
  hasCurrentValidationSnapshot: boolean;
}): CurrentRepositorySettingsState {
  if (!repoReady) {
    return {
      continuityAvailable: false,
      currentValidationAvailable: false,
      inactiveReason: "Open a valid repository to reset current-repository continuity.",
      currentValidationReason: "Open a valid repository to clear its validation cache.",
    };
  }

  return {
    continuityAvailable: true,
    currentValidationAvailable: hasCurrentValidationSnapshot,
    inactiveReason: null,
    currentValidationReason: hasCurrentValidationSnapshot
      ? null
      : "No current repository validation cache is stored.",
  };
}
