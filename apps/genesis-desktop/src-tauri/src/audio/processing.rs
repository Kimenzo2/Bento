// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Audio Processing Pipeline — Post-recording transcription pipeline
// ═══════════════════════════════════════════════════════════════════════
// Processes saved WAV recordings through a structured pipeline:
//   1. Validate source audio artifacts
//   2. Drop silent sources
//   3. Detect turns (VAD-based segmentation)
//   4. Coalesce turns into transcription chunks
//   5. Normalize and extract turn WAV files
//   6. Concurrent transcription of chunks
//   7. Post-process and assemble transcript
//   8. Generate note from transcript
//
// This replaces the single-shot `transcribe_recording` method with
// a multi-stage pipeline that handles long recordings, multiple sources,
// and produces structured transcripts.
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;

use crate::audio::processing_queue;
use crate::audio::turns::{
    self, coalesce_turns_for_transcription, detect_turns, normalize_wav_for_transcription,
    write_turn_wav, AudioTurn, DetectionSource, RecordingSource,
};
use crate::audio::validation::{
    self, validate_audio_artifact, AudioValidationConfig, SourceValidationDto,
};

// ─── Constants ────────────────────────────────────────────────────────

/// Maximum concurrent transcription jobs.
const DEFAULT_TURN_TRANSCRIPTION_CONCURRENCY: usize = 2;

// ─── Types ───────────────────────────────────────────────────────────

/// Input source for processing.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingSource {
    pub artifact_id: String,
    pub file_path: String,
    pub source: RecordingSource,
    pub sample_rate: u32,
    pub channels: u16,
}

/// A single transcribed turn with metadata.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscribedTurn {
    pub source: RecordingSource,
    pub start_ms: u64,
    pub end_ms: u64,
    pub text: String,
    pub turn_index: usize,
}

/// Result of the full audio processing pipeline.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingResult {
    pub success: bool,
    pub turns: Vec<TranscribedTurn>,
    pub full_transcript: String,
    pub validated_sources: Vec<SourceValidationDto>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

// ─── Processing Pipeline ─────────────────────────────────────────────

