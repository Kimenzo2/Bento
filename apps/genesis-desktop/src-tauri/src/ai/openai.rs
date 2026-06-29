//! OpenAI Chat Completions provider.
//!
//! API: POST https://api.openai.com/v1/chat/completions
//! Auth: `Authorization: Bearer {key}`
//! Streaming: SSE data: lines with delta.content, ends with data: [DONE]

use tokio::sync::mpsc::UnboundedSender;

use crate::ai::stream::parse_sse_stream;

pub struct OpenAIProvider {
    base_url: String,
}

impl OpenAIProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    fn client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default()
    }

    /// Shared request body builder — used by both OpenAI and Grok.
    fn build_chat_body(model: &str, prompt: &str, stream: bool) -> serde_json::Value {
        serde_json::json!({
            "model": model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_completion_tokens": 4096,
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
        let key = api_key.ok_or_else(|| "No API key for OpenAI".to_string())?;
        let client = Self::client();

        let body = Self::build_chat_body(model, prompt, false);

        let resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("OpenAI request failed: {e}"))?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"]["message"]
                .as_str()
                .unwrap_or("unknown error");
            return Err(format!("OpenAI ({status}): {msg}"));
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
        let key = api_key.ok_or_else(|| "No API key for OpenAI".to_string())?;
        let client = Self::client();

        let body = Self::build_chat_body(model, prompt, true);

        let resp = client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("OpenAI stream request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("OpenAI stream returned {status}: {body_text}"));
        }

        // OpenAI SSE: data: {"choices":[{"delta":{"content":"token"}}]}
        // End: data: [DONE]
        parse_sse_stream(resp, tx, |json| {
            json["choices"]
                .as_array()
                .and_then(|choices| choices.first())
                .and_then(|c| c["delta"]["content"].as_str())
                .map(String::from)
        })
        .await
    }

    pub async fn list_models(&self, api_key: Option<&str>) -> Result<Vec<String>, String> {
        let client = Self::client();

        let resp = match api_key {
            Some(key) => {
                client
                    .get(format!("{}/models", self.base_url))
                    .header("Authorization", format!("Bearer {key}"))
                    .send()
                    .await
                    .map_err(|e| format!("OpenAI models request failed: {e}"))?
            }
            None => {
                // Return known models without making a request
                return Ok(crate::byok::ByokProvider::OpenAI
                    .known_models()
                    .into_iter()
                    .map(String::from)
                    .collect());
            }
        };

        if !resp.status().is_success() {
            return Ok(crate::byok::ByokProvider::OpenAI
                .known_models()
                .into_iter()
                .map(String::from)
                .collect());
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
        let models = json["data"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["id"].as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }

    pub async fn validate_key(&self, api_key: Option<&str>) -> Result<(), String> {
        let key = api_key.ok_or_else(|| "No API key provided".to_string())?;
        let client = Self::client();

        let resp = client
            .get(format!("{}/models", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .send()
            .await
            .map_err(|e| format!("OpenAI validation failed: {e}"))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            Err(format!("OpenAI key invalid ({status})"))
        }
    }
}
