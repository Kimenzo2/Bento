// ═══════════════════════════════════════════════════════════════════════
// Audio Recording System — Native Rust Audio Capture & Playback
// ═══════════════════════════════════════════════════════════════════════
// Uses cpal for microphone access and hound for WAV file I/O.
// Authoritative recording state lives here, not in the frontend.
// All durations are tracked with real timestamps, not frontend timers.
// ═══════════════════════════════════════════════════════════════════════

use crate::util::time;
use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    mpsc, Arc, Mutex,
};
use tracing::info;
use std::thread;
use tauri::Emitter;

pub mod classifier;
pub mod dictation;
pub mod live_preview;
pub mod moonshine;
pub mod processing;
pub mod processing_queue;
pub mod turns;
pub mod validation;

// ─── Audio Level Payload (emitted to frontend via events) ────────────

/// Typed payload for voice:audio-level events — avoids serde_json::json! allocation per callback.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AudioLevelPayload {
    level: f32,
    rms: f32,
    peak: f32,
}

/// Typed payload for voice:session-completed events.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SessionCompletedPayload {
    session_id: String,
    status: String,
}

// ─── Recording State ──────────────────────────────────────────────────

/// Numeric encoding of RecordingStatus for lock-free atomic access in audio callbacks.
/// Using Mutex inside a cpal audio callback is a real-time safety violation.
mod status_code {
    pub const IDLE: u32 = 0;
    pub const RECORDING: u32 = 1;
    pub const PAUSED: u32 = 2;
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecordingStatus {
    Idle,
    Recording,
    Paused,
}

impl RecordingStatus {
    fn to_u32(&self) -> u32 {
        match self {
            Self::Idle => status_code::IDLE,
            Self::Recording => status_code::RECORDING,
            Self::Paused => status_code::PAUSED,
        }
    }

    fn from_u32(code: u32) -> Self {
        match code {
            status_code::RECORDING => Self::Recording,
            status_code::PAUSED => Self::Paused,
            _ => Self::Idle,
        }
    }
}

impl std::fmt::Display for RecordingStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Idle => write!(f, "idle"),
            Self::Recording => write!(f, "recording"),
            Self::Paused => write!(f, "paused"),
        }
    }
}
// ─── Audio Device ─────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub input_channels: u16,
    pub sample_rates: Vec<u32>,
}

// ─── Recording Session ────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSession {
    pub id: String,
    pub status: String,
    pub start_time: i64,
    pub elapsed_ms: i64,
    pub paused_duration_ms: i64,
    pub file_path: Option<String>,
    pub module_id: String,
    pub device_name: Option<String>,
    pub sleep_detected: bool,
}

// ─── Recording Metadata (persisted in SQLite) ─────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingMeta {
    pub id: String,
    pub title: String,
    pub duration_secs: f64,
    pub file_path: String,
    pub file_size_bytes: u64,
    pub module_id: String,
    pub created_at: i64,
    pub device_name: Option<String>,
    pub sample_rate: u32,
    pub channels: u16,
    pub tags: Vec<String>,
    pub transcribed: bool,
    pub transcript: Option<String>,
}

// ─── Recording Engine ─────────────────────────────────────────────────

pub struct RecordingEngine {
    /// Lock-free atomic status — never locked inside audio callback.
    status_atomic: Arc<AtomicU32>,
    /// Mutex-guarded session state (InnerSession).
    /// The audio callback holds this lock only for the duration of sample copying.
    session: Arc<Mutex<Option<InnerSession>>>,
    app_dir: PathBuf,
    db: SqlitePool,
    /// Signalled by the background thread after WAV finalization + SQLite write.
    finalized: Arc<AtomicBool>,
    /// AppHandle for emitting audio level events to the frontend.
    app_handle: Option<tauri::AppHandle>,
}

struct InnerSession {
    id: String,
    module_id: String,
    /// Monotonic clock start — used for elapsed-time tracking (stops during sleep).
    start_time: std::time::Instant,
    /// Wall-clock start (ms epoch) — used for sleep detection by comparing with monotonic elapsed.
    start_time_ms: i64,
    /// Set to true when the sleep-detection watchdog detects a sleep/wake cycle.
    sleep_detected: bool,
    paused_duration: std::time::Duration,
    pause_start: Option<std::time::Instant>,
    device_name: String,
    sample_rate: u32,
    channels: u16,
    file_path: PathBuf,
    file: hound::WavWriter<std::io::BufWriter<std::fs::File>>,
}

impl RecordingEngine {
    pub fn new(app_dir: PathBuf, db: SqlitePool) -> Self {
        Self {
            status_atomic: Arc::new(AtomicU32::new(status_code::IDLE)),
            session: Arc::new(Mutex::new(None)),
            app_dir,
            db,
            finalized: Arc::new(AtomicBool::new(false)),
            app_handle: None,
        }
    }

    /// Set the AppHandle for emitting events to the frontend.
    pub fn set_app_handle(&mut self, app_handle: tauri::AppHandle) {
        self.app_handle = Some(app_handle);
    }

    pub fn get_status(&self) -> RecordingStatus {
        RecordingStatus::from_u32(self.status_atomic.load(Ordering::Relaxed))
    }

