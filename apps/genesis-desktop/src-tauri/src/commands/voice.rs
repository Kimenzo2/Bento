// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

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

use crate::audio::dictation::{
    detect_agent_trigger, post_process, AgentTriggerResult, DictationProcessResult, DictationStyle,
};
use crate::audio::AudioState;
use crate::db::BentoAppState;
use crate::realtime::RealtimeHub;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

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
    let session = state.engine.stop_recording().await?;

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
    state.engine.cancel_recording().await
}

// ═══════════════════════════════════════════════════════════════════════
// Voice Memo Persistence Command
// ═══════════════════════════════════════════════════════════════════════

/// Result of saving a voice memo.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceMemoResult {
    pub success: bool,
    pub id: String,
}

/// Save a voice memo entry with transcript to the Voice Memos database.
///
/// When `recording_id` is provided, upserts the transcript into the existing
/// `recording_transcripts` row (for Rust recording modes where audio is already
/// persisted). Otherwise creates a new `recording_metadata` + `recording_transcripts`
/// pair (for text-only dictation).
///
/// For text-only dictation (no audio file), `file_path` is an empty string.
/// For Rust recording modes, pass the existing `file_path` to link the audio.
#[tauri::command]
pub async fn voice_save_memo(
    state: tauri::State<'_, BentoAppState>,
    hub: tauri::State<'_, RealtimeHub>,
    recording_id: Option<String>,
    title: String,
    transcript: String,
    duration_secs: f64,
    source: String,
    file_path: Option<String>,
) -> Result<VoiceMemoResult, String> {
    let pool = state.db();
    let now_ms = crate::util::time::now_ms();

    let id = if let Some(ref rid) = recording_id {
        sqlx::query(
            r#"UPDATE recording_metadata SET title = ?, transcribed = 1 WHERE id = ?"#,
        )
        .bind(&title)
        .bind(rid)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to update recording metadata: {e}"))?;

        sqlx::query(
            r#"INSERT INTO recording_transcripts 
            (recording_id, transcript, language, model_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(recording_id) DO UPDATE SET
              transcript = excluded.transcript,
              updated_at = excluded.updated_at"#,
        )
        .bind(rid)
        .bind(&transcript)
        .bind(None::<String>)
        .bind(None::<String>)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to upsert recording transcript: {e}"))?;

        rid.clone()
    } else {
        let id = Uuid::new_v4().to_string();
        let fp = file_path.unwrap_or_default();

        sqlx::query(
            r#"INSERT INTO recording_metadata 
            (id, title, duration_secs, file_path, file_size_bytes, module_id, 
             created_at, device_name, sample_rate, channels, transcribed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)"#,
        )
        .bind(&id)
        .bind(&title)
        .bind(duration_secs)
        .bind(&fp)
        .bind(0i64)
        .bind(&source)
        .bind(now_ms)
        .bind(None::<String>)
        .bind(0i32)
        .bind(0i32)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert recording metadata: {e}"))?;

        sqlx::query(
            r#"INSERT INTO recording_transcripts 
            (recording_id, transcript, language, model_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&transcript)
        .bind(None::<String>)
        .bind(None::<String>)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to insert recording transcript: {e}"))?;

        id
    };

    let event = if recording_id.is_some() { "updated" } else { "created" };
    hub.emit_change("voice/memos", event, json!({ "id": &id, "title": &title })).await;

    Ok(VoiceMemoResult {
        success: true,
        id,
    })
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
