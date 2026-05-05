import { invoke } from "@tauri-apps/api/core";

export type McpSidecarStatus = {
  started: boolean;
  pid?: number;
  command: string;
};

export type McpRequest = {
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

export type McpResponse = {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
};

export async function startMcpSidecar(): Promise<McpSidecarStatus> {
  return invoke<McpSidecarStatus>("start_mcp_sidecar");
}

export async function sendMcpRequest(request: McpRequest): Promise<McpResponse> {
  return invoke<McpResponse>("send_mcp_request", { request });
}
