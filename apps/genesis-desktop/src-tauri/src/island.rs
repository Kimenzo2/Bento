use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

const COMPACT_W: f64 = 260.0;
const COMPACT_H: f64 = 40.0;
const EXPANDED_W: f64 = 560.0;

/// Tracks whether the frontend island is currently expanded.
/// Used by the mouse monitor to compute the correct hit bounds
/// (compact: 260×40 centered in the 320×480 window).
#[cfg(target_os = "windows")]
static ISLAND_EXPANDED: AtomicBool = AtomicBool::new(false);

/// Cursor polling interval in milliseconds (~30 fps).
const POLL_MS: u64 = 33;

/// Hysteresis margin (px) used when the cursor is entering the island bounds.
const ENTER_MARGIN: f64 = 10.0;

/// Hysteresis margin (px) used when the cursor is leaving the island bounds.
/// Larger than ENTER_MARGIN to prevent flickering at the boundary.
const EXIT_MARGIN: f64 = 30.0;

/// macOS window level above the menu bar (NSStatusWindowLevel).
#[cfg(target_os = "macos")]
const MACOS_WINDOW_LEVEL: i64 = 25;

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

/// Background thread that polls the cursor position and toggles click-through.
///
/// When the cursor is within (or near) the island window bounds, click-through
/// is disabled so the user can click the island. When the cursor is outside,
/// click-through is enabled — clicks pass through the transparent window to
/// whatever is beneath.
///
/// Hysteresis (larger exit margin) prevents flickering at the boundary.
/// Skips processing when the window is hidden to save CPU.
#[cfg(target_os = "windows")]
fn start_mouse_monitor(app: AppHandle) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let _ = std::thread::Builder::new()
        .name("island-mouse-monitor".into())
        .spawn(move || {
        let mut was_inside = false;
        let mut hidden_count: u32 = 0;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(POLL_MS));

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };

            // Skip polling when the window is hidden — no point checking cursor
            // against an invisible window. After 100 consecutive hidden polls
            // (~3.3s) the thread exits to avoid zombie threads when the island
            // is permanently disabled at runtime.
            if !window.is_visible().unwrap_or(false) {
                hidden_count += 1;
                if hidden_count > 100 {
                    return; // thread exits
                }
                // Reset was_inside so the next show() starts fresh
                was_inside = false;
                continue;
            }
            hidden_count = 0;

            let mut pt = POINT { x: 0, y: 0 };
            if unsafe { GetCursorPos(&mut pt) } == 0 {
                continue;
            }

            let Ok(pos) = window.outer_position() else { continue; };
            let Ok(size) = window.outer_size() else { continue; };

            let win_x = pos.x as f64;
            let win_y = pos.y as f64;
            let win_w = size.width as f64;
            let win_h = size.height as f64;

            // The window is always at the expanded size (320×480).
            // When the island is compact (260×40) we narrow the hit area
            // to the centermost 260×40 region of the window.
            let (island_w, island_h) = if ISLAND_EXPANDED.load(Ordering::Relaxed) {
                (win_w, win_h)
            } else {
                (COMPACT_W, COMPACT_H)
            };
            let island_x = win_x + (win_w - island_w) / 2.0;
            let island_y = win_y;

            let margin = if was_inside { EXIT_MARGIN } else { ENTER_MARGIN };

            let inside = pt.x as f64 >= island_x - margin
                && pt.x as f64 <= island_x + island_w + margin
                && pt.y as f64 >= island_y - margin
                && pt.y as f64 <= island_y + island_h + margin;

            if inside != was_inside {
                was_inside = inside;
                let _ = window.set_ignore_cursor_events(!inside);
            }
        }
    });
}

/// Setup the island window — position, transparency, then show.
/// `visible: false` in config prevents DWM compositor crash on Windows.
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

    #[cfg(target_os = "macos")]
    if let Err(e) = set_macos_window_level(&window) {
        eprintln!("[island] macOS window level setup failed (island may sit below menu bar): {e}");
    }

    // Strip the DWM drop-shadow at the class level — otherwise the
    // WS_EX_LAYERED style (required for transparency) makes DWM paint a
    // shadow rectangle below the window.  The top half clips off-screen
    // (y=0) so only the bottom shadow is visible as a floating bar.
    #[cfg(target_os = "windows")]
    remove_class_shadow(&window).unwrap_or_else(|e| {
        eprintln!("[island] remove_class_shadow failed: {e}");
    });

    // Transparent webview background — prevents white flash.
    // MUST happen before show() on Windows to avoid DWM compositor crash.
    if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
        eprintln!("[island] set_background_color failed: {e}");
    }

    // Windows: default click-through ON. The mouse monitor thread toggles this
    // off when the cursor enters the island window area.
    // macOS: native per-pixel hit-testing for transparent windows handles
    // click-through automatically — no need to call this (doing so would make
    // the entire island, including opaque content, unclickable).
    #[cfg(target_os = "windows")]
    if let Err(e) = window.set_ignore_cursor_events(true) {
        eprintln!("[island] set_ignore_cursor_events failed: {e}");
    }

    // Pre-warm the webview compositor on Windows so the first frame is already transparent
    #[cfg(target_os = "windows")]
    {
        let _ = window.eval("document.body.style.background='transparent'");
    }

    // Position before show() so the window appears at the correct
    // top-center position on first paint — no wrong-position glitch.
    position_top_center_expanded(&window).unwrap_or_else(|e| {
        eprintln!("[island] position_top_center_expanded failed: {e}");
    });

    // Show after fully configured — avoids DWM compositor crash on Windows.
    if let Err(e) = window.show() {
        eprintln!("[island] window.show() failed: {e}");
    }

    // Start the background mouse monitor on Windows
    #[cfg(target_os = "windows")]
    start_mouse_monitor(app.handle().clone());

    Ok(())
}

