$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$srcTauri = Join-Path $appRoot "src-tauri"
$cargoBin = Join-Path $HOME ".cargo\\bin"
$llvmBin = "C:\\Program Files\\LLVM\\bin"
$isWindowsPlatform = $env:OS -eq "Windows_NT"

if (-not ($env:PATH -split ";" | Where-Object { $_ -eq $cargoBin })) {
  $env:PATH = "$cargoBin;$env:PATH"
}

if ((Test-Path (Join-Path $llvmBin "lld-link.exe")) -and -not ($env:PATH -split ";" | Where-Object { $_ -eq $llvmBin })) {
  $env:PATH = "$llvmBin;$env:PATH"
}

$isRelease = $args -contains "build"
$requestedTarget = $env:CARGO_BUILD_TARGET
$env:CARGO_BUILD_JOBS = if ($isRelease -and [string]::IsNullOrWhiteSpace($env:CARGO_BUILD_JOBS)) {
  "2"
} elseif (-not $isRelease -and [string]::IsNullOrWhiteSpace($env:CARGO_BUILD_JOBS)) {
  "1"
} else {
  $env:CARGO_BUILD_JOBS
}
$effectiveTarget = if ($requestedTarget) { $requestedTarget } else { (& rustc --print host-tuple).Trim() }
$binaryName = if ($isWindowsPlatform) { "genesis-mcp.exe" } else { "genesis-mcp" }
$targetDir = if ($isRelease) { "release" } else { "debug" }
$outputDir = Join-Path $srcTauri "binaries"
$outputBinary = if ($isWindowsPlatform) {
  Join-Path $outputDir ("genesis-mcp-{0}.exe" -f $effectiveTarget)
} else {
  Join-Path $outputDir ("genesis-mcp-{0}" -f $effectiveTarget)
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
    "genesis-mcp"
  )

  if ($requestedTarget) {
    $cargoArgs += @("--target", $requestedTarget)
  }

  if ($isRelease) {
    $cargoArgs += "--release"
  }

  & cargo @cargoArgs
  if ($LASTEXITCODE -ne 0) {
    throw "cargo build for genesis-mcp failed with exit code $LASTEXITCODE"
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
  Write-Host "Using cached genesis-mcp sidecar: $outputBinary" -ForegroundColor DarkGreen
}

& bunx tauri @args
exit $LASTEXITCODE
