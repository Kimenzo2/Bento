// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Agent chat engine — multi-turn streaming with tool calling support.
//!
//! Orchestrates provider-specific API requests, parses streaming responses
//! for both text tokens and tool calls, executes tools against the local
//! Bento database, and continues the tool-call loop automatically.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::AppHandle;
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;

use crate::agent_core::ui_schema::UiVocabulary;

// ── Public types ──────────────────────────────────────────────────────────────

const VALID_ROLES: &[&str] = &["user", "assistant", "system", "tool"];

/// A single chat message in a conversation.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    /// Function name for the tool result (required by Gemini for functionResponse).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_name: Option<String>,
    /// Epoch ms timestamp when this message was created.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<i64>,
}

impl ChatMessage {
    /// Validate the role field; returns an error for unknown roles.
    pub fn validate(&self) -> Result<(), String> {
        if !VALID_ROLES.contains(&self.role.as_str()) {
            return Err(format!(
                "Invalid message role \"{}\". Must be one of: {}",
                self.role,
                VALID_ROLES.join(", ")
            ));
        }
        Ok(())
    }
}

/// A tool call from the AI.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: Value,
}

/// Event sent to the frontend during streaming.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatEvent {
    #[serde(rename = "token")]
    Token { content: String },
    #[serde(rename = "tool_call")]
    ToolCall {
        id: String,
        name: String,
        args: Value,
        #[serde(rename = "autoExecute")]
        auto_execute: bool,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        id: String,
        name: String,
        result: Value,
        #[serde(rename = "isError")]
        is_error: bool,
    },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "done")]
    Done {
        #[serde(rename = "finishReason")]
        finish_reason: Option<String>,
        usage: Option<UsageInfo>,
    },
    #[serde(rename = "ui_update")]
    UiUpdate { ui: UiVocabulary },
}

/// Token usage information.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageInfo {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

/// A tool definition sent to the AI provider.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
    pub auto_execute: bool,
}

/// Parameters for a chat stream request.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatParams {
    pub messages: Vec<ChatMessage>,
    pub system: Option<String>,
    pub model: String,
    pub provider: String,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u64>,
    pub top_p: Option<f64>,
    pub top_k: Option<u64>,
    pub presence_penalty: Option<f64>,
    pub frequency_penalty: Option<f64>,
    pub stop_sequences: Option<Vec<String>>,
    pub enable_tools: Option<bool>,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    /// Raw `Cookie` header value for ChatGPT cookie-based auth.
    /// Set by the ChatGPT auth commands; used in `send_codex_stream`.
    pub cookie: Option<String>,
    /// Extra tools injected by the caller on top of the internal registry —
    /// currently the integration tools for connected communication apps.
    #[serde(default)]
    pub extra_tools: Option<Vec<ToolDefinition>>,
}

// ── Tool definitions (delegated to the tools registry) ───────────────────────

/// Return all tool definitions from the registry.
pub fn default_tool_definitions() -> Vec<ToolDefinition> {
    crate::ai::tools::all_definitions()
}

/// Max tool definitions supported by OpenAI-compatible providers (128).
const MAX_TOOL_DEFS_OPENAI: usize = 128;
/// Anthropic's Messages API caps the tools array at 64 — sending more is a 400.
const MAX_TOOL_DEFS_ANTHROPIC: usize = 64;

/// Provider-specific tool count limit.
fn provider_tool_cap(provider: &str) -> usize {
    if provider == "anthropic" {
        MAX_TOOL_DEFS_ANTHROPIC
    } else {
        MAX_TOOL_DEFS_OPENAI
    }
}

/// Max characters for a tool result before truncation — keeps the context
/// window healthy when integrations return large payloads.
const MAX_TOOL_RESULT_CHARS: usize = 12_000;

/// Truncate a tool result string if it exceeds MAX_TOOL_RESULT_CHARS.
fn truncate_tool_result(s: String) -> String {
    let original = s.chars().count();
    if original <= MAX_TOOL_RESULT_CHARS {
        s
    } else {
        let mut truncated: String = s.chars().take(MAX_TOOL_RESULT_CHARS).collect();
        truncated.push_str(&format!(
            "\n\n[truncated — response was {original} chars, showing first {MAX_TOOL_RESULT_CHARS}]"
        ));
        truncated
    }
}

/// Merge the internal tool registry with any caller-injected tools (e.g. the
/// integration tools for connected apps). Used for building provider requests
/// and resolving `auto_execute` during the tool-call loop.
fn all_tool_definitions(params: &ChatParams) -> Vec<ToolDefinition> {
    let max = provider_tool_cap(&params.provider);
    let internal = default_tool_definitions();
    let integration: Vec<ToolDefinition> = params.extra_tools.clone().unwrap_or_default();

    // An integration tool that shadows an internal tool name would be sent
    // twice and cause an ambiguous duplicate-tool error — keep the internal
    // definition and drop the duplicate integration copy.
    let internal_names: std::collections::HashSet<&str> =
        internal.iter().map(|d| d.name.as_str()).collect();
    let integration: Vec<ToolDefinition> = integration
        .into_iter()
        .filter(|d| !internal_names.contains(d.name.as_str()))
        .collect();

    let total = internal.len() + integration.len();

    if total <= max {
        let mut defs = internal;
        defs.extend(integration);
        return defs;
    }

    // Over the limit — prioritize integration tools (they're the connected apps
    // the user specifically set up).  Fill remaining slots with internal tools.
    let integration_cap = integration.len().min(max);
    let internal_cap = max - integration_cap;

    eprintln!(
        "[ai] tool count {total} exceeds provider limit {max} — \
         keeping all {integration_cap} integration tools + {internal_cap}/{} internal tools \
         (dropping {} internal tools)",
        internal.len(),
        internal.len() - internal_cap,
    );

    let mut defs: Vec<ToolDefinition> = internal.into_iter().take(internal_cap).collect();
    defs.extend(integration.into_iter().take(integration_cap));
    defs
}

/// Check if a provider supports tool calling.
fn provider_supports_tools(provider: &str) -> bool {
    matches!(provider, "openai" | "anthropic" | "gemini" | "grok" | "openrouter" | "chatgpt")
}

// ── Tool execution ──────────────────────────────────────────────────────────

