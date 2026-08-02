# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$cargo = Join-Path $HOME ".cargo\bin\cargo.exe"

Push-Location $appRoot
try {
  bun run type-check
  & $cargo check --manifest-path .\src-tauri\Cargo.toml
  bun run build
  $env:GENESIS_DESKTOP_ALLOW_RUST_BUILD = "1"
  bun run tauri build
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-package-size.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\desktop-smoke.ps1
} finally {
  Pop-Location
}
