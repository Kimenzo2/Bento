// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

export type DesktopPlanCode = "free" | "core" | "pro" | "power";

const coreAnchorModules = new Set(["notes", "journal", "tasks", "passwords", "budget"]);

export function planRankFromCode(value: string | null | undefined): number {
  switch ((value ?? "").toLowerCase()) {
    case "core":
      return 1;
    case "pro":
      return 2;
    case "power":
      return 3;
    default:
      return 0;
  }
}

export function requiredPlanRankForModule(moduleId: string): number {
  if (moduleId === "dashboard" || moduleId === "settings") {
    return 0;
  }

  if (moduleId === "ai") {
    return 2;
  }

  return coreAnchorModules.has(moduleId) ? 1 : 2;
}

export function canAccessModuleByPlan(
  activePlanCode: string | null | undefined,
  moduleId: string,
  hasActiveSubscription: boolean,
): boolean {
  if (moduleId === "dashboard" || moduleId === "settings") {
    return true;
  }

  if (!hasActiveSubscription) {
    return false;
  }

  return planRankFromCode(activePlanCode) >= requiredPlanRankForModule(moduleId);
}

/**
 * Whether a module should be VISIBLE in the app switcher / tabs / launcher.
 *
 * - Free plan: only dashboard + settings visible
 * - Core plan: dashboard + settings + 5 anchor modules
 * - Pro / Power: all modules visible
 */
export function isModuleVisibleByPlan(
  activePlanCode: string | null | undefined,
  moduleId: string,
  _hasActiveSubscription: boolean,
): boolean {
  if (moduleId === "dashboard" || moduleId === "settings") {
    return true;
  }

  const rank = planRankFromCode(activePlanCode);

  // Core plan (rank 1): show only the 5 anchor modules
  if (rank === 1) {
    return requiredPlanRankForModule(moduleId) <= 1;
  }

  // Pro (rank 2) and Power (rank 3): all modules visible
  if (rank >= 2) {
    return true;
  }

  // Free (rank 0): no gated modules visible
  return false;
}
