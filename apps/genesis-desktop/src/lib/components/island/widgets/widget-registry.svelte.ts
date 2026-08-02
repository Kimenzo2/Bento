// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { WidgetManifest } from "./widget-types.svelte";

type WidgetMap = Record<string, WidgetManifest>;

class WidgetRegistryClass {
  widgets = $state<WidgetMap>({});

  register(manifest: WidgetManifest): void {
    this.widgets = { ...this.widgets, [manifest.id]: manifest };
  }

  unregister(id: string): boolean {
    if (!(id in this.widgets)) return false;
    const { [id]: _, ...rest } = this.widgets;
    this.widgets = rest;
    return true;
  }

  get(id: string): WidgetManifest | undefined {
    return this.widgets[id];
  }

  getAll(): WidgetManifest[] {
    return Object.values(this.widgets);
  }

  getByCategory(category: WidgetManifest["category"]): WidgetManifest[] {
    return this.getAll().filter((w) => w.category === category);
  }

  getCompactWidgets(): WidgetManifest[] {
    return this.getAll().filter((w) => w.hasCompactMode && w.CompactComponent);
  }

  has(id: string): boolean {
    return id in this.widgets;
  }

  get count(): number {
    return Object.keys(this.widgets).length;
  }
}

export const WidgetRegistry = new WidgetRegistryClass();

export function registerWidget(manifest: WidgetManifest): void {
  WidgetRegistry.register(manifest);
}
