use crate::spawn_timeout;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};

/// ── Window size constants ─────────────────────────────────────────────
/// Compact: matches the notch footprint — 260×40 visual + 10px margin.
const COMPACT_W: f64 = 260.0;
const COMPACT_H: f64 = 50.0;

/// Notch visual height — used by the Windows hit-test to compute the
/// clickable band in compact mode (the notch itself, not the window margin).
const NOTCH_H: f64 = 40.0;

/// Expanded: covers the largest widget or overlay panel.
const EXPANDED_W: f64 = 560.0;
const EXPANDED_H: f64 = 520.0;

/// Monotonically increasing generation counter. Every call to
/// `island_compact` bumps it. The delayed resize thread captures the
/// generation at spawn time and only resizes if no newer expand/compact
/// has incremented the counter (i.e. the thread is not stale).
static RESIZE_GENERATION: AtomicU64 = AtomicU64::new(0);

/// Tracks whether the frontend island is currently expanded.
/// Used by:
/// - Windows mouse monitor to compute correct hit bounds
///   (notch: 260×40 centered in the window).
/// - Resize guard: prevents delayed compact resize from firing
///   if the user re-expanded within the delay window.
static ISLAND_EXPANDED: AtomicBool = AtomicBool::new(false);

/// Tracks whether the island WebView2 window is currently shown (visible).
/// Used by the global shortcut handler to avoid a blocking `is_visible()` IPC
/// call on the shortcut thread (which would block if the island is mid-animation).
/// Updated atomically by show/hide operations in set_island_enabled and the shortcut.
pub(crate) static ISLAND_VISIBLE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
static LAST_EXPAND_CHANGE_MS: AtomicU64 = AtomicU64::new(0);

/// Returns seconds since the last expand/compact toggle (or 0 if never toggled).
#[cfg(target_os = "windows")]
fn seconds_since_last_toggle() -> f64 {
    let last = LAST_EXPAND_CHANGE_MS.load(Ordering::Relaxed);
    if last == 0 {
        return 0.0;
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    (now.saturating_sub(last) as f64) / 1000.0
}

/// Window procedure for the island — handles WM_NCHITTEST to provide
/// per-pixel click-through outside the interactive island bounds.
#[cfg(target_os = "windows")]
static ORIGINAL_ISLAND_WNDPROC: AtomicUsize = AtomicUsize::new(0);

/// macOS window level — NSFloatingWindowLevel (5), above normal windows but below
/// the menu bar (NSStatusWindowLevel = 21+). Using 5 ensures the island is visible
/// above all user windows but doesn't overlap with system UI components.
#[cfg(target_os = "macos")]
const MACOS_WINDOW_LEVEL: i64 = 5;

/// macOS window collection behavior flags to join all Spaces.
/// NSNormalWindowLevel (0) | NSWindowCollectionBehaviorCanJoinAllSpaces (1 << 1)
/// | NSWindowCollectionBehaviorFullScreenAuxiliary (1 << 8)
#[cfg(target_os = "macos")]
const MACOS_COLLECTION_BEHAVIOR: i64 = 0 | (1 << 1) | (1 << 8);

// ── Win32 FFI — functions not exported by windows-sys 0.52 ─────────────
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::RECT;

#[cfg(target_os = "windows")]
#[link(name = "user32")]
extern "system" {
    fn GetWindowRect(hWnd: isize, lpRect: *mut RECT) -> i32;
    fn CallWindowProcW(
        prev: Option<unsafe extern "system" fn(isize, u32, usize, isize) -> isize>,
        hWnd: isize,
        msg: u32,
        wParam: usize,
        lParam: isize,
    ) -> isize;
    fn DefWindowProcW(hWnd: isize, msg: u32, wParam: usize, lParam: isize) -> isize;
}

/// Remove the CS_DROPSHADOW class style from the window class.
/// This prevents DWM from drawing drop shadows on this window class.
/// Must be called after the window HWND exists but before show().
#[cfg(target_os = "windows")]
fn remove_class_shadow(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    use raw_window_handle::HasWindowHandle;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetClassLongPtrW, SetClassLongPtrW, CS_DROPSHADOW, GCL_STYLE,
    };

    let handle = window.window_handle()?;
    let raw_window_handle::RawWindowHandle::Win32(win) = handle.as_raw() else {
        return Err("not a Win32 window".into());
    };

    unsafe {
        let style = GetClassLongPtrW(win.hwnd.get(), GCL_STYLE) as usize;
        let new_style = style & !(CS_DROPSHADOW as usize);
        SetClassLongPtrW(win.hwnd.get(), GCL_STYLE, new_style as isize);
    }
    Ok(())
}

