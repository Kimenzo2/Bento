$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$srcTauri = Join-Path $appRoot "src-tauri"
$maxBytes = 20MB
$paths = @(
  (Join-Path $srcTauri "target\release\genesis-desktop.exe"),
  (Join-Path $srcTauri "target\release\bundle")
)

$artifacts = @()
foreach ($path in $paths) {
  if (Test-Path $path -PathType Leaf) {
    $artifacts += Get-Item -LiteralPath $path
  } elseif (Test-Path $path -PathType Container) {
    $artifacts += Get-ChildItem -LiteralPath $path -Recurse -File | Where-Object {
      $_.Extension -in @(".exe", ".msi", ".dmg", ".pkg", ".appimage", ".deb", ".rpm", ".zip")
    }
  }
}

if ($artifacts.Count -eq 0) {
  throw "No packaged Genesis Desktop artifacts were found. Run the final Tauri build before the size gate."
}

$failures = @()
foreach ($artifact in $artifacts) {
  $sizeMb = [Math]::Round($artifact.Length / 1MB, 2)
  Write-Host ("{0} => {1} MB" -f $artifact.FullName, $sizeMb)
  if ($artifact.Length -gt $maxBytes) {
    $failures += ("{0} is {1} MB" -f $artifact.FullName, $sizeMb)
  }
}

if ($failures.Count -gt 0) {
  throw "Genesis Desktop package size cap failed. 20 MB max. Failures: $($failures -join '; ')"
}

Write-Host "Genesis Desktop package size gate passed." -ForegroundColor Green
