// ═══════════════════════════════════════════════════════════════════════
// Moonshine Speech-to-Text Engine — Rust FFI Wrapper
// ═══════════════════════════════════════════════════════════════════════
// Uses libloading to dynamically load the Moonshine C API shared library
// (moonshine.dll / libmoonshine.dylib / libmoonshine.so).
//
// Moonshine by Useful Sensors / moonshine-ai
// https://github.com/moonshine-ai/moonshine
// ═══════════════════════════════════════════════════════════════════════

use libloading::Library;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

// ─── Model Architectures ─────────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoonshineModelArch {
    Tiny = 0,
    Base = 1,
    TinyStreaming = 2,
    BaseStreaming = 3,
}

impl MoonshineModelArch {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Tiny => "tiny",
            Self::Base => "base",
            Self::TinyStreaming => "tiny_streaming",
            Self::BaseStreaming => "base_streaming",
        }
    }

    pub fn model_dir(&self) -> &'static str {
        match self {
            Self::Tiny => "moonshine-tiny",
            Self::Base => "moonshine-base",
            Self::TinyStreaming => "moonshine-tiny-streaming",
            Self::BaseStreaming => "moonshine-base-streaming",
        }
    }

    /// For dictation, TinyStreaming minimises latency.
    pub fn default() -> Self {
        Self::TinyStreaming
    }
}

// ─── C API Type Aliases (mirrors moonshine-c-api.h) ─────────────────────────

#[repr(C)]
pub struct CTranscript {
    pub lines: *mut TranscriptLine,
    pub line_count: usize,
}

#[repr(C)]
#[derive(Debug, Clone)]
pub struct TranscriptLine {
    pub start: f32,
    pub end: f32,
    pub duration: f32,
    pub text: *const std::os::raw::c_char,
    pub is_partial: bool,
    pub speaker_id: u64,
    pub speaker_index: u32,
}

// ─── Error Handling ─────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum MoonshineError {
    LibraryNotFound(String),
    FunctionNotFound(String),
    ModelNotFound(String),
    TranscriptionFailed(i32, String),
    StreamError(i32, String),
}

impl std::fmt::Display for MoonshineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::LibraryNotFound(p) => write!(f, "Moonshine library not found: {p}"),
            Self::FunctionNotFound(n) => write!(f, "Moonshine function not found: {n}"),
            Self::ModelNotFound(p) => write!(f, "Moonshine model not found: {p}"),
            Self::TranscriptionFailed(c, m) => write!(f, "Transcription failed ({c}): {m}"),
            Self::StreamError(c, m) => write!(f, "Stream error ({c}): {m}"),
        }
    }
}

impl std::error::Error for MoonshineError {}

// ─── Transcriber ────────────────────────────────────────────────────────────

/// Safe wrapper around the Moonshine C API transcriber.
///
/// Uses `libloading` to dynamically load the Moonshine shared library at
/// runtime. This avoids compiling C++ during `cargo build` — the library
/// is loaded on first use.
pub struct Moonshine {
    _lib: Library,
    handle: Mutex<Option<i32>>,
    model_root: PathBuf,
    loaded: Mutex<bool>,
}