/// Apply WS_EX_NOACTIVATE + subclass window with WM_NCHITTEST handler.
///
/// - WS_EX_NOACTIVATE prevents the transparent island window from stealing
///   focus when the user clicks through it to windows underneath.
/// - The WM_NCHITTEST handler returns HTTRANSPARENT for pixels outside the
///   interactive island bounds, and HTCLIENT for pixels within. This gives
///   per-pixel click-through control without the race conditions of a
///   background polling thread toggling set_ignore_cursor_events.
///
/// Replaces the old background polling thread approach entirely.
#[cfg(target_os = "windows")]
fn prepare_island_window_for_hit_test(
    window: &WebviewWindow,
) -> Result<(), Box<dyn std::error::Error>> {
    use raw_window_handle::HasWindowHandle;
    use windows_sys::Win32::UI::WindowsAndMessaging::*;

    let handle = window.window_handle()?;
    let raw_window_handle::RawWindowHandle::Win32(win) = handle.as_raw() else {
        return Err("not a Win32 window".into());
    };
    let hwnd = win.hwnd.get();

    unsafe {
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
        SetWindowLongW(hwnd, GWL_EXSTYLE, ex_style | (WS_EX_NOACTIVATE as i32));

        let prev = SetWindowLongPtrW(
            hwnd,
            GWLP_WNDPROC,
            island_hit_test_proc as *const () as isize,
        );
        ORIGINAL_ISLAND_WNDPROC.store(prev as usize, Ordering::Relaxed);
    }

    eprintln!("[island] WM_NCHITTEST hook installed + WS_EX_NOACTIVATE applied");
    Ok(())
}

/// Custom window procedure: returns HTTRANSPARENT outside the interactive island bounds.
/// The OS delivers WM_NCHITTEST immediately on every cursor movement — no polling needed.
#[cfg(target_os = "windows")]
unsafe extern "system" fn island_hit_test_proc(
    hwnd: isize,
    msg: u32,
    wparam: usize,
    lparam: isize,
) -> isize {
    const WM_NCHITTEST: u32 = 132u32;
    const HTTRANSPARENT: isize = -1;

    if msg == WM_NCHITTEST {
        let cursor_x = (lparam as i16) as i32;
        let cursor_y = ((lparam >> 16) as i16) as i32;

        let mut rect = std::mem::zeroed::<RECT>();
        if GetWindowRect(hwnd, &mut rect) != 0 {
            let win_x = rect.left as f64;
            let win_y = rect.top as f64;
            let win_w = (rect.right - rect.left) as f64;
            let win_h = (rect.bottom - rect.top) as f64;

            let expanded = ISLAND_EXPANDED.load(Ordering::Relaxed);

            let (i_w, i_h) = if expanded {
                (win_w, win_h)
            } else {
                (COMPACT_W, NOTCH_H)
            };
            let i_x = win_x + (win_w - i_w) / 2.0;

            let inside = (cursor_x as f64) >= i_x
                && (cursor_x as f64) <= i_x + i_w
                && (cursor_y as f64) >= win_y
                && (cursor_y as f64) <= win_y + i_h;

            if !inside {
                return HTTRANSPARENT;
            }
        }
    }

    let original = ORIGINAL_ISLAND_WNDPROC.load(Ordering::Relaxed);
    if original != 0 {
        let proc: unsafe extern "system" fn(isize, u32, usize, isize) -> isize =
            std::mem::transmute(original);
        CallWindowProcW(Some(proc), hwnd, msg, wparam, lparam)
    } else {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

/// Setup the island window -- position, transparency.
/// Shows the window after configuration so the WebView2 IPC channel
/// fully initializes. The window is hidden by `visible: false` in
/// `tauri.conf.json` and becomes truly visible only on first toggle.
pub fn setup_island_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let settings = crate::settings::load_desktop_settings(app.handle());
    if !settings.dynamic_island_enabled {
        eprintln!("[island] disabled via settings, skipping");
        return Ok(());
    }

    let Some(window) = app.get_webview_window("island") else {
        eprintln!("[island] window not found in config");
        return Ok(());
    };

    eprintln!("[island] setup_island_window: starting");

    #[cfg(target_os = "macos")]
    if let Err(e) = set_macos_window_level(&window) {
        eprintln!("[island] macOS window level setup failed (island may sit below menu bar): {e}");
    }

    #[cfg(target_os = "windows")]
    remove_class_shadow(&window).unwrap_or_else(|e| {
        eprintln!("[island] remove_class_shadow failed: {e}");
    });

    if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
        eprintln!("[island] set_background_color failed: {e}");
    }

    #[cfg(target_os = "windows")]
    if let Err(e) = prepare_island_window_for_hit_test(&window) {
        eprintln!("[island] hit test setup failed: {e}");
    }

    #[cfg(target_os = "windows")]
    {
        let _ = window.eval("document.body.style.background='transparent'");
    }

    // Start at compact size — window is hidden by default; this ensures
    // the first show already has the correct footprint.
    resize_island(&window, true);

    // Show the window so the WebView2 IPC channel fully initializes.
    // The window is hidden by `visible: false` in tauri.conf.json but
    // `show()` ensures WebView2's native messaging bridge is active.
    if let Err(e) = window.show() {
        eprintln!("[island] window.show() failed: {e}");
    }

    eprintln!("[island] setup_island_window: window configured and shown");

    #[cfg(target_os = "windows")]
    eprintln!("[island] setup_island_window: complete");
    Ok(())
}

