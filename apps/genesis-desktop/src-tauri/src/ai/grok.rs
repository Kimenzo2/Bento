// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! xAI Grok provider.
//!
//! xAI uses the exact same API format as OpenAI (Chat Completions).
//! This is a thin wrapper over the OpenAI-compatible format with
//! a different base URL and model list.
//!
//! API: POST {base_url}/chat/completions
//! Auth: `Authorization: Bearer {key}`
//! Streaming: SSE data: lines, ends with data: [DONE]

use tokio::sync::mpsc::UnboundedSender;

use crate::ai::stream::parse_sse_stream;

pub struct GrokProvider {
    base_url: String,
}

impl GrokProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    fn client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default()
    }

    /// Build the standard OpenAI-compatible chat request body.
    fn build_chat_body(model: &str, prompt: &str, stream: bool) -> serde_json::Value {
        serde_json::json!({
            "model": model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 4096,
            "temperature": 0.7,
            "stream": stream
        })
    }

    pub async fn complete(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
    ) -> Result<String, String> {
        let key = api_key.ok_or_else(|| "No API key for Grok".to_string())?;
        let client = Self::client();

        let body = Self::build_chat_body(model, prompt, false);

        let resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Grok request failed: {e}"))?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"]["message"].as_str().unwrap_or("unknown error");
            return Err(format!("Grok ({status}): {msg}"));
        }

        let text = json["choices"]
            .as_array()
            .and_then(|choices| choices.first())
            .and_then(|c| c["message"]["content"].as_str())
            .map(String::from)
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
        let key = api_key.ok_or_else(|| "No API key for Grok".to_string())?;
        let client = Self::client();

        let body = Self::build_chat_body(model, prompt, true);

        let resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Grok stream request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("Grok stream returned {status}: {body_text}"));
        }

        // Same SSE format as OpenAI
        parse_sse_stream(resp, tx, |json| {
            json["choices"]
                .as_array()
                .and_then(|choices| choices.first())
                .and_then(|c| c["delta"]["content"].as_str())
                .map(String::from)
        })
        .await
    }

    pub async fn list_models(&self, _api_key: Option<&str>) -> Result<Vec<String>, String> {
        Ok(crate::byok::ByokProvider::Grok
            .known_models()
            .into_iter()
            .map(String::from)
            .collect())
    }

    pub async fn validate_key(&self, api_key: Option<&str>) -> Result<(), String> {
        let key = api_key.ok_or_else(|| "No API key provided".to_string())?;
        let client = Self::client();

        // Use the models list endpoint (free, no token cost).
        // xAI supports the OpenAI-compatible GET /v1/models endpoint.
        let resp = client
            .get(format!("{}/models", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .send()
            .await
            .map_err(|e| format!("Grok validation failed: {e}"))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            Err(format!("Grok key invalid ({status})"))
        }
    }
}