/// Run the full processing pipeline on saved source audio.
///
/// 1. Validate each source artifact
/// 2. Drop silent/invalid sources
/// 3. Detect turns via energy-based VAD
/// 4. Coalesce turns into transcription chunks
/// 5. Normalize and extract each chunk as 16kHz mono WAV
/// 6. Transcribe each chunk concurrently
/// 7. Assemble final transcript
pub async fn process_saved_source_audio(
    sources: Vec<ProcessingSource>,
    app_dir: &std::path::Path,
    recording_id: &str,
) -> ProcessingResult {
    let mut result = ProcessingResult {
        success: false,
        turns: Vec::new(),
        full_transcript: String::new(),
        validated_sources: Vec::new(),
        warnings: Vec::new(),
        errors: Vec::new(),
    };

    // ── Step 0: Acquire per-recording lock ─────────────────────
    // Serialize processing for this recording to prevent race conditions
    // when multiple recordings finish simultaneously (Moonshine C FFI is not
    // thread-safe for the same model instance).
    let (_ticket, _) = processing_queue::enqueue(recording_id);
    let _guard = _ticket.lock().await;

    // ── Step 1: Validate all sources ────────────────────────────
    let config = AudioValidationConfig::default();
    let mut valid_sources: Vec<DetectionSource> = Vec::new();

    for src in &sources {
        let validation = validate_audio_artifact(&src.file_path, &config);
        let dto = SourceValidationDto {
            source: src.source.clone(),
            validation: validation.clone(),
            passes: validation::source_audio_passes_validation(&validation, &src.source),
        };
        result.validated_sources.push(dto.clone());

        if dto.passes && !validation.is_silent {
            valid_sources.push(DetectionSource {
                artifact_id: src.artifact_id.clone(),
                file_path: src.file_path.clone(),
                source: src.source.clone(),
                sample_rate: src.sample_rate,
                channels: src.channels,
            });
        } else if validation.is_silent {
            result.warnings.push(format!(
                "Source {:?} is silent, skipping ({})",
                src.source, src.file_path
            ));
        } else {
            result.warnings.push(format!(
                "Source {:?} failed validation ({})",
                src.source, src.file_path
            ));
        }
    }

    // ── Step 2: If no valid sources, return early ───────────────
    if valid_sources.is_empty() {
        result
            .errors
            .push("No valid audio sources to process".to_string());
        return result;
    }

    // ── Step 3: Detect turns ────────────────────────────────────
    let all_turns = match detect_turns(&valid_sources) {
        Ok(turns) => turns,
        Err(e) => {
            result.errors.push(format!("Turn detection failed: {e}"));
            return result;
        }
    };

    if all_turns.is_empty() {
        // Fall back to full-file transcription if no turns detected
        result
            .warnings
            .push("No turns detected, falling back to full-file transcription".to_string());
        return process_saved_audio_fallback(&sources, app_dir, recording_id).await;
    }

    // ── Step 4: Coalesce turns into transcription chunks ───────
    let chunks = coalesce_turns_for_transcription(&all_turns);

    let processing_dir = app_dir.join("processing");
    std::fs::create_dir_all(&processing_dir).ok();

    // ── Step 5-6: Normalize and transcribe each chunk concurrently ──
    let semaphore = Arc::new(Semaphore::new(DEFAULT_TURN_TRANSCRIPTION_CONCURRENCY));
    let mut handles = Vec::new();

    for (chunk_idx, chunk_turns) in chunks.iter().enumerate() {
        let chunk = chunk_turns.clone();
        let chunk_dir = processing_dir.clone();
        let sem = Arc::clone(&semaphore);

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.unwrap();
            transcribe_turn_chunk(&chunk, &chunk_dir, chunk_idx).await
        }));
    }

    // Collect results
    let mut transcribed_turns: Vec<TranscribedTurn> = Vec::new();
    for handle in handles {
        match handle.await {
            Ok(Ok(Some(mut turns))) => transcribed_turns.append(&mut turns),
            Ok(Err(e)) => result.errors.push(format!("Transcription failed: {e}")),
            Err(e) => result
                .errors
                .push(format!("Transcription task join failed: {e}")),
            _ => {}
        }
    }

    // ── Step 7: Assemble final transcript ───────────────────────
    transcribed_turns.sort_by(|a, b| {
        a.turn_index
            .cmp(&b.turn_index)
            .then(a.start_ms.cmp(&b.start_ms))
    });

    let mut parts: Vec<String> = Vec::new();
    for turn in &transcribed_turns {
        let label = match turn.source {
            RecordingSource::Microphone => "You",
            RecordingSource::System => "Speaker",
        };
        if !turn.text.trim().is_empty() {
            parts.push(format!("[{}]: {}", label, turn.text.trim()));
        }
    }

    result.full_transcript = parts.join("\n\n");
    result.turns = transcribed_turns;
    result.success = true;

    result
}

