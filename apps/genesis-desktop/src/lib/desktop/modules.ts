import { browser } from '$app/environment';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { goto } from '@mateothegreat/svelte5-router';
import { writable } from 'svelte/store';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { z } from 'zod';
import {
  getModuleCatalogEntry,
  moduleCatalog,
  moduleIdValues,
  type BentoModuleId,
} from '$lib/data/module-catalog';
import { canAccessModuleByPlan } from '$lib/desktop/billing-access';
import { ensureBillingProfile } from '$lib/stores/billing.store';
import { time } from '$lib/utils/time';

export const moduleIdSchema = z.enum(moduleIdValues);
export type { BentoModuleId } from '$lib/data/module-catalog';

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

export const modules: Array<{ id: BentoModuleId; label: string; route: string }> = moduleCatalog.map((entry) => ({
  id: entry.id,
  label: entry.navLabel,
  route: entry.route,
}));

export function moduleFromPath(pathname: string): BentoModuleId {
  if (pathname.startsWith('/apps/')) {
    const [, , moduleId] = pathname.split('/');
    if (moduleIdSchema.safeParse(moduleId).success) {
      return moduleId as BentoModuleId;
    }
  }
  if (pathname.startsWith('/notes')) return 'notes';
  if (pathname.startsWith('/project') || pathname.startsWith('/create')) return 'tasks';
  if (pathname.startsWith('/gamification')) return 'habits';
  if (pathname.startsWith('/visual-studio')) return 'ai';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export const activeModule = writable<string>(
  moduleFromPath(browser ? window.location.pathname : '/')
);

export function captureModuleContext(module: BentoModuleId): ModuleContext {
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

export async function getModuleContext(module: BentoModuleId): Promise<ModuleContext | null> {
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

export async function switchModule(toModule: BentoModuleId): Promise<ModuleSwitchReceipt> {
  const target = getModuleCatalogEntry(toModule);
  if (!target) {
    throw new Error(`Unsupported Bento module: ${toModule}`);
  }

  if (browser && isTauri()) {
    const billingProfile = await ensureBillingProfile();
    const hasAccess = canAccessModuleByPlan(
      billingProfile?.activePlanCode,
      toModule,
      billingProfile?.hasActiveSubscription ?? false,
    );
    if (!hasAccess) {
      try {
        await Promise.resolve(goto('/pricing'));
      } catch {}
      return {
        fromModule: moduleFromPath(window.location.pathname),
        toModule,
        committed: false,
      };
    }
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
      try {
        localStorage.setItem('bento:lastModule', toModule);
        localStorage.setItem('bento:lastModuleAt', String(time.now()));
      } catch {}
      activeModule.set(toModule);
      await Promise.resolve(goto(target.route));
      await setWindowTitle(toModule);
      return receipt;
    } catch (error) {
      if (!isRecoverableDesktopSwitchError(error)) {
        throw error;
      }

      console.warn(
        '[Bento Desktop] Falling back to frontend-only module switch; restart the desktop shell to refresh the Rust module catalog.',
        error,
      );
    }
  }

  if (browser) {
    try {
      localStorage.setItem('bento:lastModule', toModule);
      localStorage.setItem('bento:lastModuleAt', String(time.now()));
    } catch {}
    activeModule.set(toModule);
    await Promise.resolve(goto(target.route));
    await setWindowTitle(toModule);
  }

  return {
    fromModule,
    toModule,
    committed: !isTauri(),
  };
}

/* ─── Window title helpers ─────────────────────────────────────── */
const MODULE_TITLES: Record<string, string> = {
  tasks:     'Tasks — Bento',
  notes:     'Notes — Bento',
  habits:    'Habits — Bento',
  journal:   'Journal — Bento',
  focus:     'Focus — Bento',
  health:    'Health — Bento',
  budget:    'Budget — Bento',
  reading:   'Reading — Bento',
  grocery:   'Grocery — Bento',
  passwords: 'Vault — Bento',
  telemetry: 'System — Bento',
};

export async function setWindowTitle(moduleId: string) {
  if (!browser || !isTauri()) return;
  try {
    const title = MODULE_TITLES[moduleId] ?? 'Bento';
    await getCurrentWindow().setTitle(title);
  } catch {
    // Silently ignore — non-critical
  }
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
    message.includes('Unsupported Bento module') ||
    message.includes('Module is not installed') ||
    message.includes('invalid args `toModule`') ||
    message.includes('invalid args `fromModule`')
  );
}
