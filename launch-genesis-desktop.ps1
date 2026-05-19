# Genesis Desktop App Launcher
# Full startup sequence for Tauri + SvelteKit desktop application

$ErrorActionPreference = "Continue"

$appRoot = "C:\Users\admin\.codex\worktrees\genesis-desktop\apps\genesis-desktop"
$projectRoot = "C:\Users\admin\.codex\worktrees\genesis-desktop"

Write-Host "=== Genesis Desktop Launcher ===" -ForegroundColor Cyan
Write-Host "App Root: $appRoot" -ForegroundColor Yellow
Write-Host ""

# Ensure we're in the app directory
Set-Location $appRoot
Write-Host "Changed to: $(Get-Location)" -ForegroundColor Green

# Check if node_modules exists, if not install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Cyan
    & bun install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Dependency installation failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Starting Genesis Desktop Development Server..." -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:1420" -ForegroundColor Yellow
Write-Host "Tauri window will launch when ready" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

# Launch the development environment
& bun run tauri dev
