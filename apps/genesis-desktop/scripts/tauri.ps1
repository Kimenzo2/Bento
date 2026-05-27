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
$cargoBin = Join-Path $HOME ".cargo\\bin"
$gitUsrBin = "C:\\Program Files\\Git\\usr\\bin"
$llvmBin = "C:\\Program Files\\LLVM\\bin"
$isWindowsPlatform = $env:OS -eq "Windows_NT"
$desktopBinary = Join-Path $srcTauri "target\\debug\\genesis-desktop.exe"
$allowRustBuild = $env:GENESIS_DESKTOP_ALLOW_RUST_BUILD -eq "1"
$isRelease = $args -contains "build"
$isDev = ($args -contains "dev") -and (-not $isRelease)

if (-not ($env:PATH -split ";" | Where-Object { $_ -eq $cargoBin })) {
  $env:PATH = "$cargoBin;$env:PATH"
}

if ((Test-Path $gitUsrBin) -and -not ($env:PATH -split ";" | Where-Object { $_ -eq $gitUsrBin })) {
  $env:PATH = "$gitUsrBin;$env:PATH"
}

if ((Test-Path (Join-Path $llvmBin "lld-link.exe")) -and -not ($env:PATH -split ";" | Where-Object { $_ -eq $llvmBin })) {
  $env:PATH = "$llvmBin;$env:PATH"
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

function Assert-CachedSidecarFresh {
  param(
    [string]$SidecarPath
  )

  if (-not (Test-Path $SidecarPath)) {
    throw "Cached MCP sidecar not found at $SidecarPath. Run `$env:GENESIS_DESKTOP_ALLOW_RUST_BUILD='1'; bun run tauri dev once to rebuild."
  }

  $sidecar = Get-Item -LiteralPath $SidecarPath
  $mcpSources = Get-ChildItem -Path (Join-Path $srcTauri "src\\mcp") -Recurse -File -Include *.rs -ErrorAction SilentlyContinue
  $newerSource = @($mcpSources | Where-Object { $_.LastWriteTimeUtc -gt $sidecar.LastWriteTimeUtc })

  if ($newerSource.Count -gt 0) {
    throw "Cached MCP sidecar is stale. Run `$env:GENESIS_DESKTOP_ALLOW_RUST_BUILD='1'; bun run tauri dev once to rebuild it."
  }
}

if ($isDev -and -not $allowRustBuild) {
  if (-not (Test-Path $desktopBinary)) {
    throw "Cached desktop binary not found at $desktopBinary. Run a full build once, or set GENESIS_DESKTOP_ALLOW_RUST_BUILD=1 for a rebuild."
  }

  $effectiveTargetForCache = (& rustc --print host-tuple).Trim()
  $cachedSidecarName = if ($isWindowsPlatform) { "bento-mcp-$effectiveTargetForCache.exe" } else { "bento-mcp-$effectiveTargetForCache" }
  $cachedSidecar = Join-Path $srcTauri "binaries\\$cachedSidecarName"
  Assert-CachedRustBinaryFresh -BinaryPath $desktopBinary
  Assert-CachedSidecarFresh -SidecarPath $cachedSidecar
  Start-GenesisFrontend
  & $desktopBinary
  exit $LASTEXITCODE
}

$requestedTarget = $env:CARGO_BUILD_TARGET
$env:CARGO_BUILD_JOBS = if ($isRelease -and [string]::IsNullOrWhiteSpace($env:CARGO_BUILD_JOBS)) {
  "2"
} elseif (-not $isRelease -and [string]::IsNullOrWhiteSpace($env:CARGO_BUILD_JOBS)) {
  "1"
} else {
  $env:CARGO_BUILD_JOBS
}
$effectiveTarget = if ($requestedTarget) { $requestedTarget } else { (& rustc --print host-tuple).Trim() }
$binaryName = if ($isWindowsPlatform) { "bento-mcp.exe" } else { "bento-mcp" }
$targetDir = if ($isRelease) { "release" } else { "debug" }
$outputDir = Join-Path $srcTauri "binaries"
$outputBinary = if ($isWindowsPlatform) {
  Join-Path $outputDir ("bento-mcp-{0}.exe" -f $effectiveTarget)
} else {
  Join-Path $outputDir ("bento-mcp-{0}" -f $effectiveTarget)
}
$forceRebuild = $env:GENESIS_DESKTOP_FORCE_MCP_REBUILD -eq "1"
$shouldBuildSidecar = $isRelease -or $forceRebuild -or -not (Test-Path $outputBinary)

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

if ($shouldBuildSidecar) {
  if (-not (Test-Path $outputBinary)) {
    New-Item -ItemType File -Path $outputBinary -Force | Out-Null
  }

  $cargoArgs = @(
    "build",
    "--manifest-path",
    (Join-Path $srcTauri "Cargo.toml"),
    "--bin",
    "bento-mcp"
  )

  if ($requestedTarget) {
    $cargoArgs += @("--target", $requestedTarget)
  }

  if ($isRelease) {
    $cargoArgs += "--release"
  }

  & cargo @cargoArgs
  if ($LASTEXITCODE -ne 0) {
    throw "cargo build for bento-mcp failed with exit code $LASTEXITCODE"
  }

  $builtBinary = if ($requestedTarget) {
    Join-Path $srcTauri ("target\{0}\{1}\{2}" -f $requestedTarget, $targetDir, $binaryName)
  } else {
    Join-Path $srcTauri ("target\{0}\{1}" -f $targetDir, $binaryName)
  }

  $shouldCopy = $true
  if (Test-Path $outputBinary) {
    try {
      $builtHash = (Get-FileHash -LiteralPath $builtBinary -Algorithm SHA256).Hash
      $outputHash = (Get-FileHash -LiteralPath $outputBinary -Algorithm SHA256).Hash
      $shouldCopy = $builtHash -ne $outputHash
    } catch {
      # Fall through to overwrite if hashing fails for any reason.
      $shouldCopy = $true
    }
  }

  if ($shouldCopy) {
    Copy-Item -LiteralPath $builtBinary -Destination $outputBinary -Force
  }
} else {
  Write-Host "Using cached bento-mcp sidecar: $outputBinary" -ForegroundColor DarkGreen
}

& bunx tauri @args
exit $LASTEXITCODE