/// Execute a tool by name with the given arguments — delegates to the tools
/// registry. Integration tools are dispatched first (by slug), then the
/// internal life-OS tools.
async fn execute_tool(
    pool: &SqlitePool,
    app: &AppHandle,
    name: &str,
    args: &Value,
) -> Result<Value, String> {
    if crate::ai::tools::integrations::is_integration_tool(name) {
        return crate::ai::tools::integrations::execute_tool(app, name, args).await;
    }
    crate::ai::tools::execute_tool(pool, name, args).await
}

// ── Provider request builders ──────────────────────────────────────────────

/// Build an OpenAI/Grok-compatible chat completions request body.
fn build_openai_request(
    params: &ChatParams,
    include_tools: bool,
    stream: bool,
) -> Value {
    let mut body = json!({
        "model": params.model,
        "messages": build_openai_messages(params),
        "stream": stream,
    });

    if let Some(t) = params.temperature { body["temperature"] = json!(t); }
    if let Some(m) = params.max_tokens { body["max_completion_tokens"] = json!(m); }
    if let Some(p) = params.top_p { body["top_p"] = json!(p); }
    if let Some(p) = params.presence_penalty { body["presence_penalty"] = json!(p); }
    if let Some(f) = params.frequency_penalty { body["frequency_penalty"] = json!(f); }
    if let Some(s) = &params.stop_sequences { body["stop"] = json!(s); }

    if include_tools {
        let defs = all_tool_definitions(params);
        let tools: Vec<Value> = defs.iter().map(|t| json!({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": gemini_parameters(&t.input_schema),
            }
        })).collect();
        body["tools"] = json!(tools);
        body["tool_choice"] = json!("auto");
    }

    body
}

/// Remove incomplete tool-calling sequences from conversation history.
///
/// The tool loop runs inside `stream_chat` but only the final text response is
/// saved to memory. If the history contains assistant messages with tool_calls
/// but no matching tool response messages, the provider rejects the request.
/// This function strips ALL orphaned sequences from the entire history.
fn sanitize_history(messages: &[ChatMessage]) -> Vec<ChatMessage> {
    use std::collections::HashSet;

    // Phase 1: collect all tool_call_ids that have a matching tool response
    let responded_ids: HashSet<String> = messages
        .iter()
        .filter(|m| m.role == "tool")
        .filter_map(|m| m.tool_call_id.clone())
        .collect();

    // Phase 2: build a set of "bad" indices — assistant messages with
    // unresponded tool_calls, and orphaned tool messages
    let mut bad_indices = HashSet::new();
    for (i, msg) in messages.iter().enumerate() {
        if msg.role == "assistant" {
            if let Some(tcs) = &msg.tool_calls {
                if !tcs.is_empty() {
                    let all_responded = tcs.iter().all(|tc| responded_ids.contains(&tc.id));
                    if !all_responded {
                        bad_indices.insert(i);
                    }
                }
            }
        } else if msg.role == "tool" {
            // Orphaned tool message — no matching assistant tool_call
            let caller_exists = messages.iter().enumerate().any(|(j, m)| {
                j < i
                    && m.role == "assistant"
                    && m.tool_calls
                        .as_ref()
                        .is_some_and(|tcs| {
                            tcs.iter().any(|tc| {
                                tc.id == msg.tool_call_id.as_deref().unwrap_or("")
                            })
                        })
            });
            if !caller_exists {
                bad_indices.insert(i);
            }
        }
    }

    // Phase 3: also strip tool messages that reference bad assistant indices
    // (an assistant with unresponded calls → its tool responses are also bad)
    for (i, msg) in messages.iter().enumerate() {
        if msg.role == "tool" {
            if let Some(ref tcid) = msg.tool_call_id {
                let caller_is_bad = messages.iter().enumerate().any(|(j, m)| {
                    j < i
                        && m.role == "assistant"
                        && m.tool_calls
                            .as_ref()
                            .is_some_and(|tcs| tcs.iter().any(|tc| &tc.id == tcid))
                        && bad_indices.contains(&j)
                });
                if caller_is_bad {
                    bad_indices.insert(i);
                }
            }
        }
    }

    messages
        .iter()
        .enumerate()
        .filter(|(i, _)| !bad_indices.contains(i))
        .map(|(_, m)| m.clone())
        .collect()
}

fn build_openai_messages(params: &ChatParams) -> Vec<Value> {
    let sanitized = sanitize_history(&params.messages);
    let mut msgs = Vec::new();
    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            msgs.push(json!({"role": "system", "content": sys}));
        }
    }
    for msg in &sanitized {
        let mut m = json!({"role": msg.role, "content": msg.content});
        if let Some(tcs) = &msg.tool_calls {
            if !tcs.is_empty() {
                let calls: Vec<Value> = tcs.iter().map(|tc| json!({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": tc.args.to_string(),
                    }
                })).collect();
                m["tool_calls"] = json!(calls);
            }
        }
        if let Some(ref tid) = msg.tool_call_id {
            m["tool_call_id"] = json!(tid);
        }
        // OpenAI requires tool-role messages to carry a tool_call_id — a
        // malformed one would be rejected as a 400.
        if msg.role == "tool" && m.get("tool_call_id").is_none() {
            continue;
        }
        msgs.push(m);
    }
    msgs
}

/// Build an Anthropic messages request body.
fn build_anthropic_request(
    params: &ChatParams,
    include_tools: bool,
    stream: bool,
) -> Value {
    let mut body = json!({
        "model": params.model,
        "messages": build_anthropic_messages(params),
        "stream": stream,
        "max_tokens": params.max_tokens.unwrap_or(4096),
    });

    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            body["system"] = json!(sys);
        }
    }
    if let Some(t) = params.temperature { body["temperature"] = json!(t); }
    if let Some(p) = params.top_p { body["top_p"] = json!(p); }
    if let Some(s) = &params.stop_sequences { body["stop_sequences"] = json!(s); }

    if include_tools {
        let defs = all_tool_definitions(params);
        let tools: Vec<Value> = defs.iter().map(|t| json!({
            "name": t.name,
            "description": t.description,
            "input_schema": gemini_parameters(&t.input_schema),
        })).collect();
        body["tools"] = json!(tools);
    }

    body
}

