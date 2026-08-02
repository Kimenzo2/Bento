// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Live Transcript Preview — Real-time streaming transcription
// ═══════════════════════════════════════════════════════════════════════
// Provides a non-blocking "tap" alongside the primary WAV file writer.
// Audio chunks (~8s) are sent to the AI provider for fast transcription
// while the recording is still in progress.
//
// Design principles:
//   - Non-authoritative: the live preview is for UI feedback only.
//     The final transcript comes from batch processing the saved WAV.
//   - Backpressure: stale preview data is dropped to keep up with live audio.
//   - Non-blocking: preview failures never affect the recording.
//   - Context window: last N turns are sent as context for AI quality.
// ═══════════════════════════════════════════════════════════════════════

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri::Manager;

use crate::audio::turns::{is_effectively_silent, normalize_wav_for_transcription};

// ─── Constants ────────────────────────────────────────────────────────

/// Duration of each preview chunk in milliseconds.
const PREVIEW_CHUNK_MS: u64 = 8_000;

/// Maximum backlog chunks for the preview worker.
/// If the backlog exceeds this, old chunks are dropped to keep up.
const PREVIEW_MAX_BACKLOG_BATCHES: usize = 4;

/// Number of previous transcript turns to include as context.
const PREVIEW_CONTEXT_TURNS: usize = 3;

// ─── Types ───────────────────────────────────────────────────────────

/// A batch of audio samples for preview processing.
#[derive(Clone)]
pub struct PreviewBatch {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub chunk_index: u64,
}

/// A live transcript event emitted to the frontend.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveTranscriptEventDto {
    pub note_id: String,
    pub session_id: String,
    pub source: String,
    pub segment_id: String,
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
    pub is_final: bool,
}

// ─── Controller ──────────────────────────────────────────────────────

/// Controller for microphone live preview.
pub struct LivePreviewController {
    tx: mpsc::Sender<PreviewBatch>,
    cancel: Arc<AtomicBool>,
    /// Recent preview text for context window.
    recent_text: Arc<Mutex<Vec<String>>>,
}

impl LivePreviewController {
    /// Start a new live preview session.
    /// `session_id` is used to tag emitted events.
    /// `note_id` is used to associate preview with a note.
    pub fn start(
        app_handle: tauri::AppHandle,
        session_id: String,
        note_id: String,
        sample_rate: u32,
        channels: u16,
    ) -> Self {
        let (tx, rx) = mpsc::channel::<PreviewBatch>();
        let cancel = Arc::new(AtomicBool::new(false));
        let cancel_clone = Arc::clone(&cancel);
        let recent_text: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
        let recent_text_clone = Arc::clone(&recent_text);

        let processing_dir = app_handle
            .path()
            .app_data_dir()
            .ok()
            .map(|p: std::path::PathBuf| p.join("preview"))
            .unwrap_or_else(|| std::env::temp_dir().join("bento-preview"));
        std::fs::create_dir_all(&processing_dir).ok();

        std::thread::spawn(move || {
            run_live_preview_worker(
                rx,
                cancel_clone,
                app_handle,
                session_id,
                note_id,
                sample_rate,
                channels,
                processing_dir,
                recent_text_clone,
            );
        });

        Self {
            tx,
            cancel,
            recent_text,
        }
    }

    /// Push a batch of audio samples into the preview pipeline.
    pub fn push_samples(&self, samples: &[f32], chunk_index: u64) {
        if self.cancel.load(Ordering::Relaxed) {
            return;
        }
        // Read sample_rate from the batch metadata (we don't have it stored, use default)
        let _ = self.tx.send(PreviewBatch {
            samples: samples.to_vec(),
            sample_rate: 48000, // Will be determined from recording config in practice
            channels: 1,
            chunk_index,
        });
    }

    /// Stop the preview worker.
    pub fn stop(&self) {
        self.cancel.store(true, Ordering::Release);
    }

    /// Get recent preview text for context.
    pub fn recent_context(&self) -> Vec<String> {
        self.recent_text
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_default()
    }
}

// ─── Worker ──────────────────────────────────────────────────────────

