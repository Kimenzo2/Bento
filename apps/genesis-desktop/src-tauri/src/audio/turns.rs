// ═══════════════════════════════════════════════════════════════════════
// Turn Detection — Energy-based VAD with adaptive thresholding
// ═══════════════════════════════════════════════════════════════════════
// Analyzes WAV audio to detect speech segments ("turns") using RMS energy
// with adaptive noise floor estimation. Enables structured transcription
// from continuous recordings.
//
// Heuristic rules:
//   - 30ms sliding RMS windows
//   - Adaptive threshold from noise floor (20th percentile × multiplier)
//   - Hysteresis: start_active_ms of speech to begin a turn, end_silence_ms to end
//   - Turn merging: close turns coalesced into larger chunks
//   - Source-specific configs (microphone vs system audio)
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};

// ─── Constants ────────────────────────────────────────────────────────

/// Analysis window size in milliseconds for RMS calculation.
const WINDOW_MS: u64 = 30;

/// Maximum gap between turns from the same source to merge them for transcription.
const TRANSCRIPTION_COHERENCE_GAP_MS: u64 = 2_500;

/// Maximum transcription chunk duration in milliseconds.
const MAX_TRANSCRIPTION_CHUNK_MS: u64 = 30_000;

/// Target peak amplitude for normalization (0.0–1.0).
const NORMALIZE_TARGET_PEAK: f32 = 0.9;
const NORMALIZE_MIN_GAIN: f32 = 0.1;
const NORMALIZE_MAX_GAIN: f32 = 5.0;

/// Silence RMS floor for transcription (below this, skip sending to AI).
pub const SILENCE_RMS_FLOOR: f32 = 0.012;

/// Target sample rate for transcription.
pub const TARGET_SAMPLE_RATE: u32 = 16_000;

// ─── Types ───────────────────────────────────────────────────────────

/// Metadata for an audio source file to detect turns in.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionSource {
    pub artifact_id: String,
    pub file_path: String,
    pub source: RecordingSource,
    pub sample_rate: u32,
    pub channels: u16,
}

/// Which audio source a turn belongs to.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecordingSource {
    Microphone,
    System,
}

/// A single detected turn — a contiguous segment of speech.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioTurn {
    pub artifact_id: String,
    pub source: RecordingSource,
    pub start_ms: u64,
    pub end_ms: u64,
    pub turn_index: usize,
}

/// Configuration for turn detection, specific to each source type.
#[derive(Clone, Debug)]
pub struct SourceDetectionConfig {
    /// Minimum duration of sustained activity to start a turn (ms).
    pub start_active_ms: u64,
    /// Duration of silence to end a turn (ms).
    pub end_silence_ms: u64,
    /// Minimum turn duration (ms). Shorter turns are discarded as noise.
    pub min_turn_ms: u64,
    /// Maximum gap between turns to merge them (ms).
    pub merge_gap_ms: u64,
    /// Minimum RMS threshold (absolute noise floor).
    pub min_rms: f32,
    /// Multiplier applied to the noise floor to derive the activity threshold.
    pub noise_multiplier: f32,
}

impl Default for SourceDetectionConfig {
    fn default() -> Self {
        Self {
            start_active_ms: 300,
            end_silence_ms: 1_800,
            min_turn_ms: 700,
            merge_gap_ms: 900,
            min_rms: 0.012,
            noise_multiplier: 4.0,
        }
    }
}

impl RecordingSource {
    pub fn detection_config(&self) -> SourceDetectionConfig {
        match self {
            // System audio: more sensitive (lower threshold), shorter activation needed
            Self::System => SourceDetectionConfig {
                start_active_ms: 180,
                end_silence_ms: 2_000,
                min_turn_ms: 600,
                merge_gap_ms: 1_200,
                min_rms: 0.006,
                noise_multiplier: 3.0,
            },
            // Microphone: less sensitive (higher threshold), longer activation
            Self::Microphone => SourceDetectionConfig {
                start_active_ms: 300,
                end_silence_ms: 1_800,
                min_turn_ms: 700,
                merge_gap_ms: 900,
                min_rms: 0.012,
                noise_multiplier: 4.0,
            },
        }
    }
}

