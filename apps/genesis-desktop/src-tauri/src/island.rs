use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

const COMPACT_W: f64 = 260.0;
const COMPACT_H: f64 = 40.0;
const EXPANDED_W: f64 = 320.0;
const EXPANDED_H: f64 = 480.0;

/// Background thread that polls the cursor position and toggles click-through.
///
/// When the cursor is within (or near) the island window bounds, click-through
/// is disabled so the user can click the island. When the cursor is outside,
/// click-through is enabled — clicks pass through the transparent window to
/// whatever is beneath.
///
/// Hysteresis (larger exit margin) prevents flickering at the boundary.
#[cfg(target_os = "windows")]
fn start_mouse_monitor(app: AppHandle) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    std::thread::spawn(move || {
        let mut was_inside = false;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(33)); // ~30 fps

            let Some(window) = app.get_webview_window("island") else {
                continue;
            };

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

            // Larger exit margin prevents flickering at the boundary
            let margin = if was_inside { 30.0 } else { 10.0 };

            let inside = pt.x as f64 >= win_x - margin
                && pt.x as f64 <= win_x + win_w + margin
                && pt.y as f64 >= win_y - margin
                && pt.y as f64 <= win_y + win_h + margin;

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
    let Some(window) = app.get_webview_window("island") else {
        eprintln!("[island] window not found in config");
        return Ok(());
    };

    #[cfg(target_os = "macos")]
    if let Err(e) = set_macos_window_level(&window) {
        eprintln!("[island] macOS window level setup failed (island may sit below menu bar): {e}");
    }

    // Transparent webview background — prevents white flash.
    // MUST happen before show() on Windows to avoid DWM compositor crash.
    if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
        eprintln!("[island] set_background_color failed: {e}");
    }

    // Default: click-through enabled. The mouse monitor thread toggles this
    // off when the cursor enters the island window area.
    if let Err(e) = window.set_ignore_cursor_events(true) {
        eprintln!("[island] set_ignore_cursor_events failed: {e}");
    }

    // Pre-warm the webview compositor on Windows so the first frame is already transparent
    #[cfg(target_os = "windows")]
    {
        let _ = window.eval("document.body.style.background='transparent'");
    }

    // Show after fully configured — avoids DWM compositor crash on Windows
    if let Err(e) = window.show() {
        eprintln!("[island] window.show() failed: {e}");
    }

    // Position AFTER show() — outer_size() may return 0 before the window is mapped.
    // Use the known compact width directly to avoid relying on window geometry.
    position_top_center_initial(&window).unwrap_or_else(|e| {
        eprintln!("[island] position_top_center failed: {e}");
    });

    // Start the background mouse monitor on Windows
    #[cfg(target_os = "windows")]
    start_mouse_monitor(app.handle().clone());

    Ok(())
}

/// Set the macOS window level above the menu bar (NSStatusWindowLevel = 25).
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
        let _: () = msg_send![ns_win, setLevel: 25_i64];
    }

    Ok(())
}

/// Position the island window at top-center of the primary monitor.
/// Uses outer_size() for the window width — call this after the window is shown.
pub fn position_top_center(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    let Some(monitor) = window.app_handle().primary_monitor()? else {
        return Err("no primary monitor found".into());
    };

    let physical_screen_w = monitor.size().width as i32;
    let physical_w = window.outer_size()?.width as i32;
    let x = ((physical_screen_w - physical_w) / 2).max(0);
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y: 0 }))?;
    Ok(())
}

/// Initial positioning using the known compact width.
/// outer_size() can return 0 before the window is shown.
fn position_top_center_initial(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    let Some(monitor) = window.app_handle().primary_monitor()? else {
        return Err("no primary monitor found".into());
    };

    let physical_screen_w = monitor.size().width as i32;
    let physical_w = (COMPACT_W * monitor.scale_factor()) as i32;
    let x = ((physical_screen_w - physical_w) / 2).max(0);
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
#[tauri::command]
pub fn island_set_ignore_cursor_events(window: tauri::WebviewWindow, ignore: bool) -> Result<(), String> {
    if window.label() == "island" {
        window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn island_compact(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "island" {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: COMPACT_W,
                height: COMPACT_H,
            }))
            .map_err(|e| e.to_string())?;
        window.set_resizable(false).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn island_expand(window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "island" {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: EXPANDED_W,
                height: EXPANDED_H,
            }))
            .map_err(|e| e.to_string())?;
    }
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