/// Set the macOS window level and collection behavior for the island window.
///
/// - Sets window level to NSFloatingWindowLevel (above normal windows, below menu bar)
/// - Sets collectionBehavior to canJoinAllSpaces + fullScreenAuxiliary so the island
///   remains visible when switching Spaces or entering fullscreen apps
#[cfg(target_os = "macos")]
fn set_macos_window_level(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    use objc2::runtime::AnyObject;
    use objc2::*;
    use raw_window_handle::HasWindowHandle;

    let handle = window.window_handle()?;
    let raw_window_handle::RawWindowHandle::AppKit(appkit) = handle.as_raw() else {
        return Err("unexpected non-AppKit raw window handle on macOS".into());
    };

    unsafe {
        let ns_view = appkit.ns_view.as_ptr() as *mut AnyObject;
        let ns_win: *mut AnyObject = msg_send![ns_view, window];

        // Set window level — NSFloatingWindowLevel
        let _: () = msg_send![ns_win, setLevel: MACOS_WINDOW_LEVEL];

        // Set collectionBehavior — visible on all Spaces + fullscreen auxiliary
        let _: () = msg_send![ns_win, setCollectionBehavior: MACOS_COLLECTION_BEHAVIOR];
    }

    Ok(())
}

/// Position the island window at top-center of the primary monitor.
/// Uses outer_size() for the window width -- call this after the window is shown.
pub fn position_top_center(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    let Some(monitor) = window.app_handle().primary_monitor()? else {
        return Err("no primary monitor found".into());
    };

    let monitor_pos = monitor.position();
    let physical_screen_w = monitor.size().width as i32;
    let physical_w = window.outer_size()?.width as i32;
    let x = monitor_pos.x + ((physical_screen_w - physical_w) / 2).max(0);
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x,
        y: 0,
    }))?;
    Ok(())
}

/// Toggle compact/expanded state on the frontend.
#[tauri::command]
pub async fn toggle_island(window: tauri::WebviewWindow) -> Result<(), String> {
    spawn_timeout!(5, {
        eprintln!("[island] toggle_island() called");
        if window.label() == "island" {
            position_top_center(&window).unwrap_or_else(|e| {
                eprintln!("[island] reposition on toggle failed: {e}");
            });
            window
                .emit("island:toggle", ())
                .map_err(|e| e.to_string())?;
            eprintln!("[island] toggle_island: emitted island:toggle event");
        } else {
            eprintln!(
                "[island] toggle_island: wrong window label '{}'",
                window.label()
            );
        }
        Ok(())
    })
}

