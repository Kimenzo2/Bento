//! Google Gemini provider.
//!
//! API: POST /v1beta/models/{model}:generateContent?key={API_KEY}
//! Stream: POST /v1beta/models/{model}:streamGenerateContent?key={API_KEY}
//! Auth: API key as query parameter (or x-goog-api-key header)
//! Response: candidates[0].content.parts[0].text

use tokio::sync::mpsc::UnboundedSender;

pub struct GeminiProvider {
    base_url: String,
}

impl GeminiProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    fn client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_default()
    }

    /// Strip "models/" prefix if present from model name.
    fn normalize_model(model: &str) -> String {
        model.trim_start_matches("models/").to_string()
    }

    /// Build the Gemini request body.
    fn build_contents(prompt: &str) -> serde_json::Value {
        serde_json::json!({
            "contents": [{
                "role": "user",
                "parts": [{"text": prompt}]
            }]
        })
    }

    /// Extract text from a Gemini response (streaming or non-streaming).
    fn extract_text(json: &serde_json::Value) -> Option<String> {
        json["candidates"]
            .as_array()
            .and_then(|candidates| candidates.first())
            .and_then(|c| c["content"]["parts"].as_array())
            .and_then(|parts| parts.first())
            .and_then(|p| p["text"].as_str())
            .map(String::from)
    }

    pub async fn complete(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
    ) -> Result<String, String> {
        let key = api_key.ok_or_else(|| "No API key for Gemini".to_string())?;
        let client = Self::client();
        let model_name = Self::normalize_model(model);

        let url = format!(
            "{}/models/{}:generateContent?key={key}",
            self.base_url, model_name
        );

        let body = Self::build_contents(prompt);

        let resp = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Gemini request failed: {e}"))?;

        let status = resp.status();
        let json: serde_json::Value = resp.json().await.map_err(|e| format!("Parse error: {e}"))?;

        if !status.is_success() {
            let msg = json["error"]["message"].as_str().unwrap_or("unknown error");
            return Err(format!("Gemini ({status}): {msg}"));
        }

        let text = Self::extract_text(&json).unwrap_or_default();
        Ok(text)
    }

    pub async fn stream(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
        tx: UnboundedSender<String>,
    ) -> Result<(), String> {
        let key = api_key.ok_or_else(|| "No API key for Gemini".to_string())?;
        let client = Self::client();
        let model_name = Self::normalize_model(model);

        let url = format!(
            "{}/models/{}:streamGenerateContent?key={key}&alt=sse",
            self.base_url, model_name
        );

        let body = Self::build_contents(prompt);

        let resp = client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Gemini stream request failed: {e}"))?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(format!("Gemini stream returned {status}: {body_text}"));
        }

        // Gemini SSE format: data: {"candidates":[{"content":{"parts":[{"text":"token"}]}}]}
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

                if line.starts_with("data: ") {
                    let data = &line[6..];

                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        // Check for error
                        if json.get("error").is_some() {
                            let msg = json["error"]["message"].as_str().unwrap_or("stream error");
                            let _ = tx.send(format!("__ERROR__:{msg}"));
                            return Err(msg.to_string());
                        }

                        // Extract text token
                        if let Some(token) = Self::extract_text(&json) {
                            if !token.is_empty() {
                                let _ = tx.send(token);
                            }
                        }

                        // Check for finish reason (stream complete)
                        if let Some(candidates) = json["candidates"].as_array() {
                            if let Some(first) = candidates.first() {
                                if first.get("finishReason").is_some()
                                    || first.get("finish_reason").is_some()
                                {
                                    let _ = tx.send("__DONE__".to_string());
                                    return Ok(());
                                }
                            }
                        }
                    }
                }
            }
        }

        let _ = tx.send("__DONE__".to_string());
        Ok(())
    }

    pub async fn list_models(&self, api_key: Option<&str>) -> Result<Vec<String>, String> {
        let client = Self::client();

        let url = match api_key {
            Some(key) => format!("{}/models?key={key}", self.base_url),
            None => {
                return Ok(crate::byok::ByokProvider::Gemini
                    .known_models()
                    .into_iter()
                    .map(String::from)
                    .collect());
            }
        };

        let resp = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Gemini models request failed: {e}"))?;

        if !resp.status().is_success() {
            return Ok(crate::byok::ByokProvider::Gemini
                .known_models()
                .into_iter()
                .map(String::from)
                .collect());
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

    pub async fn validate_key(&self, api_key: Option<&str>) -> Result<(), String> {
        let key = api_key.ok_or_else(|| "No API key provided".to_string())?;
        let client = Self::client();

        let resp = client
            .get(format!("{}/models?key={key}", self.base_url))
            .send()
            .await
            .map_err(|e| format!("Gemini validation failed: {e}"))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            Err(format!("Gemini key invalid ({status})"))
        }
    }
}