// ─── Turn Detection ──────────────────────────────────────────────────

/// Detect turns across multiple audio sources and assign turn indices.
/// Returns all detected turns sorted by start_ms with sequential turn_index.
pub fn detect_turns(sources: &[DetectionSource]) -> Result<Vec<AudioTurn>, String> {
    let mut all_turns: Vec<AudioTurn> = Vec::new();

    for source in sources {
        let source_turns = detect_source_turns(source)?;
        all_turns.extend(source_turns);
    }

    // Sort by start time
    all_turns.sort_by(|a, b| a.start_ms.cmp(&b.start_ms));

    // Assign sequential turn indices
    for (i, turn) in all_turns.iter_mut().enumerate() {
        turn.turn_index = i;
    }

    Ok(all_turns)
}

/// Detect turns within a single audio source.
pub fn detect_source_turns(source: &DetectionSource) -> Result<Vec<AudioTurn>, String> {
    let reader = hound::WavReader::open(&source.file_path)
        .map_err(|e| format!("Failed to open WAV for turn detection: {e}"))?;

    let spec = reader.spec();
    let sample_rate = spec.sample_rate.max(1);
    let channels = spec.channels.max(1) as usize;

    let samples: Vec<i16> = reader
        .into_samples::<i16>()
        .filter_map(|s| s.ok())
        .collect();

    if samples.is_empty() {
        return Ok(Vec::new());
    }

    // Compute RMS values for each 30ms window
    let rms_values = compute_rms_windows(&samples, channels, sample_rate);
    if rms_values.is_empty() {
        return Ok(Vec::new());
    }

    let config = source.source.detection_config(); // use mic config by default
    let threshold = compute_activity_threshold(&rms_values, &config);

    // Scan windows and identify active segments
    let active: Vec<bool> = rms_values.iter().map(|&rms| rms >= threshold).collect();

    // Group contiguous active windows into segments
    let mut segments: Vec<(usize, usize)> = Vec::new(); // (start_window, end_window) inclusive
    let mut i = 0;
    while i < active.len() {
        if active[i] {
            let seg_start = i;
            while i < active.len() && active[i] {
                i += 1;
            }
            let seg_end = i - 1;
            let duration_ms = ((seg_end - seg_start) as f64 * WINDOW_MS as f64) as u64;
            if duration_ms >= config.min_turn_ms {
                segments.push((seg_start, seg_end));
            }
        } else {
            i += 1;
        }
    }

    // Merge segments that are close enough
    let merged = merge_close_segments(&segments, config.merge_gap_ms, WINDOW_MS);

    // Convert merged segments to AudioTurn structs
    let turns: Vec<AudioTurn> = merged
        .iter()
        .map(|(start, end)| AudioTurn {
            artifact_id: source.artifact_id.clone(),
            source: source.source.clone(),
            start_ms: (*start as f64 * WINDOW_MS as f64) as u64,
            end_ms: ((*end + 1) as f64 * WINDOW_MS as f64)
                .min((samples.len() / channels) as f64 / sample_rate as f64 * 1000.0)
                as u64,
            turn_index: 0,
        })
        .collect();

    Ok(turns)
}

// ─── RMS Calculation ─────────────────────────────────────────────────

/// Compute RMS values for fixed-size windows across the audio samples.
/// Handles multi-channel by averaging channels per sample frame.
fn compute_rms_windows(samples: &[i16], channels: usize, _sample_rate: u32) -> Vec<f32> {
    let window_size = (_sample_rate as f64 * WINDOW_MS as f64 / 1000.0).ceil() as usize;
    if window_size == 0 {
        return Vec::new();
    }

    let mut rms_values = Vec::new();
    let mut i = 0;

    while i + window_size <= samples.len() / channels {
        let mut sum_sq = 0.0f64;
        let mut count = 0usize;

        for frame in 0..window_size {
            let idx = (i + frame) * channels;
            if idx + channels > samples.len() {
                break;
            }
            // Average channels for this frame
            let frame_sum: f64 = samples[idx..idx + channels]
                .iter()
                .map(|&s| s as f64 / i16::MAX as f64)
                .sum();
            let frame_avg = frame_sum / channels as f64;
            sum_sq += frame_avg * frame_avg;
            count += 1;
        }

        if count > 0 {
            let rms = (sum_sq / count as f64) as f32;
            rms_values.push(rms);
        }

        i += window_size;
    }

    rms_values
}

