$fixes = @(
    @{ file="components/CurriculumViewer.tsx"; old="  onEdit,"; new="  _onEdit," },
    @{ file="components/LegalViewer.tsx"; old="const [isLoading, setIsLoading]"; new="const [_isLoading, _setIsLoading]" },
    @{ file="components/MobileBottomNav.tsx"; old="  unreadCount,"; new="  _unreadCount," },
    @{ file="components/SparkleCursor.tsx"; old="const [mousePos, "; new="const [_mousePos, " },
    @{ file="components/collaboration/LiveCursors.tsx"; old=", containerRef)"; new=", _containerRef)" },
    @{ file="components/collaboration/SharedVisualCard.tsx"; old="} catch (err)"; new="} catch (_err)" },
    @{ file="components/settings/SessionManagement.tsx"; old="const { user }"; new="const { user: _user }" },
    @{ file="hooks/useGoogleOneTap.ts"; old="const [isInitialized, "; new="const [_isInitialized, " },
    @{ file="contexts/I18nContext.tsx"; old="} catch (error)"; new="} catch (_error)" }
)

foreach ($fix in $fixes) {
    $content = Get-Content $fix.file -Raw
    if ($content.Contains($fix.old)) {
        $content = $content.Replace($fix.old, $fix.new)
        Set-Content $fix.file -Value $content -NoNewline
        Write-Host "Fixed: $($fix.file)"
    } else {
        Write-Host "SKIP (not found): $($fix.file) - $($fix.old)"
    }
}
Write-Host "DONE"
