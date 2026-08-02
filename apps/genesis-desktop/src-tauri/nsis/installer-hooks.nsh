; NSIS installer hooks — kill orphaned sidecar processes before Tauri
; copies / deletes files so the installer never sees "Error opening file
; for writing: chatgpt-proxy.exe" caused by a locked binary.
;
; Tauri's CheckIfAppIsRunning (called after NSIS_HOOK_PREINSTALL) handles
; the main bento-desktop.exe, but has no knowledge of sidecars.
;
; taskkill /F /T terminates the entire process tree (/T) so child
; processes spawned by the Bun-compiled proxy are also killed.
; /IM matches by image name, which is the most portable approach
; across Windows versions.
;
; Sleep gives Windows time to release file handles after termination.

!macro NSIS_HOOK_PREINSTALL
    nsExec::ExecToLog '$SYSDIR\taskkill.exe /F /T /IM chatgpt-proxy.exe'
    Pop $R0
    nsExec::ExecToLog '$SYSDIR\taskkill.exe /F /T /IM bento-spectrum.exe'
    Pop $R0
    Sleep 2000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
    nsExec::ExecToLog '$SYSDIR\taskkill.exe /F /T /IM chatgpt-proxy.exe'
    Pop $R0
    nsExec::ExecToLog '$SYSDIR\taskkill.exe /F /T /IM bento-spectrum.exe'
    Pop $R0
    Sleep 2000
!macroend
