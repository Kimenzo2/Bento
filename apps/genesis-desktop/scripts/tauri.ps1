$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot

# Load .env file into the current process environment so the Rust binary
# (which does NOT auto-read .env like Vite does) can access VITE_SUPABASE_URL etc.
$envFilePath = Join-Path $appRoot ".env"
if (Test-Path $envFilePath) {
  Get-Content $envFilePath | Where-Object { $_ -match "^\s*[^#]\S+=.+" } | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Count -eq 2) {
      $key   = $parts[0].Trim()
      $value = $parts[1].Trim()
      [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
  Write-Host "Loaded .env from $envFilePath" -ForegroundColor DarkGray
}
$srcTauri = Join-Path $appRoot "src-tauri"
$cargoBin = Join-Path $HOME ".cargo" "bin"
$skipVcpkgBootstrap = $env:GENESIS_DESKTOP_SKIP_VCPKG_BOOTSTRAP -eq "1"
$isWindowsPlatform = $env:OS -eq "Windows_NT"
$allowRustBuild = $env:GENESIS_DESKTOP_ALLOW_RUST_BUILD -eq "1"
$isRelease = $args -contains "build"
$isDev = ($args -contains "dev") -and (-not $isRelease)

$pathSep = if ($isWindowsPlatform) { ";" } else { ":" }

if (-not ($env:PATH -split $pathSep | Where-Object { $_ -eq $cargoBin })) {
  $env:PATH = "$cargoBin$pathSep$env:PATH"
}

if ($isWindowsPlatform) {
  $gitUsrBin = "C:\Program Files\Git\usr\bin"
  $llvmBin = "C:\Program Files\LLVM\bin"

  if ((Test-Path $gitUsrBin) -and -not ($env:PATH -split $pathSep | Where-Object { $_ -eq $gitUsrBin })) {
    $env:PATH = "$gitUsrBin$pathSep$env:PATH"
  }

  if ((Test-Path (Join-Path $llvmBin "lld-link.exe")) -and -not ($env:PATH -split $pathSep | Where-Object { $_ -eq $llvmBin })) {
    $env:PATH = "$llvmBin$pathSep$env:PATH"
  }
}

if ($isWindowsPlatform -and -not $skipVcpkgBootstrap) {
  & (Join-Path $appRoot "scripts" "setup-vcpkg.ps1")
}

function Start-GenesisFrontend {
  $frontendListenPort = 1420
  $hasFrontendListener = Get-NetTCPConnection -LocalPort $frontendListenPort -State Listen -ErrorAction SilentlyContinue
  if ($hasFrontendListener) {
    return
  }

  Start-Process -WindowStyle Hidden -FilePath bun -ArgumentList @("run", "dev:frontend") -WorkingDirectory $appRoot | Out-Null

  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Get-NetTCPConnection -LocalPort $frontendListenPort -State Listen -ErrorAction SilentlyContinue) {
      return
    }

    Start-Sleep -Milliseconds 250
  }

  throw "The frontend dev server did not start on port 1420."
}

function Assert-CachedRustBinaryFresh {
  param(
    [string]$BinaryPath
  )

  $binary = Get-Item -LiteralPath $BinaryPath -ErrorAction Stop
  $trackedInputs = @(
    (Join-Path $srcTauri "Cargo.toml"),
    (Join-Path $srcTauri "Cargo.lock"),
    (Join-Path $srcTauri "tauri.conf.json")
  )

  $rustSources = Get-ChildItem -Path (Join-Path $srcTauri "src") -Recurse -File -Include *.rs -ErrorAction Stop
  $newerInput = @($trackedInputs | Where-Object { (Test-Path $_) -and ((Get-Item -LiteralPath $_).LastWriteTimeUtc -gt $binary.LastWriteTimeUtc) })
  $newerSource = @($rustSources | Where-Object { $_.LastWriteTimeUtc -gt $binary.LastWriteTimeUtc })

  if ($newerInput.Count -gt 0 -or $newerSource.Count -gt 0) {
    throw "Cached Rust binary is stale. Run `$env:GENESIS_DESKTOP_ALLOW_RUST_BUILD='1'; bun run tauri dev once to rebuild, then return to bun run dev for frontend-only hot reload."
  }
}

if ($isDev -and -not $allowRustBuild) {
  $desktopBinary = Join-Path $srcTauri "target\debug\genesis-desktop.exe"

  if (-not (Test-Path $desktopBinary)) {
    throw "Cached desktop binary not found at $desktopBinary. Run a full build once, or set GENESIS_DESKTOP_ALLOW_RUST_BUILD=1 for a rebuild."
  }

  Assert-CachedRustBinaryFresh -BinaryPath $desktopBinary
  Start-GenesisFrontend
  & $desktopBinary
  exit $LASTEXITCODE
}

& bunx tauri @args
exit $LASTEXITCODE
