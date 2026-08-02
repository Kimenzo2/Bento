// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::spawn_timeout;
use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use tauri::utils::config::WindowEffectsConfig;
use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Manager};

// ─────────────────────────────────────────────────────────────────────────────
// Native OS window frame setup
//
// Enables the OS window frame (border, shadow, resize handles on all 4 sides)
// while keeping the custom-drawn titlebar.
//
// Windows: `decorations: false` removes the native titlebar. We add back the
//          frame styles (WS_THICKFRAME, WS_BORDER) plus the drop-shadow
//          extended style (WS_EX_WINDOWEDGE). WS_CAPTION is never set.
// macOS:   Via AppKit raw handle — `configure_macos_titlebar()` below makes the
//          titlebar transparent, hides the title text, and enables the
//          full-size-content-view style mask so the webview spans the window.
// Linux:   WM handles the frame natively; no extra setup needed.
// ─────────────────────────────────────────────────────────────────────────────

/// Add native frame styles to the borderless window on Windows.
///
/// `decorations: false` strips all chrome. We stitch back:
/// - `WS_THICKFRAME` — resize handles on all 4 edges
/// - `WS_BORDER` — thin 1 px edge line
/// - `WS_MINIMIZEBOX | WS_MAXIMIZEBOX` — window-menu affordances
/// - `WS_EX_WINDOWEDGE` — DWM drop shadow
///
/// # Safety
///
/// This function calls into the Win32 `SetWindowLongW` / `SetWindowPos`
/// APIs, which are inherently unsafe. It is sound because `hwnd` is a
/// valid top-level window handle obtained from `raw_window_handle`, the
/// memory backing the window object is still alive, and the new styles
/// are a well-known subset of `WS_OVERLAPPEDWINDOW` minus the caption
/// styles that would produce a native titlebar.
#[cfg(target_os = "windows")]
pub fn configure_native_frame(window: &impl HasWindowHandle) -> Result<(), String> {
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let handle = window.window_handle().map_err(|e| e.to_string())?;
    let hwnd = match handle.as_raw() {
        RawWindowHandle::Win32(win32) => win32.hwnd.get(),
        _ => return Err("expected Win32 window handle".into()),
    };

    // SAFETY: hwnd is a valid top-level HWND from raw_window_handle. The
    // window object is still alive (we hold &impl HasWindowHandle). The
    // style flags we add are standard window chrome bits that DWM accepts.
    unsafe {
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        let add = (WS_THICKFRAME | WS_BORDER | WS_MINIMIZEBOX | WS_MAXIMIZEBOX) as i32;
        if SetWindowLongW(hwnd, GWL_STYLE, style | add) == 0 {
            return Err("SetWindowLongW(GWL_STYLE) returned 0".into());
        }

        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        if SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style | WS_EX_WINDOWEDGE as i32) == 0 {
            return Err("SetWindowLongW(GWL_EXSTYLE) returned 0".into());
        }

        // Force the window to recalculate its non-client area so the new
        // frame styles take effect immediately.
        if SetWindowPos(
            hwnd,
            0isize,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
        ) == 0
        {
            return Err("SetWindowPos(SWP_FRAMECHANGED) returned 0".into());
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn configure_native_frame(_window: &impl HasWindowHandle) -> Result<(), String> {
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// macOS: transparent titlebar with hidden title text
// ─────────────────────────────────────────────────────────────────────────────
//
// Tauri v2 provides TitleBarStyle::Overlay as a builder API, but since we
// define the main window in tauri.conf.json (rather than creating it in Rust),
// we use the AppKit raw handle to achieve the same effect at runtime:
//
//   1. setTitlebarAppearsTransparent — blends titlebar into the web content
//   2. setTitleVisibility: NSTitleVisibilityHidden — hides title text
//   3. NSFullSizeContentViewWindowMask — lets webview span the full window
//
// Traffic-light buttons remain native at top-left per macOS convention.
//
// See also: <https://v2.tauri.app/learn/window-customization/#macos>

/// Apply a transparent, titleless titlebar on macOS.
///
/// Traffic-light (close/minimize/zoom) buttons stay native. The window title
/// is hidden so our custom titlebar component isn't fighting a native label.
#[cfg(target_os = "macos")]
pub fn configure_macos_titlebar(window: &impl HasWindowHandle) -> Result<(), String> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let handle = window.window_handle().map_err(|e| e.to_string())?;
    let ns_view = match handle.as_raw() {
        RawWindowHandle::AppKit(appkit) => appkit.ns_view,
        _ => return Err("expected AppKit window handle".into()),
    };
    let view_ptr = ns_view.as_ptr() as *mut AnyObject;

    // SAFETY: view_ptr is a valid NSView. We send [view window] to get the
    // containing NSWindow, then configure it. All pointers are alive for the
    // duration of this call and the selectors are standard AppKit APIs.
    unsafe {
        let ns_window: *mut AnyObject = msg_send![view_ptr, window];
        if ns_window.is_null() {
            return Err("null NSWindow from ns_view".into());
        }
        let () = msg_send![ns_window, setTitlebarAppearsTransparent: true];
        let () = msg_send![ns_window, setTitleVisibility: 1i64]; // NSTitleVisibilityHidden
        let mask: usize = msg_send![ns_window, styleMask];
        let () = msg_send![ns_window, setStyleMask: mask | (1 << 15)]; // NSFullSizeContentViewWindowMask
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Glass / Acrylic / Vibrancy effect
// ─────────────────────────────────────────────────────────────────────────────

// The `return` statements inside the cfg-guarded blocks make the
// trailing `unreachable!()` path unreachable on Windows/macOS at
// compile time. This is intentional — we just suppress the warning.
#[allow(unreachable_code)]
#[tauri::command]
#[allow(unreachable_code)] // cfg-guarded branches make the fallthrough unreachable on Windows/macOS
pub async fn set_window_glass(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("no main window")?;

    // app is only used inside cfg(macos) — macro's move closure captures it
    // but on non-macOS it would trigger unused-variable warnings.
    #[cfg(not(target_os = "macos"))]
    let _ = &app;

    spawn_timeout!(10, {
        if !enabled {
            return window
                .set_effects(None::<WindowEffectsConfig>)
                .map_err(|e| e.to_string());
        }

        #[cfg(target_os = "macos")]
        {
            use tauri_plugin_liquid_glass::LiquidGlassExt;

            let supported = app.liquid_glass().is_supported();
            if supported {
                app.liquid_glass()
                    .set_effect(&window, Default::default())
                    .map_err(|e| e.to_string())?;
                return Ok(());
            }

            return window
                .set_effects(
                    EffectsBuilder::new()
                        .effects(vec![Effect::UnderWindowBackground])
                        .build(),
                )
                .map_err(|e| e.to_string());
        }

        #[cfg(target_os = "windows")]
        {
            return window
                .set_effects(
                    EffectsBuilder::new()
                        .effects(vec![Effect::Acrylic])
                        .color(tauri::window::Color(32, 32, 32, 200))
                        .build(),
                )
                .map_err(|e| e.to_string());
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        return Ok(());

        #[cfg(any(target_os = "windows", target_os = "macos"))]
        unreachable!()
    })
}
