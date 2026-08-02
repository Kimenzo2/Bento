// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Anthropic Claude provider.
//!
//! API: POST https://api.anthropic.com/v1/messages
//! Auth: `x-api-key` header + `anthropic-version: 2023-06-01`
//! Streaming: SSE with message_start/content_block_delta/message_stop events.

use tokio::sync::mpsc::UnboundedSender;

use crate::ai::stream::parse_sse_stream;

pub struct AnthropicProvider {
    base_url: String,
}

impl AnthropicProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    /// Build a reqwest Client with default timeouts.
    fn client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default()
    }

    pub async fn complete(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
    ) -> Result<String, String> {
        let key = api_key.ok_or_else(|| "No API key for Anthropic".to_string())?;
        let client = Self::client();

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}]
        });

        let resp = client
            .post(format!("{}/messages", self.base_url))
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Anthropic request failed: {e}"))?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"]["message"].as_str().unwrap_or("unknown error");
            return Err(format!("Anthropic ({status}): {msg}"));
        }

        // Extract text from content blocks
        let text = json["content"]
            .as_array()
            .and_then(|blocks| {
                blocks
                    .iter()
                    .filter_map(|b| {
                        if b["type"].as_str() == Some("text") {
                            b["text"].as_str().map(String::from)
                        } else {
                            None
                        }
                    })
                    .collect::<Vec<_>>()
                    .join("")
                    .into()
            })
            .unwrap_or_default();

        Ok(text)
    }

    pub async fn stream(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
        tx: UnboundedSender<String>,
    ) -> Result<(), String> {
        let key = api_key.ok_or_else(|| "No API key for Anthropic".to_string())?;
        let client = Self::client();

        let body = serde_json::json!({
            "model": model,
            "max_tokens": 4096,
            "stream": true,
            "messages": [{"role": "user", "content": prompt}]
        });

        let resp = client
            .post(format!("{}/messages", self.base_url))
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Anthropic stream request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("Anthropic stream returned {status}: {body_text}"));
        }

        // Anthropic SSE format:
        // event: content_block_delta
        // data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
        //
        // We parse the data: lines and extract delta.text
        parse_sse_stream(resp, tx, |json| {
            // Anthropic streaming events have delta.text in content_block_delta events
            if json["type"].as_str() == Some("content_block_delta") {
                return json["delta"]["text"].as_str().map(String::from);
            }
            None
        })
        .await
    }

    pub async fn list_models(&self, api_key: Option<&str>) -> Result<Vec<String>, String> {
        // Try the models list API if a key is available.
        if let Some(key) = api_key {
            let client = Self::client();
            let resp = client
                .get(format!("{}/models", self.base_url))
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await;

            if let Ok(resp) = resp {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(models) = json["data"].as_array() {
                            let names: Vec<String> = models
                                .iter()
                                .filter_map(|m| m["id"].as_str().map(String::from))
                                .collect();
                            if !names.is_empty() {
                                return Ok(names);
                            }
                        }
                    }
                }
            }
        }

        // Fall back to known models.
        Ok(crate::byok::ByokProvider::Anthropic
            .known_models()
            .into_iter()
            .map(String::from)
            .collect())
    }

    pub async fn validate_key(&self, api_key: Option<&str>) -> Result<(), String> {
        let key = api_key.ok_or_else(|| "No API key provided".to_string())?;
        let client = Self::client();

        // Use the models list endpoint (free, no token cost) instead of making a messages call.
        let resp = client
            .get(format!("{}/models", self.base_url))
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .await
            .map_err(|e| format!("Anthropic validation failed: {e}"))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            Err(format!("Anthropic key invalid ({status})"))
        }
    }
}
