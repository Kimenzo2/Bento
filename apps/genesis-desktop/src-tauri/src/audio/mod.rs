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
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
    mpsc,
};
use std::thread;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

// ─── Recording State ──────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RecordingStatus {
    Idle,
    Recording,
    Paused,
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
    status: Arc<Mutex<RecordingStatus>>,
    session: Arc<Mutex<Option<InnerSession>>>,
    app_dir: PathBuf,
    db: SqlitePool,
    /// Signalled by the background thread after WAV finalization + SQLite write.
    finalized: Arc<AtomicBool>,
    /// Set to true while the sleep-detection watchdog is running.
    /// Set to false to signal the watchdog to exit (e.g. on manual stop).
    watchdog_active: Arc<AtomicBool>,
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
            status: Arc::new(Mutex::new(RecordingStatus::Idle)),
            session: Arc::new(Mutex::new(None)),
            app_dir,
            db,
            finalized: Arc::new(AtomicBool::new(false)),
            watchdog_active: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn get_status(&self) -> RecordingStatus {
        self.status
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
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
                            if min == max { Some(min) } else { None }
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
        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        if *status != RecordingStatus::Idle {
            return Err("Recording is already in progress.".to_string());
        }
        *status = RecordingStatus::Recording;
        drop(status);

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
        let status_arc = self.status.clone();
        let session_arc = self.session.clone();
        let status_arc_for_callback = Arc::clone(&status_arc);
        let session_arc_for_callback = Arc::clone(&session_arc);
        let session_id_clone = session_id.clone();
        let db_clone = self.db.clone();
        let device_name_clone = device_name.clone();

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

        // ── Sleep-detection watchdog ──────────────────────────────────────
        // Compares monotonic elapsed time vs wall-clock elapsed time every 2s.
        // If wall-clock elapsed exceeds monotonic elapsed by > 30s, the machine
        // likely slept mid-recording — flag it so the frontend can alert the user.
        const SLEEP_THRESHOLD_MS: i64 = 30_000;
        let watchdog_session = Arc::clone(&self.session);
        let watchdog_active = Arc::clone(&self.watchdog_active);
        self.watchdog_active.store(true, Ordering::Release);
        std::thread::spawn(move || {
            while watchdog_active.load(Ordering::Acquire) {
                std::thread::sleep(std::time::Duration::from_secs(2));
                if !watchdog_active.load(Ordering::Acquire) {
                    break;
                }
                let mut guard = match watchdog_session.lock() {
                    Ok(g) => g,
                    Err(_) => continue,
                };
                if let Some(ref mut inner) = *guard {
                    let monotonic_elapsed = inner.start_time.elapsed().as_millis() as i64;
                    let wall_clock_elapsed = time::now_ms() - inner.start_time_ms;
                    let drift = wall_clock_elapsed - monotonic_elapsed;
                    if drift > SLEEP_THRESHOLD_MS && !inner.sleep_detected {
                        inner.sleep_detected = true;
                        eprintln!(
                            "[audio] Sleep detected mid-recording: drift={}ms (threshold={}ms)",
                            drift, SLEEP_THRESHOLD_MS
                        );
                    }
                }
                drop(guard);
            }
        });

        // Spawn audio capture thread
        std::thread::spawn(move || {
            let input_stream = match device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // Check if we should still be recording
                    let s = status_arc_for_callback
                        .lock()
                        .unwrap_or_else(|e| e.into_inner());
                    let s_clone = s.clone();
                    drop(s);

                    if s_clone == RecordingStatus::Idle || s_clone == RecordingStatus::Paused {
                        return;
                    }

                    // Write samples to WAV
                    let mut guard = session_arc_for_callback
                        .lock()
                        .unwrap_or_else(|e| e.into_inner());
                    if let Some(ref mut inner) = *guard {
                        for &sample in data {
                            // Convert f32 [-1.0, 1.0] to i16
                            let amplitude = (sample * i16::MAX as f32) as i16;
                            if let Err(_) = inner.file.write_sample(amplitude) {
                                break;
                            }
                        }
                    }
                },
                |err| {
                    eprintln!("[audio] Stream error: {err}");
                },
                None,
            ) {
                Ok(stream) => stream,
                Err(e) => {
                    eprintln!("[audio] Failed to build input stream: {e}");
                    return;
                }
            };

            // Keep stream alive until recording stops
            loop {
                std::thread::sleep(std::time::Duration::from_millis(500));
                let s = status_arc.lock().unwrap_or_else(|e| e.into_inner());
                if *s == RecordingStatus::Idle {
                    drop(s);
                    // Close the writer
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

                        // Persist metadata to SQLite synchronously on this background thread
                        if let Err(e) = rt_handle.block_on(async {
                            sqlx::query(
                                r#"INSERT INTO recording_metadata 
                                (id, title, duration_secs, file_path, file_size_bytes, module_id, 
                                 created_at, device_name, sample_rate, channels, transcribed)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)"#,
                            )
                            .bind(&id)
                            .bind(&format!("Recording {}", &id[..8]))
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
                            eprintln!("[audio] Failed to persist recording metadata: {e}");
                        }
                    }
                    drop(guard);
                    finalized_arc.store(true, Ordering::Release);
                    break;
                }
                drop(s);
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
    /// Waits for the background thread to confirm SQLite persistence before returning.
    pub fn stop_recording(&self) -> Result<RecordingSession, String> {
        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        if *status == RecordingStatus::Idle {
            return Err("No recording in progress.".to_string());
        }
        *status = RecordingStatus::Idle;
        drop(status);

        // Stop the sleep-detection watchdog
        self.watchdog_active.store(false, Ordering::Release);

        // Wait for background thread to finalize + persist (up to 3 seconds)
        for _ in 0..30 {
            if self.finalized.load(Ordering::Acquire) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        self.finalized.store(false, Ordering::Release);

        // Extract session data before clearing
        let mut guard = self.session.lock().map_err(|e| e.to_string())?;
        let sleep_detected = guard.as_ref().map(|s| s.sleep_detected).unwrap_or(false);
        let session_data = guard.take();
        let elapsed = session_data
            .as_ref()
            .map(|s| {
                let total = s.start_time.elapsed() - s.paused_duration;
                let pause_deduction = s
                    .pause_start
                    .map(|ps| s.start_time.elapsed() - ps.elapsed())
                    .unwrap_or(std::time::Duration::ZERO);
                total - pause_deduction
            })
            .unwrap_or(std::time::Duration::ZERO);

        let result = RecordingSession {
            id: session_data
                .as_ref()
                .map(|s| s.id.clone())
                .unwrap_or_default(),
            status: "completed".to_string(),
            start_time: session_data
                .as_ref()
                .map(|s| time::now_ms() - s.start_time.elapsed().as_millis() as i64)
                .unwrap_or(time::now_ms()),
            elapsed_ms: elapsed.as_millis() as i64,
            paused_duration_ms: session_data
                .as_ref()
                .map(|s| s.paused_duration.as_millis() as i64)
                .unwrap_or(0),
            file_path: session_data
                .as_ref()
                .map(|s| s.file_path.to_string_lossy().to_string()),
            module_id: session_data
                .as_ref()
                .map(|s| s.module_id.clone())
                .unwrap_or_default(),
            device_name: session_data.as_ref().map(|s| s.device_name.clone()),
            sleep_detected,
        };

        drop(guard);
        Ok(result)
    }

    /// Pause the current recording.
    pub fn pause_recording(&self) -> Result<RecordingSession, String> {
        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        if *status != RecordingStatus::Recording {
            return Err("Recording is not active.".to_string());
        }
        *status = RecordingStatus::Paused;

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
        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        if *status != RecordingStatus::Paused {
            return Err("Recording is not paused.".to_string());
        }
        *status = RecordingStatus::Recording;

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
                status: self
                    .status
                    .lock()
                    .map(|s| s.to_string())
                    .unwrap_or_default(),
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
    pub fn list_recordings(
        &self,
        module_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<RecordingMeta>, String> {
        let rt = tokio::runtime::Handle::try_current()
            .map_err(|_| "No Tokio runtime available.".to_string())?;

        let db = self.db.clone();
        let module_id_owned = module_id.map(|s| s.to_string());

        let rows = rt.block_on(async {
            match module_id_owned.as_deref() {
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
                .map_err(|e| e.to_string()),
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
                .map_err(|e| e.to_string()),
            }
        })?;

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

            let context =
                WhisperContext::new_with_params(&model_path, WhisperContextParameters::default())
                    .map_err(|e| e.to_string())?;

            let mut state = context.create_state().map_err(|e| e.to_string())?;
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_language(Some(&language));
            params.set_translate(false);
            params.set_print_special(false);
            params.set_print_progress(false);
            params.set_print_realtime(false);
            params.set_print_timestamps(false);

            state.full(params, &audio).map_err(|e| e.to_string())?;

            let mut transcript = String::new();
            for segment in state.as_iter() {
                let text = segment.to_string();
                if !text.trim().is_empty() {
                    if !transcript.is_empty() {
                        transcript.push(' ');
                    }
                    transcript.push_str(text.trim());
                }
            }

            Ok::<String, String>(transcript.trim().to_string())
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
    pub fn delete_recording(&self, id: &str) -> Result<(), String> {
        let rt = tokio::runtime::Handle::try_current()
            .map_err(|_| "No Tokio runtime available.".to_string())?;

        let db = self.db.clone();
        let id_owned = id.to_string();

        // Get file path before deleting metadata
        let row = rt.block_on(async {
            sqlx::query("SELECT file_path FROM recording_metadata WHERE id = ?")
                .bind(&id_owned)
                .fetch_optional(&db)
                .await
                .map_err(|e| e.to_string())
        })?;

        if let Some(r) = row {
            if let Ok(path) = r.try_get::<String, _>("file_path") {
                let _ = std::fs::remove_file(&path);
            }
        }

        rt.block_on(async {
            sqlx::query("DELETE FROM recording_transcripts WHERE recording_id = ?")
                .bind(&id_owned)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())?;
            sqlx::query("DELETE FROM recording_metadata WHERE id = ?")
                .bind(&id_owned)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())
        })?;

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
    pub fn update_recording_title(&self, id: &str, title: &str) -> Result<(), String> {
        let rt = tokio::runtime::Handle::try_current()
            .map_err(|_| "No Tokio runtime available.".to_string())?;

        let db = self.db.clone();
        let id_owned = id.to_string();
        let title_owned = title.to_string();

        rt.block_on(async {
            sqlx::query("UPDATE recording_metadata SET title = ? WHERE id = ?")
                .bind(&title_owned)
                .bind(&id_owned)
                .execute(&db)
                .await
                .map_err(|e| e.to_string())
        })?;

        Ok(())
    }

    /// Cancel the current recording — stop and delete the file without persisting.
    pub fn cancel_recording(&self) -> Result<(), String> {
        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        if *status == RecordingStatus::Idle {
            return Err("No recording in progress.".to_string());
        }
        *status = RecordingStatus::Idle;
        drop(status);

        // Stop the sleep-detection watchdog
        self.watchdog_active.store(false, Ordering::Release);

        // Wait for background thread to finalize
        for _ in 0..30 {
            if self.finalized.load(Ordering::Acquire) {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
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
            let _ = self.delete_recording(&id);
        }

        Ok(())
    }

    /// Retry recording — cancel current and start a new one.
    pub fn retry_recording(
        &self,
        module_id: &str,
        device_name: Option<&str>,
    ) -> Result<RecordingSession, String> {
        // Cancel current recording if any
        let status = self.status.lock().map_err(|e| e.to_string())?.clone();
        if status != RecordingStatus::Idle {
            self.cancel_recording()?;
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
}

impl AudioState {
    pub fn new(app_dir: PathBuf, db: SqlitePool) -> Self {
        Self {
            engine: RecordingEngine::new(app_dir, db),
            playback: PlaybackEngine::new(),
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
}

#[tauri::command]
pub async fn delete_recording(
    state: tauri::State<'_, AudioState>,
    id: String,
) -> Result<(), String> {
    state.engine.delete_recording(&id)
}

#[tauri::command]
pub async fn update_recording_title(
    state: tauri::State<'_, AudioState>,
    id: String,
    title: String,
) -> Result<(), String> {
    state.engine.update_recording_title(&id, &title)
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
    state.engine.cancel_recording()
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
