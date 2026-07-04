// ═══════════════════════════════════════════════════════════════════════
// Audio Validation — WAV integrity checks + stale header repair
// ═══════════════════════════════════════════════════════════════════════
// Validates WAV recordings for integrity, duration, and signal quality.
// Repairs stale headers from recordings interrupted by crashes (SIGKILL).
// Enables crash-recoverable recording — the engine can detect and fix
// partial recordings instead of losing them entirely.
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::audio::turns::RecordingSource;

// ─── Types ───────────────────────────────────────────────────────────

/// Configuration for audio validation tolerances.
#[derive(Clone, Debug)]
pub struct AudioValidationConfig {
    pub min_duration_ms: u64,
    pub duration_tolerance_ms: u64,
}

impl Default for AudioValidationConfig {
    fn default() -> Self {
        Self {
            min_duration_ms: 1_000,
            duration_tolerance_ms: 750,
        }
    }
}

/// Result of validating an audio artifact.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioValidationDto {
    pub exists: bool,
    pub readable: bool,
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
    pub declared_duration_ms: u64,
    pub actual_duration_ms: u64,
    pub file_size_bytes: u64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
    pub is_silent: bool,
    pub duration_match: bool,
    pub warnings: Vec<String>,
    pub checksum: Option<String>,
}

/// Result of validating a specific recording source.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceValidationDto {
    pub source: RecordingSource,
    pub validation: AudioValidationDto,
    pub passes: bool,
}

// ─── WAV Layout Parsing ──────────────────────────────────────────────

/// Describes the layout of the RIFF/WAVE chunks in a file.
#[derive(Clone, Debug)]
struct WavLayout {
    /// Offset to the RIFF chunk size field.
    #[allow(dead_code)]
    riff_size_offset: u64,
    /// Offset to the "fmt " chunk data.
    #[allow(dead_code)]
    fmt_offset: u64,
    /// Offset to the "data" chunk size field.
    data_size_offset: u64,
    /// Offset to the start of the audio data (immediately after "data" size).
    data_offset: u64,
    /// Declared data chunk size from the header.
    declared_data_size: u32,
    /// Whether the WAV is standard 16-bit PCM.
    is_standard_pcm: bool,
}

/// Scan the WAV file structure to find RIFF chunk offsets.
fn read_wav_layout(file_path: &str) -> Result<WavLayout, String> {
    use std::io::{Read, Seek, SeekFrom};

    let mut file = std::fs::File::open(file_path).map_err(|e| format!("Failed to open: {e}"))?;

    // Read RIFF header
    let mut header = [0u8; 12];
    file.read_exact(&mut header)
        .map_err(|e| format!("Failed to read header: {e}"))?;

    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("Not a valid WAV file".to_string());
    }

    let riff_size = u32::from_le_bytes(header[4..8].try_into().unwrap());
    let mut fmt_offset = 0u64;
    let mut data_size_offset = 0u64;
    let mut data_offset = 0u64;
    let mut declared_data_size = 0u32;
    let mut is_standard_pcm = false;

    // Scan chunks
    let mut pos = 12u64;
    while pos < riff_size as u64 + 8 {
        let mut chunk_header = [0u8; 8];
        if file.read_exact(&mut chunk_header).is_err() {
            break;
        }
        let chunk_id = &chunk_header[0..4];
        let chunk_size = u32::from_le_bytes(chunk_header[4..8].try_into().unwrap()) as u64;

        match chunk_id {
            b"fmt " => {
                fmt_offset = pos + 8;
                // Read format info
                let mut fmt_data = vec![0u8; chunk_size.min(16) as usize];
                file.read_exact(&mut fmt_data).ok();
                if fmt_data.len() >= 16 {
                    let audio_format = u16::from_le_bytes(fmt_data[0..2].try_into().unwrap());
                    is_standard_pcm = audio_format == 1 || audio_format == 0xFFFE; // PCM or EXTENSIBLE
                }
            }
            b"data" => {
                data_size_offset = pos + 4;
                data_offset = pos + 8;
                declared_data_size = u32::from_le_bytes(chunk_header[4..8].try_into().unwrap());

                // Check available bytes past header for actual size
                let file_len = std::fs::metadata(file_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let actual_data_bytes = file_len.saturating_sub(data_offset);
                // Re-interpret if the declared size is 0 or obviously wrong
                if declared_data_size == 0 || declared_data_size as u64 > actual_data_bytes {
                    declared_data_size = actual_data_bytes as u32;
                }
                break;
            }
            _ => {
                // Skip padding byte if chunk size is odd
                let skip = chunk_size + (chunk_size % 2);
                file.seek(SeekFrom::Current(skip as i64)).ok();
            }
        }

        pos += 8 + chunk_size + (chunk_size % 2);
    }

    if data_offset == 0 {
        return Err("No data chunk found in WAV file".to_string());
    }

    Ok(WavLayout {
        riff_size_offset: 4,
        fmt_offset,
        data_size_offset,
        data_offset,
        declared_data_size,
        is_standard_pcm,
    })
}

