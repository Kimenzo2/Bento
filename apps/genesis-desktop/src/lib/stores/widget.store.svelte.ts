import { WidgetRegistry } from "$lib/components/island/widgets/widget-registry.svelte";
import type { WidgetManifest, WidgetEnabledState } from "$lib/components/island/widgets/widget-types.svelte";

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

class WidgetStore {
  manifests = $state<WidgetManifest[]>([]);
  enabled = $state.raw<WidgetEnabledState>({});

  load() {
    this.manifests = WidgetRegistry.getAll();
    const saved: WidgetEnabledState = loadJSON("bento:widgets:enabled", {});
    for (const w of this.manifests) {
      this.enabled[w.id] = saved[w.id] ?? w.defaultEnabled;
    }
  }

  toggle(id: string) {
    this.enabled = { ...this.enabled, [id]: !this.enabled[id] };
    localStorage.setItem("bento:widgets:enabled", JSON.stringify(this.enabled));
  }

  get enabledWidgets(): WidgetManifest[] {
    return this.manifests.filter((w) => this.enabled[w.id]);
  }
}

export const widgetStore = new WidgetStore();