/// Expand the island via frontend event.
#[tauri::command]
pub async fn show_island(window: tauri::WebviewWindow) -> Result<(), String> {
    spawn_timeout!(5, {
        eprintln!("[island] show_island() called");
        if window.label() == "island" {
            position_top_center(&window).unwrap_or_else(|e| {
                eprintln!("[island] reposition on show failed: {e}");
            });
            window.emit("island:show", ()).map_err(|e| e.to_string())?;
            eprintln!("[island] show_island: emitted island:show event");
        } else {
            eprintln!(
                "[island] show_island: wrong window label '{}'",
                window.label()
            );
        }
        Ok(())
    })
}

/// Collapse to compact via frontend event.
#[tauri::command]
pub async fn hide_island(window: tauri::WebviewWindow) -> Result<(), String> {
    spawn_timeout!(5, {
        eprintln!("[island] hide_island() called");
        if window.label() == "island" {
            window.emit("island:hide", ()).map_err(|e| e.to_string())?;
            eprintln!("[island] hide_island: emitted island:hide event");
        } else {
            eprintln!(
                "[island] hide_island: wrong window label '{}'",
                window.label()
            );
        }
        Ok(())
    })
}

/// Toggle whether the island window accepts cursor events.
/// Deprecated: the background mouse monitor manages click-through internally.
#[tauri::command]
pub fn island_set_ignore_cursor_events(
    window: tauri::WebviewWindow,
    ignore: bool,
) -> Result<(), String> {
    eprintln!("[island] set_ignore_cursor_events({ignore}) called");
    if window.label() == "island" {
        window
            .set_ignore_cursor_events(ignore)
            .map_err(|e| e.to_string())?;
        eprintln!("[island] set_ignore_cursor_events({ignore}) succeeded");
    } else {
        eprintln!(
            "[island] set_ignore_cursor_events: wrong window label '{}'",
            window.label()
        );
    }
    Ok(())
}

/// Resize and reposition the island window.
/// Compact: 260×50 — just the notch, no dead zone.
/// Expanded: 560×520 — enough for any widget panel or overlay.
fn resize_island(window: &tauri::WebviewWindow, compact: bool) {
    let (w, h) = if compact {
        (COMPACT_W, COMPACT_H)
    } else {
        (EXPANDED_W, EXPANDED_H)
    };

    if let Err(e) = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
        width: w,
        height: h,
    })) {
        eprintln!("[island] resize_island: set_size failed: {e}");
    }

    // Re-center horizontally at the top of the primary monitor.
    match window.app_handle().primary_monitor() {
        Ok(Some(monitor)) => {
            let scale = monitor.scale_factor();
            let screen_w = monitor.size().width as f64;
            let phys_w = w * scale;
            let x = (monitor.position().x as f64) + ((screen_w - phys_w) / 2.0).max(0.0);
            if let Err(e) =
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: x as i32,
                    y: 0,
                }))
            {
                eprintln!("[island] resize_island: set_position failed: {e}");
            }
        }
        Ok(None) => eprintln!("[island] resize_island: no primary monitor found"),
        Err(e) => eprintln!("[island] resize_island: primary_monitor error: {e}"),
    }
}

#[tauri::command]
pub fn island_compact(window: tauri::WebviewWindow) -> Result<(), String> {
    eprintln!("[island] island_compact() called");
    let prev = ISLAND_EXPANDED.swap(false, Ordering::SeqCst);
    let gen = RESIZE_GENERATION.fetch_add(1, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    LAST_EXPAND_CHANGE_MS.store(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        Ordering::Relaxed,
    );
    eprintln!("[island] compact(gen={gen}) -- ISLAND_EXPANDED: {prev} -> false");
    // Delay window resize by 600ms so the CSS shell animation (550ms)
    // finishes shrinking first — prevents clipping the still-animating shell.
    // Guard: only resize if no newer expand/compact has been requested since
    // this compact call (generation counter check).
    //
    // Uses run_on_main_thread to schedule the resize on the main/UI thread
    // (WebView2 set_size/set_position must not be called from background threads).
    let app_handle = window.app_handle().clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(600));
        if !ISLAND_EXPANDED.load(Ordering::Relaxed)
            && RESIZE_GENERATION.load(Ordering::Relaxed) == gen + 1
        {
            let _ = app_handle.run_on_main_thread(move || {
                resize_island(&window, true);
            });
        }
    });
    Ok(())
}