    /// Set the recording status atomically (lock-free).
    fn set_status(&self, status: RecordingStatus) {
        self.status_atomic.store(
            status.to_u32(),
            match status {
                RecordingStatus::Idle => Ordering::Release,
                _ => Ordering::Relaxed,
            },
        );
    }

    /// Enumerate available input audio devices.
    pub fn list_devices() -> Result<Vec<AudioDevice>, String> {
        let host = cpal::default_host();
        let default_id = host
            .default_input_device()
            .map(|d| d.name().unwrap_or_default());

        let devices = host.input_devices().map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for device in devices {
            let name = device.name().map_err(|e| e.to_string())?;
            let config = device.default_input_config().ok();
            let channels = config.as_ref().map(|c| c.channels()).unwrap_or(0);

            // Sample rates
            let sample_rates = match device.supported_input_configs() {
                Ok(configs) => {
                    let mut rates: Vec<u32> = configs
                        .filter_map(|c| {
                            let min = c.min_sample_rate().0;
                            let max = c.max_sample_rate().0;
                            if min == max {
                                Some(min)
                            } else {
                                None
                            }
                        })
                        .collect();
                    rates.sort();
                    rates.dedup();
                    if rates.is_empty() {
                        vec![44100] // fallback
                    } else {
                        rates
                    }
                }
                Err(_) => vec![44100],
            };

            result.push(AudioDevice {
                id: name.clone(),
                is_default: default_id.as_deref() == Some(&name),
                name,
                input_channels: channels,
                sample_rates,
            });
        }

        Ok(result)
    }

