**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Genesis Desktop Signing

Windows:

- `GENESIS_DESKTOP_WINDOWS_CERTIFICATE_THUMBPRINT`: certificate thumbprint used by the Windows signing config
- `GENESIS_DESKTOP_WINDOWS_SIGN_COMMAND`: optional external signing command for CI services such as Azure Trusted Signing; the wrapper parses the command line and launches the resolved executable directly instead of shelling out through `cmd.exe`
- `GENESIS_DESKTOP_WINDOWS_TIMESTAMP_URL`: optional RFC 3161 timestamp server for the local Windows signing wrapper
- `TAURI_WINDOWS_SIGNTOOL_PATH`: optional path to `signtool.exe` when the local wrapper signs via the Windows SDK

macOS:

- `APPLE_SIGNING_IDENTITY`: Developer ID Application or App Store signing identity
- `APPLE_PROVIDER_SHORT_NAME`: provider short name when the Apple account requires it
- `APPLE_CERTIFICATE`: base64-encoded certificate payload for CI import
- `APPLE_CERTIFICATE_PASSWORD`: certificate password
- `APPLE_API_ISSUER`: App Store Connect issuer ID for notarization
- `APPLE_API_KEY`: App Store Connect key ID
- `APPLE_API_KEY_PATH`: path to the downloaded App Store Connect private key

Config files:

- [`src-tauri/tauri.conf.json`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src-tauri\tauri.conf.json)
- [`src-tauri/tauri.windows.conf.json`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src-tauri\tauri.windows.conf.json)
- [`src-tauri/tauri.macos.conf.json`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src-tauri\tauri.macos.conf.json)
- [`src-tauri/scripts/sign-windows.ps1`](C:\Users\admin.codex\worktrees\genesis-desktop\apps\genesis-desktop\src-tauri\scripts\sign-windows.ps1)

The platform files are placeholders. The Windows bundle uses `src-tauri/scripts/sign-windows.ps1` so CI can inject a full signing command or a thumbprint-based `signtool` path through environment variables before `bun run release:windows`.
