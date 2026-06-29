//! SSE streaming response parser helpers.
//!
//! Each provider sends tokens as Server-Sent Events (SSE) or newline-delimited JSON.
//! This module provides a shared helper to parse SSE streams and extract text deltas.

use reqwest::Response;
use tokio::sync::mpsc::UnboundedSender;

/// Parse an SSE stream from a reqwest response and forward text tokens.
///
/// For each SSE `data:` line, calls `extract_token` to pull out the text delta.
/// The extracted token is sent through `tx`. On completion or error, a sentinel
/// is sent:
///   - `__DONE__` when the stream ends cleanly
///   - `__ERROR__:{message}` when an error occurs
pub async fn parse_sse_stream<F>(
    response: Response,
    tx: UnboundedSender<String>,
    extract_token: F,
) -> Result<(), String>
where
    F: Fn(&serde_json::Value) -> Option<String> + Send + 'static,
{
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = futures::stream::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Process complete lines from the buffer
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue; // Empty line = SSE event separator
            }

            if line.starts_with("data: ") {
                let data = &line[6..];

                // Check for stream end markers
                if data == "[DONE]" {
                    let _ = tx.send("__DONE__".to_string());
                    return Ok(());
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    // Check for error in the response
                    if let Some(err) = json.get("error") {
                        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown error");
                        let _ = tx.send(format!("__ERROR__:{msg}"));
                        return Err(msg.to_string());
                    }

                    if let Some(token) = extract_token(&json) {
                        if !token.is_empty() {
                            let _ = tx.send(token);
                        }
                    }
                }
            }
        }
    }

    let _ = tx.send("__DONE__".to_string());
    Ok(())
}

/// Parse Ollama's newline-delimited JSON streaming format.
///
/// Each line is a JSON object with a `response` field containing the next token.
pub async fn parse_ollama_stream(
    response: Response,
    tx: UnboundedSender<String>,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = futures::stream::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(token) = json["response"].as_str() {
                    if !token.is_empty() {
                        let _ = tx.send(token.to_string());
                    }
                }

                // Check for done flag
                if json.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                    let _ = tx.send("__DONE__".to_string());
                    return Ok(());
                }
            }
        }
    }

    let _ = tx.send("__DONE__".to_string());
    Ok(())
}

/// Parse Gemini's SSE streaming format.
///
/// Gemini sends SSE events where tokens are inside `candidates[0].content.parts[0].text`.
pub async fn parse_gemini_stream(
    response: Response,
    tx: UnboundedSender<String>,
) -> Result<(), String> {
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = futures::stream::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() {
                continue;
            }

            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    let _ = tx.send("__DONE__".to_string());
                    return Ok(());
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    // Check for error
                    if let Some(err) = json.get("error") {
                        let msg = err.get("message").and_then(|m| m.as_str()).unwrap_or("unknown error");
                        let _ = tx.send(format!("__ERROR__:{msg}"));
                        return Err(msg.to_string());
                    }

                    // Extract from candidates[0].content.parts[0].text
                    if let Some(token) = json["candidates"]
                        .as_array()
                        .and_then(|arr| arr.first())
                        .and_then(|c| c["content"]["parts"].as_array())
                        .and_then(|parts| parts.first())
                        .and_then(|p| p["text"].as_str())
                        .map(|s| s.to_string())
                    {
                        if !token.is_empty() {
                            let _ = tx.send(token);
                        }
                    }
                }
            }
        }
    }

    let _ = tx.send("__DONE__".to_string());
    Ok(())
}

/// Send a complete response as a single token followed by __DONE__.
pub async fn send_complete_response(
    response_text: String,
    tx: UnboundedSender<String>,
) -> Result<(), String> {
    let _ = tx.send(response_text);
    let _ = tx.send("__DONE__".to_string());
    Ok(())
}
