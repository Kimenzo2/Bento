// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! ChatGPT (Codex) provider.
//!
//! Routes through the self-hosted Express proxy which uses real Codex OAuth.
//! Auth is cookie-based (no API key). The reqwest Client from managed
//! Tauri state carries the session cookie automatically.
//! Endpoint: {server_url}/api/chatgpt/responses (Codex format)

use serde_json::Value;
use tokio::sync::mpsc::UnboundedSender;

use crate::ai::chat::ChatMessage;

pub struct ChatGptProvider {
    pub base_url: String,
}

impl ChatGptProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    /// Translate OpenAI-format messages into Codex `input` items.
    fn messages_to_codex_input(messages: &[ChatMessage]) -> Vec<Value> {
        messages.iter().map(|msg| {
            let mut item = serde_json::json!({
                "type": "message",
                "role": msg.role,
                "content": msg.content,
            });
            if let Some(tcs) = &msg.tool_calls {
                item["tool_calls"] = serde_json::json!(tcs.iter().map(|tc| {
                    serde_json::json!({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": tc.args.to_string(),
                        }
                    })
                }).collect::<Vec<_>>());
            }
            if let Some(ref tid) = msg.tool_call_id {
                item["tool_call_id"] = serde_json::json!(tid);
            }
            item
        }).collect()
    }

    pub fn build_codex_request(
        model: &str,
        system: Option<&str>,
        messages: &[ChatMessage],
        tools: Option<&[Value]>,
        stream: bool,
        max_tokens: Option<u64>,
        temperature: Option<f64>,
        top_p: Option<f64>,
    ) -> Value {
        let mut input = Vec::new();

        if let Some(sys) = system {
            if !sys.is_empty() {
                input.push(serde_json::json!({
                    "type": "message",
                    "role": "developer",
                    "content": sys,
                }));
            }
        }

        input.extend(Self::messages_to_codex_input(messages));

        let mut body = serde_json::json!({
            "model": model,
            "input": input,
            "stream": stream,
        });

        if let Some(t) = max_tokens { body["max_output_tokens"] = serde_json::json!(t); }
        if let Some(t) = temperature { body["temperature"] = serde_json::json!(t); }
        if let Some(p) = top_p { body["top_p"] = serde_json::json!(p); }

        if let Some(tools) = tools {
            body["tools"] = serde_json::json!(tools);
            body["tool_choice"] = serde_json::json!("auto");
        }

        body
    }

    pub fn client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default()
    }

    pub async fn complete(
        &self,
        model: &str,
        _api_key: Option<&str>,
        prompt: &str,
    ) -> Result<String, String> {
        let msg = ChatMessage {
            role: "user".into(),
            content: prompt.into(),
            tool_calls: None,
            tool_call_id: None,
            tool_call_name: None,
            created_at: None,
        };
        let body = Self::build_codex_request(model, None, &[msg], None, false, None, None, None);

        let client = Self::client();
        let resp = client
            .post(format!("{}/responses", self.base_url))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("ChatGPT request failed: {e}"))?;

        let status = resp.status();
        let json: Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"].as_str().unwrap_or("unknown error");
            return Err(format!("ChatGPT proxy ({status}): {msg}"));
        }

        // Extract text from Codex response format
        let text = json["output"]
            .as_array()
            .and_then(|arr| arr.iter().find(|o| o["type"] == "message"))
            .and_then(|msg| msg["content"].as_array())
            .and_then(|content| content.iter().find(|c| c["type"] == "output_text"))
            .and_then(|t| t["text"].as_str())
            .map(String::from)
            .unwrap_or_default();

        Ok(text)
    }

    pub async fn stream(
        &self,
        model: &str,
        _api_key: Option<&str>,
        prompt: &str,
        tx: UnboundedSender<String>,
    ) -> Result<(), String> {
        let msg = ChatMessage {
            role: "user".into(),
            content: prompt.into(),
            tool_calls: None,
            tool_call_id: None,
            tool_call_name: None,
            created_at: None,
        };
        let body = Self::build_codex_request(model, None, &[msg], None, true, None, None, None);

        let client = Self::client();
        let resp = client
            .post(format!("{}/responses", self.base_url))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("ChatGPT stream request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("ChatGPT proxy returned {status}: {body_text}"));
        }

        parse_codex_sse_stream(resp, tx).await
    }

    pub async fn list_models(&self, _api_key: Option<&str>) -> Result<Vec<String>, String> {
        Ok(vec![
            "gpt-4o".into(),
            "gpt-4o-mini".into(),
            "gpt-4.1".into(),
            "gpt-4.1-mini".into(),
            "gpt-4.1-nano".into(),
            "o3".into(),
            "o3-mini".into(),
            "o4-mini".into(),
            "gpt-5.5".into(),
        ])
    }

    pub async fn validate_key(&self, _api_key: Option<&str>) -> Result<(), String> {
        Ok(())
    }
}

/// Parse a Codex SSE stream and send text tokens through the channel.
async fn parse_codex_sse_stream(
    resp: reqwest::Response,
    tx: UnboundedSender<String>,
) -> Result<(), String> {
    use futures::StreamExt;
    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut current_event = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }

            if line.starts_with("event: ") {
                current_event = line[7..].to_string();
            } else if line.starts_with("data: ") {
                let data = &line[6..];
                let json: Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                match current_event.as_str() {
                    "response.text.delta" => {
                        if let Some(delta) = json["data"]["delta"].as_str() {
                            if !delta.is_empty() {
                                let _ = tx.send(delta.to_string());
                            }
                        }
                    }
                    "response.done" => {
                        let _ = tx.send("__DONE__".to_string());
                        return Ok(());
                    }
                    "error" => {
                        let msg = json["message"].as_str().unwrap_or("Codex API error");
                        let _ = tx.send(format!("__ERROR__:{msg}"));
                        return Err(msg.to_string());
                    }
                    _ => {}
                }
                current_event.clear();
            }
        }
    }

    // Stream ended without response.done — unexpected
    let _ = tx.send("__DONE__".to_string());
    Ok(())
}