fn build_anthropic_messages(params: &ChatParams) -> Vec<Value> {
    let sanitized = sanitize_history(&params.messages);
    let mut msgs = Vec::new();
    for msg in &sanitized {
        if msg.role == "system" { continue; }
        if msg.role == "tool" {
            // A tool_result must reference a tool_use block by id — skip
            // malformed messages instead of sending `tool_use_id: null`.
            let Some(tool_use_id) = msg.tool_call_id.as_deref() else { continue; };
            msgs.push(json!({
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": tool_use_id, "content": msg.content}]
            }));
            continue;
        }
        let mut content: Vec<Value> = Vec::new();
        if !msg.content.is_empty() {
            content.push(json!({"type": "text", "text": msg.content}));
        }
        if let Some(tcs) = &msg.tool_calls {
            for tc in tcs {
                content.push(json!({
                    "type": "tool_use",
                    "id": tc.id,
                    "name": tc.name,
                    "input": tc.args,
                }));
            }
        }
        // Anthropic rejects empty content arrays — drop messages with neither
        // text nor tool_use blocks.
        if content.is_empty() { continue; }
        msgs.push(json!({"role": msg.role, "content": content}));
    }
    msgs
}

/// Build a Gemini request body.
fn build_gemini_request(
    params: &ChatParams,
    include_tools: bool,
    _stream: bool,
) -> Value {
    let mut body = json!({
        "contents": build_gemini_contents(params),
    });

    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            body["system_instruction"] = json!({"parts": [{"text": sys}]});
        }
    }
    let mut config = json!({});
    if let Some(t) = params.temperature { config["temperature"] = json!(t); }
    if let Some(m) = params.max_tokens { config["maxOutputTokens"] = json!(m); }
    if let Some(p) = params.top_p { config["topP"] = json!(p); }
    if let Some(k) = params.top_k { config["topK"] = json!(k); }
    if !config.as_object().map_or(true, |o| o.is_empty()) {
        body["generationConfig"] = config;
    }

    if include_tools {
        let defs = all_tool_definitions(params);
        let funcs: Vec<Value> = defs.iter().map(|t| json!({
            "name": t.name,
            "description": t.description,
            "parameters": gemini_parameters(&t.input_schema),
        })).collect();
        body["tools"] = json!([{"function_declarations": funcs}]);
    }

    body
}

/// Normalize a tool input schema into the JSON-Schema shape Gemini requires.
/// Gemini rejects function declarations whose `parameters` is an empty object,
/// lacks a `type`, or has a `properties` that isn't an object.
fn gemini_parameters(schema: &Value) -> Value {
    let Some(obj) = schema.as_object() else {
        return json!({"type": "object", "properties": {}});
    };
    let mut out = obj.clone();
    if out.get("type").and_then(|t| t.as_str()).is_none() {
        out.insert("type".into(), json!("object"));
    }
    if !out.contains_key("properties") {
        out.insert("properties".into(), json!({}));
    } else if !out.get("properties").unwrap().is_object() {
        out.insert("properties".into(), json!({}));
    }
    Value::Object(out)
}

fn build_gemini_contents(params: &ChatParams) -> Vec<Value> {
    let sanitized = sanitize_history(&params.messages);
    let mut contents = Vec::new();
    for (idx, msg) in sanitized.iter().enumerate() {
        if msg.role == "system" { continue; }
        let gemini_role = match msg.role.as_str() {
            "assistant" => "model",
            // Gemini v1beta only accepts "user" and "model" roles.
            // Function responses must be sent as "user" with functionResponse parts.
            "tool" => "user",
            r => r,
        };

        let mut parts: Vec<Value> = Vec::new();
        if !msg.content.is_empty() {
            parts.push(json!({"text": msg.content}));
        }
        if let Some(tcs) = &msg.tool_calls {
            for tc in tcs {
                parts.push(json!({
                    "functionCall": {"name": tc.name, "args": tc.args}
                }));
            }
        }
        if msg.tool_call_id.is_some() {
            let name = msg.tool_call_name.as_deref().unwrap_or_else(|| {
                // Fallback: look back through previous messages for the matching
                // tool call with this ID to extract the function name.
                params.messages[..idx]
                    .iter()
                    .rev()
                    .find(|m| {
                        m.tool_calls
                            .as_ref()
                            .is_some_and(|tcs| tcs.iter().any(|tc| tc.id == *msg.tool_call_id.as_deref().unwrap_or_default()))
                    })
                    .and_then(|m| m.tool_calls.as_ref())
                    .and_then(|tcs| tcs.iter().find(|tc| tc.id == *msg.tool_call_id.as_deref().unwrap_or_default()))
                    .map(|tc| tc.name.as_str())
                    .unwrap_or_default()
            });
            if name.is_empty() {
                // An empty functionResponse name is rejected by Gemini. If the
                // function name can't be resolved (e.g. the originating tool
                // call was pruned from history), degrade to plain text instead
                // of failing the whole request.
                parts.push(json!({"text": msg.content}));
            } else {
                parts.push(json!({
                    "functionResponse": {"name": name, "response": {"result": msg.content}}
                }));
            }
        }

        contents.push(json!({"role": gemini_role, "parts": parts}));
    }
    contents
}

// ── Response parsers ────────────────────────────────────────────────────────

/// Parse an OpenAI/Grok SSE response for text deltas.
/// Tool call accumulation by index is handled by the caller.
fn parse_openai_sse_line(
    data: &str,
) -> Option<ChatEvent> {
    if data == "[DONE]" {
        return None;
    }
    let json: Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return None,
    };

    // OpenAI/Grok may return API errors as SSE events (HTTP 200 with an
    // `error` object in the body). Surface them instead of dropping the line.
    if let Some(err) = json["error"].as_object() {
        let message = err.get("message").and_then(|v| v.as_str())
            .unwrap_or("Unknown OpenAI API error");
        return Some(ChatEvent::Error { message: format!("OpenAI API error: {message}") });
    }

    let choice = json["choices"].as_array()?.first()?;

    let delta = &choice["delta"];
    let finish = choice["finish_reason"].as_str();

    if let Some(text) = delta["content"].as_str() {
        if !text.is_empty() {
            return Some(ChatEvent::Token { content: text.to_string() });
        }
    }

    if let Some(reason) = finish {
        if !reason.is_empty() && reason != "null" {
            return Some(ChatEvent::Done {
                finish_reason: Some(reason.to_string()),
                usage: None,
            });
        }
    }

    None
}

/// Intermediate accumulator for streaming tool call deltas.
/// Arguments arrive as partial JSON fragments across multiple SSE deltas
/// and must be concatenated before parsing.
struct ToolCallDelta {
    id: String,
    name: String,
    args_buf: String,
}

