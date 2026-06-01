# Genesis Desktop

## Development

```bash
bun install
bun run type-check
bun run tauri dev
```

`bun run tauri dev` now uses the cached `target/debug/genesis-desktop.exe` binary plus the Vite dev server, so the hot-reload loop does not block on Rust compilation.
Set `GENESIS_DESKTOP_ALLOW_RUST_BUILD=1` if you need to force a fresh Rust rebuild during development.

## Production Build

```bash
bun run build
bun run tauri build
```

## Environment

Desktop-only variables live in [`apps/genesis-desktop/.env.example`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop.env.example). This app does not read from the web app env files.

Required runtime values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MASTRA_URL`

Signing values are documented in [`apps/genesis-desktop/SIGNING.md`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\SIGNING.md).

## Theme And Shell

- Theme tokens live in [`src/lib/data/themes.ts`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src\lib\data\themes.ts).
- Shell tokens live in [`src/lib/shell-theme.ts`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src\lib\shell-theme.ts).
- [`src/lib/stores/theme.store.ts`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src\lib\stores\theme.store.ts) persists theme and mode to `localStorage`.
- [`src/app.html`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src\app.html) pre-applies the saved theme before Svelte mounts.
- [`src/lib/components/WindowShell.svelte`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src\lib\components\WindowShell.svelte) renders the custom titlebar.
- [`src/lib/components/RuntimeBridge.svelte`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src\lib\components\RuntimeBridge.svelte) applies theme variables, handles deep links, starts the MCP sidecar, and checks for updates.
