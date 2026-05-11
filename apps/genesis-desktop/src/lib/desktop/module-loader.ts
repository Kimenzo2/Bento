import { browser } from '$app/environment';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { mount, unmount } from 'svelte';
import type { GenesisModuleId, ModuleContext } from './modules';
import { activeModule, captureModuleContext, moduleFromPath, modules, switchModule } from './modules';

type MountedModule = Record<string, unknown>;

let currentInstalledModule: MountedModule | null = null;

export function moduleAssetUrl(moduleId: string, assetPath: string) {
  const safeAssetPath = assetPath.replace(/^\/+/, '');

  if (!browser || !isTauri()) {
    return `/modules/${moduleId}/${safeAssetPath}`;
  }

  // Tauri serves custom protocol assets as http://<scheme>.localhost on Windows.
  return `http://module.localhost/${moduleId}/${safeAssetPath}`;
}

export async function loadInstalledModule(moduleId: string, target: HTMLElement, settings: unknown) {
  if (!browser) {
    return null;
  }

  const fromModule = moduleFromPath(window.location.pathname);
  const context: ModuleContext = captureModuleContext(fromModule);

  if (isTauri()) {
    if (isBuiltinModule(moduleId)) {
      await invoke('flush_module_state', {
        fromModule,
        toModule: moduleId,
        context,
      });
    } else {
      await invoke('save_module_context', {
        module: fromModule,
        context,
      });
    }
    await invoke('set_active_module', { moduleId });
  }

  if (currentInstalledModule) {
    unmount(currentInstalledModule);
  }
  currentInstalledModule = null;
  target.innerHTML = '';

  loadModuleCss(moduleId);

  const loaded = await import(/* @vite-ignore */ moduleAssetUrl(moduleId, 'index.js'));
  const ModuleApp = loaded.default;

  currentInstalledModule = mount(ModuleApp, {
    target,
    props: {
      moduleId,
      settings,
    },
  });

  activeModule.set(moduleId);
  return currentInstalledModule;
}

export function unloadInstalledModule() {
  if (currentInstalledModule) {
    unmount(currentInstalledModule);
  }
  currentInstalledModule = null;
  document.getElementById('genesis-module-css')?.remove();
}

export async function loadBuiltinModule(moduleId: GenesisModuleId) {
  unloadInstalledModule();
  return switchModule(moduleId);
}

function loadModuleCss(moduleId: string) {
  document.getElementById('genesis-module-css')?.remove();

  const link = document.createElement('link');
  link.id = 'genesis-module-css';
  link.rel = 'stylesheet';
  link.href = moduleAssetUrl(moduleId, 'index.css');
  document.head.appendChild(link);
}

export function isBuiltinModule(moduleId: string): moduleId is GenesisModuleId {
  return modules.some((entry) => entry.id === moduleId);
}
