export type DesktopPlanCode = "free" | "creator" | "studio" | "empire" | "power";

const coreAnchorModules = new Set([
  "notes",
  "journal",
  "tasks",
  "passwords",
  "budget",
]);

export function planRankFromCode(value: string | null | undefined): number {
  switch ((value ?? "").toLowerCase()) {
    case "creator":
      return 1;
    case "studio":
      return 2;
    case "power":
      return 3;
    case "empire":
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
