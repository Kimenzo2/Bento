import { invoke } from "@tauri-apps/api/core";

export interface RecordingSession {
  id: string;
  status: string;
  startTime: number;
  elapsedMs: number;
  pausedDurationMs: number;
  filePath: string | null;
  moduleId: string;
  deviceName: string | null;
}

export interface RecordingMeta {
  id: string;
  title: string;
  durationSecs: number;
  filePath: string;
  fileSizeBytes: number;
  moduleId: string;
  createdAt: number;
  deviceName: string | null;
  sampleRate: number;
  channels: number;
  tags: string[];
  transcribed: boolean;
  transcript: string | null;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

const internalRecordingStatus = {
  _value: "idle" as string,
  get value() { return this._value; },
  set value(v: string) { this._value = v; },
};

function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const session = await invoke<RecordingSession | null>("get_current_session");
      if (session) {
        internalRecordingStatus.value = session.status;
      } else {
        internalRecordingStatus.value = "idle";
        stopPolling();
      }
    } catch { /* ignore polling errors */ }
  }, 250);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export async function startRecording(
  moduleId: string,
  deviceName?: string,
): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>("start_recording", {
    moduleId,
    deviceName: deviceName ?? null,
  });
  internalRecordingStatus.value = "recording";
  startPolling();
  return session;
}

export async function stopRecording(): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>("stop_recording");
  const moduleId = session.moduleId;
  internalRecordingStatus.value = "idle";
  stopPolling();
  await refreshRecordings(moduleId ?? "voice-memos");
  return session;
}

export async function cancelRecording(): Promise<void> {
  await invoke("cancel_recording");
  stopPolling();
  internalRecordingStatus.value = "idle";
}

async function refreshRecordings(moduleId: string): Promise<RecordingMeta[]> {
  return listRecordings(moduleId);
}

export async function listRecordings(
  moduleId?: string,
  limit: number = 50,
): Promise<RecordingMeta[]> {
  return invoke<RecordingMeta[]>("list_recordings", {
    moduleId: moduleId ?? null,
    limit,
  });
}

export async function deleteRecording(id: string): Promise<void> {
  await invoke("delete_recording", { id });
}

export async function updateRecordingTitle(id: string, title: string): Promise<void> {
  await invoke("update_recording_title", { id, title });
}