/// Compute the adaptive activity threshold based on RMS distribution.
/// Uses the 20th percentile as the noise floor, then applies the multiplier.
fn compute_activity_threshold(rms_values: &[f32], config: &SourceDetectionConfig) -> f32 {
    if rms_values.is_empty() {
        return config.min_rms;
    }

    let mut sorted = rms_values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // 20th percentile noise floor
    let noise_idx = ((sorted.len() as f64) * 0.2).floor() as usize;
    let noise_floor = sorted[noise_idx.min(sorted.len() - 1)];

    // Threshold = max(noise_floor * multiplier, noise_floor + min_rms, min_rms)
    noise_floor
        .max(config.noise_multiplier * noise_floor)
        .max(noise_floor + config.min_rms)
        .max(config.min_rms)
}

/// Merge segments that are separated by less than the merge gap.
fn merge_close_segments(
    segments: &[(usize, usize)],
    merge_gap_ms: u64,
    window_ms: u64,
) -> Vec<(usize, usize)> {
    if segments.is_empty() {
        return Vec::new();
    }

    let mut merged: Vec<(usize, usize)> = Vec::new();
    let mut current = segments[0];

    for &seg in &segments[1..] {
        let gap_windows = seg.0.saturating_sub(current.1);
        let gap_ms = gap_windows as u64 * window_ms;
        if gap_ms <= merge_gap_ms {
            // Merge: extend end
            current.1 = seg.1.max(current.1);
        } else {
            merged.push(current);
            current = seg;
        }
    }
    merged.push(current);

    merged
}

// ─── Turn Coalescing for Transcription ──────────────────────────────

