# fast-setup.ps1 — run ONCE as Administrator to get ~100x faster builds on Windows
# Usage:  Start-Process powershell -Verb RunAs -ArgumentList "-File fast-setup.ps1"

param([string]$ProjectDir = $PSScriptRoot)

Write-Host "`n=== Genesis Fast Build Setup ===" -ForegroundColor Cyan

# ── 1. Windows Defender exclusions ────────────────────────────────────────────
Write-Host "`n[1/4] Adding Windows Defender exclusions..." -ForegroundColor Yellow

$excludePaths = @(
    $ProjectDir,
    "$ProjectDir\node_modules",
    "$ProjectDir\dist",
    "$ProjectDir\.vite",
    "$env:APPDATA\npm",
    "$env:APPDATA\npm-cache",
    "$env:LOCALAPPDATA\npm-cache",
    "$env:LOCALAPPDATA\Yarn",
    "$env:USERPROFILE\.vite",
    "C:\Program Files\nodejs",
    "C:\Program Files\Git\usr\bin"
)

$excludeProcs = @("node.exe", "npm.cmd", "npx.cmd", "vite.cmd", "tsc.cmd",
                  "esbuild.exe", "biome.exe", "tsx.cmd", "pnpm.cmd", "bun.exe")

foreach ($p in $excludePaths) {
    Add-MpPreference -ExclusionPath $p -ErrorAction SilentlyContinue
    Write-Host "  + Path: $p" -ForegroundColor Green
}
foreach ($proc in $excludeProcs) {
    Add-MpPreference -ExclusionProcess $proc -ErrorAction SilentlyContinue
    Write-Host "  + Process: $proc" -ForegroundColor Green
}

# ── 2. Set NODE_OPTIONS system-wide ───────────────────────────────────────────
Write-Host "`n[2/4] Setting NODE_OPTIONS..." -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable(
    "NODE_OPTIONS",
    "--max-old-space-size=8192 --max-semi-space-size=256",
    [System.EnvironmentVariableTarget]::User
)
Write-Host "  + NODE_OPTIONS = --max-old-space-size=8192 --max-semi-space-size=256" -ForegroundColor Green

# ── 3. Set UV_THREADPOOL_SIZE for faster libuv I/O ────────────────────────────
Write-Host "`n[3/4] Setting UV_THREADPOOL_SIZE..." -ForegroundColor Yellow
[System.Environment]::SetEnvironmentVariable("UV_THREADPOOL_SIZE", "16", [System.EnvironmentVariableTarget]::User)
Write-Host "  + UV_THREADPOOL_SIZE = 16" -ForegroundColor Green

# ── 4. Speed up PowerShell terminal startup ───────────────────────────────────
Write-Host "`n[4/4] Optimising PowerShell profile..." -ForegroundColor Yellow
$profileDir = Split-Path $PROFILE
if (-not (Test-Path $profileDir)) { New-Item -ItemType Directory -Path $profileDir -Force | Out-Null }
$speedupBlock = @'

# ── Genesis Fast Build additions ─────────────────────────────
$env:NODE_OPTIONS = "--max-old-space-size=8192 --max-semi-space-size=256"
$env:UV_THREADPOOL_SIZE = "16"
$env:FORCE_COLOR = "1"
# Jump to project quickly
function genesis { Set-Location "C:\Users\admin\Downloads\Genesis" }
function dev    { npm run dev:fast }
function build  { npm run build }
# ─────────────────────────────────────────────────────────────
'@
if (-not (Test-Path $PROFILE)) { New-Item -Path $PROFILE -Force | Out-Null }
$existing = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
if ($existing -notmatch "Genesis Fast Build") {
    Add-Content -Path $PROFILE -Value $speedupBlock
    Write-Host "  + Added shortcuts to PowerShell profile: $PROFILE" -ForegroundColor Green
} else {
    Write-Host "  (profile already updated)" -ForegroundColor Gray
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host "`n=== Setup complete! Restart VS Code / PowerShell to apply. ===" -ForegroundColor Cyan
Write-Host "   Benchmark: Measure-Command { node --version } should now be < 200ms" -ForegroundColor White
