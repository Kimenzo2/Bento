// ═══════════════════════════════════════════════════════════════════════
// Voice Commands — Higher-level voice operations wrapping audio engine
// ═══════════════════════════════════════════════════════════════════════
// These commands provide the Phase 1 foundation:
//   - voice_start: Start a voice session (dictation/voice_note/meeting/agent)
//   - voice_stop:  Stop and finalize the current session
//   - voice_pause: Pause the current recording
//   - voice_resume: Resume a paused recording
//   - voice_cancel: Cancel and discard the current session
// ═══════════════════════════════════════════════════════════════════════

use crate::audio::dictation::{post_process, detect_agent_trigger, DictationProcessResult, AgentTriggerResult, DictationStyle};
use crate::audio::AudioState;
use serde::{Deserialize, Serialize};

/// Response returned by voice_start / voice_stop.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceSessionDto {
    pub id: String,
    pub status: String,
    pub start_time: i64,
    pub elapsed_ms: i64,
    pub file_path: Option<String>,
}

/// Start a voice recording session.
/// Uses the mode string as the module_id so the frontend can tag sessions
/// (e.g., "dictation", "voice_note", "meeting", "agent_conversation").
#[tauri::command]
pub async fn voice_start(
    state: tauri::State<'_, AudioState>,
    mode: String,
) -> Result<VoiceSessionDto, String> {
    let module_id = if mode.is_empty() { "voice" } else { &mode };
    let session = state.engine.start_recording(module_id, None)?;

    Ok(VoiceSessionDto {
        id: session.id,
        status: session.status,
        start_time: session.start_time,
        elapsed_ms: session.elapsed_ms,
        file_path: session.file_path,
    })
}

/// Stop the current voice recording.
#[tauri::command]
pub async fn voice_stop(state: tauri::State<'_, AudioState>) -> Result<VoiceSessionDto, String> {
    let session = state.engine.stop_recording()?;

    Ok(VoiceSessionDto {
        id: session.id,
        status: session.status,
        start_time: session.start_time,
        elapsed_ms: session.elapsed_ms,
        file_path: session.file_path,
    })
}

/// Pause the current voice recording.
#[tauri::command]
pub async fn voice_pause(state: tauri::State<'_, AudioState>) -> Result<VoiceSessionDto, String> {
    let session = state.engine.pause_recording()?;

    Ok(VoiceSessionDto {
        id: session.id,
        status: session.status,
        start_time: session.start_time,
        elapsed_ms: session.elapsed_ms,
        file_path: session.file_path,
    })
}

/// Resume a paused voice recording.
#[tauri::command]
pub async fn voice_resume(state: tauri::State<'_, AudioState>) -> Result<VoiceSessionDto, String> {
    let session = state.engine.resume_recording()?;

    Ok(VoiceSessionDto {
        id: session.id,
        status: session.status,
        start_time: session.start_time,
        elapsed_ms: session.elapsed_ms,
        file_path: session.file_path,
    })
}

/// Cancel the current voice recording — discards without saving.
#[tauri::command]
pub async fn voice_cancel(state: tauri::State<'_, AudioState>) -> Result<(), String> {
    state.engine.cancel_recording()
}

// ═══════════════════════════════════════════════════════════════════════
// Dictation Post-Processing Commands
// ═══════════════════════════════════════════════════════════════════════

/// Post-process raw dictation text: strip fillers, apply style, detect agent triggers.
#[tauri::command]
pub fn dictation_process(text: String, style: String) -> Result<DictationProcessResult, String> {
    let dictation_style = match style.to_lowercase().as_str() {
        "casual" => DictationStyle::Casual,
        "formal" => DictationStyle::Formal,
        _ => DictationStyle::Standard,
    };
    Ok(post_process(&text, dictation_style))
}

/// Check if text contains an agent trigger ("hey bento", "ask bento", "bento ").
#[tauri::command]
pub fn dictation_detect_agent(text: String) -> Result<AgentTriggerResult, String> {
    Ok(detect_agent_trigger(&text))
}
