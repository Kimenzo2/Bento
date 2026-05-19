# Audio Recording System — Final Audit Report

## 1. Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                  Svelte UI (Voice Memos)            │
│  - Recording controls (start/stop/pause/resume)     │
│  - Playback controls (play/stop)                    │
│  - Recording listing, rename, delete                │
│  - Elapsed timer, duration display                  │
│  └─ Calls Tauri IPC commands                        │
├─────────────────────────────────────────────────────┤
│              TypeScript Bridge (audio-recording.ts)  │
│  - Typed invoke wrappers for all 18 commands        │
│  - Reactive stores (recordingStatus, currentSession)│
│  - Polling at 250ms for live session updates        │
│  - Store cleanup on stop/cancel                     │
├─────────────────────────────────────────────────────┤
│              Rust Backend (audio/mod.rs)            │
│  RecordingEngine (cpal + hound)                     │
│  PlaybackEngine (rodio)                             │
│  AudioState (managed state)                         │
│  18 Tauri commands                                  │
├─────────────────────────────────────────────────────┤
│              Tauri IPC (lib.rs)                     │
│  - AudioState initialized in setup()                │
│  - All 18 commands registered in invoke_handler     │
├─────────────────────────────────────────────────────┤
│              SQLite (recording_metadata table)       │
│  - Persistent recording metadata (id, title, path,  │
│    duration, file_size, module_id, device, etc.)    │
│  - Indexed by created_at, module_id                 │
│  - File storage: $APPDATA/recordings/*.wav          │
└─────────────────────────────────────────────────────┘
```

## 2. Existing Recording Systems Found

| Location | Status |
|---|---|
| `src/modules/voice-memos/App.svelte` | **Was fake** — `setTimeout` simulating 3-second recording, no mic access, no Rust backend, no audio data captured |
| `src/modules/voice-memos/voice-memos.css` | Static styles for fake UI |
| `src/lib/services/audio-recording.ts` | Did not exist |
| `src-tauri/src/audio/mod.rs` | Did not exist |

**Fake/static implementations removed:**
- `setTimeout`-based fake recording timer removed
- Static recording icon toggles removed
- Placeholder "recording complete" alerts removed
- Fake state management removed

## 3. Missing Systems Implemented

| System | Implementation |
|---|---|
| Rust audio capture (cpal) | `RecordingEngine` with background thread streaming |
| WAV file writing (hound) | Proper WAV spec with sample rate/channels/16-bit |
| Recording lifecycle | start, stop, pause, resume, cancel, retry |
| Device enumeration | `list_devices()` with name, channels, sample rates |
| Playback (rodio) | `PlaybackEngine` with play/pause/resume/stop, background worker thread |
| SQLite persistence | `recording_metadata` table with full schema + indexes |
| TypeScript bridge | 18 typed command wrappers, reactive stores, polling |
| Microphone permission check | `check_microphone_permission()` via cpal device detection |
| Cancel + retry | `cancel_recording()` (file + metadata cleanup), `retry_recording()` |
| Voice Memos UI full rewrite | Real recording controls, playback, listing, rename, delete, empty states |

## 4. Weak Systems Repaired

| Issue | Fix |
|---|---|
| `cancel_recording` had broken SQL cleanup | Replaced `delete_recording_inner()` (deleted all but 50 newest recordings) with `delete_recording(&id)` — proper ID-based deletion |
| Polling race on stop | Poll callback now checks if session is null and resets stores + stops polling |
| A11y: `<p onclick>` used for title rename | Changed to `<button>` with proper `aria-label`, `type="button"`, and accessible styling |
| No cancel during recording | Added cancel button in both recording and paused states |
| Missing `check_microphone_permission` | Added as `RecordingEngine` static method + `#[tauri::command]` |

## 5. Performance Issues Detected & Fixed

| Issue | Status |
|---|---|
| Excessive IPC spam | No — polling at 250ms is appropriate; only active during recording |
| Blocking audio loops | No — cpal callback is non-blocking; background thread sleeps 500ms |
| Memory leaks | No — session is properly cleaned (`guard.take()`) on stop/cancel |
| Runaway streams | No — background thread exits on Idle status; stream dropped |
| Duplicated listeners | No — single event stream per recording session |
| High CPU usage | No — cpal audio callback is lightweight; tokio SQL writes use `block_on` |

## 6. IPC Architecture Summary

**18 Tauri Commands:**

| Command | Direction | Payload |
|---|---|---|
| `start_recording` | UI → Rust | `module_id`, `device_name?` → `RecordingSession` |
| `stop_recording` | UI → Rust | → `RecordingSession` (waits for finalized signal) |
| `pause_recording` | UI → Rust | → `RecordingSession` |
| `resume_recording` | UI → Rust | → `RecordingSession` |
| `cancel_recording` | UI → Rust | → `()` (deletes file + metadata by ID) |
| `retry_recording` | UI → Rust | `module_id`, `device_name?` → `RecordingSession` |
| `get_recording_status` | UI → Rust | → `"idle" / "recording" / "paused"` |
| `get_current_session` | Polling → Rust | → `Option<RecordingSession>` |
| `list_audio_devices` | UI → Rust | → `Vec<AudioDevice>` |
| `check_microphone_permission` | UI → Rust | → `bool` |
| `list_recordings` | UI → Rust | `module_id?`, `limit?` → `Vec<RecordingMeta>` |
| `delete_recording` | UI → Rust | `id` → `()` (file + metadata) |
| `update_recording_title` | UI → Rust | `id`, `title` → `()` |
| `playback_start` | UI → Rust | `file_path` → `()` |
| `playback_pause` | UI → Rust | → `()` |
| `playback_resume` | UI → Rust | → `()` |
| `playback_stop` | UI → Rust | → `()` |
| `playback_is_playing` | UI → Rust | → `bool` |

**Frontend/Backend Responsibility Split:**

| Responsibility | Owner |
|---|---|
| Microphone access | Rust (cpal) |
| Recording state | Rust (`Arc<Mutex<RecordingStatus>>`) |
| Audio streams | Rust (cpal callback thread) |
| WAV file writing | Rust (hound, background thread) |
| Duration tracking | Rust (`std::time::Instant` timestamps) |
| Metadata persistence | Rust (SQLite via sqlx + tokio) |
| Playback | Rust (rodio, background worker) |
| Device detection | Rust (cpal) |
| UI rendering | Svelte |
| Recording timer display | Svelte (backed by Rust `startTime` timestamp) |
| Playback state display | Svelte (local `playingFile` state) |
| Error display | Svelte |

## 7. Audio Service Architecture Summary

### RecordingEngine

```
┌─────────────────────────────────────────┐
│            RecordingEngine              │
├─────────────────────────────────────────┤
│ status: Arc<Mutex<RecordingStatus>>     │
│ session: Arc<Mutex<Option<InnerSession>>>│
│ finalized: Arc<AtomicBool>              │
│ app_dir: PathBuf                        │
│ db: SqlitePool                          │
├─────────────────────────────────────────┤
│ start_recording(module_id, device?)     │
│ stop_recording() → RecordingSession     │
│ pause_recording() → RecordingSession    │
│ resume_recording() → RecordingSession   │
│ cancel_recording()                      │
│ retry_recording(module_id, device?)     │
│ get_status() → RecordingStatus          │
│ get_current_session() → Option<Session> │
│ list_devices() → Vec<AudioDevice>       │
│ check_microphone_permission() → bool    │
│ list_recordings(module_id?, limit)      │
│ delete_recording(id)                    │
│ update_recording_title(id, title)       │
└─────────────────────────────────────────┘
```

### Background Thread Lifecycle

```
start_recording()
    │
    ├── Sets status = Recording
    ├── Opens WAV writer (hound)
    ├── Builds cpal input stream
    ├── Stores InnerSession
    └── Spawns std::thread
            │
            ├── Audio callback (cpal thread):
            │   └── Writes f32 samples → i16 → WAV
            │
            └── Main loop (500ms poll):
                ├── Detects status = Idle
                ├── Finalizes WAV (hound)
                ├── Persists metadata → SQLite (block_on)
                └── Sets finalized = true, exits
```

### PlaybackEngine

```
┌─────────────────────────────────────────┐
│            PlaybackEngine               │
├─────────────────────────────────────────┤
│ command_tx: mpsc::Sender<Command>       │
│ is_playing: Arc<AtomicBool>             │
│ └─ Background worker thread             │
│     ├── Opens rodio OutputStream        │
│     ├── Creates rodio Sink              │
│     ├── Decodes WAV file                │
│     └── Appends to sink                 │
├─────────────────────────────────────────┤
│ play(file_path)                         │
│ pause() / resume()                      │
│ stop() / is_playing()                   │
└─────────────────────────────────────────┘
```

## 8. Storage Architecture Summary

### File Storage

```
$APPDATA/
  └── recordings/
      ├── <uuid>.wav    (16-bit PCM, configurable sample rate/channels)
      └── ...
```

### Database Schema (`recording_metadata`)

```sql
CREATE TABLE IF NOT EXISTS recording_metadata (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '',
    duration_secs   REAL NOT NULL DEFAULT 0,
    file_path       TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    module_id       TEXT NOT NULL DEFAULT '',
    created_at      INTEGER NOT NULL,
    device_name     TEXT,
    sample_rate     INTEGER NOT NULL DEFAULT 44100,
    channels        INTEGER NOT NULL DEFAULT 1,
    transcribed     INTEGER NOT NULL DEFAULT 0
);
```

### Indexes

- `idx_recording_created_at` on `created_at`
- `idx_recording_module_id` on `module_id`

### Storage Flow

```
Recording starts → file created at $APPDATA/recordings/<uuid>.wav
WAV finalized   → file closed (hound finalize)
Metadata saved  → INSERT INTO recording_metadata
List recordings → SELECT ... ORDER BY created_at DESC
Delete          → SELECT file_path → DELETE FROM recording_metadata → rm file
Cancel          → rm file → DELETE FROM recording_metadata WHERE id = ?
```

## 9. Device Management Summary

- **Detection**: cpal host enumeration of all input devices
- **Default device**: `host.default_input_device()` — used when no device specified
- **Device selection**: By name, via optional `device_name` parameter
- **Graceful failure**: Returns descriptive error if device not found
- **Sample rates**: Enumerates supported rates per device, falls back to 44100
- **Channel detection**: Default config channels reported per device
- **Cross-platform**: cpal supports Windows (WASAPI), Linux (ALSA/PulseAudio), macOS (CoreAudio)

## 10. Future AI-Readiness Status

| Capability | Status |
|---|---|
| Transcription | Metadata field `transcribed` exists as `bool`, UI button placeholder present |
| AI summaries | Architecture supports via `tags: Vec<String>` field and `transcribed` flag |
| Speech-to-text | Prerequisite: transcription infrastructure first |
| Voice search | Prerequisite: transcription first |
| Semantic indexing | Prerequisite: embeddings pipeline first |

All metadata fields are structured and backward-compatible. No schema migration needed to add AI features — only new optional fields and processing pipelines.

## 11. Final Crate Dependency Summary

```toml
[dependencies]
cpal = "0.15"           # Cross-platform audio capture
hound = "3.5"           # WAV file encoding/decoding
rodio = "0.19"          # Audio playback
uuid = { version = "1", features = ["v4"] }  # Session/recording IDs
```

## 12. Recording Lifecycle Summary

```
    IDLE ──── start_recording() ────→ RECORDING
     ↑                                      │
     │                                 pause_recording()
     │                                      ↓
     │                                 PAUSED
     │                                      │
     │                                 resume_recording()
     │                                      ↓
     │                                 RECORDING
     │                                      │
     ├── stop_recording() ──────────────────┤
     │    (wait for finalized signal)       │
     │    (finalize WAV, persist metadata)  │
     │    → returns RecordingSession        │
     │                                      │
     └── cancel_recording() ────────────────┤
          (wait for finalized signal)       │
          (delete WAV file)                 │
          (delete metadata by ID)           │
          → returns ()
```

## 13. Privacy Risk Report

| Risk | Status |
|---|---|
| Recording stored locally | ✅ Yes — `$APPDATA/recordings/` |
| Metadata stored locally | ✅ Yes — SQLite |
| Data leaves device | ❌ No — no server sync configured |
| Sensitive content exposure | ✅ None — all local, no uploads |
| Microphone permission | ✅ Checked via `check_microphone_permission()` |
| User control | ✅ Full — delete, rename, list, cancel |
| Platform permission check | ⚠️ OS-level (Windows/macOS) — cpal will fail gracefully if denied |

**No privacy risks found.** The system is fully local-first with no data transmission.

## 14. Performance Risk Report

| Risk | Status |
|---|---|
| High CPU during recording | ⚠️ Minimal — cpal callback is lightweight; background thread sleeps 500ms |
| Memory leak | ✅ None — session cleaned on stop/cancel |
| Thread leak | ✅ None — background thread exits on Idle |
| IPC spam | ✅ Low — 250ms polling only during recording |
| Large file growth | ✅ Auto-limited by user actions (delete/cancel) |
| SQLite contention | ✅ Low — one INSERT per recording; lightweight SELECT for listing |
| Audio buffer overflow | ⚠️ Possible on underpowered hardware — cpal writes to WAV directly, no intermediate buffering |

**Performance risk: low.** No blocking operations on the UI thread. All audio processing happens on background threads.
