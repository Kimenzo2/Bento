// ═══════════════════════════════════════════════════════════════════════
// Audio Recording Bridge — Typed Tauri IPC Wrappers for Native Audio
// ═══════════════════════════════════════════════════════════════════════
// Authoritative recording state lives in Rust (cpal + hound).
// Frontend renders UI, displays waveform/duration, triggers commands.
// All timers use real Rust-side timestamps, not frontend setInterval.
// ═══════════════════════════════════════════════════════════════════════

import { invoke } from '@tauri-apps/api/core';
import { writable } from 'svelte/store';

// ─── Types ────────────────────────────────────────────────────────────

export type RecordingStatus = 'idle' | 'recording' | 'paused';
export type PlaybackStatus = 'idle' | 'playing' | 'paused';

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
  inputChannels: number;
  sampleRates: number[];
}

export interface RecordingSession {
  id: string;
  status: string;
  startTime: number;       // UTC ms
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
  createdAt: number;       // UTC ms
  deviceName: string | null;
  sampleRate: number;
  channels: number;
  tags: string[];
  transcribed: boolean;
  transcript: string | null;
}

// ─── Reactive Stores ──────────────────────────────────────────────────

/** Current recording status (polled from Rust). */
export const recordingStatus = writable<RecordingStatus>('idle');

/** Current session details (null when idle). */
export const currentSession = writable<RecordingSession | null>(null);

/** List of persisted recordings, keyed by module. */
export const recordingsByModule = writable<Record<string, RecordingMeta[]>>({});

/** List of available audio input devices. */
export const audioDevices = writable<AudioDevice[]>([]);

// ─── Polling ──────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling Rust for recording session state.
 * Updates stores at ~4fps. Call during recording, stop after.
 */
function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      const session = await invoke<RecordingSession | null>('get_current_session');
      // Only update stores if we're still recording (avoids race where
      // stop_recording already set stores to idle but in-flight poll returns data)
      if (session) {
        currentSession.set(session);
        recordingStatus.set(session.status as RecordingStatus);
      } else {
        // Session cleared on Rust side — ensure stores reflect idle
        currentSession.set(null);
        recordingStatus.set('idle');
        stopPolling();
      }
    } catch {
      // Ignore polling errors — might be between recordings
    }
  }, 250);
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Recording Commands ───────────────────────────────────────────────

/**
 * Start recording from the specified module.
 * @param moduleId - e.g. "voice-memos", "journal", "notes"
 * @param deviceName - optional device name; uses default if omitted
 */
export async function startRecording(
  moduleId: string,
  deviceName?: string,
): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>('start_recording', {
    moduleId,
    deviceName: deviceName ?? null,
  });
  recordingStatus.set('recording');
  currentSession.set(session);
  startPolling();
  return session;
}

/**
 * Stop the current recording and finalize the WAV file.
 */
export async function stopRecording(): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>('stop_recording');
  const moduleId = session.moduleId;
  recordingStatus.set('idle');
  stopPolling();
  currentSession.set(null);
  await refreshRecordings(moduleId ?? 'voice-memos');
  return session;
}

/**
 * Pause the current recording (samples stop writing to WAV).
 */
export async function pauseRecording(): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>('pause_recording');
  recordingStatus.set('paused');
  currentSession.set(session);
  return session;
}

/**
 * Resume a paused recording.
 */
export async function resumeRecording(): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>('resume_recording');
  recordingStatus.set('recording');
  currentSession.set(session);
  return session;
}

/**
 * Get the current recording session without polling.
 */
export async function getCurrentSession(): Promise<RecordingSession | null> {
  return invoke<RecordingSession | null>('get_current_session');
}

/**
 * Cancel the current recording — stop and delete the WAV file without persisting.
 */
export async function cancelRecording(): Promise<void> {
  await invoke('cancel_recording');
  stopPolling();
  recordingStatus.set('idle');
  currentSession.set(null);
}

/**
 * Retry recording — cancel current and start a new one.
 */
export async function retryRecording(
  moduleId: string,
  deviceName?: string,
): Promise<RecordingSession> {
  const session = await invoke<RecordingSession>('retry_recording', {
    moduleId,
    deviceName: deviceName ?? null,
  });
  recordingStatus.set('recording');
  currentSession.set(session);
  startPolling();
  return session;
}

/**
 * Check if a microphone is available and ready.
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  return invoke<boolean>('check_microphone_permission');
}

export async function pickTranscriptionModel(): Promise<string | null> {
  return invoke<string | null>('pick_transcription_model');
}

export async function transcribeRecording(
  recordingId: string,
  modelPath: string,
  language?: string,
): Promise<string> {
  return invoke<string>('transcribe_recording', {
    recording_id: recordingId,
    model_path: modelPath,
    language,
  });
}

/**
 * List available audio input devices.
 */
export async function listAudioDevices(): Promise<AudioDevice[]> {
  const devices = await invoke<AudioDevice[]>('list_audio_devices');
  audioDevices.set(devices);
  return devices;
}

// ─── Recording Management Commands ────────────────────────────────────

/**
 * List persisted recordings, optionally filtered by module.
 */
export async function listRecordings(
  moduleId?: string,
  limit: number = 50,
): Promise<RecordingMeta[]> {
  const recordings = await invoke<RecordingMeta[]>('list_recordings', {
    moduleId: moduleId ?? null,
    limit,
  });
  if (moduleId) {
    recordingsByModule.update((map) => {
      map[moduleId] = recordings;
      return map;
    });
  }
  return recordings;
}

/**
 * Refresh the recordings list for a given module.
 */
export async function refreshRecordings(moduleId: string): Promise<RecordingMeta[]> {
  return listRecordings(moduleId);
}

/**
 * Delete a recording by ID (removes file + metadata).
 */
export async function deleteRecording(id: string): Promise<void> {
  await invoke('delete_recording', { id });
}

/**
 * Update a recording's title.
 */
export async function updateRecordingTitle(id: string, title: string): Promise<void> {
  await invoke('update_recording_title', { id, title });
}

// ─── Playback Commands ────────────────────────────────────────────────

/**
 * Start playback of a WAV file.
 */
export async function playbackStart(filePath: string): Promise<void> {
  await invoke('playback_start', { filePath });
}

/**
 * Pause current playback.
 */
export async function playbackPause(): Promise<void> {
  await invoke('playback_pause');
}

/**
 * Resume paused playback.
 */
export async function playbackResume(): Promise<void> {
  await invoke('playback_resume');
}

/**
 * Stop playback and release resources.
 */
export async function playbackStop(): Promise<void> {
  await invoke('playback_stop');
}

/**
 * Check if playback is currently active.
 */
export async function playbackIsPlaying(): Promise<boolean> {
  return invoke<boolean>('playback_is_playing');
}

// ─── Cleanup ──────────────────────────────────────────────────────────

/**
 * Clean up polling. Call when component unmounts.
 */
export function cleanupRecordingBridge(): void {
  stopPolling();
  recordingStatus.set('idle');
  currentSession.set(null);
}
