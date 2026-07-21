import express from "express";
import helmet from "helmet";
import { createChatGPTHandler } from "@opencoredev/loginwithchatgpt-server";

const PORT = parseInt(process.env.PORT || "3001", 10);
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:1420,tauri://localhost,bento://"
)
  .split(",")
  .map((s) => s.trim());

const app = express();

// Security headers
app.use(helmet());

// Manual CORS — no cors package needed, and avoids double-header conflicts
// with the Web-standard handler bridge below.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
  }
  next();
});

// JSON body parser
app.use(express.json({ limit: "1mb" }));

// ── ChatGPT OAuth + Codex proxy handler ──────────────────────────────────
// Uses `@opencoredev/loginwithchatgpt-server` which implements real Codex
// device-code OAuth so API calls run against the user's own ChatGPT plan.
const chatgpt = createChatGPTHandler({
  secret: process.env.CHATGPT_SESSION_SECRET,
  allowedOrigins: ALLOWED_ORIGINS,
});

// Bridge: Express req/res ↔ Web-standard Request/Response
// Mounted at /api/chatgpt/* to match the handler's default basePath.
app.all("/api/chatgpt/:path(*)", async (req, res) => {
  try {
    const scheme = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost";
    const url = new URL(req.originalUrl, `${scheme}://${host}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue;
      const lkey = key.toLowerCase();
      if (lkey === "host" || lkey === "connection") continue;
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    const body =
      req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined;

    const webRequest = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    const webResponse = await chatgpt.handler(webRequest);
    res.status(webResponse.status);

    webResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "set-cookie") {
        res.append("Set-Cookie", value);
      } else {
        res.setHeader(key, value);
      }
    });

    // Pipe streaming payloads (SSE from /responses)
    const contentType = webResponse.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream") && webResponse.body) {
      const reader = webResponse.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } finally {
        res.end();
      }
    } else {
      res.send(await webResponse.text());
    }
  } catch (err) {
    console.error("[chatgpt] handler error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
  }
});

// ── Health check ─────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "2.0.0", timestamp: Date.now() });
});

// ── Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[bento-proxy] server running on port ${PORT}`);
  console.log(`[bento-proxy] allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[bento-proxy] ChatGPT auth mounted at /api/chatgpt/`);
  console.log(`[bento-proxy] routes: /login /status /session /logout /models /responses`);
});
