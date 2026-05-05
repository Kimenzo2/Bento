$ErrorActionPreference = "Stop"

$binaryPath = $args[0]
if ([string]::IsNullOrWhiteSpace($binaryPath)) {
  throw "Windows signing requires the bundle path as the first argument."
}

$customCommand = $env:GENESIS_DESKTOP_WINDOWS_SIGN_COMMAND
if (-not [string]::IsNullOrWhiteSpace($customCommand)) {
  $expandedCommand = $customCommand.Replace('%1', ('"' + $binaryPath + '"'))
  & cmd /c $expandedCommand
  exit $LASTEXITCODE
}

$thumbprint = $env:GENESIS_DESKTOP_WINDOWS_CERTIFICATE_THUMBPRINT
if ([string]::IsNullOrWhiteSpace($thumbprint)) {
  Write-Host "Skipping Windows code signing for $binaryPath because no signing secrets were provided."
  exit 0
}

$signTool = $env:TAURI_WINDOWS_SIGNTOOL_PATH
if ([string]::IsNullOrWhiteSpace($signTool)) {
  $signTool = "signtool.exe"
}

$timestampUrl = $env:GENESIS_DESKTOP_WINDOWS_TIMESTAMP_URL
if ([string]::IsNullOrWhiteSpace($timestampUrl)) {
  $timestampUrl = "http://timestamp.digicert.com"
}

& $signTool sign /sha1 $thumbprint /fd sha256 /tr $timestampUrl /td sha256 $binaryPath
exit $LASTEXITCODE
