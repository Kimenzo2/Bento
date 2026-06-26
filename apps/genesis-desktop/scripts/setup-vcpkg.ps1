$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $scriptRoot
$vcpkgCommit = "e1dfb369fc1c6e58d5850cf67c224caa955309e5"
$vcpkgTriplet = "x64-windows-static-md"

function Get-VcpkgRoot {
  if (-not [string]::IsNullOrWhiteSpace($env:VCPKG_ROOT)) {
    return $env:VCPKG_ROOT
  }

  $defaultRoot = Join-Path $env:LOCALAPPDATA "Genesis\vcpkg"
  return $defaultRoot
}

function Get-VcpkgCacheDir {
  if (-not [string]::IsNullOrWhiteSpace($env:VCPKG_BINARY_SOURCES_CACHE)) {
    return $env:VCPKG_BINARY_SOURCES_CACHE
  }

  return (Join-Path $env:LOCALAPPDATA "Genesis\vcpkg-bincache")
}

function Find-LibClangPath {
  $libclang = Get-ChildItem -Path "C:\Program Files\LLVM\bin", "C:\Program Files (x86)\LLVM\bin" -Filter libclang.dll -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $libclang) {
    return $null
  }

  return $libclang.Directory.FullName
}

$vcpkgRoot = Get-VcpkgRoot
$vcpkgCacheDir = Get-VcpkgCacheDir
$vcpkgExe = Join-Path $vcpkgRoot "vcpkg.exe"
$tripletRoot = Join-Path $vcpkgRoot "installed\$vcpkgTriplet"
$includeRoot = Join-Path $tripletRoot "include"
$libRoot = Join-Path $tripletRoot "lib"

New-Item -ItemType Directory -Force -Path $vcpkgCacheDir | Out-Null

if (-not (Test-Path $vcpkgRoot)) {
  Write-Host "Cloning vcpkg into $vcpkgRoot" -ForegroundColor DarkGray
  git clone https://github.com/microsoft/vcpkg.git $vcpkgRoot
}

Push-Location $vcpkgRoot
try {
  git checkout $vcpkgCommit | Out-Null
  & "$vcpkgRoot\bootstrap-vcpkg.bat" -disableMetrics
  # vcpkg's sqlcipher port supports fts5/json1/geopoly/tool.
  # rtree is compiled into the port by default, so there is no rtree feature flag.
  & $vcpkgExe install "sqlcipher[fts5,json1]:$vcpkgTriplet" --binarysource="clear;files,$vcpkgCacheDir,readwrite"
} finally {
  Pop-Location
}

if (-not (Test-Path (Join-Path $tripletRoot "include\sqlcipher\sqlite3.h"))) {
  throw "vcpkg did not install sqlite3.h under $tripletRoot\\include\\sqlcipher"
}

[System.Environment]::SetEnvironmentVariable("VCPKG_ROOT", $vcpkgRoot, "Process")
[System.Environment]::SetEnvironmentVariable("VCPKG_DEFAULT_TRIPLET", $vcpkgTriplet, "Process")
[System.Environment]::SetEnvironmentVariable("VCPKG_TARGET_TRIPLET", $vcpkgTriplet, "Process")
[System.Environment]::SetEnvironmentVariable("VCPKGRS_TRIPLET", $vcpkgTriplet, "Process")
[System.Environment]::SetEnvironmentVariable("VCPKG_BINARY_SOURCES", "clear;files,$vcpkgCacheDir,readwrite", "Process")
[System.Environment]::SetEnvironmentVariable("VCPKGRS_DYNAMIC", "0", "Process")
[System.Environment]::SetEnvironmentVariable("SQLCIPHER_STATIC", "1", "Process")
[System.Environment]::SetEnvironmentVariable("SQLCIPHER_INCLUDE_DIR", $includeRoot, "Process")
[System.Environment]::SetEnvironmentVariable("SQLCIPHER_LIB_DIR", $libRoot, "Process")
$libclangPath = Find-LibClangPath
if ($libclangPath) {
  [System.Environment]::SetEnvironmentVariable("LIBCLANG_PATH", $libclangPath, "Process")
}

$installedBin = Join-Path $tripletRoot "bin"
if ((Test-Path $installedBin) -and -not ($env:PATH -split ";" | Where-Object { $_ -eq $installedBin })) {
  $env:PATH = "$installedBin;$env:PATH"
}

Write-Host "vcpkg SQLCipher ready in $vcpkgRoot" -ForegroundColor DarkGreen
