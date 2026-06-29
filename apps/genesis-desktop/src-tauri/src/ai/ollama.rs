//! Ollama local provider.
//!
//! Uses the /api/chat endpoint (preferred for conversational AI).
//! No API key required — runs locally.
//!
//! API: POST {base_url}/api/chat
//! Streaming: newline-delimited JSON with `message.content` and `done` flag.
//! List models: GET {base_url}/api/tags
//! Health: GET {base_url}/ returns "Ollama is running"

use tokio::sync::mpsc::UnboundedSender;

pub struct OllamaProvider {
    base_url: String,
}

impl OllamaProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    fn client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300)) // Ollama can be slow
            .build()
            .unwrap_or_default()
    }

    pub async fn complete(
        &self,
        model: &str,
        _api_key: Option<&str>,
        prompt: &str,
    ) -> Result<String, String> {
        let client = Self::client();

        let body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": false
        });

        let resp = client
            .post(format!("{}/api/chat", self.base_url))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {e}"))?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"].as_str().unwrap_or("unknown error");
            return Err(format!("Ollama ({status}): {msg}"));
        }

        let text = json["message"]["content"]
            .as_str()
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
        let client = Self::client();

        let body = serde_json::json!({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": true
        });

        let resp = client
            .post(format!("{}/api/chat", self.base_url))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama stream request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama stream returned {status}: {body_text}"));
        }

        // Ollama streaming format: newline-delimited JSON
        // Each line: {"model":"...","created_at":"...","message":{"role":"assistant","content":"token"},"done":false}
        // Final line: {"message":{"role":"assistant","content":""},"done":true,...}
        let mut stream = resp.bytes_stream();
        let mut buffer = String::new();

        while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
            let chunk = chunk_result.map_err(|e| format!("Stream read error: {e}"))?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                    // Extract token from message.content
                    if let Some(token) = json["message"]["content"].as_str() {
                        if !token.is_empty() {
                            let _ = tx.send(token.to_string());
                        }
                    }

                    // Check if stream is complete
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

    pub async fn list_models(&self, _api_key: Option<&str>) -> Result<Vec<String>, String> {
        let client = Self::client();

        let resp = client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map_err(|e| format!("Ollama tags request failed: {e}"))?;

        if !resp.status().is_success() {
            // Ollama may not be running — return empty list
            return Ok(Vec::new());
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;
        let models = json["models"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|m| m["name"].as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        Ok(models)
    }

    pub async fn validate_key(&self, _api_key: Option<&str>) -> Result<(), String> {
        // Ollama doesn't use API keys — just ping to check it's running
        let client = Self::client();

        let resp = client
            .get(&self.base_url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("Ollama is not running: {e}"))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(format!("Ollama returned status {}", resp.status()))
        }
    }
}