// ─── Validation ──────────────────────────────────────────────────────

/// Validate an audio artifact file.
pub fn validate_audio_artifact(
    file_path: &str,
    config: &AudioValidationConfig,
) -> AudioValidationDto {
    let mut result = AudioValidationDto {
        exists: false,
        readable: false,
        sample_rate: 0,
        channels: 0,
        bits_per_sample: 0,
        declared_duration_ms: 0,
        actual_duration_ms: 0,
        file_size_bytes: 0,
        peak_amplitude: 0.0,
        rms_amplitude: 0.0,
        is_silent: true,
        duration_match: false,
        warnings: Vec::new(),
        checksum: None,
    };

    // Check existence
    let metadata = match std::fs::metadata(file_path) {
        Ok(m) => {
            result.exists = true;
            result.file_size_bytes = m.len();
            m
        }
        Err(_) => {
            result.warnings.push("File does not exist".to_string());
            return result;
        }
    };

    if metadata.len() < 44 {
        // WAV header minimum size
        result.warnings.push("File too small to be a valid WAV".to_string());
        return result;
    }

    // Try to read as WAV
    let reader = match hound::WavReader::open(file_path) {
        Ok(r) => {
            result.readable = true;
            r
        }
        Err(e) => {
            result.warnings.push(format!("Cannot read as WAV: {e}"));
            return result;
        }
    };

    let spec = reader.spec();
    result.sample_rate = spec.sample_rate;
    result.channels = spec.channels;
    result.bits_per_sample = spec.bits_per_sample;

    // Calculate declared duration from header
    let bytes_per_frame = (spec.bits_per_sample / 8) as u64 * spec.channels as u64;
    let total_frames = reader.len() as u64 / bytes_per_frame.max(1);
    let declared_duration_ms = if spec.sample_rate > 0 {
        (total_frames * 1000) / spec.sample_rate as u64
    } else {
        0
    };
    result.declared_duration_ms = declared_duration_ms;

    // Calculate actual duration from file size
    let header_size = 44u64; // approximate
    let actual_audio_bytes = metadata.len().saturating_sub(header_size);
    let actual_frames = actual_audio_bytes / bytes_per_frame.max(1);
    let actual_duration_ms = if spec.sample_rate > 0 {
        (actual_frames * 1000) / spec.sample_rate as u64
    } else {
        declared_duration_ms
    };
    result.actual_duration_ms = actual_duration_ms;

    // Check duration match with tolerance
    let duration_diff = if declared_duration_ms > actual_duration_ms {
        declared_duration_ms - actual_duration_ms
    } else {
        actual_duration_ms - declared_duration_ms
    };

    // Dynamic tolerance for longer recordings
    let tolerance = dynamic_tolerance(actual_duration_ms, config.duration_tolerance_ms);
    result.duration_match = duration_diff <= tolerance;
    if !result.duration_match {
        result.warnings.push(format!(
            "Duration mismatch: declared={}ms actual={}ms (tolerance={}ms)",
            declared_duration_ms, actual_duration_ms, tolerance
        ));
    }

    // Check minimum duration
    if actual_duration_ms < config.min_duration_ms {
        result.warnings.push(format!(
            "Duration too short: {}ms < {}ms minimum",
            actual_duration_ms, config.min_duration_ms
        ));
    }

    // Signal analysis (sample first 10 seconds or entire file)
    let max_samples: u32 = spec.sample_rate * 10 * spec.channels as u32;
    let sample_count = reader.len().min(max_samples) as usize;
    let samples: Vec<i16> = reader
        .into_samples::<i16>()
        .take(sample_count)
        .filter_map(|s| s.ok())
        .collect();

    if !samples.is_empty() {
        let peak = samples
            .iter()
            .map(|&s| (s as f32).abs() / i16::MAX as f32)
            .fold(0.0f32, f32::max);
        result.peak_amplitude = peak;

        let sum_sq: f64 = samples
            .iter()
            .map(|&s| (s as f64 / i16::MAX as f64).powi(2))
            .sum();
        result.rms_amplitude = (sum_sq / samples.len() as f64).sqrt() as f32;

        result.is_silent = result.rms_amplitude < crate::audio::turns::SILENCE_RMS_FLOOR;

        if result.is_silent {
            result.warnings.push("Audio is effectively silent".to_string());
        }
    }

    // Generate checksum
    result.checksum = checksum_file(file_path).ok();

    result
}

