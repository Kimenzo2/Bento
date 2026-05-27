use rmcp::{tool, tool_router, transport::stdio, ServiceExt};
use tokio::runtime::Builder;

#[derive(Clone)]
struct BentoMcp;

#[tool_router(server_handler)]
impl BentoMcp {
    #[tool(description = "Respond with a simple MCP heartbeat.")]
    fn ping(&self) -> String {
        serde_json::json!({
            "message": "pong",
            "source": "bento-mcp"
        })
        .to_string()
    }

    #[tool(description = "Return the static creative planning scaffold used by Bento Desktop.")]
    fn creative_plan(&self) -> String {
        serde_json::json!({
            "status": "ready",
            "steps": [
                "Capture brief",
                "Draft scene direction",
                "Generate visual assets",
                "Review consistency",
                "Prepare export package"
            ]
        })
        .to_string()
    }

    #[tool(description = "Report local workspace health for the MCP sidecar.")]
    fn workspace_health(&self) -> String {
        serde_json::json!({
            "connected": true,
            "runtime": "local-sidecar",
            "transport": "stdio-jsonrpc"
        })
        .to_string()
    }
}

fn main() {
    let runtime = Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap_or_else(|error| {
            eprintln!("bento-mcp failed to initialize runtime: {error}");
            std::process::exit(1);
        });

    if let Err(error) = runtime.block_on(async {
        let service = BentoMcp.serve(stdio()).await?;
        service.waiting().await?;
        Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
    }) {
        eprintln!("bento-mcp failed: {error}");
        std::process::exit(1);
    }
}
