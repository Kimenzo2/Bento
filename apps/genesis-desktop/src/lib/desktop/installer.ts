import { browser } from '$app/environment';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { z } from 'zod';

const installedModuleSchema = z
  .object({
    id: z.string(),
    version: z.string(),
    installedAt: z.number(),
    builtin: z.boolean(),
    manifest: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

const registryEntrySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    version: z.string(),
    sizeMb: z.number(),
    category: z.string(),
    bundleUrl: z.string().nullable().optional(),
    checksumSha256: z.string().nullable().optional(),
    iconUrl: z.string().nullable().optional(),
    accent: z.string(),
    free: z.boolean(),
    installed: z.boolean(),
    builtin: z.boolean(),
  })
  .strict();

export type InstalledModule = z.infer<typeof installedModuleSchema>;
export type ModuleRegistryEntry = z.infer<typeof registryEntrySchema>;

export async function getInstalledModules(): Promise<InstalledModule[]> {
  if (!browser || !isTauri()) {
    return [];
  }

  const result = await invoke<unknown[]>('get_installed_modules');
  return z.array(installedModuleSchema).parse(result);
}

export async function fetchModuleRegistry(): Promise<ModuleRegistryEntry[]> {
  if (!browser || !isTauri()) {
    return [];
  }

  const result = await invoke<unknown[]>('fetch_module_registry');
  return z.array(registryEntrySchema).parse(result);
}