/// Parse and accumulate tool call deltas from an OpenAI/Grok SSE line.
/// OpenAI sends tool calls across multiple deltas (index-based), so the
/// caller must accumulate partial JSON arguments by index.
fn parse_openai_tool_deltas(
    data: &str,
    accumulator: &mut Vec<ToolCallDelta>,
) {
    let json: Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return,
    };
    let choice = match json["choices"].as_array().and_then(|a| a.first()) {
        Some(c) => c,
        None => return,
    };
    let delta = &choice["delta"];
    let tcs = match delta["tool_calls"].as_array() {
        Some(t) => t,
        None => return,
    };

    for tc in tcs {
        let idx = tc["index"].as_i64().unwrap_or(0) as usize;
        let id = tc["id"].as_str().unwrap_or("").to_string();
        let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
        let args_str = tc["function"]["arguments"].as_str().unwrap_or("");

        if idx < accumulator.len() {
            if !id.is_empty() {
                accumulator[idx].id = id;
            }
            if !name.is_empty() {
                accumulator[idx].name = name;
            }
            if !args_str.is_empty() {
                accumulator[idx].args_buf.push_str(args_str);
            }
        } else {
            accumulator.push(ToolCallDelta {
                id,
                name,
                args_buf: args_str.to_string(),
            });
        }
    }
}

/// Parse an Anthropic SSE line for text deltas and tool use blocks.
/// Tool call blocks are accumulated in the provided Vec by index.
fn parse_anthropic_sse_line(
    event_type: &str,
    data: &str,
    tool_accumulator: &mut Vec<(usize, String, String, String)>,
) -> Option<ChatEvent> {
    let json: Value = serde_json::from_str(data).ok()?;

    match event_type {
        "content_block_start" => {
            if json["content_block"]["type"].as_str() == Some("tool_use") {
                let idx = json["index"].as_i64().unwrap_or(0) as usize;
                let id = json["content_block"]["id"].as_str().unwrap_or("").to_string();
                let name = json["content_block"]["name"].as_str().unwrap_or("").to_string();
                // Initial input from content_block_start (may be empty, completed by input_json_delta)
                let initial_args = json["content_block"]["input"]
                    .as_object()
                    .map(|obj| serde_json::to_string(obj).unwrap_or_default())
                    .unwrap_or_default();
                tool_accumulator.push((idx, id, name, initial_args));

                // Don't emit ToolCall yet — wait for content_block_stop to accumulate complete args
            }
        }
        "content_block_delta" => {
            if json["delta"]["type"].as_str() == Some("text_delta") {
                if let Some(text) = json["delta"]["text"].as_str() {
                    if !text.is_empty() {
                        return Some(ChatEvent::Token { content: text.to_string() });
                    }
                }
            }
            // Accumulate partial JSON for tool_use input blocks
            if json["delta"]["type"].as_str() == Some("input_json_delta") {
                let idx = json["index"].as_i64().unwrap_or(0) as usize;
                if let Some(partial) = json["delta"]["partial_json"].as_str() {
                    if let Some(entry) = tool_accumulator.iter_mut().find(|(i, _, _, _)| *i == idx) {
                        entry.3.push_str(partial);
                    }
                }
            }
        }
        "content_block_stop" => {
            // Finalize tool call — parse accumulated JSON and emit
            let idx = json["index"].as_i64().unwrap_or(0) as usize;
            if let Some(pos) = tool_accumulator.iter().position(|(i, _, _, _)| *i == idx) {
                let (_, id, name, args_str) = tool_accumulator.remove(pos);
                let args: Value = match serde_json::from_str(&args_str) {
                    Ok(v) => v,
                    Err(e) => {
                        return Some(ChatEvent::Error {
                            message: format!(
                                "Anthropic returned malformed tool arguments for '{name}': {e}"
                            ),
                        });
                    }
                };
                return Some(ChatEvent::ToolCall {
                    id,
                    name,
                    args,
                    auto_execute: true,
                });
            }
        }
        "message_delta" => {
            let stop = json["delta"]["stop_reason"].as_str();
            return Some(ChatEvent::Done {
                finish_reason: stop.map(|s| s.to_string()),
                usage: if json["usage"].is_null() || json["usage"].as_object().map_or(true, |o| o.is_empty()) {
                    None
                } else {
                    Some(UsageInfo {
                        input_tokens: json["usage"]["input_tokens"].as_u64(),
                        output_tokens: json["usage"]["output_tokens"].as_u64(),
                    })
                },
            });
        }
        "message_stop" => {
            // Already handled by message_delta, just ignore
        }
        _ => {}
    }
    None
}

/// Parse a Gemini SSE line for text and function calls.
fn parse_gemini_sse_line(
    data: &str,
) -> Option<ChatEvent> {
    if data == "[DONE]" { return None; }
    let json: Value = serde_json::from_str(data).ok()?;

    // Gemini may return API errors as SSE events (HTTP 200 with error in body).
    // Surface them instead of silently dropping the SSE line.
    if let Some(error_obj) = json["error"].as_object() {
        let message = error_obj.get("message").and_then(|v| v.as_str()).unwrap_or("Unknown Gemini API error");
        return Some(ChatEvent::Error { message: format!("Gemini API error: {message}") });
    }

    let candidate = json["candidates"].as_array()?.first()?;

    // Check finish reason
    if let Some(reason) = candidate["finishReason"].as_str() {
        if !reason.is_empty() && reason != "STOP" {
            return Some(ChatEvent::Done {
                finish_reason: Some(reason.to_string()),
                usage: if json["usageMetadata"].is_null() {
                    None
                } else {
                    Some(UsageInfo {
                        input_tokens: json["usageMetadata"]["promptTokenCount"].as_u64(),
                        output_tokens: json["usageMetadata"]["candidatesTokenCount"].as_u64(),
                    })
                },
            });
        }
    }

    let parts = candidate["content"]["parts"].as_array()?;
    for part in parts {
        if let Some(text) = part["text"].as_str() {
            if !text.is_empty() {
                return Some(ChatEvent::Token { content: text.to_string() });
            }
        }
        if let Some(fc) = part["functionCall"].as_object() {
            let name = fc.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let args = fc.get("args").cloned().unwrap_or(json!({}));
            return Some(ChatEvent::ToolCall {
                id: Uuid::new_v4().to_string(),
                name: name.to_string(),
                args,
                auto_execute: true,
            });
        }
    }
    None
}

// ── HTTP client helpers ────────────────────────────────────────────────────

