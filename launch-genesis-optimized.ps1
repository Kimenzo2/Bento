# Genesis Desktop - Optimized Launcher
# Compile with all performance optimizations enabled

param(
    [switch]$debug = $false,
    [switch]$verbose = $false
)

$appRoot = "C:\Users\admin\.codex\worktrees\genesis-desktop\apps\genesis-desktop"

Set-Location $appRoot

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Genesis Desktop - Optimized Build" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Clean previous builds for clean slate
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .svelte-kit, build, dist, "src-tauri\target"
Write-Host "✓ Cleaned" -ForegroundColor Green
Write-Host ""

# Kill any running processes
Write-Host "🛑 Stopping any running Genesis processes..." -ForegroundColor Yellow
Get-Process -Name "genesis-desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "cargo" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "bun" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Write-Host "✓ Processes stopped" -ForegroundColor Green
Write-Host ""

# Build command
$buildCmd = if ($debug) { "dev" } else { "build" }
$modeLabel = if ($debug) { "DEBUG (Fast Compile)" } else { "RELEASE (Optimized)" }

Write-Host "🔨 Building Genesis in $modeLabel mode..." -ForegroundColor Yellow
Write-Host "   Profile: Release Profile=3, LTO=true, Strip=true, Panic=abort" -ForegroundColor DarkGray
Write-Host "   Frontend: Code-split (@mastra, @gen-*, vendor), Minified (Terser)" -ForegroundColor DarkGray
Write-Host "   CSP: Enabled, Capabilities: Minimal" -ForegroundColor DarkGray
Write-Host ""

if ($buildCmd -eq "dev") {
    Write-Host "⚡ Starting dev server (will stay running)..." -ForegroundColor Cyan
    bun run tauri dev
} else {
    Write-Host "Building Vite bundle..." -ForegroundColor Cyan
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    bun run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Vite build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Vite bundle complete in $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Building Tauri app..." -ForegroundColor Cyan
    $tauriStart = [System.Diagnostics.Stopwatch]::StartNew()
    
    bun run tauri build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tauri build failed" -ForegroundColor Red
        exit 1
    }
    
    $tauriStart.Stop()
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ Build Complete!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Binary location:" -ForegroundColor Yellow
    Write-Host "  $appRoot\src-tauri\target\release\genesis-desktop.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Total build time: $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Yellow
    Write-Host ""
    
    # Launch the app
    Write-Host "🚀 Launching Genesis Desktop..." -ForegroundColor Cyan
    & "$appRoot\src-tauri\target\release\genesis-desktop.exe"
}
