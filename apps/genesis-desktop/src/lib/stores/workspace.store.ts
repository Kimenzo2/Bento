import { writable } from "svelte/store";
import { demoAssets, demoProjects } from "$lib/data/app-data";

const SIDEBAR_KEY = "genesis_desktop_sidebar_collapsed";

export const workspaceStore = writable({
  sidebarCollapsed:
    typeof window !== "undefined" ? window.localStorage.getItem(SIDEBAR_KEY) === "true" : false,
  selectedProjectId: demoProjects[0]?.id ?? "",
  projects: demoProjects,
  assets: demoAssets,
});

workspaceStore.subscribe((value) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SIDEBAR_KEY, String(value.sidebarCollapsed));
});

export function toggleSidebar() {
  workspaceStore.update((state) => ({
    ...state,
    sidebarCollapsed: !state.sidebarCollapsed,
  }));
}

export function selectProject(projectId: string) {
  workspaceStore.update((state) => ({
    ...state,
    selectedProjectId: projectId,
  }));
}