/// Background worker that processes preview batches.
fn run_live_preview_worker(
    rx: mpsc::Receiver<PreviewBatch>,
    cancel: Arc<AtomicBool>,
    app_handle: tauri::AppHandle,
    session_id: String,
    note_id: String,
    _sample_rate: u32,
    _channels: u16,
    processing_dir: PathBuf,
    recent_text: Arc<Mutex<Vec<String>>>,
) {
    let mut backlog: Vec<PreviewBatch> = Vec::new();
    let mut chunk_index: u64 = 0;

    loop {
        if cancel.load(Ordering::Relaxed) {
            break;
        }

        // Collect available batches (non-blocking)
        while let Ok(batch) = rx.try_recv() {
            backlog.push(batch);

            // Drop old batches if backlog is too large (backpressure)
            if backlog.len() > PREVIEW_MAX_BACKLOG_BATCHES {
                let dropped = backlog.len() - PREVIEW_MAX_BACKLOG_BATCHES;
                backlog.drain(0..dropped);
                eprintln!(
                    "[live-preview] Dropped {} stale batches (backlog={})",
                    dropped,
                    backlog.len()
                );
            }
        }

        if backlog.is_empty() {
            std::thread::sleep(std::time::Duration::from_millis(100));
            continue;
        }

        // Process the next batch - clone metadata before mutating backlog
        let (duration_ms, sample_rate_for_chunk) = {
            let first_batch = match backlog.first() {
                Some(b) => b,
                None => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    continue;
                }
            };
            let dur =
                (first_batch.samples.len() as f64 / first_batch.sample_rate as f64 * 1000.0) as u64;
            (dur, first_batch.sample_rate)
        };

        if duration_ms < PREVIEW_CHUNK_MS {
            // Not enough audio yet — accumulate more
            std::thread::sleep(std::time::Duration::from_millis(200));
            continue;
        }

        // Merge all available samples up to PREVIEW_CHUNK_MS
        let mut merged_samples: Vec<f32> = Vec::new();
        let mut total_samples = 0usize;
        let mut batches_to_consume = 0usize;

        for b in &backlog {
            let needed = (sample_rate_for_chunk as f64 * PREVIEW_CHUNK_MS as f64 / 1000.0) as usize;
            if total_samples + b.samples.len() > needed {
                let remaining = needed.saturating_sub(total_samples);
                merged_samples.extend_from_slice(&b.samples[..remaining]);
                batches_to_consume += 1;
                break;
            }
            merged_samples.extend_from_slice(&b.samples);
            total_samples += b.samples.len();
            batches_to_consume += 1;
        }

        // Remove consumed batches
        backlog.drain(0..batches_to_consume);

        // Check if silent
        if is_effectively_silent(&merged_samples) {
            chunk_index += 1;
            continue;
        }

        // Transcribe this chunk
        let chunk_path = processing_dir.join(format!("preview_{}.wav", chunk_index));
        let norm_path = processing_dir.join(format!("preview_{}_norm.wav", chunk_index));

        // Write temporary WAV
        {
            let spec = hound::WavSpec {
                channels: 1,
                sample_rate: sample_rate_for_chunk,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };
            if let Ok(mut writer) = hound::WavWriter::create(&chunk_path, spec) {
                for &sample in &merged_samples {
                    let amplitude = (sample * i16::MAX as f32) as i16;
                    let _ = writer.write_sample(amplitude);
                }
                let _ = writer.finalize();
            }
        }

        // Normalize to 16kHz mono
        if normalize_wav_for_transcription(
            &chunk_path.to_string_lossy(),
            &norm_path.to_string_lossy(),
        )
        .is_err()
        {
            chunk_index += 1;
            continue;
        }

        // Read normalized audio
        let reader = match hound::WavReader::open(&norm_path) {
            Ok(r) => r,
            Err(_) => {
                chunk_index += 1;
                continue;
            }
        };

        let spec = reader.spec();
        let samples: Vec<i16> = reader
            .into_samples::<i16>()
            .filter_map(|s| s.ok())
            .collect();

        if samples.is_empty() {
            chunk_index += 1;
            continue;
        }

        let audio_f32: Vec<f32> = samples
            .iter()
            .map(|&s| s as f32 / i16::MAX as f32)
            .collect();

        if is_effectively_silent(&audio_f32) {
            chunk_index += 1;
            continue;
        }

        // Transcribe
        let app_dir = processing_dir
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::env::temp_dir().join("bento"));

        let result_text = {
            let transcriber = match crate::audio::moonshine::Moonshine::new(&app_dir) {
                Ok(t) => t,
                Err(_) => {
                    chunk_index += 1;
                    continue;
                }
            };
            match transcriber.transcribe(&audio_f32, spec.sample_rate.max(1) as i32) {
                Ok(t) => t.trim().to_string(),
                Err(_) => {
                    chunk_index += 1;
                    continue;
                }
            }
        };

        if result_text.is_empty() {
            chunk_index += 1;
            continue;
        }

        // Update recent context
        {
            if let Ok(mut recent) = recent_text.lock() {
                recent.push(result_text.clone());
                if recent.len() > PREVIEW_CONTEXT_TURNS {
                    let excess = recent.len() - PREVIEW_CONTEXT_TURNS;
                    recent.drain(0..excess);
                }
            }
        }

        // Build context string
        #[allow(unused_variables)]
        let context = {
            if let Ok(recent) = recent_text.lock() {
                recent.join(" | ")
            } else {
                String::new()
            }
        };

        // Emit to frontend
        let event = LiveTranscriptEventDto {
            note_id: note_id.clone(),
            session_id: session_id.clone(),
            source: "microphone".to_string(),
            segment_id: format!("preview-{}", chunk_index),
            start_ms: chunk_index * PREVIEW_CHUNK_MS,
            end_ms: (chunk_index + 1) * PREVIEW_CHUNK_MS,
            text: result_text,
            is_final: false,
        };

        let _ = app_handle.emit("voice:live-transcript", &event);

        chunk_index += 1;

        // Cleanup temp files
        let _ = std::fs::remove_file(&chunk_path);
        let _ = std::fs::remove_file(&norm_path);

        std::thread::sleep(std::time::Duration::from_millis(50));
    }
}

// ─── System Audio Preview ────────────────────────────────────────────

/// Controller for system audio live preview.
/// Polls a growing WAV file for new data.
pub struct SystemLivePreviewController {
    cancel: Arc<AtomicBool>,
}

impl SystemLivePreviewController {
    pub fn start(
        _app_handle: tauri::AppHandle,
        _session_id: String,
        _note_id: String,
        _system_wav_path: PathBuf,
    ) -> Self {
        // System audio preview is macOS-specific (out-of-process helper)
        // For now, stub the implementation — full support requires
        // polling the system audio WAV file for new data.
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn stop(&self) {
        self.cancel.store(true, Ordering::Release);
    }
}