use std::sync::LazyLock;

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        // SSE streams can run for minutes, but a stalled stream should
        // eventually time out to prevent hanging indefinitely.
        .timeout(std::time::Duration::from_secs(300))
        .tcp_keepalive(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("reqwest::Client::builder() should always succeed with these settings")
});

fn http_client() -> &'static reqwest::Client {
    &HTTP_CLIENT
}

// ── Streaming functions ────────────────────────────────────────────────────

/// Stream a chat response through the given sender.
/// Handles the tool-calling loop automatically.
pub async fn stream_chat(
    params: ChatParams,
    pool: SqlitePool,
    app: AppHandle,
    tx: UnboundedSender<ChatEvent>,
) -> Result<(), String> {
    let provider = params.provider.to_lowercase();
    let api_key = params.api_key.clone();
    let base_url = params.base_url.clone();
    let enable_tools = params.enable_tools.unwrap_or(true) && provider_supports_tools(&provider);

    // Validate all messages before processing
    for (i, msg) in params.messages.iter().enumerate() {
        msg.validate().map_err(|e| format!("Message at index {i}: {e}"))?;
    }

    // We run the tool loop: up to 10 rounds to prevent infinite loops
    let mut current_messages = params.messages.clone();
    let max_rounds = 10;

    for round in 0..max_rounds {
        // Sanitize history before every API call — strip orphaned tool_calls
        // and tool messages that the memory system didn't save correctly.
        current_messages = sanitize_history(&current_messages);

        let chat_params = ChatParams {
            messages: current_messages.clone(),
            enable_tools: Some(enable_tools && round < max_rounds - 1),
            ..params.clone()
        };

        // Send the request
        let response = match provider.as_str() {
            "chatgpt" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_codex_request(&chat_params, include_tools, true);
                send_codex_stream(&chat_params, &base_url, body, &tx).await?
            }
            "openai" | "grok" | "openrouter" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_openai_request(&chat_params, include_tools, true);
                send_openai_stream(&chat_params, &api_key, &base_url, body, &tx).await?
            }
            "anthropic" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_anthropic_request(&chat_params, include_tools, true);
                send_anthropic_stream(&chat_params, &api_key, &base_url, body, &tx).await?
            }
            "gemini" => {
                let include_tools = enable_tools && round < max_rounds - 1;
                let body = build_gemini_request(&chat_params, include_tools, true);
                send_gemini_stream(&chat_params, &api_key, &base_url, body, &tx).await?
            }
            "ollama" => {
                let body = build_openai_request(&chat_params, false, true);
                send_ollama_stream(&chat_params, &base_url, body, &tx).await?
            }
            _ => return Err(format!("Unknown provider: {provider}")),
        };

        // Check if there was a tool call to process
        match response {
            StreamResult::Done => return Ok(()),
            StreamResult::ToolCalls { text, calls } => {
                let defs = all_tool_definitions(&chat_params);
                let mut executed: Vec<(ToolCall, Result<Value, String>)> = Vec::new();
                let mut any_auto = false;

                for tc in &calls {
                    let def = defs.iter().find(|d| d.name == tc.name);
                    let auto_execute = def.map(|d| d.auto_execute).unwrap_or(true);
                    if auto_execute { any_auto = true; }

                    tx.send(ChatEvent::ToolCall {
                        id: tc.id.clone(),
                        name: tc.name.clone(),
                        args: tc.args.clone(),
                        auto_execute,
                    }).ok();

                    if !auto_execute {
                        continue;
                    }

                    let result = execute_tool(&pool, &app, &tc.name, &tc.args).await;
                    match &result {
                        Ok(value) => {
                            tx.send(ChatEvent::ToolResult {
                                id: tc.id.clone(),
                                name: tc.name.clone(),
                                result: value.clone(),
                                is_error: false,
                            }).ok();
                        }
                        Err(e) => {
                            tx.send(ChatEvent::ToolResult {
                                id: tc.id.clone(),
                                name: tc.name.clone(),
                                result: json!({"error": e}),
                                is_error: true,
                            }).ok();
                        }
                    }
                    executed.push((tc.clone(), result));
                }

                // All calls require user approval — surface them and stop this
                // round; a follow-up request (after approval) continues.
                if !any_auto {
                    // Still add the assistant message + placeholder tool responses
                    // so the message history stays valid for the next API call.
                    if !calls.is_empty() {
                        current_messages.push(ChatMessage {
                            role: "assistant".into(),
                            content: text,
                            tool_calls: Some(calls.clone()),
                            tool_call_id: None,
                            tool_call_name: None,
                            created_at: None,
                        });
                        for tc in &calls {
                            current_messages.push(ChatMessage {
                                role: "tool".into(),
                                content: "Tool requires user approval and has not been executed yet. Call this tool again after approval.".into(),
                                tool_calls: None,
                                tool_call_id: Some(tc.id.clone()),
                                tool_call_name: Some(tc.name.clone()),
                                created_at: None,
                            });
                        }
                    }
                    tx.send(ChatEvent::Done { finish_reason: Some("tool_use".into()), usage: None }).ok();
                    return Ok(());
                }

                if !executed.is_empty() {
                    // Persist ONE assistant message carrying the text the model
                    // emitted this round plus all its tool calls, followed by
                    // one tool message per result. Grouping keeps the message
                    // history valid for every provider (assistant tool_calls
                    // must pair with the tool results that follow).
                    current_messages.push(ChatMessage {
                        role: "assistant".into(),
                        content: text,
                        tool_calls: Some(executed.iter().map(|(tc, _)| tc.clone()).collect()),
                        tool_call_id: None,
                        tool_call_name: None,
                        created_at: None,
                    });
                    for (tc, result) in executed {
                        let content = match result {
                            Ok(value) => truncate_tool_result(value.to_string()),
                            Err(e) => format!("Error: {e}"),
                        };
                        current_messages.push(ChatMessage {
                            role: "tool".into(),
                            content,
                            tool_calls: None,
                            tool_call_id: Some(tc.id.clone()),
                            tool_call_name: Some(tc.name.clone()),
                            created_at: None,
                        });
                    }
                }

                continue;
            }
            // Error events are sent through the channel directly; no StreamResult::Error variant needed.
        }
    }

    tx.send(ChatEvent::Done { finish_reason: Some("max_turns".into()), usage: None }).ok();
    Ok(())
}

enum StreamResult {
    Done,
    ToolCalls { text: String, calls: Vec<ToolCall> },
}

