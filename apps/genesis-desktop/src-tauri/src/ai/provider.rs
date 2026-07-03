//! AI Provider trait and dispatch.
//!
//! Uses an enum-based approach (not a trait object) so each provider is a
//! concrete struct with its own `complete` and `stream` methods, dispatched
//! via a match in the `AiProvider` enum.

use std::collections::HashMap;
use tokio::sync::mpsc::UnboundedSender;

use super::anthropic::AnthropicProvider;
use super::gemini::GeminiProvider;
use super::grok::GrokProvider;
use super::ollama::OllamaProvider;
use super::openai::OpenAIProvider;

/// Enum dispatching to the correct AI provider implementation.
pub enum AiProvider {
    Anthropic(AnthropicProvider),
    OpenAI(OpenAIProvider),
    Grok(GrokProvider),
    Ollama(OllamaProvider),
    Gemini(GeminiProvider),
}

impl AiProvider {
    /// Send a complete (non-streaming) prompt and return the full response.
    pub async fn complete(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
    ) -> Result<String, String> {
        match self {
            Self::Anthropic(p) => p.complete(model, api_key, prompt).await,
            Self::OpenAI(p) => p.complete(model, api_key, prompt).await,
            Self::Grok(p) => p.complete(model, api_key, prompt).await,
            Self::Ollama(p) => p.complete(model, api_key, prompt).await,
            Self::Gemini(p) => p.complete(model, api_key, prompt).await,
        }
    }

    /// Stream a response token-by-token through the sender channel.
    /// Sends `__DONE__` on completion or `__ERROR__:{msg}` on failure.
    pub async fn stream(
        &self,
        model: &str,
        api_key: Option<&str>,
        prompt: &str,
        tx: UnboundedSender<String>,
    ) -> Result<(), String> {
        match self {
            Self::Anthropic(p) => p.stream(model, api_key, prompt, tx).await,
            Self::OpenAI(p) => p.stream(model, api_key, prompt, tx).await,
            Self::Grok(p) => p.stream(model, api_key, prompt, tx).await,
            Self::Ollama(p) => p.stream(model, api_key, prompt, tx).await,
            Self::Gemini(p) => p.stream(model, api_key, prompt, tx).await,
        }
    }

    /// List available models for this provider.
    /// For Ollama, fetches dynamically from the local server.
    /// For others, returns the known model list.
    pub async fn list_models(&self, api_key: Option<&str>) -> Result<Vec<String>, String> {
        match self {
            Self::Anthropic(p) => p.list_models(api_key).await,
            Self::OpenAI(p) => p.list_models(api_key).await,
            Self::Grok(p) => p.list_models(api_key).await,
            Self::Ollama(p) => p.list_models(api_key).await,
            Self::Gemini(p) => p.list_models(api_key).await,
        }
    }

    /// Validate an API key by calling the provider's cheapest endpoint.
    pub async fn validate_key(&self, api_key: Option<&str>) -> Result<(), String> {
        match self {
            Self::Anthropic(p) => p.validate_key(api_key).await,
            Self::OpenAI(p) => p.validate_key(api_key).await,
            Self::Grok(p) => p.validate_key(api_key).await,
            Self::Ollama(p) => p.validate_key(api_key).await,
            Self::Gemini(p) => p.validate_key(api_key).await,
        }
    }
}

/// Create an AiProvider for the given provider name.
///
/// `base_url_overrides` allows custom endpoints (useful for Ollama or
/// self-hosted OpenAI-compatible servers).
pub fn create_provider(
    provider_name: &str,
    base_url_overrides: &HashMap<String, String>,
) -> Result<AiProvider, String> {
    match provider_name {
        "anthropic" => {
            let base_url = base_url_overrides
                .get("anthropic")
                .cloned()
                .unwrap_or_else(|| "https://api.anthropic.com/v1".to_string());
            Ok(AiProvider::Anthropic(AnthropicProvider::new(base_url)))
        }
        "openai" => {
            let base_url = base_url_overrides
                .get("openai")
                .cloned()
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            Ok(AiProvider::OpenAI(OpenAIProvider::new(base_url)))
        }
        "grok" => {
            let base_url = base_url_overrides
                .get("grok")
                .cloned()
                .unwrap_or_else(|| "https://api.x.ai/v1".to_string());
            Ok(AiProvider::Grok(GrokProvider::new(base_url)))
        }
        "ollama" => {
            let base_url = base_url_overrides
                .get("ollama")
                .cloned()
                .unwrap_or_else(|| "http://localhost:11434".to_string());
            Ok(AiProvider::Ollama(OllamaProvider::new(base_url)))
        }
        "gemini" => {
            let base_url = base_url_overrides
                .get("gemini")
                .cloned()
                .unwrap_or_else(|| "https://generativelanguage.googleapis.com/v1beta".to_string());
            Ok(AiProvider::Gemini(GeminiProvider::new(base_url)))
        }
        other => Err(format!("Unknown AI provider: {other}")),
    }
}