/// Compute dynamic tolerance for longer recordings.
/// Tolerance grows with duration but at a diminishing rate.
fn dynamic_tolerance(duration_ms: u64, base_tolerance_ms: u64) -> u64 {
    // For recordings > 60s, allow more tolerance proportionally
    if duration_ms > 60_000 {
        let extra = (duration_ms / 4_000).min(600_000);
        base_tolerance_ms + extra
    } else {
        base_tolerance_ms
    }
}

/// Determine if a source's validation result passes the quality bar.
pub fn source_audio_passes_validation(
    dto: &AudioValidationDto,
    _source: &RecordingSource,
) -> bool {
    if !dto.exists || !dto.readable {
        return false;
    }

    // Allow some tolerance on silence for microphone (could be quiet room)
    // but system audio should never be silent
    if dto.is_silent && dto.actual_duration_ms > 10_000 {
        return false;
    }

    true
}

// ─── Stale WAV Header Repair ─────────────────────────────────────────

/// Repair a stale WAV header where the data chunk size wasn't finalized.
///
/// When a recording is interrupted (SIGKILL, crash, etc.), the WAV header
/// may have an incorrect data chunk size. This function uses the actual
/// file size on disk to correct the header.
pub fn repair_stale_wav_header(file_path: &str) -> Result<(), String> {
    let layout = read_wav_layout(file_path)?;

    if !layout.is_standard_pcm {
        return Err("Only standard PCM WAV files can be repaired".to_string());
    }

    // The actual data size = file size - data_offset
    let file_len = std::fs::metadata(file_path)
        .map_err(|e| format!("Failed to get file size: {e}"))?
        .len();

    let actual_data_size = file_len.saturating_sub(layout.data_offset) as u32;

    // If declared size already matches actual (within a small margin), no repair needed
    let diff = if layout.declared_data_size > actual_data_size {
        layout.declared_data_size - actual_data_size
    } else {
        actual_data_size - layout.declared_data_size
    };

    // Only repair if difference is significant (> 100 bytes)
    if diff <= 100 {
        return Ok(()); // No repair needed
    }

    // Read and rewrite the header
    use std::io::{Seek, SeekFrom, Write};

    let mut file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(file_path)
        .map_err(|e| format!("Failed to open for repair: {e}"))?;

    // Get the RIFF chunk (sub-chunk) size from position 4
    // The RIFF size includes everything after the RIFF header (positions 8..end)
    let riff_data_size = file_len.saturating_sub(8) as u32;

    // Write corrected RIFF size
    file.seek(SeekFrom::Start(4))
        .map_err(|e| format!("Seek error: {e}"))?;
    file.write_all(&riff_data_size.to_le_bytes())
        .map_err(|e| format!("Write error: {e}"))?;

    // Check if there's a "data" chunk header we already found
    // Write corrected data chunk size
    if actual_data_size > 0 {
        file.seek(SeekFrom::Start(layout.data_size_offset))
            .map_err(|e| format!("Seek error: {e}"))?;
        file.write_all(&actual_data_size.to_le_bytes())
            .map_err(|e| format!("Write error: {e}"))?;
    }

    eprintln!(
        "[audio-validation] Repaired stale WAV header: declared_data_size={} actual_data_size={} (diff={})",
        layout.declared_data_size, actual_data_size, diff
    );

    Ok(())
}

