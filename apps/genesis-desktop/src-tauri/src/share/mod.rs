// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ─────────────────────────────────────────────────────────────────────────────
// Share Service — Central middle layer for sharing content from any module.
//
// Provides a single `share_content` Tauri command that modules call to share
// text, markdown, JSON, HTML, CSV, or plain data to clipboard or file.
// Extensible by adding new ShareFormat or ShareDestination variants.
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Supported output formats for sharing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ShareFormat {
    /// Plain unformatted text
    PlainText,
    /// Markdown text
    Markdown,
    /// JSON data
    Json,
    /// HTML fragment
    Html,
    /// CSV tabular data
    Csv,
    /// Bento internal JSON manifest
    BentoManifest,
}

/// Where the shared content goes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ShareDestination {
    /// Copy to system clipboard
    Clipboard,
    /// Prompt user to save as file via dialog
    File,
}

/// Options controlling the share operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareOptions {
    /// Display/filename label for the content (e.g. "My Tasks", "Weekly Report")
    pub label: String,
    /// Default filename (without extension) if saving to file
    pub filename: String,
    /// Whether to sanitize/remove sensitive fields before sharing
    #[serde(default = "default_sanitize")]
    pub sanitize: bool,
    /// Optional metadata to embed (e.g. export timestamp, source module)
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
}

fn default_sanitize() -> bool {
    true
}

impl Default for ShareOptions {
    fn default() -> Self {
        Self {
            label: String::new(),
            filename: "bento-export".to_string(),
            sanitize: true,
            metadata: None,
        }
    }
}

/// Result of a share operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareResult {
    /// Whether the share was completed successfully
    pub success: bool,
    /// Human-readable status message
    pub message: String,
    /// Path to saved file (if destination was File)
    pub file_path: Option<String>,
    /// Byte size of the shared content
    pub size_bytes: usize,
}

/// Format raw content according to the requested format.
fn format_content(content: &str, format: &ShareFormat) -> String {
    match format {
        ShareFormat::PlainText => content.to_string(),
        ShareFormat::Markdown => content.to_string(),
        ShareFormat::Json | ShareFormat::BentoManifest => {
            // Pretty-print if valid JSON
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
                serde_json::to_string_pretty(&parsed).unwrap_or_else(|_| content.to_string())
            } else {
                content.to_string()
            }
        }
        ShareFormat::Html => {
            // Wrap in a minimal HTML document if it's not a full document
            if content.trim().starts_with("<!") || content.trim().starts_with("<html") {
                content.to_string()
            } else {
                format!(
                    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Bento Export</title></head><body>\n{}\n</body></html>",
                    content
                )
            }
        }
        ShareFormat::Csv => content.to_string(),
    }
}

/// Get the file extension for a given format.
fn format_extension(format: &ShareFormat) -> &'static str {
    match format {
        ShareFormat::PlainText => "txt",
        ShareFormat::Markdown => "md",
        ShareFormat::Json => "json",
        ShareFormat::Html => "html",
        ShareFormat::Csv => "csv",
        ShareFormat::BentoManifest => "json",
    }
}

/// Get the file dialog filter name for a given format.
fn format_filter_name(format: &ShareFormat) -> &'static str {
    match format {
        ShareFormat::PlainText => "Text files",
        ShareFormat::Markdown => "Markdown files",
        ShareFormat::Json => "JSON files",
        ShareFormat::Html => "HTML files",
        ShareFormat::Csv => "CSV files",
        ShareFormat::BentoManifest => "JSON files",
    }
}

/// Main share entry point — formats content and sends it to the requested destination.
#[tauri::command]
pub async fn share_content(
    app: AppHandle,
    content: String,
    format: ShareFormat,
    destination: ShareDestination,
    options: Option<ShareOptions>,
) -> Result<ShareResult, String> {
    let opts = options.unwrap_or_default();
    let formatted = format_content(&content, &format);
    let _size_bytes = formatted.len();

    match destination {
        ShareDestination::Clipboard => share_to_clipboard(&app, &formatted, &opts).await,
        ShareDestination::File => share_to_file(&app, &formatted, &format, &opts).await,
    }
}

/// Copy formatted content to the system clipboard.
async fn share_to_clipboard(
    app: &AppHandle,
    content: &str,
    options: &ShareOptions,
) -> Result<ShareResult, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_clipboard_manager::ClipboardExt;
        let clipboard = app.clipboard();
        clipboard
            .write_text(content.to_string())
            .map_err(|e| format!("Clipboard write failed: {e}"))?;
    }

    #[cfg(not(desktop))]
    {
        let _ = (app, content);
        return Err("Clipboard sharing is not supported on this platform.".to_string());
    }

    Ok(ShareResult {
        success: true,
        message: format!("{} copied to clipboard", options.label),
        file_path: None,
        size_bytes: content.len(),
    })
}

/// Prompt user to save formatted content to a file via system dialog.
async fn share_to_file(
    app: &AppHandle,
    content: &str,
    format: &ShareFormat,
    options: &ShareOptions,
) -> Result<ShareResult, String> {
    use std::fs;

    let ext = format_extension(format);
    let filter_name = format_filter_name(format);
    let default_name = format!("{}.{}", options.filename, ext);

    let path = app
        .dialog()
        .file()
        .set_title("Save shared content")
        .add_filter(filter_name, &[ext])
        .set_file_name(&default_name)
        .blocking_save_file();

    let Some(path) = path else {
        return Ok(ShareResult {
            success: false,
            message: "Save cancelled by user.".to_string(),
            file_path: None,
            size_bytes: content.len(),
        });
    };

    let path = path
        .into_path()
        .map_err(|e: tauri_plugin_fs::Error| e.to_string())?;
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {e}"))?;

    let path_str = path.to_string_lossy().to_string();

    Ok(ShareResult {
        success: true,
        message: format!("{} saved to {}", options.label, path_str),
        file_path: Some(path_str),
        size_bytes: content.len(),
    })
}

/// Convenience command: share as Markdown to clipboard.
#[tauri::command]
pub async fn share_markdown(
    app: AppHandle,
    content: String,
    label: String,
) -> Result<ShareResult, String> {
    share_content(
        app,
        content,
        ShareFormat::Markdown,
        ShareDestination::Clipboard,
        Some(ShareOptions {
            label,
            filename: "export".to_string(),
            sanitize: true,
            metadata: None,
        }),
    )
    .await
}

/// Convenience command: share as JSON to file via dialog.
#[tauri::command]
pub async fn share_json_to_file(
    app: AppHandle,
    content: String,
    filename: String,
    label: String,
) -> Result<ShareResult, String> {
    share_content(
        app,
        content,
        ShareFormat::Json,
        ShareDestination::File,
        Some(ShareOptions {
            label,
            filename,
            sanitize: true,
            metadata: None,
        }),
    )
    .await
}

/// Convenience command: share tabular data as CSV to file via dialog.
#[tauri::command]
pub async fn share_csv_to_file(
    app: AppHandle,
    content: String,
    filename: String,
    label: String,
) -> Result<ShareResult, String> {
    share_content(
        app,
        content,
        ShareFormat::Csv,
        ShareDestination::File,
        Some(ShareOptions {
            label,
            filename,
            sanitize: true,
            metadata: None,
        }),
    )
    .await
}
