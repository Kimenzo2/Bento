import { z } from "zod";

export const genesisMastraConfig = {
  app: {
    id: "genesis-desktop",
    name: "Genesis Desktop",
  },
  memory: {
    provider: "local-first",
    namespace: "desktop-session",
  },
  agents: {
    creativeDirector: {
      name: "Genesis Creative Director",
      description: "Coordinates local-first story, visual, and export workflows for Genesis Desktop.",
      model: "local-orchestrator",
      instructions: [
        "Prefer local tools and cached assets before network access.",
        "Return concise structured steps for generation, review, and export.",
        "Hand off file or rendering work to MCP-backed tools when available.",
      ],
    },
  },
  tools: {
    exportPlanner: {
      description: "Prepare an export plan for print, viewer, or asset-pack delivery.",
      inputSchema: z.object({
        projectId: z.string(),
        target: z.enum(["print-pdf", "viewer", "asset-pack"]),
      }),
    },
    mcpBridge: {
      description: "Proxy a JSON-RPC call to the local Rust MCP sidecar.",
      inputSchema: z.object({
        method: z.string(),
        params: z.record(z.string(), z.unknown()).optional(),
      }),
    },
  },
} as const;

export type GenesisMastraConfig = typeof genesisMastraConfig;
