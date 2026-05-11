import { browser } from '$app/environment';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { goto } from '@mateothegreat/svelte5-router';
import { writable } from 'svelte/store';
import { z } from 'zod';
import {
  getModuleCatalogEntry,
  moduleCatalog,
  moduleIdValues,
  type GenesisModuleId,
} from '$lib/data/module-catalog';

export const moduleIdSchema = z.enum(moduleIdValues);
export type { GenesisModuleId } from '$lib/data/module-catalog';

export const moduleContextSchema = z
  .object({
    module: moduleIdSchema.optional(),
    scrollPosition: z.number().min(0).default(0),
    lastOpenId: z.string().nullable().default(null),
    cursorPosition: z.number().int().min(0).nullable().default(null),
    extra: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const switchReceiptSchema = z
  .object({
    fromModule: moduleIdSchema,
    toModule: moduleIdSchema,
    committed: z.boolean(),
  })
  .strict();

export type ModuleContext = z.infer<typeof moduleContextSchema>;
export type ModuleSwitchReceipt = z.infer<typeof switchReceiptSchema>;

export const modules: Array<{ id: GenesisModuleId; label: string; route: string }> = moduleCatalog.map((entry) => ({
  id: entry.id,
  label: entry.navLabel,
  route: entry.route,
}));

export function moduleFromPath(pathname: string): GenesisModuleId {
  if (pathname.startsWith('/apps/')) {
    const [, , moduleId] = pathname.split('/');
    if (moduleIdSchema.safeParse(moduleId).success) {
      return moduleId as GenesisModuleId;
    }
  }
  if (pathname.startsWith('/editor')) return 'notes';
  if (pathname.startsWith('/project') || pathname.startsWith('/create')) return 'tasks';
  if (pathname.startsWith('/gamification')) return 'habits';
  if (pathname.startsWith('/visual-studio')) return 'ai';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export const activeModule = writable<string>(
  moduleFromPath(browser ? window.location.pathname : '/')
);

export function captureModuleContext(module: GenesisModuleId): ModuleContext {
  if (!browser) {
    return { module, scrollPosition: 0, lastOpenId: null, cursorPosition: null, extra: {} };
  }

  const mainScroll =
    document.querySelector<HTMLElement>('.desktop-workspace__main') ??
    document.querySelector<HTMLElement>('.shell-main') ??
    document.querySelector<HTMLElement>('.desktop-content-scroll') ??
    document.querySelector<HTMLElement>('.desktop-app-root');

  return {
    module,
    scrollPosition: mainScroll?.scrollTop ?? window.scrollY ?? 0,
    lastOpenId: document.activeElement?.id || null,
    cursorPosition: null,
    extra: {
      pathname: window.location.pathname,
    },
  };
}

export async function getModuleContext(module: GenesisModuleId): Promise<ModuleContext | null> {
  if (!browser || !isTauri()) {
    return null;
  }

  const result = await invoke<unknown>('get_module_context', { module });
  if (result === null) {
    return null;
  }

  return moduleContextSchema.parse(result);
}

export async function saveModuleContext(context: ModuleContext): Promise<ModuleContext | null> {
  if (!browser || !isTauri()) {
    return context;
  }

  const parsed = moduleContextSchema.parse(context);
  const result = await invoke<unknown>('save_module_context', {
    module: parsed.module ?? 'dashboard',
    context: parsed,
  });
  return moduleContextSchema.parse(result);
}

export async function switchModule(toModule: GenesisModuleId): Promise<ModuleSwitchReceipt> {
  const target = getModuleCatalogEntry(toModule);
  if (!target) {
    throw new Error(`Unsupported Genesis module: ${toModule}`);
  }

  const fromModule = moduleFromPath(browser ? window.location.pathname : '/');
  const context = captureModuleContext(fromModule);

  if (browser && isTauri()) {
    try {
      const result = await invoke<unknown>('flush_module_state', {
        fromModule,
        toModule,
        context,
      });
      const receipt = switchReceiptSchema.parse(result);
      activeModule.set(toModule);
      await Promise.resolve(goto(target.route));
      return receipt;
    } catch (error) {
      if (!isRecoverableDesktopSwitchError(error)) {
        throw error;
      }

      console.warn(
        '[Genesis Desktop] Falling back to frontend-only module switch; restart the desktop shell to refresh the Rust module catalog.',
        error,
      );
    }
  }

  if (browser) {
    activeModule.set(toModule);
    await Promise.resolve(goto(target.route));
  }

  return {
    fromModule,
    toModule,
    committed: !isTauri(),
  };
}

function isRecoverableDesktopSwitchError(error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';

  return (
    message.includes('Unsupported Genesis module') ||
    message.includes('Module is not installed') ||
    message.includes('invalid args `toModule`') ||
    message.includes('invalid args `fromModule`')
  );
}