    /// Start recording from the specified (or default) device.
    pub fn start_recording(
        &self,
        module_id: &str,
        device_name: Option<&str>,
    ) -> Result<RecordingSession, String> {
        // Lock-free atomic check-and-set — prevents TOCTOU race between load and store
        self.status_atomic
            .compare_exchange(
                status_code::IDLE,
                status_code::RECORDING,
                Ordering::Acquire,
                Ordering::Relaxed,
            )
            .map_err(|current| {
                let status = RecordingStatus::from_u32(current);
                format!("Recording is already in progress ({status}).")
            })?;

        let host = cpal::default_host();
        let device = match device_name {
            Some(name) => host
                .input_devices()
                .map_err(|e| e.to_string())?
                .find(|d| d.name().unwrap_or_default() == name)
                .ok_or_else(|| format!("Audio device not found: {name}")),
            None => host
                .default_input_device()
                .ok_or_else(|| "No default input device available.".to_string()),
        }?;

        let device_name = device.name().unwrap_or_else(|_| "unknown".to_string());
        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get default config: {e}"))?;

        let sample_rate = config.sample_rate().0;
        let channels = config.channels();

        // Create recordings directory
        let recordings_dir = self.app_dir.join("recordings");
        std::fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

        // Generate safe filename
        let session_id = uuid::Uuid::new_v4().to_string();
        let filename = format!("{}.wav", session_id);
        let file_path = recordings_dir.join(&filename);

        // Open WAV writer
        let spec = hound::WavSpec {
            channels,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let file = std::fs::File::create(&file_path).map_err(|e| e.to_string())?;
        let writer = hound::WavWriter::new(std::io::BufWriter::new(file), spec)
            .map_err(|e| e.to_string())?;

        // Capture runtime handle so the background thread can persist metadata
        let rt_handle = tokio::runtime::Handle::current();

        // Spawn the recording stream on a background thread
        let finalized_arc = self.finalized.clone();
        let session_arc = self.session.clone();
        let status_atomic = Arc::clone(&self.status_atomic);
        let status_atomic_for_callback = Arc::clone(&status_atomic);
        let status_atomic_for_error = Arc::clone(&status_atomic);
        let session_arc_for_callback = Arc::clone(&session_arc);
        let session_id_clone = session_id.clone();
        let db_clone = self.db.clone();
        let device_name_clone = device_name.clone();
        // AppHandle for emitting audio level events — clone before first move closure
        let app_handle_for_levels = self.app_handle.clone();
        let app_handle_for_completed = self.app_handle.clone();

        let now_ms = time::now_ms();
        let session = InnerSession {
            id: session_id_clone.clone(),
            module_id: module_id.to_string(),
            start_time: std::time::Instant::now(),
            start_time_ms: now_ms,
            sleep_detected: false,
            paused_duration: std::time::Duration::ZERO,
            pause_start: None,
            device_name: device_name.clone(),
            sample_rate,
            channels,
            file_path: file_path.clone(),
            file: writer,
        };

        *self.session.lock().map_err(|e| e.to_string())? = Some(session);

        // ── Watchdog and recording are merged into a single thread ────────
        // Sleep detection (monotonic vs wall-clock, every ~2s) runs within the
        // 500ms polling loop. This eliminates the separate watchdog thread.
        let session_id_for_thread = session_id.clone();
        std::thread::spawn(move || {
            let input_stream = match device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Lock-free atomic check — never acquire a Mutex in audio callback
                    let s = status_atomic_for_callback.load(Ordering::Relaxed);
                    if s == status_code::IDLE || s == status_code::PAUSED {
                        return;
                    }

                    // ── Compute RMS audio level ──────────────────────────
                    if let Some(ref app_handle) = app_handle_for_levels {
                        let rms: f32 = if data.is_empty() {
                            0.0
                        } else {
                            let sum: f32 = data.iter().map(|s| s * s).sum();
                            (sum / data.len() as f32).sqrt()
                        };
                        // Scale RMS to 0.0–1.0 range and emit event
                        let level = (rms * 3.0).min(1.0);
                        let peak = data.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
                        let _ = app_handle
                            .emit("voice:audio-level", AudioLevelPayload { level, rms, peak });
                    }

                    // Write samples to WAV
                    let mut guard = session_arc_for_callback
                        .lock()
                        .unwrap_or_else(|e| e.into_inner());
                    if let Some(ref mut inner) = *guard {
                        for &sample in data {
                            // Convert f32 [-1.0, 1.0] to i16
                            let amplitude = (sample * i16::MAX as f32) as i16;
                            if inner.file.write_sample(amplitude).is_err() {
                                break;
                            }
                        }
                    }
                },
                move |err| {
                    info!("[audio] Stream error: {err}");
                    // Device was unplugged or lost — signal the monitoring loop to finalize.
                    // On macOS, cpal triggers DeviceNotAvailable when a USB mic is unplugged
                    // or an AirPod switches away. On Windows, this can happen with device removal.
                    // By setting status to IDLE, the background loop will finalize the WAV file
                    // and persist what was recorded before the stream died.
                    status_atomic_for_error.store(status_code::IDLE, Ordering::Release);
                },
                None,
            ) {
                Ok(stream) => stream,
                Err(e) => {
                    info!("[audio] Failed to build input stream: {e}");
                    return;
                }
            };

            // ── Sleep-detection: merged into the recording loop ────────────
            // Every ~2s (every 4th iteration of the 500ms loop), compare monotonic
            // elapsed time vs wall-clock elapsed time. If wall-clock elapsed exceeds
            // monotonic elapsed by > 30s, the machine likely slept mid-recording.
            const SLEEP_THRESHOLD_MS: i64 = 30_000;
            let mut sleep_check_count: u32 = 0;

            // Keep stream alive until recording stops
            loop {
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Sleep detection check (every ~2 seconds);
                sleep_check_count += 1;
                if sleep_check_count % 4 == 0 {
                    let mut guard = session_arc.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(ref mut inner) = *guard {
                        let monotonic_elapsed = inner.start_time.elapsed().as_millis() as i64;
                        let wall_clock_elapsed = time::now_ms() - inner.start_time_ms;
                        let drift = wall_clock_elapsed - monotonic_elapsed;
                        if drift > SLEEP_THRESHOLD_MS && !inner.sleep_detected {
                            inner.sleep_detected = true;
                            info!(
                                "[audio] Sleep detected mid-recording: drift={}ms (threshold={}ms)",
                                drift, SLEEP_THRESHOLD_MS
                            );
                        }
                    }
                    drop(guard);
                }
                if status_atomic.load(Ordering::Relaxed) == status_code::IDLE {
                    // Close the writer — take the session
                    let mut guard = session_arc.lock().unwrap_or_else(|e| e.into_inner());
                    if let Some(inner) = guard.take() {
                        let _ = inner.file.finalize();
                        let size = std::fs::metadata(&inner.file_path)
                            .map(|m| m.len())
                            .unwrap_or(0);

                        // Persist metadata to SQLite (blocking on background thread)
                        let id = inner.id.clone();
                        let mid = inner.module_id.clone();
                        let dur = inner.start_time.elapsed() - inner.paused_duration;
                        let start_ts = time::now_ms() - dur.as_millis() as i64;
                        let fpath = inner.file_path.to_string_lossy().to_string();
                        let srate = inner.sample_rate as i64;
                        let ch = inner.channels as i64;
                        let db = db_clone.clone();
                        let dev = device_name_clone.clone();

                        // Emit voice:session-completed event to frontend
                        if let Some(ref app_handle) = app_handle_for_completed {
                            let _ = app_handle.emit(
                                "voice:session-completed",
                                SessionCompletedPayload {
                                    session_id: session_id_for_thread.clone(),
                                    status: "completed".to_string(),
                                },
                            );
                        }

                        // Persist metadata to SQLite synchronously on this background thread
                        if let Err(e) = rt_handle.block_on(async {
                            sqlx::query(
                                r#"INSERT INTO recording_metadata 
                                (id, title, duration_secs, file_path, file_size_bytes, module_id, 
                                 created_at, device_name, sample_rate, channels, transcribed)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"#,
                            )
                            .bind(&id)
                            .bind(format!("Recording {}", &id[..8]))
                            .bind(dur.as_secs_f64())
                            .bind(&fpath)
                            .bind(size as i64)
                            .bind(&mid)
                            .bind(start_ts)
                            .bind(&dev)
                            .bind(srate)
                            .bind(ch)
                            .execute(&db)
                            .await
                        }) {
                            info!("[audio] Failed to persist recording metadata: {e}");
                        }
                    }
                    drop(guard);
                    finalized_arc.store(true, Ordering::Release);
                    break;
                }
            }

            drop(input_stream);
        });