/// Transcribe a single turn chunk.
async fn transcribe_turn_chunk(
    chunk_turns: &[AudioTurn],
    processing_dir: &PathBuf,
    chunk_idx: usize,
) -> Result<Option<Vec<TranscribedTurn>>, String> {
    if chunk_turns.is_empty() {
        return Ok(None);
    }

    let source_file = chunk_turns[0]
        .artifact_id
        .split_once(':')
        .map(|(_, rest)| rest)
        .unwrap_or(&chunk_turns[0].artifact_id);

    // For simplicity, each chunk uses the first turn's source file
    // We'll normalize and transcribe the full chunk range
    let chunk_path = processing_dir.join(format!("chunk_{}.wav", chunk_idx));
    let normalized_path = processing_dir.join(format!("chunk_{}_norm.wav", chunk_idx));

    if chunk_turns.len() < 1 || source_file.is_empty() {
        return Ok(None);
    }

    // Write the chunk's audio segment
    // For the full chunk, use start_ms of first turn and end_ms of last turn
    let first = chunk_turns.first().unwrap();
    let last = chunk_turns.last().unwrap();

    let merged_turn = AudioTurn {
        artifact_id: first.artifact_id.clone(),
        source: first.source.clone(),
        start_ms: first.start_ms,
        end_ms: last.end_ms,
        turn_index: 0,
    };

    write_turn_wav(source_file, &merged_turn, &chunk_path.to_string_lossy())?;

    // Normalize for transcription
    normalize_wav_for_transcription(
        &chunk_path.to_string_lossy(),
        &normalized_path.to_string_lossy(),
    )?;

    // Read the normalized audio
    let reader = hound::WavReader::open(&normalized_path)
        .map_err(|e| format!("Failed to open normalized chunk: {e}"))?;
    let spec = reader.spec();
    let samples: Vec<i16> = reader
        .into_samples::<i16>()
        .filter_map(|s| s.ok())
        .collect();

    if samples.is_empty() {
        return Ok(None);
    }

    // Convert to f32 for moonshine
    let audio_f32: Vec<f32> = samples
        .iter()
        .map(|&s| s as f32 / i16::MAX as f32)
        .collect();

    // Check if silent
    if turns::is_effectively_silent(&audio_f32) {
        return Ok(None);
    }

    // Transcribe using moonshine
    let app_dir = processing_dir
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    let transcriber = crate::audio::moonshine::Moonshine::new(&app_dir)
        .map_err(|e| format!("Moonshine init failed: {e}"))?;
    let text = transcriber
        .transcribe(&audio_f32, spec.sample_rate.max(1) as i32)
        .map_err(|e| format!("Transcription failed: {e}"))?;

    if text.trim().is_empty() {
        return Ok(None);
    }

    // Create transcribed turns from the chunk
    let results: Vec<TranscribedTurn> = chunk_turns
        .iter()
        .map(|turn| TranscribedTurn {
            source: turn.source.clone(),
            start_ms: turn.start_ms,
            end_ms: turn.end_ms,
            text: text.clone(), // We replicate text per turn for now
            turn_index: turn.turn_index,
        })
        .collect();

    Ok(Some(results))
}

/// Fallback: process a single audio file directly (no turn detection).
/// Used when VAD finds no turns or for simple dictation recordings.
pub async fn process_saved_audio_fallback(
    sources: &[ProcessingSource],
    app_dir: &std::path::Path,
    _recording_id: &str,
) -> ProcessingResult {
    // NOTE: The per-recording lock is acquired by the caller
    // (process_saved_source_audio) which holds it across the entire
    // pipeline. This function doesn't re-acquire it to avoid deadlock.
    // If called from external code, wrap in processing_queue::enqueue.
    let mut result = ProcessingResult {
        success: false,
        turns: Vec::new(),
        full_transcript: String::new(),
        validated_sources: Vec::new(),
        warnings: Vec::new(),
        errors: Vec::new(),
    };

    for src in sources {
        let processing_dir = app_dir.join("processing");
        std::fs::create_dir_all(&processing_dir).ok();

        let normalized_path = processing_dir.join(format!("full_{}.wav", src.artifact_id));

        // Normalize
        if let Err(e) =
            normalize_wav_for_transcription(&src.file_path, &normalized_path.to_string_lossy())
        {
            result
                .errors
                .push(format!("Normalization failed for {}: {e}", src.file_path));
            continue;
        }

        // Read normalized audio
        let reader = match hound::WavReader::open(&normalized_path) {
            Ok(r) => r,
            Err(e) => {
                result
                    .errors
                    .push(format!("Failed to read normalized audio: {e}"));
                continue;
            }
        };

        let spec = reader.spec();
        let samples: Vec<i16> = reader
            .into_samples::<i16>()
            .filter_map(|s| s.ok())
            .collect();

        if samples.is_empty() {
            result.warnings.push(format!(
                "Empty audio after normalization: {}",
                src.file_path
            ));
            continue;
        }

        let audio_f32: Vec<f32> = samples
            .iter()
            .map(|&s| s as f32 / i16::MAX as f32)
            .collect();

        if turns::is_effectively_silent(&audio_f32) {
            result.warnings.push(format!(
                "Silent audio after normalization: {}",
                src.file_path
            ));
            continue;
        }

        // Transcribe
        let transcriber = match crate::audio::moonshine::Moonshine::new(app_dir) {
            Ok(t) => t,
            Err(e) => {
                result.errors.push(format!("Failed to init Moonshine: {e}"));
                continue;
            }
        };

        let text = match transcriber.transcribe(&audio_f32, spec.sample_rate.max(1) as i32) {
            Ok(t) => t,
            Err(e) => {
                result.errors.push(format!("Transcription failed: {e}"));
                continue;
            }
        };

        if text.trim().is_empty() {
            continue;
        }

        result.turns.push(TranscribedTurn {
            source: src.source.clone(),
            start_ms: 0,
            end_ms: (audio_f32.len() as f64 / spec.sample_rate as f64 * 1000.0) as u64,
            text: text.trim().to_string(),
            turn_index: result.turns.len(),
        });
    }

    // Assemble transcript
    let mut parts: Vec<String> = Vec::new();
    for turn in &result.turns {
        let label = match turn.source {
            RecordingSource::Microphone => "You",
            RecordingSource::System => "Speaker",
        };
        if !turn.text.is_empty() {
            parts.push(format!("[{}]: {}", label, turn.text));
        }
    }

    result.full_transcript = parts.join("\n\n");
    result.success = !result.turns.is_empty();

    result
}

