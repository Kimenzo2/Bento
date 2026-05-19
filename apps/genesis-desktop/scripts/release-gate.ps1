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