// ─── Checksum ────────────────────────────────────────────────────────

/// Compute SHA-256 checksum of a file.
pub fn checksum_file(file_path: &str) -> Result<String, String> {
    let mut file =
        std::fs::File::open(file_path).map_err(|e| format!("Failed to open for checksum: {e}"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    use std::io::Read;
    loop {
        let bytes_read = file
            .read(&mut buffer)
            .map_err(|e| format!("Read error: {e}"))?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

// ─── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_wav(samples: &[i16], sample_rate: u32, channels: u16) -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.wav");
        let spec = hound::WavSpec {
            channels,
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
    fn test_validate_valid_wav() {
        let samples: Vec<i16> = (0..44100).map(|i| (i as f64 * 0.1).sin() as i16 * 5000).collect();
        let (_dir, path) = create_test_wav(&samples, 44100, 1);
        let config = AudioValidationConfig::default();
        let result = validate_audio_artifact(&path, &config);
        assert!(result.exists);
        assert!(result.readable);
        assert!(result.duration_match);
        assert!(!result.is_silent);
        assert!(result.peak_amplitude > 0.0);
    }

    #[test]
    fn test_validate_nonexistent_file() {
        let config = AudioValidationConfig::default();
        let result = validate_audio_artifact("nonexistent.wav", &config);
        assert!(!result.exists);
        assert!(!result.readable);
    }

    #[test]
    fn test_validate_silent_file() {
        let samples = vec![0i16; 44100];
        let (_dir, path) = create_test_wav(&samples, 44100, 1);
        let config = AudioValidationConfig::default();
        let result = validate_audio_artifact(&path, &config);
        assert!(result.exists);
        assert!(result.is_silent);
    }

    #[test]
    fn test_repair_stale_wav_header() {
        // Create a valid WAV, then corrupt the header's data size
        let samples: Vec<i16> = (0..44100).map(|i| (i as f64 * 0.1).sin() as i16 * 5000).collect();
        let (_dir, path) = create_test_wav(&samples, 44100, 1);

        // Corrupt the data chunk size (at offset 40 for standard WAV)
        {
            use std::io::{Seek, SeekFrom, Write};
            let mut file = std::fs::OpenOptions::new()
                .write(true)
                .open(&path)
                .unwrap();
            // Write a very small data size
            file.seek(SeekFrom::Start(40)).unwrap();
            file.write_all(&100u32.to_le_bytes()).unwrap(); // claim only 100 bytes
        }

        // Repair
        let result = repair_stale_wav_header(&path);
        assert!(result.is_ok(), "Repair should succeed: {:?}", result.err());

        // Verify the WAV is now readable with correct duration
        let reader = hound::WavReader::open(&path).unwrap();
        assert!(reader.len() > 100, "Should have many more samples than 100");
    }

    #[test]
    fn test_checksum_file() {
        let samples = vec![1i16, 2, 3, 4, 5];
        let (_dir, path) = create_test_wav(&samples, 44100, 1);
        let hash = checksum_file(&path).unwrap();
        assert_eq!(hash.len(), 64, "SHA-256 should be 64 hex chars");
    }

    #[test]
    fn test_dynamic_tolerance() {
        let short = dynamic_tolerance(30_000, 750);
        assert_eq!(short, 750, "Short recordings should use base tolerance");

        let long = dynamic_tolerance(300_000, 750);
        assert!(
            long > 750,
            "Long recordings should have extended tolerance"
        );
    }
}
