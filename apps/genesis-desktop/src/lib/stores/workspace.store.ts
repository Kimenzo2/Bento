import { get, writable } from "svelte/store";
import { demoAssets, demoProjects } from "$lib/data/app-data";
import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

const initialSettings = get(desktopSettings);
const sidebarCollapsed = initialSettings.workspace.sidebarCollapsed;

export const workspaceStore = writable({
  sidebarCollapsed,
  selectedProjectId: demoProjects[0]?.id ?? "",
  projects: demoProjects,
  assets: demoAssets,
});

desktopSettings.subscribe((settings) => {
  workspaceStore.update((state) =>
    state.sidebarCollapsed === settings.workspace.sidebarCollapsed
      ? state
      : {
          ...state,
          sidebarCollapsed: settings.workspace.sidebarCollapsed,
        }
  );
});

export function toggleSidebar() {
  void updateDesktopSettings((current) => ({
    ...current,
    workspace: {
      ...current.workspace,
      sidebarCollapsed: !current.workspace.sidebarCollapsed,
    },
  }));

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
