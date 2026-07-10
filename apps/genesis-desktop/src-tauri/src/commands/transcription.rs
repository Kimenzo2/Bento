// ═══════════════════════════════════════════════════════════════════════
// Transcription Commands — Dictation paste + Voice note creation
// ═══════════════════════════════════════════════════════════════════════
// Phase 2 of the Voice Engine implementation.
//
// Dictation mode:
//   - Copies transcribed text to clipboard
//   - Simulates Ctrl+V paste into the focused text field
//
// Voice Note mode:
//   - Saves transcript as a searchable note
//   - Generates an AI title from the first sentence/line
// ═══════════════════════════════════════════════════════════════════════

use serde::Serialize;
use tauri::AppHandle;
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;
use uuid::Uuid;

use crate::audio::classifier::generate_note_title;
use crate::db::BentoAppState;

/// Result of a dictation paste operation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationResult {
    pub success: bool,
    pub text: String,
    pub char_count: usize,
}

/// Result of a voice note creation.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceNoteResult {
    pub success: bool,
    pub note_id: String,
    pub title: String,
    pub char_count: usize,
}

/// Paste transcribed text at the current cursor position.
///
/// Strategy:
///   1. Write the text to the system clipboard
///   2. Simulate Ctrl+V (or Cmd+V on macOS) to paste at cursor
///   3. Return the pasted text
///
/// This avoids needing platform-specific text injection APIs.
#[tauri::command]
pub async fn voice_paste_dictation(
    app: AppHandle,
    text: String,
) -> Result<DictationResult, String> {
    if text.trim().is_empty() {
        return Err("No text to paste.".to_string());
    }

    // Write to clipboard (backup for user if they want to manually paste)
    let clipboard = app.clipboard();
    let _ = clipboard.write_text(text.clone());

    // Inject text directly into the focused element via insertText.
    // document.execCommand('paste') is deprecated and blocked by Chrome's security model.
    // insertText works in input, textarea, and contenteditable without user gesture.
    if let Some(window) = app.get_webview_window("main") {
        // Use serde_json for safe JS string escaping
        let escaped = serde_json::to_string(&text).unwrap_or_else(|_| "\"\"".to_string());
        let js = format!("document.execCommand('insertText', false, {});", escaped);
        let _: Result<(), _> = window.eval(&js);
    }

    let char_count = text.trim().len();

    Ok(DictationResult {
        success: true,
        text: text.trim().to_string(),
        char_count,
    })
}

/// Save a transcribed voice note.
///
/// Creates a note in the Bento Notes engine with:
///   - Auto-generated title (from first sentence/line)
///   - Full transcript as the note body
///   - "Voice Note" tag
///
/// Returns the note ID and generated title.
#[tauri::command]
pub async fn voice_save_note(
    state: tauri::State<'_, BentoAppState>,
    transcript: String,
    title: Option<String>,
) -> Result<VoiceNoteResult, String> {
    if transcript.trim().is_empty() {
        return Err("Cannot save an empty voice note.".to_string());
    }

    let pool = state.db();
    let object_id = Uuid::new_v4().to_string();
    let block_id = Uuid::new_v4().to_string();
    let now_ms = crate::util::time::now_ms();

    // Generate title from transcript if not provided
    let note_title = title
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| generate_note_title(&transcript));

    let tags_json = r#"["Voice Note"]"#;

    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| format!("Transaction error: {e}"))?;
    // BEGIN IMMEDIATE prevents the read->write upgrade trap where
    // SQLITE_BUSY ignores busy_timeout when a read tx tries to write.
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Transaction error: {e}"))?;

    let tx_result: Result<VoiceNoteResult, String> = async {
        // Insert note object
        sqlx::query(
            r#"INSERT INTO note_objects (id, title, icon, tags, pinned, layout, is_archived, details, created_at, updated_at)
               VALUES (?, ?, ?, ?, 0, 'note', 0, '{}', ?, ?)"#,
        )
        .bind(&object_id)
        .bind(&note_title)
        .bind("🎤") // mic icon for voice notes
        .bind(tags_json)
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create note object: {e}"))?;

        // Insert title block
        let title_content = serde_json::json!({
            "text": note_title,
            "style": 4,  // TextStyle::Title
            "marks": [],
            "checked": false,
            "color": "",
            "iconEmoji": "",
            "iconImage": ""
        });
        sqlx::query(
            r#"INSERT INTO blocks (id, object_id, parent_id, type, content, position, created_at, updated_at)
               VALUES (?, ?, NULL, 'text', ?, 0, ?, ?)"#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&object_id)
        .bind(&title_content.to_string())
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create title block: {e}"))?;

        // Insert body block with transcript
        let body_content = serde_json::json!({
            "text": transcript.trim(),
            "style": 0,  // TextStyle::Paragraph
            "marks": [],
            "checked": false,
            "color": "",
            "iconEmoji": "",
            "iconImage": ""
        });
        sqlx::query(
            r#"INSERT INTO blocks (id, object_id, parent_id, type, content, position, created_at, updated_at)
               VALUES (?, ?, NULL, 'text', ?, 1, ?, ?)"#,
        )
        .bind(&block_id)
        .bind(&object_id)
        .bind(&body_content.to_string())
        .bind(now_ms)
        .bind(now_ms)
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to create note block: {e}"))?;

        let char_count = transcript.trim().len();

        Ok(VoiceNoteResult {
            success: true,
            note_id: object_id,
            title: note_title,
            char_count,
        })
    }.await;

    match tx_result {
        Ok(val) => {
            sqlx::query("COMMIT")
                .execute(&mut *conn)
                .await
                .map_err(|e| format!("Commit error: {e}"))?;
            Ok(val)
        }
        Err(e) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;
            Err(e)
        }
    }
}

/// Get a voice note by ID (redirects to notes service).
#[tauri::command]
pub async fn voice_get_note(
    state: tauri::State<'_, BentoAppState>,
    note_id: String,
) -> Result<serde_json::Value, String> {
    let pool = state.db();
    let row = sqlx::query_as::<_, (String, String, Option<String>, String, i64, i64)>(
        "SELECT id, title, icon, tags, created_at, updated_at FROM note_objects WHERE id = ?",
    )
    .bind(&note_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Database error: {e}"))?
    .ok_or_else(|| format!("Note not found: {note_id}"))?;

    Ok(serde_json::json!({
        "id": row.0,
        "title": row.1,
        "icon": row.2,
        "tags": row.3,
        "createdAt": row.4,
        "updatedAt": row.5,
    }))
}
