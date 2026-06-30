import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import {
  desktopSettings,
  desktopSettingsSchemaSafeParse,
  type DesktopSettings,
} from "$lib/desktop/settings";
import type { DesktopLifecycleState } from "$lib/stores/lifecycle.store";

const exportManifestSchema = z
  .object({
    createdAt: z.string().min(1),
    presets: z.array(z.any()),
    pipeline: z.array(z.string().min(1)),
  })
  .strict();

const optionalPathSchema = z.string().min(1).nullable();
const lifecycleStateSchema = z.enum(["Idle", "Busy", "Backgrounded", "Exiting"]);
const backgroundTaskResponseSchema = z
  .object({
    taskId: z.string().min(1),
    state: lifecycleStateSchema,
  })
  .strict();

export type ExportManifest = z.infer<typeof exportManifestSchema>;
export type BackgroundTaskResponse = z.infer<typeof backgroundTaskResponseSchema>;

export async function pickExportDirectory(): Promise<string | null> {
  const path = await invoke<unknown>("pick_export_directory");
  return optionalPathSchema.parse(path);
}

export async function saveExportManifest(manifest: ExportManifest): Promise<string | null> {
  const parsed = exportManifestSchema.parse(manifest);
  const path = await invoke<unknown>("save_export_manifest", { manifest: parsed });
  return optionalPathSchema.parse(path);
}

export async function backupDesktopSettings(): Promise<string | null> {
  const result = await invoke<unknown>("backup_desktop_settings");
  return optionalPathSchema.parse(result);
}

export async function restoreDesktopSettingsBackup(): Promise<DesktopSettings | null> {
  const result = await invoke<unknown>("restore_desktop_settings_backup");
  if (result === null) {
    return null;
  }

  const parsed = desktopSettingsSchemaSafeParse(result);
  if (!parsed.success) {
    throw parsed.error;
  }

  desktopSettings.set(parsed.data);
  return parsed.data;
}

export async function getLifecycleState(): Promise<DesktopLifecycleState> {
  const state = await invoke<unknown>("get_lifecycle_state");
  return lifecycleStateSchema.parse(state);
}

export async function beginBackgroundTask(label: string): Promise<BackgroundTaskResponse> {
  const result = await invoke<unknown>("begin_background_task", {
    request: { label },
  });
  return backgroundTaskResponseSchema.parse(result);
}

export async function finishBackgroundTask(taskId: string): Promise<DesktopLifecycleState> {
  const state = await invoke<unknown>("finish_background_task", { taskId });
  return lifecycleStateSchema.parse(state);
}

export async function restoreWindow(): Promise<DesktopLifecycleState> {
  const state = await invoke<unknown>("restore_window");
  return lifecycleStateSchema.parse(state);
}

export async function quitApp(): Promise<void> {
  await invoke("quit_app");
}
