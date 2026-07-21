//! ChatGPT Proxy provider.
//!
//! Routes through a self-hosted app-server which proxies to OpenAI API.
//! The session JWT is used as Bearer token for authentication.
//! Endpoint: {server_url}/api/v1/chat/completions

use tokio::sync::mpsc::UnboundedSender;

use crate::ai::stream::parse_sse_stream;

pub struct ChatGptProvider {
    base_url: String,
}

impl ChatGptProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

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
        let key = api_key.ok_or_else(|| "Not signed in with ChatGPT".to_string())?;
        let client = Self::client();

        let body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_completion_tokens": 4096,
            "temperature": 0.7,
            "stream": false
        });

        let resp = client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("ChatGPT request failed: {e}"))?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"]["message"].as_str().unwrap_or("unknown error");
            return Err(format!("ChatGPT proxy ({status}): {msg}"));
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
        let key = api_key.ok_or_else(|| "Not signed in with ChatGPT".to_string())?;
        let client = Self::client();

        let body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_completion_tokens": 4096,
            "temperature": 0.7,
            "stream": true
        });

        let resp = client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {key}"))
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
        Ok(vec![
            "gpt-4o".into(),
            "gpt-4o-mini".into(),
            "gpt-4.1".into(),
            "gpt-4.1-mini".into(),
            "gpt-4.1-nano".into(),
            "o3".into(),
            "o3-mini".into(),
            "o4-mini".into(),
        ])
    }

    pub async fn validate_key(&self, _api_key: Option<&str>) -> Result<(), String> {
        // Session validity is checked at request time; keyring presence is sufficient
        Ok(())
    }
}
