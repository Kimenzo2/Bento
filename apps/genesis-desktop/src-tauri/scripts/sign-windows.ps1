$ErrorActionPreference = "Stop"

$binaryPath = $args[0]
if ([string]::IsNullOrWhiteSpace($binaryPath)) {
  throw "Windows signing requires the bundle path as the first argument."
}

$commandLineParser = @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class GenesisDesktopCommandLineParser
{
    [DllImport("shell32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern IntPtr CommandLineToArgvW(string lpCmdLine, out int pNumArgs);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr LocalFree(IntPtr hMem);

    public static string[] Split(string commandLine)
    {
        int argc;
        IntPtr argv = CommandLineToArgvW(commandLine, out argc);
        if (argv == IntPtr.Zero)
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }

        try
        {
            var arguments = new string[argc];
            for (int index = 0; index < argc; index++)
            {
                IntPtr current = Marshal.ReadIntPtr(argv, index * IntPtr.Size);
                arguments[index] = Marshal.PtrToStringUni(current);
            }

            return arguments;
        }
        finally
        {
            LocalFree(argv);
        }
    }
}
"@

$customCommand = $env:GENESIS_DESKTOP_WINDOWS_SIGN_COMMAND
if (-not [string]::IsNullOrWhiteSpace($customCommand)) {
  $expandedCommand = $customCommand.Replace('%1', ('"' + $binaryPath + '"'))
  Add-Type -TypeDefinition $commandLineParser -Language CSharp
  $parsedCommand = [GenesisDesktopCommandLineParser]::Split($expandedCommand)

  if ($parsedCommand.Length -lt 1) {
    throw "GENESIS_DESKTOP_WINDOWS_SIGN_COMMAND did not resolve to an executable command."
  }

  $commandPath = $parsedCommand[0]
  $commandArguments = @()
  if ($parsedCommand.Length -gt 1) {
    $commandArguments = $parsedCommand[1..($parsedCommand.Length - 1)]
  }

  & $commandPath @commandArguments
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
