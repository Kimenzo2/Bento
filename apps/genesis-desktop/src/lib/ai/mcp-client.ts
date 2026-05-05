import { z } from "zod";
import { invoke } from "@tauri-apps/api/core";

const mcpMethodSchema = z.enum(["ping", "creative.plan", "workspace.health"]);
const mcpRequestSchema = z
  .object({
    id: z.string().min(1).max(128),
    method: mcpMethodSchema,
    params: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type McpSidecarStatus = {
  started: boolean;
  pid?: number;
  command: string;
};

export type McpRequest = {
  id: string;
  method: z.infer<typeof mcpMethodSchema>;
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
  const parsedRequest = mcpRequestSchema.parse(request);
  return invoke<McpResponse>("send_mcp_request", { request: parsedRequest });
}
