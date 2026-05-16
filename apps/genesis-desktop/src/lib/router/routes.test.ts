import { describe, expect, it } from "vitest";
import { starterModuleIds } from "$lib/data/module-catalog";
import { starterModuleLoaders } from "$lib/modules/starter-module-registry";
import { routePatterns } from "$lib/router/route-patterns";

describe("Genesis app module routing", () => {
  it("matches launcher app URLs with a named appId route parameter", () => {
    const match = routePatterns.starterApp.exec("/apps/tasks");
    expect(match?.groups?.appId).toBe("tasks");
  });

  it("has a concrete module loader for every starter app", () => {
    for (const appId of starterModuleIds) {
      expect(starterModuleLoaders[appId]).toBeTypeOf("function");
    }
  });
});
