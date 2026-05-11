$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$srcTauri = Join-Path $appRoot "src-tauri"
$binary = Join-Path $srcTauri "target\debug\genesis-desktop.exe"
$frontendProcess = $null

function Ensure-Frontend {
  $listener = Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    return
  }

  $script:frontendProcess = Start-Process -WindowStyle Hidden -FilePath bun -ArgumentList @("run", "dev:frontend") -WorkingDirectory $appRoot -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(30)

  while ([DateTime]::UtcNow -lt $deadline) {
    $listener = Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
      return
    }

    Start-Sleep -Milliseconds 250
  }

  throw "Frontend dev server did not start on port 1420 for smoke testing."
}

function Assert-BinaryFresh {
  $desktopBinary = Get-Item -LiteralPath $binary -ErrorAction Stop
  $inputs = @(
    (Join-Path $srcTauri "Cargo.toml"),
    (Join-Path $srcTauri "Cargo.lock"),
    (Join-Path $srcTauri "tauri.conf.json")
  )
  $rustSources = Get-ChildItem -Path (Join-Path $srcTauri "src") -Recurse -File -Include *.rs -ErrorAction Stop
  $newerInputs = @($inputs | Where-Object { (Test-Path $_) -and ((Get-Item -LiteralPath $_).LastWriteTimeUtc -gt $desktopBinary.LastWriteTimeUtc) })
  $newerSources = @($rustSources | Where-Object { $_.LastWriteTimeUtc -gt $desktopBinary.LastWriteTimeUtc })

  if ($newerInputs.Count -gt 0 -or $newerSources.Count -gt 0) {
    throw "Cached debug binary is stale. Run the final Rust/Tauri build before desktop smoke."
  }
}

function Assert-Config {
  $config = Get-Content -Raw -Path (Join-Path $srcTauri "tauri.conf.json") | ConvertFrom-Json
  $window = $config.app.windows | Where-Object { $_.label -eq "main" } | Select-Object -First 1

  if (-not $window) { throw "Missing main Tauri window config." }
  if ($window.visible -ne $false) { throw "Main window must start with visible=false." }
  if ($window.center -ne $true) { throw "Main window must use center=true." }
  if ($window.resizable -ne $true) { throw "Main window must remain resizable." }
  if ($window.decorations -ne $false) { throw "Main window must use custom decorations=false." }
  if ($window.shadow -ne $true) { throw "Main window must keep shadow=true for resize affordances." }

  $capabilities = Get-Content -Raw -Path (Join-Path $srcTauri "capabilities\default.json") | ConvertFrom-Json
  $permissions = @($capabilities.permissions | ForEach-Object {
    if ($_ -is [string]) { $_ } else { $_.identifier }
  })

  foreach ($required in @(
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-start-dragging",
    "global-shortcut:allow-register",
    "global-shortcut:allow-unregister",
    "notification:default",
    "updater:default",
    "window-state:default"
  )) {
    if ($permissions -notcontains $required) {
      throw "Missing required Tauri capability permission: $required"
    }
  }
}

function Assert-WindowsLaunch {
  if ($env:OS -ne "Windows_NT") {
    Write-Host "Runtime launch smoke is skipped on this non-Windows host. Run this script on macOS too before claiming macOS confidence." -ForegroundColor Yellow
    return
  }

  if (-not (Test-Path $binary)) {
    throw "Cached debug binary not found at $binary. Run the final Rust/Tauri build before launch smoke."
  }

  Assert-BinaryFresh
  Ensure-Frontend
  $process = Start-Process -FilePath $binary -WorkingDirectory $appRoot -PassThru
  try {
    Start-Sleep -Seconds 4
    if ($process.HasExited) {
      throw "Genesis Desktop exited during launch smoke with code $($process.ExitCode)."
    }
  } finally {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
    }
  }
}

Assert-Config
try {
  Assert-WindowsLaunch
  Write-Host "Genesis Desktop smoke gate completed." -ForegroundColor Green
} finally {
  if ($frontendProcess -and -not $frontendProcess.HasExited) {
    Stop-Process -Id $frontendProcess.Id -Force
  }
}
