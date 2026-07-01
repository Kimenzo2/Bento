import { invoke } from "@tauri-apps/api/core";
import { islandItems, type IslandItem } from "$lib/data/island-catalog";

export type IslandMode = "compact" | "expanded";
export type IslandPage = "apps" | "actions" | "agenda";

class IslandStore {
  mode = $state<IslandMode>("compact");
  page = $state<IslandPage>("apps");
  selectedItemId = $state<string | null>(null);
  searchQuery = $state("");
  recentCache = $state<IslandItem[]>(this.loadRecent());

  expand(page: IslandPage = "apps") {
    this.mode = "expanded";
    this.page = page;
    invoke("island_expand");
  }

  collapse() {
    this.mode = "compact";
    this.page = "apps";
    this.selectedItemId = null;
    this.searchQuery = "";
    invoke("island_compact");
  }

  toggle() {
    if (this.mode === "compact") {
      this.expand();
    } else {
      this.collapse();
    }
  }

  selectItem(id: string) {
    this.selectedItemId = this.selectedItemId === id ? null : id;
  }

  setPage(page: IslandPage) {
    this.page = page;
    this.selectedItemId = null;
  }

  setSearch(query: string) {
    this.searchQuery = query;
  }

  private loadRecent(): IslandItem[] {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("bento:island:recent")
        : null;
    if (!stored) return islandItems.slice(0, 4);
    try {
      const ids = JSON.parse(stored) as string[];
      const items = ids
        .map((id) => islandItems.find((i) => i.id === id))
        .filter(Boolean) as IslandItem[];
      return items.length ? items : islandItems.slice(0, 4);
    } catch {
      return islandItems.slice(0, 4);
    }
  }

  pushRecent(id: string) {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem("bento:island:recent");
    const recent: string[] = raw ? JSON.parse(raw) : [];
    const updated = [id, ...recent.filter((existing) => existing !== id)].slice(0, 6);
    localStorage.setItem("bento:island:recent", JSON.stringify(updated));
    this.recentCache = this.loadRecent();
  }

  get filteredItems(): IslandItem[] {
    if (!this.searchQuery.trim()) return islandItems;
    const q = this.searchQuery.toLowerCase();
    return islandItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.tagline.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
    );
  }

  get selectedItem(): IslandItem | null {
    if (!this.selectedItemId) return null;
    return this.filteredItems.find((i) => i.id === this.selectedItemId) ?? null;
  }

  get recentItems(): IslandItem[] {
    return this.recentCache;
  }
}

export const islandStore = new IslandStore();