impl Moonshine {
    /// Library filenames per platform.
    fn lib_filename() -> &'static str {
        if cfg!(target_os = "windows") {
            "moonshine.dll"
        } else if cfg!(target_os = "macos") {
            "libmoonshine.dylib"
        } else {
            "libmoonshine.so"
        }
    }

    /// Search paths for the Moonshine shared library, in priority order.
    fn search_paths(app_dir: &Path) -> Vec<PathBuf> {
        let lib = Self::lib_filename();
        vec![
            app_dir.join("binaries").join(lib),
            app_dir.join("moonshine").join(lib),
            app_dir.join("models").join(lib),
            PathBuf::from(lib),
        ]
    }

    /// Find the Moonshine shared library on disk.
    fn find_library(app_dir: &Path) -> Result<PathBuf, MoonshineError> {
        for path in Self::search_paths(app_dir) {
            if path.exists() {
                return Ok(path);
            }
        }
        Err(MoonshineError::LibraryNotFound(format!(
            "searched {} paths — download from https://github.com/moonshine-ai/moonshine/releases",
            Self::search_paths(app_dir).len()
        )))
    }

    /// Create a new Moonshine instance. Loads the shared library but does NOT
    /// load the model yet (lazy initialisation on first transcribe call).
    pub fn new(app_dir: &Path) -> Result<Self, MoonshineError> {
        let lib_path = Self::find_library(app_dir)?;

        // Safety: We're loading a well-known C API from a trusted library.
        let _lib = unsafe { Library::new(&lib_path) }
            .map_err(|e| MoonshineError::LibraryNotFound(format!("{lib_path:?}: {e}")))?;

        let model_root = app_dir.join("models").join("moonshine");

        Ok(Self {
            _lib,
            handle: Mutex::new(None),
            model_root,
            loaded: Mutex::new(false),
        })
    }

    /// Check if the Moonshine library is available on this system.
    pub fn is_available(app_dir: &Path) -> bool {
        Self::find_library(app_dir).is_ok()
    }

    /// Get the URL where users can download Moonshine models.
    pub fn model_download_url() -> &'static str {
        "https://github.com/moonshine-ai/moonshine/releases"
    }

    /// Get the expected model directory for the default architecture.
    pub fn model_dir(&self) -> PathBuf {
        self.model_root
            .join(MoonshineModelArch::default().model_dir())
    }

    /// Ensure the transcriber model is loaded. Lazy-initialised on first call.
    ///
    /// The model files are expected at:
    /// `{app_dir}/models/moonshine/moonshine-tiny-streaming/`
    pub fn ensure_loaded(&self) -> Result<(), MoonshineError> {
        let mut loaded = self
            .loaded
            .lock()
            .map_err(|e| MoonshineError::TranscriptionFailed(-1, format!("mutex: {e}")))?;

        if *loaded {
            return Ok(());
        }

        let model_dir = self.model_dir();
        if !model_dir.exists() {
            return Err(MoonshineError::ModelNotFound(format!(
                "{} — download models from {}",
                model_dir.display(),
                Self::model_download_url()
            )));
        }

        // The actual model loading happens via the C API when we call
        // moonshine_load_transcriber_from_files. For now, we just verify
        // the directory exists and mark as loaded.
        //
        // In a full implementation, we would call the C API here:
        // let handle = unsafe { moonshine_load_transcriber_from_files(...) };
        //
        // For the initial integration, we use a placeholder that returns
        // a descriptive error if the model isn't properly set up.

        *loaded = true;
        Ok(())
    }

    /// Transcribe audio data (batch mode, non-streaming).
    ///
    /// `audio_data` should be 16kHz mono f32 samples in range [-1.0, 1.0].
    /// Returns the transcribed text.
    ///
    /// In the full implementation, this calls:
    /// - moonshine_transcribe_without_streaming() for batch transcription
    /// - moonshine_transcript_to_string() to get the result
    /// - moonshine_free_transcript() to clean up
    pub fn transcribe(
        &self,
        audio_data: &[f32],
        sample_rate: i32,
    ) -> Result<String, MoonshineError> {
        self.ensure_loaded()?;

        // Placeholder: In the full implementation, this would call the C API.
        // For now, we return a helpful message indicating Moonshine is ready
        // but the C API bindings need to be completed.
        //
        // Full implementation would be:
        // ```
        // let mut transcript: *mut CTranscript = std::ptr::null_mut();
        // let result = unsafe {
        //     moonshine_transcribe_without_streaming(
        //         handle, audio_data.as_ptr(), audio_data.len() as u64,
        //         sample_rate, 0, &mut transcript
        //     )
        // };
        // if result != 0 { return Err(...); }
        // let text = unsafe { moonshine_transcript_to_string(transcript) };
        // // ... convert to Rust String ...
        // unsafe { moonshine_free_transcript(transcript); }
        // ```

        Ok(format!(
            "[Moonshine ready] {} samples @ {}Hz — C API integration pending",
            audio_data.len(),
            sample_rate
        ))
    }
}

impl Drop for Moonshine {
    fn drop(&mut self) {
        if let Ok(mut handle) = self.handle.lock() {
            if let Some(h) = handle.take() {
                // In full implementation: unsafe { moonshine_free_transcriber(h); }
                let _ = h;
            }
        }
    }
}

// ─── Audio Preprocessing Helpers ────────────────────────────────────────────

/// Downmix interleaved multi-channel i16 samples to mono f32 in [-1.0, 1.0].
pub fn downmix_to_mono_f32(samples: &[i16], channels: u16) -> Vec<f32> {
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

/// Linear resample audio to a target sample rate.
pub fn resample_linear(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
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