#[tauri::command]
pub fn island_expand(window: tauri::WebviewWindow) -> Result<(), String> {
    eprintln!("[island] island_expand() called");
    // Schedule resize on main thread via run_on_main_thread so the IPC
    // thread is never blocked by WebView2 compositor work.
    let app_handle = window.app_handle().clone();
    let _ = app_handle.run_on_main_thread(move || {
        resize_island(&window, false);
    });
    let prev = ISLAND_EXPANDED.swap(true, Ordering::SeqCst);
    RESIZE_GENERATION.fetch_add(1, Ordering::SeqCst);
    #[cfg(target_os = "windows")]
    LAST_EXPAND_CHANGE_MS.store(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
        Ordering::Relaxed,
    );
    eprintln!("[island] expand() -- ISLAND_EXPANDED: {prev} -> true");
    Ok(())
}

/// Diagnostics command -- dumps current island state.
#[tauri::command]
pub fn island_dump_state() -> Result<serde_json::Value, String> {
    let expanded = ISLAND_EXPANDED.load(Ordering::Relaxed);
    #[cfg(target_os = "windows")]
    {
        let toggle_secs = seconds_since_last_toggle();
        return Ok(serde_json::json!({
            "expanded": expanded,
            "seconds_since_last_toggle": toggle_secs,
            "stuck_warning": expanded && toggle_secs > 10.0,
        }));
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(serde_json::json!({
            "expanded": expanded,
        }))
    }
}

#[tauri::command]
pub fn island_start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    eprintln!("[island] start_drag() called");
    if window.label() == "island" {
        window.start_dragging().map_err(|e| e.to_string())?;
        eprintln!("[island] start_drag() succeeded");
    } else {
        eprintln!(
            "[island] start_drag: wrong window label '{}'",
            window.label()
        );
    }
    Ok(())
}

/// Focus the main Bento window.
///
/// Calls `window.show()` + `window.set_focus()` which are synchronous WebView2
/// compositor calls that can block the main IPC thread if DWM is under load
/// (e.g. acrylic/glass effect transitions, window animation).
///
/// Runs on the blocking thread pool via spawn_timeout! to keep the IPC thread free.
#[tauri::command]
pub async fn focus_main_window(app: AppHandle) -> Result<(), String> {
    eprintln!("[island] focus_main_window() called");

    let Some(window) = app.get_webview_window("main") else {
        eprintln!("[island] focus_main_window: main window not found");
        return Ok(());
    };

    spawn_timeout!(5, {
        window.show().map_err(|e: tauri::Error| e.to_string())?;
        window
            .set_focus()
            .map_err(|e: tauri::Error| e.to_string())?;
        eprintln!("[island] focus_main_window: main window focused");
        Ok(())
    })
}

/// Enable or disable the Dynamic Island at runtime.
///
/// When disabled, the island window is hidden. When re-enabled, it's shown again
/// with proper positioning and transparency.
///
/// Non-fatal when the island window doesn't exist yet (e.g., settings hydration
/// fires before setup completes). Logs the miss and returns Ok — the window
/// will be created and shown during the next setup cycle.
#[tauri::command]
pub async fn set_island_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window("island") else {
        eprintln!(
            "[island] set_island_enabled({enabled}): island window not found yet (non-fatal)"
        );
        return Ok(());
    };

    spawn_timeout!(5, {
        eprintln!("[island] set_island_enabled({enabled}) called");

        if enabled {
            ISLAND_EXPANDED.store(false, Ordering::SeqCst);
            #[cfg(target_os = "windows")]
            LAST_EXPAND_CHANGE_MS.store(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                Ordering::Relaxed,
            );

            if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
                eprintln!("[island] set_background_color on re-enable failed: {e}");
            }

            resize_island(&window, true);

            window.show().map_err(|e| e.to_string())?;
            ISLAND_VISIBLE.store(true, Ordering::SeqCst);

            let _ = window.emit("island:hide", ());

            eprintln!("[island] set_island_enabled(true): complete");
        } else {
            window.hide().map_err(|e| e.to_string())?;
            ISLAND_VISIBLE.store(false, Ordering::SeqCst);
            eprintln!("[island] set_island_enabled(false): window hidden");
        }

        Ok(())
    })
}
