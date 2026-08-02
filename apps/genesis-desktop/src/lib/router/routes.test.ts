// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { describe, expect, it } from "vitest";
import { starterModuleIds } from "$lib/data/module-catalog";
import { starterModuleLoaders } from "$lib/modules/starter-module-registry";
import { routePatterns } from "$lib/router/route-patterns";

describe("Bento app module routing", () => {
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
