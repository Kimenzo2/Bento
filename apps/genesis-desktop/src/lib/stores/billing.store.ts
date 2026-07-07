import { browser } from "$app/environment";
import { isTauri } from "@tauri-apps/api/core";
import { get, writable } from "svelte/store";

export type BillingProfileSnapshot = {
  billingTier: string;
  userTier: string;
  hasActiveSubscription: boolean;
  activePlanCode: string | null;
  subscriptionEndDate: string | null;
  cancelAtPeriodEnd: boolean | null;
};

export const billingProfile = writable<BillingProfileSnapshot | null>(null);

let billingProfileRequest: Promise<BillingProfileSnapshot | null> | null = null;

function normalizeBillingProfile(profile: any): BillingProfileSnapshot {
  return {
    billingTier: String(profile?.billingTier ?? "free"),
    userTier: String(profile?.userTier ?? "Free"),
    hasActiveSubscription: Boolean(profile?.hasActiveSubscription),
    activePlanCode:
      typeof profile?.activePlanCode === "string" && profile.activePlanCode.trim()
        ? profile.activePlanCode.trim()
        : null,
    subscriptionEndDate:
      typeof profile?.subscriptionEndDate === "string" && profile.subscriptionEndDate.trim()
        ? profile.subscriptionEndDate
        : null,
    cancelAtPeriodEnd:
      typeof profile?.cancelAtPeriodEnd === "boolean" ? profile.cancelAtPeriodEnd : null,
  };
}

async function invokeTauri<T>(command: string): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command);
}

export function setBillingProfile(profile: BillingProfileSnapshot | null) {
  billingProfile.set(profile);
}

export function clearBillingProfile() {
  billingProfileRequest = null;
  billingProfile.set(null);
}

export function getBillingProfileSnapshot(): BillingProfileSnapshot | null {
  return get(billingProfile);
}

export async function refreshBillingProfile(): Promise<BillingProfileSnapshot | null> {
  if (!browser || !isTauri()) {
    billingProfile.set(null);
    return null;
  }

  if (billingProfileRequest) {
    return billingProfileRequest;
  }

  billingProfileRequest = invokeTauri<unknown>("get_billing_profile")
    .then((profile) => {
      const normalized = normalizeBillingProfile(profile);
      billingProfile.set(normalized);
      return normalized;
    })
    .catch(() => {
      billingProfile.set(null);
      return null;
    })
    .finally(() => {
      billingProfileRequest = null;
    });

  return billingProfileRequest;
}

export async function ensureBillingProfile(): Promise<BillingProfileSnapshot | null> {
  const current = getBillingProfileSnapshot();
  if (current) {
    return current;
  }

  return refreshBillingProfile();
}
