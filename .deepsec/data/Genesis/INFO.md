# Genesis (Bento)

## What this codebase does

Bento is a personal life-OS desktop app (Tauri v2 + SvelteKit + SQLite/SQLCipher). It tracks tasks, notes, habits, mood, sleep, meals, focus sessions, passwords, budget, nutrition, and health. Exposes all data via a local MCP server (localhost:14872) for AI agent integration. Supabase-hosted auth with optional cloud backup.

## Auth shape

- `AuthManager` (Rust `src-tauri/src/auth.rs`) — manages Supabase OAuth PKCE flow via OS keyring
- `bootstrap()` / `current_valid_session()` / `try_refresh_session()` — session lifecycle
- `StoredAuthSession` — plain JSON at `{data_dir}/session.json` with access+refresh tokens
- `McpAuthToken` — 32-byte random hex token written to `{data_dir}/mcp-server.json` (no expiry)
- `CryptoService` (Rust `src-tauri/src/crypto.rs`) — Argon2id master password deriving SQLCipher key, salt stored in keyring
- `byok_save_key` / `byok_delete_key` — user-configured API keys (OpenAI, Anthropic, Gemini, xAI, Ollama) stored in OS keyring

## Threat model

- **Local attacker** with filesystem access: `session.json` exposes Supabase tokens; `mcp-server.json` exposes full data access via MCP API; unencrypted clipboard history stored on disk
- **Network attacker** from same machine: MCP server binds to `127.0.0.1:14872` with no TLS, bearer token must be discovered
- **Prompt injection via AI**: AI responses rendered as markdown via `{@html}` in MarkdownBlock.svelte — pre-escaped but depends on `marked` not breaking HTML entities
- **Credential leakage**: API keys, master password passed as bare `String` over Tauri IPC — visible in memory dumps

## Project-specific patterns to flag

1. **Audio recording path traversal**: `RecordingEngine` constructs path as `{data_dir}/recordings/{module_id}/{uuid}.wav` — `module_id` from IPC unsanitized
2. **`playback_start` arbitrary file read**: Rust command takes bare `filePath: String` from IPC, no path validation
3. **Dynamic SQL table names**: `format!("DELETE FROM \"{escaped}\"")` in `db.rs` with only `"` escaping — used in `purge_local_user_content`
4. **MCP discovery file**: `mcp-server.json` written to `{data_dir}` with bearer token and URL, persists on crash (only deleted on clean shutdown)
5. **Service-role key in keyring**: `cloud_backup.rs` stores Supabase service_role key for admin operations (account deletion via `delete_account` command)

## Known false-positives

- `byok/settings.rs` — stores user API keys in OS keyring (intended, best practice)
- `src-tauri/src/mcp/tools/` — all MCP tools are intentionally designe to expose data to local AI agents
- `auth.rs` line 33-34 — `BUNDLED_SUPABASE_URL` / `BUNDLED_SUPABASE_ANON_KEY` are public JWT credentials for Supabase client SDK, not secrets
- `src/lib/markdown/repairMarkdown.ts` — `escapeMarkdownHtml()` pre-escapes HTML before markdown parsing; `{@html}` usage is the intended rendering path
- `clipboard/clipboard.css`, `nutrition/App.svelte` unused CSS sections — dead code, not vulnerabilities