        Ok(RecordingSession {
            id: session_id,
            status: "recording".to_string(),
            start_time: time::now_ms(),
            elapsed_ms: 0,
            paused_duration_ms: 0,
            file_path: Some(file_path.to_string_lossy().to_string()),
            module_id: module_id.to_string(),
            device_name: Some(device_name),
            sleep_detected: false,
        })
    }

    /// Stop the current recording and finalize the WAV file.
    ///
    /// Finalizes the WAV writer synchronously on the calling thread so the
    /// file handle is released before returning — prevents file lock contention
    /// on Windows when playback immediately follows (an open `hound::WavWriter`
    /// holds a write lock that blocks `std::fs::File::open` in the playback engine).
    pub fn stop_recording(&self) -> Result<RecordingSession, String> {
        if self.status_atomic.load(Ordering::Relaxed) == status_code::IDLE {
            return Err("No recording in progress.".to_string());
        }

        // Step 1: Take the session from the Mutex and finalize the WAV writer NOW.
        let mut guard = self.session.lock().map_err(|e| e.to_string())?;
        let session_data = guard.take();
        drop(guard); // Release lock before potentially blocking on SQLite

        // Destructure to take ownership of `file` (hound::WavWriter::finalize consumes self).
        let (
            sleep_detected,
            start_time,
            paused_duration,
            pause_start,
            id,
            file_path,
            module_id,
            device_name,
            sample_rate,
            channels,
        ) = match session_data {
            Some(inner) => {
                let InnerSession {
                    file,
                    sleep_detected,
                    start_time,
                    paused_duration,
                    pause_start,
                    id,
                    file_path,
                    module_id,
                    device_name,
                    sample_rate,
                    channels,
                    start_time_ms: _,
                } = inner;
                let _ = file.finalize(); // Close WAV writer — file handle released
                (
                    sleep_detected,
                    start_time,
                    paused_duration,
                    pause_start,
                    id,
                    file_path,
                    module_id,
                    device_name,
                    sample_rate,
                    channels,
                )
            }
            None => {
                // Background thread already consumed the session (unlikely racing case)
                (
                    false,
                    std::time::Instant::now(),
                    std::time::Duration::ZERO,
                    None,
                    String::new(),
                    PathBuf::new(),
                    String::new(),
                    String::new(),
                    0u32,
                    0u16,
                )
            }
        };

        // Step 2: Signal the background thread to stop (audio callback will cease)
        self.set_status(RecordingStatus::Idle);

        // Step 3: Persist metadata synchronously (bg thread sees empty session, just cleans up)
        if !id.is_empty() {
            let rt_handle = tokio::runtime::Handle::current();
            let dur = start_time.elapsed() - paused_duration;
            let pause_deduction = pause_start
                .map(|ps| start_time.elapsed() - ps.elapsed())
                .unwrap_or(std::time::Duration::ZERO);
            let actual_dur = dur - pause_deduction;
            let start_ts = time::now_ms() - actual_dur.as_millis() as i64;
            let size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);

            let _ = rt_handle.block_on(async {
                sqlx::query(
                    r#"INSERT INTO recording_metadata 
                    (id, title, duration_secs, file_path, file_size_bytes, module_id, 
                     created_at, device_name, sample_rate, channels, transcribed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"#,
                )
                .bind(&id)
                .bind(format!("Recording {}", &id[..8]))
                .bind(actual_dur.as_secs_f64())
                .bind(&file_path.to_string_lossy().to_string())
                .bind(size as i64)
                .bind(&module_id)
                .bind(start_ts)
                .bind(&device_name)
                .bind(sample_rate as i64)
                .bind(channels as i64)
                .execute(&self.db)
                .await
            });
        }

        // Step 4: Wait for background thread to see IDLE, clean up, and signal
        for _ in 0..30 {
            if self.finalized.load(Ordering::Acquire) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        self.finalized.store(false, Ordering::Release);

        // Step 5: Build result (all fields always available since we took the session)
        let elapsed = {
            let total = start_time.elapsed() - paused_duration;
            let pause_deduction = pause_start
                .map(|ps| start_time.elapsed() - ps.elapsed())
                .unwrap_or(std::time::Duration::ZERO);
            total - pause_deduction
        };

        Ok(RecordingSession {
            id,
            status: "completed".to_string(),
            start_time: time::now_ms() - start_time.elapsed().as_millis() as i64,
            elapsed_ms: elapsed.as_millis() as i64,
            paused_duration_ms: paused_duration.as_millis() as i64,
            file_path: Some(file_path.to_string_lossy().to_string()),
            module_id,
            device_name: Some(device_name),
            sleep_detected,
        })
    }

    /// Pause the current recording.
    pub fn pause_recording(&self) -> Result<RecordingSession, String> {
        if self.status_atomic.load(Ordering::Relaxed) != status_code::RECORDING {
            return Err("Recording is not active.".to_string());
        }
        self.set_status(RecordingStatus::Paused);

        let mut guard = self.session.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut inner) = *guard {
            inner.pause_start = Some(std::time::Instant::now());
        }

        let elapsed = guard
            .as_ref()
            .map(|s| (s.start_time.elapsed() - s.paused_duration).as_millis() as i64)
            .unwrap_or(0);

        let sleep_detected = guard.as_ref().map(|s| s.sleep_detected).unwrap_or(false);

        Ok(RecordingSession {
            id: guard.as_ref().map(|s| s.id.clone()).unwrap_or_default(),
            status: "paused".to_string(),
            start_time: guard
                .as_ref()
                .map(|s| time::now_ms() - s.start_time.elapsed().as_millis() as i64)
                .unwrap_or(time::now_ms()),
            elapsed_ms: elapsed,
            paused_duration_ms: guard
                .as_ref()
                .map(|s| s.paused_duration.as_millis() as i64)
                .unwrap_or(0),
            file_path: guard
                .as_ref()
                .map(|s| s.file_path.to_string_lossy().to_string()),
            module_id: guard
                .as_ref()
                .map(|s| s.module_id.clone())
                .unwrap_or_default(),
            device_name: guard.as_ref().map(|s| s.device_name.clone()),
            sleep_detected,
        })
    }

    /// Resume a paused recording.
    pub fn resume_recording(&self) -> Result<RecordingSession, String> {
        if self.status_atomic.load(Ordering::Relaxed) != status_code::PAUSED {
            return Err("Recording is not paused.".to_string());
        }
        self.set_status(RecordingStatus::Recording);

        let mut guard = self.session.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut inner) = *guard {
            if let Some(pause_start) = inner.pause_start.take() {
                inner.paused_duration += pause_start.elapsed();
            }
        }

        let elapsed = guard
            .as_ref()
            .map(|s| (s.start_time.elapsed() - s.paused_duration).as_millis() as i64)
            .unwrap_or(0);

        let sleep_detected = guard.as_ref().map(|s| s.sleep_detected).unwrap_or(false);

        Ok(RecordingSession {
            id: guard.as_ref().map(|s| s.id.clone()).unwrap_or_default(),
            status: "recording".to_string(),
            start_time: guard
                .as_ref()
                .map(|s| time::now_ms() - s.start_time.elapsed().as_millis() as i64)
                .unwrap_or(time::now_ms()),
            elapsed_ms: elapsed,
            paused_duration_ms: guard
                .as_ref()
                .map(|s| s.paused_duration.as_millis() as i64)
                .unwrap_or(0),
            file_path: guard
                .as_ref()
                .map(|s| s.file_path.to_string_lossy().to_string()),
            module_id: guard
                .as_ref()
                .map(|s| s.module_id.clone())
                .unwrap_or_default(),
            device_name: guard.as_ref().map(|s| s.device_name.clone()),
            sleep_detected,
        })
    }

    /// Get current session info (for frontend polling).
    /// Returns `None` when recording session is cleared after finalization.
    pub fn get_current_session(&self) -> Result<Option<RecordingSession>, String> {
        let guard = self.session.lock().map_err(|e| e.to_string())?;
        Ok(guard.as_ref().map(|inner| {
            let total = inner.start_time.elapsed() - inner.paused_duration;
            let pause_deduction = inner
                .pause_start
                .map(|ps| inner.start_time.elapsed() - ps.elapsed())
                .unwrap_or(std::time::Duration::ZERO);
            let actual = total - pause_deduction;

            RecordingSession {
                id: inner.id.clone(),
                status: RecordingStatus::from_u32(self.status_atomic.load(Ordering::Relaxed))
                    .to_string(),
                start_time: time::now_ms() - inner.start_time.elapsed().as_millis() as i64,
                elapsed_ms: actual.as_millis() as i64,
                paused_duration_ms: inner.paused_duration.as_millis() as i64,
                file_path: Some(inner.file_path.to_string_lossy().to_string()),
                module_id: inner.module_id.clone(),
                device_name: Some(inner.device_name.clone()),
                sleep_detected: inner.sleep_detected,
            }
        }))
    }

    /// List all persisted recordings from the database.
    pub async fn list_recordings(
        &self,
        module_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<RecordingMeta>, String> {
        let db = self.db.clone();
        let module_id_owned = module_id.map(|s| s.to_string());

        let rows = match module_id_owned.as_deref() {
            Some(mid) => sqlx::query(
                r#"
                    SELECT m.*, t.transcript AS transcript
                    FROM recording_metadata m
                    LEFT JOIN recording_transcripts t ON t.recording_id = m.id
                    WHERE m.module_id = ?
                    ORDER BY m.created_at DESC
                    LIMIT ?
                    "#,
            )
            .bind(mid)
            .bind(limit)
            .fetch_all(&db)
            .await
            .map_err(|e| e.to_string())?,
            None => sqlx::query(
                r#"
                    SELECT m.*, t.transcript AS transcript
                    FROM recording_metadata m
                    LEFT JOIN recording_transcripts t ON t.recording_id = m.id
                    ORDER BY m.created_at DESC
                    LIMIT ?
                    "#,
            )
            .bind(limit)
            .fetch_all(&db)
            .await
            .map_err(|e| e.to_string())?,
        };

        Ok(rows
            .into_iter()
            .map(|r| RecordingMeta {
                id: r.try_get("id").unwrap_or_default(),
                title: r.try_get("title").unwrap_or_default(),
                duration_secs: r.try_get("duration_secs").unwrap_or(0.0),
                file_path: r.try_get("file_path").unwrap_or_default(),
                file_size_bytes: r.try_get::<i64, _>("file_size_bytes").unwrap_or(0) as u64,
                module_id: r.try_get("module_id").unwrap_or_default(),
                created_at: r.try_get("created_at").unwrap_or(0),
                device_name: r.try_get("device_name").ok(),
                sample_rate: r.try_get::<i64, _>("sample_rate").unwrap_or(44100) as u32,
                channels: r.try_get::<i64, _>("channels").unwrap_or(1) as u16,
                tags: Vec::new(),
                transcribed: r.try_get::<i64, _>("transcribed").unwrap_or(0) == 1,
                transcript: r.try_get::<String, _>("transcript").ok(),
            })
            .collect())
    }

    pub async fn transcribe_recording(
        &self,
        recording_id: &str,
        model_path: &str,
        language: Option<&str>,
    ) -> Result<String, String> {
        let row = sqlx::query("SELECT file_path, module_id FROM recording_metadata WHERE id = ?")
            .bind(recording_id)
            .fetch_optional(&self.db)
            .await
            .map_err(|e| e.to_string())?;

        let Some(row) = row else {
            return Err("Recording not found.".to_string());
        };

        let file_path: String = row.try_get("file_path").map_err(|e| e.to_string())?;
        let model_path = model_path.to_string();
        let language = language.unwrap_or("en").to_string();
        let model_path_for_db = model_path.clone();
        let language_for_db = language.clone();
        let app_dir = self.app_dir.clone();

        let transcript = tokio::task::spawn_blocking(move || {
            let mut reader = hound::WavReader::open(&file_path).map_err(|e| e.to_string())?;
            let spec = reader.spec();
            let sample_rate = spec.sample_rate.max(1);
            let channels = spec.channels.max(1);

            let samples = reader
                .samples::<i16>()
                .map(|sample| sample.map_err(|e| e.to_string()))
                .collect::<Result<Vec<_>, _>>()?;

            let mono = downmix_to_mono_f32(&samples, channels);
            let audio = resample_linear(&mono, sample_rate, 16_000);

            let transcriber = moonshine::Moonshine::new(&app_dir).map_err(|e| e.to_string())?;
            let text = transcriber
                .transcribe(&audio, 16_000)
                .map_err(|e| e.to_string())?;

            Ok::<String, String>(text.trim().to_string())
        })
        .await
        .map_err(|e| e.to_string())??;

        let now = time::now_ms();
        sqlx::query(
            r#"
            INSERT INTO recording_transcripts (
                recording_id, transcript, language, model_path, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(recording_id) DO UPDATE SET
                transcript = excluded.transcript,
                language = excluded.language,
                model_path = excluded.model_path,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(recording_id)
        .bind(&transcript)
        .bind(&language_for_db)
        .bind(&model_path_for_db)
        .bind(now)
        .bind(now)
        .execute(&self.db)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query("UPDATE recording_metadata SET transcribed = 1 WHERE id = ?")
            .bind(recording_id)
            .execute(&self.db)
            .await
            .map_err(|e| e.to_string())?;
        Ok(transcript)
    }

    /// Delete a recording by ID (removes file + metadata).
    pub async fn delete_recording(&self, id: &str) -> Result<(), String> {
        let db = self.db.clone();
        let id_owned = id.to_string();

        // Get file path before deleting metadata
        let row = sqlx::query("SELECT file_path FROM recording_metadata WHERE id = ?")
            .bind(&id_owned)
            .fetch_optional(&db)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(r) = row {
            if let Ok(path) = r.try_get::<String, _>("file_path") {
                let _ = std::fs::remove_file(&path);
            }
        }

        sqlx::query("DELETE FROM recording_transcripts WHERE recording_id = ?")
            .bind(&id_owned)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query("DELETE FROM recording_metadata WHERE id = ?")
            .bind(&id_owned)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Check if microphone is available and ready.
    pub fn check_microphone_permission() -> Result<bool, String> {
        let host = cpal::default_host();
        match host.default_input_device() {
            Some(_) => Ok(true),
            None => Ok(false),
        }
    }

    /// Update a recording's title metadata.
    pub async fn update_recording_title(&self, id: &str, title: &str) -> Result<(), String> {
        let db = self.db.clone();
        let id_owned = id.to_string();
        let title_owned = title.to_string();

        sqlx::query("UPDATE recording_metadata SET title = ? WHERE id = ?")
            .bind(&title_owned)
            .bind(&id_owned)
            .execute(&db)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Cancel the current recording — stop and delete the file without persisting.
    pub async fn cancel_recording(&self) -> Result<(), String> {
        if self.status_atomic.load(Ordering::Relaxed) == status_code::IDLE {
            return Err("No recording in progress.".to_string());
        }
        self.set_status(RecordingStatus::Idle);

        // Wait for background thread to finalize
        for _ in 0..30 {
            if self.finalized.load(Ordering::Acquire) {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        self.finalized.store(false, Ordering::Release);

        // Capture the recording ID before clearing, then delete file + metadata by ID
        let recording_id = {
            let mut guard = self.session.lock().map_err(|e| e.to_string())?;
            if let Some(inner) = guard.take() {
                let _ = std::fs::remove_file(&inner.file_path);
                Some(inner.id.clone())
            } else {
                None
            }
        };

        // Remove metadata by the specific recording ID (the background thread may
        // have already written it before finalized signal was set)
        if let Some(id) = recording_id {
            let _ = self.delete_recording(&id).await;
        }

        Ok(())
    }

    /// Retry recording — cancel current and start a new one.
    pub async fn retry_recording(
        &self,
        module_id: &str,
        device_name: Option<&str>,
    ) -> Result<RecordingSession, String> {
        // Cancel current recording if any (lock-free check)
        if self.status_atomic.load(Ordering::Relaxed) != status_code::IDLE {
            self.cancel_recording().await?;
        }
        // Start fresh
        self.start_recording(module_id, device_name)
    }
}

fn downmix_to_mono_f32(samples: &[i16], channels: u16) -> Vec<f32> {
    if channels <= 1 {
        return samples
            .iter()
            .map(|sample| (*sample as f32) / i16::MAX as f32)
            .collect();
    }

    let channels = channels as usize;
    let mut mono = Vec::with_capacity(samples.len() / channels.max(1));
    for frame in samples.chunks(channels) {
        if frame.is_empty() {
            continue;
        }
        let sum: f32 = frame
            .iter()
            .map(|sample| *sample as f32 / i16::MAX as f32)
            .sum();
        mono.push(sum / frame.len() as f32);
    }
    mono
}

fn resample_linear(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if samples.is_empty() || from_rate == 0 || to_rate == 0 || from_rate == to_rate {
        return samples.to_vec();
    }

    let ratio = to_rate as f64 / from_rate as f64;
    let target_len = ((samples.len() as f64) * ratio).ceil().max(1.0) as usize;
    let mut out = Vec::with_capacity(target_len);

    for i in 0..target_len {
        let source_pos = (i as f64) / ratio;
        let left = source_pos.floor() as usize;
        let right = (left + 1).min(samples.len().saturating_sub(1));
        let frac = (source_pos - left as f64) as f32;
        let left_sample = samples.get(left).copied().unwrap_or(0.0);
        let right_sample = samples.get(right).copied().unwrap_or(left_sample);
        out.push(left_sample + (right_sample - left_sample) * frac);
    }

    out
}

// ─── Playback Engine ──────────────────────────────────────────────────

enum PlaybackCommand {
    Play {
        file_path: String,
        respond_to: mpsc::Sender<Result<(), String>>,
    },
    Pause {
        respond_to: mpsc::Sender<Result<(), String>>,
    },
    Resume {
        respond_to: mpsc::Sender<Result<(), String>>,
    },
    Stop {
        respond_to: mpsc::Sender<Result<(), String>>,
    },
}

pub struct PlaybackEngine {
    command_tx: mpsc::Sender<PlaybackCommand>,
    is_playing: Arc<AtomicBool>,
}

impl Default for PlaybackEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl PlaybackEngine {
    pub fn new() -> Self {
        let (command_tx, command_rx) = mpsc::channel::<PlaybackCommand>();
        let is_playing = Arc::new(AtomicBool::new(false));
        let worker_is_playing = Arc::clone(&is_playing);

        thread::spawn(move || {
            let mut output_stream: Option<rodio::OutputStream> = None;
            let mut sink: Option<rodio::Sink> = None;

            loop {
                if let Some(active_sink) = sink.as_ref() {
                    if active_sink.empty() {
                        sink = None;
                        output_stream = None;
                        worker_is_playing.store(false, Ordering::Release);
                    }
                }

                let command = match command_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(command) => command,
                    Err(mpsc::RecvTimeoutError::Timeout) => continue,
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                };

                match command {
                    PlaybackCommand::Play {
                        file_path,
                        respond_to,
                    } => {
                        let result = (|| -> Result<(), String> {
                            sink = None;
                            output_stream = None;

                            let (_stream, stream_handle) = rodio::OutputStream::try_default()
                                .map_err(|e| format!("Failed to open audio output: {e}"))?;
                            let new_sink = rodio::Sink::try_new(&stream_handle)
                                .map_err(|e| format!("Failed to create audio sink: {e}"))?;
                            let file = std::fs::File::open(&file_path)
                                .map_err(|e| format!("Failed to open file: {e}"))?;
                            let source = rodio::Decoder::new(std::io::BufReader::new(file))
                                .map_err(|e| format!("Failed to decode audio: {e}"))?;

                            new_sink.append(source);
                            output_stream = Some(_stream);
                            sink = Some(new_sink);
                            worker_is_playing.store(true, Ordering::Release);
                            Ok(())
                        })();
                        let _ = respond_to.send(result);
                    }
                    PlaybackCommand::Pause { respond_to } => {
                        let result = match sink.as_ref() {
                            Some(active_sink) => {
                                active_sink.pause();
                                worker_is_playing.store(false, Ordering::Release);
                                Ok(())
                            }
                            None => Err("No active playback.".to_string()),
                        };
                        let _ = respond_to.send(result);
                    }
                    PlaybackCommand::Resume { respond_to } => {
                        let result = match sink.as_ref() {
                            Some(active_sink) => {
                                active_sink.play();
                                worker_is_playing.store(true, Ordering::Release);
                                Ok(())
                            }
                            None => Err("No active playback.".to_string()),
                        };
                        let _ = respond_to.send(result);
                    }
                    PlaybackCommand::Stop { respond_to } => {
                        sink = None;
                        output_stream = None;
                        worker_is_playing.store(false, Ordering::Release);
                        let _ = respond_to.send(Ok(()));
                    }
                }
            }
        });

        Self {
            command_tx,
            is_playing,
        }
    }

    fn request(&self, command: PlaybackCommand) -> Result<(), String> {
        self.command_tx
            .send(command)
            .map_err(|error| error.to_string())
    }

    /// Play a WAV file from the given path.
    pub fn play(&self, file_path: &str) -> Result<(), String> {
        let (respond_to, response_rx) = mpsc::channel();
        self.request(PlaybackCommand::Play {
            file_path: file_path.to_string(),
            respond_to,
        })?;
        response_rx.recv().map_err(|error| error.to_string())?
    }

    /// Check if playback is currently active.
    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Acquire)
    }

    /// Pause playback.
    pub fn pause(&self) -> Result<(), String> {
        let (respond_to, response_rx) = mpsc::channel();
        self.request(PlaybackCommand::Pause { respond_to })?;
        response_rx.recv().map_err(|error| error.to_string())?
    }

    /// Resume paused playback.
    pub fn resume(&self) -> Result<(), String> {
        let (respond_to, response_rx) = mpsc::channel();
        self.request(PlaybackCommand::Resume { respond_to })?;
        response_rx.recv().map_err(|error| error.to_string())?
    }

    /// Stop playback and release resources.
    pub fn stop(&self) -> Result<(), String> {
        let (respond_to, response_rx) = mpsc::channel();
        self.request(PlaybackCommand::Stop { respond_to })?;
        response_rx.recv().map_err(|error| error.to_string())?
    }
}

// ─── Managed State ────────────────────────────────────────────────────

pub struct AudioState {
    pub engine: RecordingEngine,
    pub playback: PlaybackEngine,
    /// AppHandle for emitting voice events to frontend.
    pub app_handle: Option<tauri::AppHandle>,
}

impl AudioState {
    pub fn new(app_dir: PathBuf, db: SqlitePool, app_handle: Option<tauri::AppHandle>) -> Self {
        let mut engine = RecordingEngine::new(app_dir, db);
        if let Some(ref handle) = app_handle {
            engine.set_app_handle(handle.clone());
        }
        Self {
            engine,
            playback: PlaybackEngine::new(),
            app_handle,
        }
    }
}

// ─── Tauri Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn start_recording(
    state: tauri::State<'_, AudioState>,
    module_id: String,
    device_name: Option<String>,
) -> Result<RecordingSession, String> {
    state
        .engine
        .start_recording(&module_id, device_name.as_deref())
}

#[tauri::command]
pub async fn stop_recording(
    state: tauri::State<'_, AudioState>,
) -> Result<RecordingSession, String> {
    state.engine.stop_recording()
}

#[tauri::command]
pub async fn pause_recording(
    state: tauri::State<'_, AudioState>,
) -> Result<RecordingSession, String> {
    state.engine.pause_recording()
}

#[tauri::command]
pub async fn resume_recording(
    state: tauri::State<'_, AudioState>,
) -> Result<RecordingSession, String> {
    state.engine.resume_recording()
}

#[tauri::command]
pub async fn get_recording_status(state: tauri::State<'_, AudioState>) -> Result<String, String> {
    Ok(state.engine.get_status().to_string())
}

#[tauri::command]
pub async fn get_current_session(
    state: tauri::State<'_, AudioState>,
) -> Result<Option<RecordingSession>, String> {
    state.engine.get_current_session()
}

#[tauri::command]
pub async fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    RecordingEngine::list_devices()
}

#[tauri::command]
pub async fn list_recordings(
    state: tauri::State<'_, AudioState>,
    module_id: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<RecordingMeta>, String> {
    state
        .engine
        .list_recordings(module_id.as_deref(), limit.unwrap_or(50))
        .await
}

#[tauri::command]
pub async fn delete_recording(
    state: tauri::State<'_, AudioState>,
    id: String,
) -> Result<(), String> {
    state.engine.delete_recording(&id).await
}

#[tauri::command]
pub async fn update_recording_title(
    state: tauri::State<'_, AudioState>,
    id: String,
    title: String,
) -> Result<(), String> {
    state.engine.update_recording_title(&id, &title).await
}

#[tauri::command]
pub async fn playback_start(
    state: tauri::State<'_, AudioState>,
    file_path: String,
) -> Result<(), String> {
    state.playback.play(&file_path)
}

#[tauri::command]
pub async fn playback_pause(state: tauri::State<'_, AudioState>) -> Result<(), String> {
    state.playback.pause()
}

#[tauri::command]
pub async fn playback_resume(state: tauri::State<'_, AudioState>) -> Result<(), String> {
    state.playback.resume()
}

#[tauri::command]
pub async fn playback_stop(state: tauri::State<'_, AudioState>) -> Result<(), String> {
    state.playback.stop()
}

#[tauri::command]
pub async fn playback_is_playing(state: tauri::State<'_, AudioState>) -> Result<bool, String> {
    Ok(state.playback.is_playing())
}

#[tauri::command]
pub async fn cancel_recording(state: tauri::State<'_, AudioState>) -> Result<(), String> {
    state.engine.cancel_recording().await
}

#[tauri::command]
pub async fn retry_recording(
    state: tauri::State<'_, AudioState>,
    module_id: String,
    device_name: Option<String>,
) -> Result<RecordingSession, String> {
    state
        .engine
        .retry_recording(&module_id, device_name.as_deref())
        .await
}

#[tauri::command]
pub async fn check_microphone_permission() -> Result<bool, String> {
    RecordingEngine::check_microphone_permission()
}

#[tauri::command]
pub async fn transcribe_recording(
    state: tauri::State<'_, AudioState>,
    recording_id: String,
    model_path: String,
    language: Option<String>,
) -> Result<String, String> {
    state
        .engine
        .transcribe_recording(&recording_id, &model_path, language.as_deref())
        .await
}
