import { get, writable } from "svelte/store";
import { demoAssets, demoProjects } from "$lib/data/app-data";
import { desktopSettings, updateDesktopSettings } from "$lib/desktop/settings";

const initialSettings = get(desktopSettings);
const sidebarCollapsed = initialSettings.workspace.sidebarCollapsed;
const sidebarWidth = initialSettings.workspace.sidebarWidth;
const sidebarTop = initialSettings.workspace.sidebarTop;

export const workspaceStore = writable({
  sidebarCollapsed,
  sidebarWidth,
  sidebarTop,
  sidebarHidden: false,
  selectedProjectId: demoProjects[0]?.id ?? "",
  projects: demoProjects,
  assets: demoAssets,
});

desktopSettings.subscribe((settings) => {
  workspaceStore.update((state) =>
    state.sidebarCollapsed === settings.workspace.sidebarCollapsed &&
    state.sidebarWidth === settings.workspace.sidebarWidth &&
    state.sidebarTop === settings.workspace.sidebarTop
      ? state
      : {
          ...state,
          sidebarCollapsed: settings.workspace.sidebarCollapsed,
          sidebarWidth: settings.workspace.sidebarWidth,
          sidebarTop: settings.workspace.sidebarTop,
        },
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

export function setSidebarWidth(nextWidth: number) {
  workspaceStore.update((state) => ({
    ...state,
    sidebarWidth: nextWidth,
  }));
}

export function persistSidebarWidth(nextWidth: number) {
  void updateDesktopSettings((current) => ({
    ...current,
    workspace: {
      ...current.workspace,
      sidebarWidth: nextWidth,
    },
  }));
}

export function setSidebarTop(nextTop: number) {
  workspaceStore.update((state) => ({
    ...state,
    sidebarTop: nextTop,
  }));
}

export function persistSidebarTop(nextTop: number) {
  void updateDesktopSettings((current) => ({
    ...current,
    workspace: {
      ...current.workspace,
      sidebarTop: nextTop,
    },
  }));
}

export function toggleSidebarHidden() {
  workspaceStore.update((state) => ({
    ...state,
    sidebarHidden: !state.sidebarHidden,
  }));
}

export function selectProject(projectId: string) {
  workspaceStore.update((state) => ({
    ...state,
    selectedProjectId: projectId,
  }));
}