/// Coalesce turns into transcription chunks.
/// Turns from the same source that are close together get merged into a single chunk,
/// limited to MAX_TRANSCRIPTION_CHUNK_MS duration.
pub fn coalesce_turns_for_transcription(turns: &[AudioTurn]) -> Vec<Vec<AudioTurn>> {
    if turns.is_empty() {
        return Vec::new();
    }

    let mut chunks: Vec<Vec<AudioTurn>> = Vec::new();
    let mut current_chunk: Vec<AudioTurn> = Vec::new();

    for turn in turns {
        if current_chunk.is_empty() {
            current_chunk.push(turn.clone());
            continue;
        }

        // Check if this turn can be merged into the current chunk
        let chunk_start = current_chunk.first().unwrap().start_ms;
        let chunk_end = current_chunk.last().unwrap().end_ms;
        let gap = turn.start_ms.saturating_sub(chunk_end);

        if gap <= TRANSCRIPTION_COHERENCE_GAP_MS
            && (turn.end_ms - chunk_start) <= MAX_TRANSCRIPTION_CHUNK_MS
        {
            current_chunk.push(turn.clone());
        } else {
            chunks.push(current_chunk);
            current_chunk = vec![turn.clone()];
        }
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    chunks
}

/// Write a turn's audio segment to a new WAV file.
pub fn write_turn_wav(
    source_path: &str,
    turn: &AudioTurn,
    output_path: &str,
) -> Result<(), String> {
    let mut reader =
        hound::WavReader::open(source_path).map_err(|e| format!("Failed to open WAV: {e}"))?;

    let spec = reader.spec();
    let sample_rate = spec.sample_rate;
    let channels = spec.channels;

    let all_samples: Vec<i16> = reader.samples::<i16>().filter_map(|s| s.ok()).collect();

    let ch = channels as usize;
    let total_samples = all_samples.len();
    let total_frames = total_samples / ch;
    let sr = sample_rate as usize;

    // Calculate frame positions from time (ms * sample_rate / 1000)
    let start_frame = ((turn.start_ms as usize * sr + 999) / 1000).min(total_frames);
    let end_frame = ((turn.end_ms as usize * sr) / 1000)
        .min(total_frames)
        .max(start_frame + 1);

    // Convert frame positions to sample indices
    let start_idx = start_frame * ch;
    let end_idx = (end_frame * ch).min(total_samples);

    let turn_samples = &all_samples[start_idx..end_idx];

    let mut writer = hound::WavWriter::create(output_path, spec)
        .map_err(|e| format!("Failed to create turn WAV: {e}"))?;

    for &sample in turn_samples {
        writer
            .write_sample(sample)
            .map_err(|e| format!("Failed to write sample: {e}"))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize turn WAV: {e}"))?;

    Ok(())
}

// ─── Normalization ───────────────────────────────────────────────────

/// Normalize a WAV file for transcription: downmix to mono, resample to 16kHz,
/// and apply gain normalization.
pub fn normalize_wav_for_transcription(
    source_path: &str,
    output_path: &str,
) -> Result<u32, String> {
    let mut reader =
        hound::WavReader::open(source_path).map_err(|e| format!("Failed to open WAV: {e}"))?;

    let spec = reader.spec();
    let sample_rate = spec.sample_rate;
    let channels = spec.channels;

    // Read all samples
    let samples: Vec<i16> = reader.samples::<i16>().filter_map(|s| s.ok()).collect();

    if samples.is_empty() {
        return Err("Empty audio file".to_string());
    }

    // Downmix to mono f32
    let mono = downmix_to_mono(&samples, channels);

    // Compute gain for normalization
    let peak = mono.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
    let gain = if peak > 0.0 {
        (NORMALIZE_TARGET_PEAK / peak).clamp(NORMALIZE_MIN_GAIN, NORMALIZE_MAX_GAIN)
    } else {
        1.0
    };

    // Apply gain
    let normalized: Vec<f32> = mono.iter().map(|&s| (s * gain).clamp(-1.0, 1.0)).collect();

    // Resample to 16kHz if needed
    let resampled = if sample_rate != TARGET_SAMPLE_RATE {
        resample_linear(&normalized, sample_rate, TARGET_SAMPLE_RATE)
    } else {
        normalized
    };

    // Write output WAV
    let output_spec = hound::WavSpec {
        channels: 1,
        sample_rate: TARGET_SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(output_path, output_spec)
        .map_err(|e| format!("Failed to create normalized WAV: {e}"))?;

    for &sample in &resampled {
        let amplitude = (sample * i16::MAX as f32) as i16;
        writer
            .write_sample(amplitude)
            .map_err(|e| format!("Failed to write sample: {e}"))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize normalized WAV: {e}"))?;

    Ok(TARGET_SAMPLE_RATE)
}

/// Check if audio data is effectively silent (below transcription floor).
pub fn is_effectively_silent(samples: &[f32]) -> bool {
    if samples.is_empty() {
        return true;
    }
    let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
    let rms = (sum_sq / samples.len() as f32).sqrt();
    rms < SILENCE_RMS_FLOOR
}

/// Check if audio is silent given raw i16 samples.
pub fn is_silent_i16(samples: &[i16]) -> bool {
    if samples.is_empty() {
        return true;
    }
    let sum_sq: f64 = samples
        .iter()
        .map(|&s| (s as f64 / i16::MAX as f64).powi(2))
        .sum();
    let rms = (sum_sq / samples.len() as f64).sqrt() as f32;
    rms < SILENCE_RMS_FLOOR
}

// ─── Utilities ───────────────────────────────────────────────────────

/// Downmix multi-channel i16 samples to mono f32.
pub fn downmix_to_mono(samples: &[i16], channels: u16) -> Vec<f32> {
    if channels <= 1 {
        return samples
            .iter()
            .map(|&s| (s as f32) / i16::MAX as f32)
            .collect();
    }

    let ch = channels as usize;
    let mut mono = Vec::with_capacity(samples.len() / ch);
    for frame in samples.chunks(ch) {
        if frame.is_empty() {
            continue;
        }
        let sum: f32 = frame.iter().map(|&s| s as f32 / i16::MAX as f32).sum();
        mono.push(sum / frame.len() as f32);
    }
    mono
}

/// Linear resampling from one sample rate to another.
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

// ─── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_wav(samples: &[i16], sample_rate: u32) -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wav");
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        for &s in samples {
            writer.write_sample(s).unwrap();
        }
        writer.finalize().unwrap();
        (dir, path.to_string_lossy().to_string())
    }

    #[test]
    fn test_silence_detection() {
        let silent = vec![0i16; 1000];
        assert!(is_silent_i16(&silent));

        let loud: Vec<i16> = (0..1000).map(|i| (i as f32 * 0.5) as i16).collect();
        assert!(!is_silent_i16(&loud));
    }

    #[test]
    fn test_downmix_mono_passthrough() {
        let input = vec![100i16, 200, 300];
        let mono = downmix_to_mono(&input, 1);
        assert_eq!(mono.len(), 3);
        assert!((mono[0] - (100.0 / i16::MAX as f32)).abs() < 0.001);
    }

    #[test]
    fn test_downmix_stereo_to_mono() {
        let input = vec![100i16, 200, 300, 400]; // 2 frames, 2 channels
        let mono = downmix_to_mono(&input, 2);
        assert_eq!(mono.len(), 2);
    }

    #[test]
    fn test_resample_same_rate() {
        let input = vec![0.1, 0.2, 0.3];
        let output = resample_linear(&input, 16000, 16000);
        assert_eq!(output.len(), 3);
        assert!((output[0] - 0.1).abs() < 0.001);
    }

    #[test]
    fn test_resample_down() {
        let input = vec![0.0, 0.5, 1.0, 0.5, 0.0]; // 5 samples at 10kHz
        let output = resample_linear(&input, 10000, 8000);
        assert!(output.len() < 5, "resampled should be shorter");
        assert!(
            output.len() >= 3,
            "resampled should have at least 3 samples"
        );
    }

    #[test]
    fn test_merge_close_segments() {
        let segments = vec![(0, 5), (10, 15), (100, 105)];
        let merged = merge_close_segments(&segments, 200, 30);
        // First two should merge (gap = 5*30 = 150ms ≤ 200ms)
        // Third should stay separate (gap = 85*30 = 2550ms > 200ms)
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0], (0, 15));
        assert_eq!(merged[1], (100, 105));
    }

    #[test]
    fn test_rms_calculation() {
        let samples: Vec<i16> = vec![0i16; 1000]; // silence
        let rms = compute_rms_windows(&samples, 1, 44100);
        assert!(!rms.is_empty(), "should produce some windows");
        assert!(
            rms.iter().all(|&v| v < 0.001),
            "silence should have near-zero RMS"
        );

        let samples: Vec<i16> = (0..4410).map(|i| (i as f32 * 0.1) as i16).collect();
        let rms = compute_rms_windows(&samples, 1, 44100);
        assert!(
            rms.iter().any(|&v| v > 0.01),
            "active audio should have non-zero RMS"
        );
    }

    #[test]
    fn test_activity_threshold_dynamic() {
        let rms = vec![0.001, 0.001, 0.002, 0.5, 0.6, 0.001, 0.002];
        let config = SourceDetectionConfig::default();
        let threshold = compute_activity_threshold(&rms, &config);
        // Noise floor ≈ 0.001 (20th percentile), threshold = max(0.001*4, 0.001+0.012, 0.012)
        assert!(threshold >= 0.012);
        assert!(threshold < 0.5, "threshold should be below speech level");
    }

    #[test]
    fn test_normalize_wav_for_transcription() {
        let samples: Vec<i16> = (0..44100)
            .map(|i| ((i as f64 * 0.3).sin() * 10000.0) as i16)
            .collect();
        let (_dir, path) = create_test_wav(&samples, 44100);
        let out_dir = tempfile::tempdir().unwrap();
        let out_path = out_dir.path().join("normalized.wav");

        let result = normalize_wav_for_transcription(&path, &out_path.to_string_lossy());
        assert!(
            result.is_ok(),
            "normalization should succeed: {:?}",
            result.err()
        );

        // Verify output is valid 16kHz mono
        let reader = hound::WavReader::open(&out_path).unwrap();
        assert_eq!(reader.spec().sample_rate, 16_000);
        assert_eq!(reader.spec().channels, 1);
    }

    #[test]
    fn test_is_effectively_silent() {
        assert!(is_effectively_silent(&[0.0; 100]));
        assert!(!is_effectively_silent(&[0.5; 100]));
    }
}