// ─── Post-processing ─────────────────────────────────────────────────

/// Clean up a transcript by fixing minor ASR errors.
/// This is a deterministic post-processing step (no AI call needed).
pub fn post_process_transcript(transcript: &str) -> String {
    if transcript.is_empty() {
        return String::new();
    }

    let mut cleaned = transcript.to_string();

    // Fix common ASR artifacts
    // 1. Remove repeated filler words at start of sentences
    let patterns = [
        ("so so ", "so "),
        ("and and ", "and "),
        ("the the ", "the "),
        ("in in ", "in "),
        ("is is ", "is "),
        ("to to ", "to "),
        ("a a ", "a "),
        ("um ", ""),
        ("uh ", ""),
        ("like ", ""), // remove filler "like" at sentence start
    ];

    // Apply patterns (simple first pass)
    for (from, to) in &patterns {
        cleaned = cleaned.replace(from, to);
    }

    // 2. Capitalize first letter of sentences
    let mut chars: Vec<char> = cleaned.chars().collect();
    let mut new_sentence = true;
    for i in 0..chars.len() {
        if new_sentence && chars[i].is_alphabetic() {
            chars[i] = chars[i].to_ascii_uppercase();
            new_sentence = false;
        }
        if chars[i] == '.' || chars[i] == '!' || chars[i] == '?' {
            new_sentence = true;
            // Skip spaces
            let mut j = i + 1;
            while j < chars.len() && chars[j] == ' ' {
                j += 1;
            }
            if j < chars.len() && chars[j].is_alphabetic() {
                chars[j] = chars[j].to_ascii_uppercase();
            }
        }
    }
    let cleaned_str: String = chars.iter().collect();

    // 3. Trim whitespace
    cleaned_str.trim().to_string()
}

// ─── Tests ───────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_post_process_removes_fillers() {
        let input = "um so so i was thinking about the project";
        let result = post_process_transcript(input);
        assert!(result.contains("I was thinking"));
        assert!(!result.contains("  "));
    }

    #[test]
    fn test_post_process_capitalizes_sentences() {
        let input = "hello world. this is a test. good morning!";
        let result = post_process_transcript(input);
        assert!(result.starts_with("Hello"));
        assert!(result.contains(". This"));
        assert!(result.contains("! Good"));
    }

    #[test]
    fn test_post_process_empty() {
        assert_eq!(post_process_transcript(""), "");
    }

    #[test]
    fn test_post_process_no_change_for_clean_text() {
        let input = "Hello world. This is a test.";
        let result = post_process_transcript(input);
        assert_eq!(result, "Hello world. This is a test.");
    }

    #[test]
    fn test_post_process_remove_filler_like() {
        let input = "like I was going to the store";
        let result = post_process_transcript(input);
        assert!(result.starts_with("I"));
    }
}