async fn send_openai_stream(
    _params: &ChatParams,
    api_key: &Option<String>,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let key = api_key.as_deref().ok_or_else(|| "No API key for OpenAI/Grok".to_string())?;
    let client = http_client();
    let url = format!("{}/chat/completions", base_url.as_deref().unwrap_or("https://api.openai.com/v1"));

    let resp = client.post(&url)
        .header("Authorization", format!("Bearer {key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut tool_call_deltas: Vec<ToolCallDelta> = Vec::new();
    let mut emitted_text = String::new();

    'stream: while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if !line.starts_with("data: ") { continue; }

            let data = &line[6..];
            if data == "[DONE]" { break 'stream; }

            // Accumulate tool call deltas by index (OpenAI sends partial arguments across chunks)
            parse_openai_tool_deltas(data, &mut tool_call_deltas);

            if let Some(event) = parse_openai_sse_line(data) {
                match event {
                    ChatEvent::Token { content } => {
                        emitted_text.push_str(&content);
                        tx.send(ChatEvent::Token { content }).ok();
                    }
                    ChatEvent::Done { .. } => {
                        if tool_call_deltas.is_empty() {
                            tx.send(event).ok();
                            return Ok(StreamResult::Done);
                        }
                    }
                    ChatEvent::Error { .. } => {
                        tx.send(event).ok();
                        return Err("OpenAI stream aborted by API error".to_string());
                    }
                    _ => {}
                }
            }
        }
    }

    if !tool_call_deltas.is_empty() {
        // Parse complete arguments from accumulated raw strings
        let mut tool_calls: Vec<ToolCall> = Vec::with_capacity(tool_call_deltas.len());
        for d in tool_call_deltas {
            let args: Value = match serde_json::from_str(&d.args_buf) {
                Ok(v) => v,
                Err(e) => {
                    return Err(format!(
                        "OpenAI returned malformed tool call arguments for '{}': {e}",
                        d.name
                    ));
                }
            };
            tool_calls.push(ToolCall { id: d.id, name: d.name, args });
        }
        Ok(StreamResult::ToolCalls { text: emitted_text, calls: tool_calls })
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

async fn send_anthropic_stream(
    _params: &ChatParams,
    api_key: &Option<String>,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let key = api_key.as_deref().ok_or_else(|| "No API key for Anthropic".to_string())?;
    let client = http_client();
    let url = format!("{}/messages", base_url.as_deref().unwrap_or("https://api.anthropic.com/v1"));

    let resp = client.post(&url)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Anthropic returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut current_event = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();
    let mut emitted_text = String::new();
    // Anthropic sends tool_use input as structured JSON across content_block_start → input_json_delta → content_block_stop
    let mut tool_accumulator: Vec<(usize, String, String, String)> = Vec::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
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
                if let Some(event) = parse_anthropic_sse_line(&current_event, data, &mut tool_accumulator) {
                    match event {
                        ChatEvent::Token { content } => {
                            emitted_text.push_str(&content);
                            tx.send(ChatEvent::Token { content }).ok();
                        }
                        ChatEvent::ToolCall { id, name, args, .. } => {
                            tool_calls.push(ToolCall { id, name, args });
                        }
                        ChatEvent::Done { .. } => {
                            if tool_calls.is_empty() {
                                tx.send(event).ok();
                                return Ok(StreamResult::Done);
                            }
                        }
                        ChatEvent::Error { .. } => {
                            tx.send(event).ok();
                            return Err("Anthropic stream aborted by API error".to_string());
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        Ok(StreamResult::ToolCalls { text: emitted_text, calls: tool_calls })
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

async fn send_gemini_stream(
    params: &ChatParams,
    api_key: &Option<String>,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let key = api_key.as_deref().ok_or_else(|| "No API key for Gemini".to_string())?;
    let client = http_client();
    let base = base_url.as_deref().unwrap_or("https://generativelanguage.googleapis.com/v1beta");
    let url = format!("{base}/models/{model}:streamGenerateContent?alt=sse&key={key}", model = params.model);

    let resp = client.post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Gemini returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();
    let mut emitted_text = String::new();

    'stream: while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if !line.starts_with("data: ") { continue; }

            let data = &line[6..];
            if data == "[DONE]" { break 'stream; }

            if let Some(event) = parse_gemini_sse_line(data) {
                match event {
                    ChatEvent::Token { content } => {
                        emitted_text.push_str(&content);
                        tx.send(ChatEvent::Token { content }).ok();
                    }
                    ChatEvent::ToolCall { id, name, args, .. } => {
                        tool_calls.push(ToolCall { id, name, args });
                    }
                    ChatEvent::Done { .. } => {
                        if tool_calls.is_empty() {
                            tx.send(event).ok();
                            return Ok(StreamResult::Done);
                        }
                    }
                    ChatEvent::Error { .. } => {
                        tx.send(event).ok();
                        return Err("Gemini stream aborted by API error".to_string());
                    }
                    _ => {}
                }
            }
        }
    }

    if !tool_calls.is_empty() {
        Ok(StreamResult::ToolCalls { text: emitted_text, calls: tool_calls })
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

async fn send_ollama_stream(
    _params: &ChatParams,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let client = http_client();
    let url = format!("{}/api/chat", base_url.as_deref().unwrap_or("http://localhost:11434"));

    let resp = client.post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Ollama returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut emitted_text = String::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if line.is_empty() { continue; }
            if let Ok(json) = serde_json::from_str::<Value>(&line) {
                if let Some(token) = json["message"]["content"].as_str() {
                    if !token.is_empty() {
                        emitted_text.push_str(token);
                        tx.send(ChatEvent::Token { content: token.to_string() }).ok();
                    }
                }
                if json.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                    tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
                    return Ok(StreamResult::Done);
                }
            }
        }
    }

    tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
    Ok(StreamResult::Done)
}

// ── Codex (ChatGPT) provider ──────────────────────────────────────────────

/// Build a Codex Responses API request body from ChatParams.
fn build_codex_request(
    params: &ChatParams,
    include_tools: bool,
    stream: bool,
) -> Value {
    let mut input = Vec::new();

    if let Some(sys) = &params.system {
        if !sys.is_empty() {
            input.push(json!({
                "type": "message",
                "role": "developer",
                "content": sys,
            }));
        }
    }

    for msg in &params.messages {
        // The Responses API has no "tool" role — tool outputs are standalone
        // `function_call_output` items and tool calls are standalone
        // `function_call` items, each keyed by call id.
        match msg.role.as_str() {
            "tool" => {
                let call_id = msg.tool_call_id.clone().unwrap_or_default();
                if call_id.is_empty() {
                    continue;
                }
                input.push(json!({
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": msg.content,
                }));
            }
            "assistant" => {
                input.push(json!({
                    "type": "message",
                    "role": "assistant",
                    "content": msg.content,
                }));
                if let Some(tcs) = &msg.tool_calls {
                    for tc in tcs {
                        input.push(json!({
                            "type": "function_call",
                            "id": tc.id,
                            "name": tc.name,
                            "arguments": tc.args.to_string(),
                        }));
                    }
                }
            }
            _ => {
                input.push(json!({
                    "type": "message",
                    "role": msg.role,
                    "content": msg.content,
                }));
            }
        }
    }

    let mut body = json!({
        "model": params.model,
        "input": input,
        "stream": stream,
    });

    if let Some(t) = params.max_tokens { body["max_output_tokens"] = json!(t); }
    if let Some(t) = params.temperature { body["temperature"] = json!(t); }
    if let Some(p) = params.top_p { body["top_p"] = json!(p); }

    if include_tools {
        let defs = all_tool_definitions(params);
        let tools: Vec<Value> = defs.iter().map(|t| json!({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": gemini_parameters(&t.input_schema),
            }
        })).collect();
        body["tools"] = json!(tools);
        body["tool_choice"] = json!("auto");
    }

    body
}

/// Send a Codex SSE stream request and parse events.
///
/// Codex SSE uses named events (`event:` + `data:` lines) instead of
/// OpenAI's bare `data:` lines. The key events:
///   - `response.text.delta` — text token delta
///   - `response.function_call_arguments.delta` — tool call argument delta  
///   - `response.output_item.added` — new output item (message or function_call)
///   - `response.output_item.done` — output item complete
///   - `response.done` — response complete (includes full output)
async fn send_codex_stream(
    params: &ChatParams,
    base_url: &Option<String>,
    body: Value,
    tx: &UnboundedSender<ChatEvent>,
) -> Result<StreamResult, String> {
    let url = format!("{}/responses", base_url.as_deref().unwrap_or("http://localhost:3001/api"));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let mut req = client.post(&url).header("Content-Type", "application/json");
    if let Some(ref cookie) = params.cookie {
        req = req.header("Cookie", cookie);
    }
    let resp = req
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Codex request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Codex proxy returned {status}: {text}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut current_event = String::new();
    let mut tool_calls: Vec<ToolCall> = Vec::new();
    let mut emitted_text = String::new();
    // Track partial tool call arguments across deltas
    let mut partial_tool_args: std::collections::HashMap<String, (String, String)> = std::collections::HashMap::new();

    while let Some(chunk_result) = futures::StreamExt::next(&mut stream).await {
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
                    Err(_) => {
                        current_event.clear();
                        continue;
                    }
                };

                match current_event.as_str() {
                    "response.text.delta" => {
                        if let Some(delta) = json["data"]["delta"].as_str() {
                            if !delta.is_empty() {
                                emitted_text.push_str(delta);
                                tx.send(ChatEvent::Token { content: delta.to_string() }).ok();
                            }
                        }
                    }
                    "response.output_item.added" => {
                        let item_type = json["data"]["type"].as_str().unwrap_or("");
                        if item_type == "function_call" {
                            let id = json["data"]["id"].as_str().unwrap_or("").to_string();
                            let name = json["data"]["name"].as_str().unwrap_or("").to_string();
                            let args = json["data"]["arguments"].as_str().unwrap_or("");
                            let trimmed = "".to_string();
                            let args_str = trimmed + args;
                            partial_tool_args.insert(id.clone(), (name, args_str));
                            tool_calls.push(ToolCall {
                                id,
                                name: String::new(),
                                args: json!(""),
                            });
                        }
                    }
                    "response.function_call_arguments.delta" => {
                        if let Some(id) = json["data"]["id"].as_str() {
                            if let Some(delta) = json["data"]["delta"].as_str() {
                                if let Some((ref name, ref mut args)) = partial_tool_args.get_mut(id) {
                                    args.push_str(delta);
                                    // Update the corresponding tool call
                                    if let Some(tc) = tool_calls.iter_mut().find(|t| t.id == id) {
                                        tc.name = name.clone();
                                        if let Ok(parsed) = serde_json::from_str::<Value>(args) {
                                            tc.args = parsed;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    "response.output_item.done" => {
                        let item_type = json["data"]["type"].as_str().unwrap_or("");
                        if item_type == "function_call" {
                            if let Some(id) = json["data"]["id"].as_str() {
                                // Finalize args from JSON if we have partial accumulation
                                if let Some((name, full_args)) = partial_tool_args.remove(id) {
                                    if let Some(tc) = tool_calls.iter_mut().find(|t| t.id == id) {
                                        tc.name = name;
                                        if let Ok(parsed) = serde_json::from_str::<Value>(&full_args) {
                                            tc.args = parsed;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    "response.done" => {
                        // Check the done event for tool calls in the output
                        if !tool_calls.is_empty() {
                            return Ok(StreamResult::ToolCalls { text: emitted_text, calls: tool_calls });
                        }
                        // Also check output for tool calls
                        if let Some(output) = json["data"]["output"].as_array() {
                            for item in output {
                                if item["type"] == "function_call" {
                                    let id = item["id"].as_str().unwrap_or("").to_string();
                                    let name = item["name"].as_str().unwrap_or("").to_string();
                                    let args_str = item["arguments"].as_str().unwrap_or("{}");
                                    let args = match serde_json::from_str(args_str) {
                                        Ok(v) => v,
                                        Err(e) => {
                                            return Err(format!(
                                                "Codex returned malformed tool arguments for '{name}': {e}"
                                            ));
                                        }
                                    };
                                    tool_calls.push(ToolCall { id, name, args });
                                }
                            }
                            if !tool_calls.is_empty() {
                                return Ok(StreamResult::ToolCalls { text: emitted_text, calls: tool_calls });
                            }
                        }
                        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
                        return Ok(StreamResult::Done);
                    }
                    "error" => {
                        let msg = json["message"].as_str().unwrap_or("Codex API error");
                        tx.send(ChatEvent::Error { message: msg.to_string() }).ok();
                        return Err(msg.to_string());
                    }
                    _ => {}
                }
                current_event.clear();
            }
        }
    }

    // Stream ended without a response.done event
    if !tool_calls.is_empty() {
        Ok(StreamResult::ToolCalls { text: emitted_text, calls: tool_calls })
    } else {
        tx.send(ChatEvent::Done { finish_reason: Some("stop".into()), usage: None }).ok();
        Ok(StreamResult::Done)
    }
}

/// Perform a non-streaming chat completion.
/// Uses the streaming engine internally for full tool-calling support.
pub async fn complete_chat(
    params: ChatParams,
    pool: SqlitePool,
    app: AppHandle,
) -> Result<String, String> {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ChatEvent>();

    let stream_params = ChatParams {
        enable_tools: Some(params.enable_tools.unwrap_or(false)),
        ..params
    };

    let error_tx = tx.clone();
    tokio::spawn(async move {
        if let Err(e) = stream_chat(stream_params, pool, app, tx).await {
            eprintln!("[ai] complete_chat error: {e}");
            let _ = error_tx.send(ChatEvent::Error { message: e });
        }
    });

    let mut text = String::new();
    while let Some(event) = rx.recv().await {
        match event {
            ChatEvent::Token { content } => text.push_str(&content),
            ChatEvent::Error { message } => return Err(message),
            ChatEvent::Done { .. } => return Ok(text),
            _ => {}
        }
    }
    Err("Chat stream ended without completion".to_string())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_role_valid() {
        for role in &["user", "assistant", "system", "tool"] {
            let msg = ChatMessage {
                role: role.to_string(),
                content: "hello".into(),
                tool_calls: None,
                tool_call_id: None,
                tool_call_name: None,
                created_at: None,
            };
            assert!(msg.validate().is_ok());
        }
    }

    #[test]
    fn test_validate_role_invalid() {
        for role in &["assistent", "model", "function", ""] {
            let msg = ChatMessage {
                role: role.to_string(),
                content: "hello".into(),
                tool_calls: None,
                tool_call_id: None,
                tool_call_name: None,
                created_at: None,
            };
            assert!(msg.validate().is_err());
        }
    }

    #[test]
    fn test_validate_role_empty_content() {
        let msg = ChatMessage {
            role: "user".into(),
            content: "".into(),
            tool_calls: None,
            tool_call_id: None,
            tool_call_name: None,
            created_at: None,
        };
        assert!(msg.validate().is_ok());
    }

    #[test]
    fn test_provider_supports_tools() {
        assert!(super::provider_supports_tools("openai"));
        assert!(super::provider_supports_tools("anthropic"));
        assert!(super::provider_supports_tools("gemini"));
        assert!(super::provider_supports_tools("grok"));
        assert!(super::provider_supports_tools("chatgpt"));
        assert!(!super::provider_supports_tools("ollama"));
        assert!(!super::provider_supports_tools("unknown"));
    }

    #[test]
    fn test_default_tool_definitions_are_valid() {
        let defs = super::default_tool_definitions();
        assert!(!defs.is_empty());
        for tool in defs {
            assert!(!tool.name.is_empty(), "Tool name should not be empty");
            assert!(!tool.description.is_empty(), "Tool {} description should not be empty", tool.name);
            assert_eq!(tool.input_schema["type"], "object", "Tool {} input_schema should be object", tool.name);
        }
    }

    #[test]
    fn test_openai_tool_delta_accumulation() {
        // Simulate two chunks for the same tool call at index 0
        let mut acc: Vec<ToolCall> = Vec::new();

        // Chunk 1: id + name + empty args
        parse_openai_tool_deltas(
            r#"{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_tasks","arguments":""}}]}}]}"#,
            &mut acc,
        );
        assert_eq!(acc.len(), 1);
        assert_eq!(acc[0].id, "call_1");
        assert_eq!(acc[0].name, "get_tasks");

        // Chunk 2: partial args (no id/name)
        parse_openai_tool_deltas(
            r#"{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"status\":\"pending\"}"}}]}}]}"#,
            &mut acc,
        );
        assert_eq!(acc.len(), 1, "Should not add new entry for existing index");
        assert_eq!(acc[0].args["status"], "pending");
    }

    #[test]
    fn test_openai_tool_delta_multiple_calls() {
        let mut acc: Vec<ToolCall> = Vec::new();

        // Two tool calls in one chunk
        parse_openai_tool_deltas(
            r#"{"choices":[{"index":0,"delta":{"tool_calls":[
                {"index":0,"id":"call_1","function":{"name":"get_tasks","arguments":""}},
                {"index":1,"id":"call_2","function":{"name":"create_task","arguments":"{\"title\":\"test\"}"}}
            ]}}]}"#,
            &mut acc,
        );
        assert_eq!(acc.len(), 2);
        assert_eq!(acc[0].name, "get_tasks");
        assert_eq!(acc[1].name, "create_task");
        assert_eq!(acc[1].args["title"], "test");
    }

    #[test]
    fn test_anthropic_tool_accumulation_across_events() {
        // Simulate content_block_start → input_json_delta → content_block_stop
        let mut emitter: Vec<(usize, String, String, String)> = Vec::new();

        // Start
        assert!(parse_anthropic_sse_line(
            "content_block_start",
            r#"{"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"get_tasks","input":{}}}"#,
            &mut emitter,
        ).is_none());
        assert_eq!(emitter.len(), 1);
        assert_eq!(emitter[0].1, "toolu_1");
        assert_eq!(emitter[0].2, "get_tasks");

        // Delta
        assert!(parse_anthropic_sse_line(
            "content_block_delta",
            r#"{"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"status\":\"pending\"}"}}"#,
            &mut emitter,
        ).is_none());
        assert_eq!(emitter[0].3, "{\"status\":\"pending\"}");

        // Stop should emit ToolCall with accumulated args
        let event = parse_anthropic_sse_line(
            "content_block_stop",
            r#"{"type":"content_block_stop","index":0}"#,
            &mut emitter,
        ).expect("Should emit ToolCall on content_block_stop");
        assert!(emitter.is_empty(), "Accumulator should be cleared after stop");

        match event {
            ChatEvent::ToolCall { id, name, args, .. } => {
                assert_eq!(id, "toolu_1");
                assert_eq!(name, "get_tasks");
                assert_eq!(args["status"], "pending");
            }
            _ => panic!("Expected ToolCall event"),
        }
    }
}
