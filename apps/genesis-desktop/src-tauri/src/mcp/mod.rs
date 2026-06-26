use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum McpMethod {
    #[serde(rename = "ping")]
    Ping,
    #[serde(rename = "creative.plan")]
    CreativePlan,
    #[serde(rename = "workspace.health")]
    WorkspaceHealth,
}

impl McpMethod {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Ping => "ping",
            Self::CreativePlan => "creative.plan",
            Self::WorkspaceHealth => "workspace.health",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct McpRequest {
    pub id: String,
    pub method: McpMethod,
    #[serde(default)]
    pub params: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct McpError {
    pub code: i32,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct McpResponse {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<McpError>,
}

pub fn handle_request(request: McpRequest) -> McpResponse {
    let result = match request.method.as_str() {
        "ping" => Some(json!({ "message": "pong", "source": "bento-mcp" })),
        "creative.plan" => Some(json!({
            "status": "ready",
            "steps": [
                "Capture brief",
                "Draft scene direction",
                "Generate visual assets",
                "Review consistency",
                "Prepare export package"
            ]
        })),
        "workspace.health" => Some(json!({
            "connected": true,
            "runtime": "local-sidecar",
            "transport": "stdio-jsonrpc"
        })),
        _ => None,
    };

    match result {
        Some(value) => McpResponse {
            id: request.id,
            result: Some(value),
            error: None,
        },
        None => McpResponse {
            id: request.id,
            result: None,
            error: Some(McpError {
                code: -32601,
                message: format!("Unknown MCP method: {}", request.method.as_str()),
            }),
        },
    }
}