/// Set the macOS window level above the menu bar (NSStatusWindowLevel).
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
        let _: () = msg_send![ns_win, setLevel: MACOS_WINDOW_LEVEL];
    }

    Ok(())
}

/// Position the island window at top-center of the primary monitor.
/// Uses outer_size() for the window width — call this after the window is shown.
pub fn position_top_center(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    let Some(monitor) = window.app_handle().primary_monitor()? else {
        return Err("no primary monitor found".into());
    };

    let monitor_pos = monitor.position();
    let physical_screen_w = monitor.size().width as i32;
    let physical_w = window.outer_size()?.width as i32;
    let x = monitor_pos.x + ((physical_screen_w - physical_w) / 2).max(0);
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y: 0 }))?;
    Ok(())
}

/// Position the window at the expanded size (window never resizes after startup).
/// The frontend island div animates between compact/expanded via CSS transitions.
fn position_top_center_expanded(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    let Some(monitor) = window.app_handle().primary_monitor()? else {
        return Err("no primary monitor found".into());
    };

    let monitor_pos = monitor.position();
    let physical_screen_w = monitor.size().width as i32;
    let physical_w = (EXPANDED_W * monitor.scale_factor()) as i32;
    let x = monitor_pos.x + ((physical_screen_w - physical_w) / 2).max(0);
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y: 0 }))?;
    Ok(())
}

/// Toggle compact/expanded state on the frontend.
#[tauri::command]
pub fn toggle_island(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "island" {
        position_top_center(&window).unwrap_or_else(|e| {
            eprintln!("[island] reposition on toggle failed: {e}");
        });
        window.emit("island:toggle", ()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Expand the island via frontend event.
/// The frontend store drives the actual resize through island_expand.
#[tauri::command]
pub fn show_island(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "island" {
        position_top_center(&window).unwrap_or_else(|e| {
            eprintln!("[island] reposition on show failed: {e}");
        });
        window.emit("island:show", ()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Collapse to compact via frontend event.
#[tauri::command]
pub fn hide_island(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "island" {
        window.emit("island:hide", ()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Toggle whether the island window accepts cursor events.
///
/// Deprecated: the background mouse monitor (`start_mouse_monitor`) manages
/// click-through internally. This command is retained for debugging only.
#[tauri::command]
pub fn island_set_ignore_cursor_events(window: tauri::WebviewWindow, ignore: bool) -> Result<(), String> {
    if window.label() == "island" {
        window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn island_compact() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    ISLAND_EXPANDED.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn island_expand() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    ISLAND_EXPANDED.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn island_start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "island" {
        window.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn focus_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e: tauri::Error| e.to_string())?;
        window.set_focus().map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

/// Enable or disable the Dynamic Island at runtime.
/// When disabled, the island window is hidden. When re-enabled, it's shown again
/// with proper positioning and transparency.
#[tauri::command]
pub fn set_island_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window("island") else {
        return Err("island window not found".into());
    };

    if enabled {
        // Window stays at expanded size — the frontend island div animates
        // between compact/expanded via CSS transitions.
        #[cfg(target_os = "windows")]
        ISLAND_EXPANDED.store(false, Ordering::SeqCst);

        // Restore transparent background (idempotent).
        if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
            eprintln!("[island] set_background_color on re-enable failed: {e}");
        }

        // Position before show so the window appears at the correct
        // top-center position on first paint — no wrong-position glitch.
        position_top_center_expanded(&window).unwrap_or_else(|e| {
            eprintln!("[island] reposition on re-enable failed: {e}");
        });

        window.show().map_err(|e| e.to_string())?;

        // Reset frontend state to compact (the Svelte store persists across
        // hide/show since the webview process stays alive).
        let _ = window.emit("island:hide", ());

        // Windows: start clickable — the mouse monitor thread will toggle
        // click-through ON within the next poll cycle if the cursor is outside.
        // macOS: default per-pixel hit-testing is correct; no override needed.
        #[cfg(target_os = "windows")]
        {
            let _ = window.set_ignore_cursor_events(false);
            start_mouse_monitor(app.clone());
        }
    } else {
        window.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}
