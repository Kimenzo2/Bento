use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
#[cfg(target_os = "windows")]
use std::time::{Duration, Instant};

const EXPANDED_W: f64 = 560.0;

/// Compact island dimensions — used by the Windows mouse monitor.
#[cfg(target_os = "windows")]
const COMPACT_W: f64 = 260.0;
#[cfg(target_os = "windows")]
const COMPACT_H: f64 = 40.0;

/// Tracks whether the frontend island is currently expanded.
/// Used by the mouse monitor to compute the correct hit bounds
/// (compact: 260x40 centered in the 320x480 window).
#[cfg(target_os = "windows")]
static ISLAND_EXPANDED: AtomicBool = AtomicBool::new(false);

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

/// Cursor polling interval in milliseconds (~30 fps).
#[cfg(target_os = "windows")]
const POLL_MS: u64 = 33;

/// Hysteresis margin (px) used when the cursor is entering the island bounds.
#[cfg(target_os = "windows")]
const ENTER_MARGIN: f64 = 10.0;

/// Hysteresis margin (px) used when the cursor is leaving the island bounds.
/// Larger than ENTER_MARGIN to prevent flickering at the boundary.
#[cfg(target_os = "windows")]
const EXIT_MARGIN: f64 = 30.0;

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
/// click-through is enabled -- clicks pass through the transparent window to
/// whatever is beneath.
///
/// Hysteresis (larger exit margin) prevents flickering at the boundary.
/// Skips processing when the window is hidden to save CPU.
#[cfg(target_os = "windows")]
fn start_mouse_monitor(app: AppHandle) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    // Track whether a monitor thread is already running to prevent duplicates.
    static MONITOR_SPAWNED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
    if MONITOR_SPAWNED.swap(true, std::sync::atomic::Ordering::SeqCst) {
        eprintln!("[island-monitor] monitor already running, skipping duplicate spawn");
        return;
    }

    let _ = std::thread::Builder::new()
        .name("island-mouse-monitor".into())
        .spawn(move || {
        let mut was_inside = false;
        let mut transition_count: u32 = 0;
        let mut last_log = Instant::now();

        eprintln!("[island-monitor] thread started");

        loop {
            std::thread::sleep(std::time::Duration::from_millis(POLL_MS));

            let Some(window) = app.get_webview_window("island") else {
                if last_log.elapsed() > Duration::from_secs(5) {
                    eprintln!("[island-monitor] WARN: island window not found, waiting...");
                    last_log = Instant::now();
                }
                continue;
            };

            // Skip processing when hidden but do NOT exit — the island window
            // starts hidden (see setup_island_window) and is shown later via
            // toggle_island / show_island. Exiting here would leave no monitor
            // when the window becomes visible.
            if !window.is_visible().unwrap_or(false) {
                was_inside = false;
                continue;
            }

            // Watchdog: check if ISLAND_EXPANDED has been stuck for > 30s
            let toggle_secs = seconds_since_last_toggle();
            let expanded_now = ISLAND_EXPANDED.load(Ordering::Relaxed);
            if expanded_now && toggle_secs > 30.0 && toggle_secs < 30.5 {
                eprintln!("[island-monitor] WARN: ISLAND_EXPANDED = true for {toggle_secs:.1}s without toggle. Possible freeze.");
            }

            let mut pt = POINT { x: 0, y: 0 };
            if unsafe { GetCursorPos(&mut pt) } == 0 {
                if last_log.elapsed() > Duration::from_secs(5) {
                    eprintln!("[island-monitor] GetCursorPos failed");
                    last_log = Instant::now();
                }
                continue;
            }

            let Ok(pos) = window.outer_position() else { continue; };
            let Ok(size) = window.outer_size() else { continue; };

            let win_x = pos.x as f64;
            let win_y = pos.y as f64;
            let win_w = size.width as f64;
            let win_h = size.height as f64;

            let (island_w, island_h) = if expanded_now {
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
                transition_count += 1;
                eprintln!(
                    "[island-monitor] cursor {} bounds at ({},{}) island=({:.0},{:.0})+({:.0},{:.0}) [transition #{}, expanded={}, toggle_secs={:.1}]",
                    if inside { "ENTERED" } else { "LEFT" },
                    pt.x, pt.y,
                    island_x, island_y, island_w, island_h,
                    transition_count,
                    expanded_now,
                    toggle_secs,
                );
                let result = window.set_ignore_cursor_events(!inside);
                if let Err(e) = result {
                    eprintln!("[island-monitor] set_ignore_cursor_events failed: {e}");
                }
            }
        }
    });
}

/// Setup the island window -- position, transparency.
/// Does NOT call `window.show()` because showing a transparent+alwaysOnTop
/// window during startup can corrupt the DWM compositor on Windows, causing
/// the app (and sometimes the entire desktop) to crash irrecoverably.
/// The island is shown later via `show_island` / `toggle_island` commands.
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
    if let Err(e) = window.set_ignore_cursor_events(true) {
        eprintln!("[island] set_ignore_cursor_events failed: {e}");
    }

    #[cfg(target_os = "windows")]
    {
        let _ = window.eval("document.body.style.background='transparent'");
    }

    position_top_center_expanded(&window).unwrap_or_else(|e| {
        eprintln!("[island] position_top_center_expanded failed: {e}");
    });

    // DO NOT call window.show() here. See doc comment above.
    eprintln!("[island] setup_island_window: window configured (not shown — deferred)");

    #[cfg(target_os = "windows")]
    start_mouse_monitor(app.handle().clone());

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
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x,
        y: 0,
    }))?;
    Ok(())
}

/// Toggle compact/expanded state on the frontend.
#[tauri::command]
pub fn toggle_island(window: tauri::WebviewWindow) -> Result<(), String> {
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
}

/// Expand the island via frontend event.
#[tauri::command]
pub fn show_island(window: tauri::WebviewWindow) -> Result<(), String> {
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
}

/// Collapse to compact via frontend event.
#[tauri::command]
pub fn hide_island(window: tauri::WebviewWindow) -> Result<(), String> {
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

#[tauri::command]
pub fn island_compact() -> Result<(), String> {
    eprintln!("[island] island_compact() called");
    #[cfg(target_os = "windows")]
    {
        let prev = ISLAND_EXPANDED.swap(false, Ordering::SeqCst);
        LAST_EXPAND_CHANGE_MS.store(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            Ordering::Relaxed,
        );
        eprintln!("[island] compact() -- ISLAND_EXPANDED: {prev} -> false");
    }
    Ok(())
}

#[tauri::command]
pub fn island_expand() -> Result<(), String> {
    eprintln!("[island] island_expand() called");
    #[cfg(target_os = "windows")]
    {
        let prev = ISLAND_EXPANDED.swap(true, Ordering::SeqCst);
        LAST_EXPAND_CHANGE_MS.store(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            Ordering::Relaxed,
        );
        eprintln!("[island] expand() -- ISLAND_EXPANDED: {prev} -> true");
    }
    Ok(())
}

/// Diagnostics command -- dumps current island state.
#[tauri::command]
pub fn island_dump_state() -> Result<serde_json::Value, String> {
    #[cfg(target_os = "windows")]
    {
        let expanded = ISLAND_EXPANDED.load(Ordering::Relaxed);
        let toggle_secs = seconds_since_last_toggle();
        Ok(serde_json::json!({
            "expanded": expanded,
            "seconds_since_last_toggle": toggle_secs,
            "stuck_warning": expanded && toggle_secs > 10.0,
        }))
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(serde_json::json!({
            "expanded": null,
            "note": "ISLAND_EXPANDED only tracked on Windows"
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

#[tauri::command]
pub fn focus_main_window(app: AppHandle) -> Result<(), String> {
    eprintln!("[island] focus_main_window() called");
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e: tauri::Error| e.to_string())?;
        window
            .set_focus()
            .map_err(|e: tauri::Error| e.to_string())?;
        eprintln!("[island] focus_main_window: main window focused");
    } else {
        eprintln!("[island] focus_main_window: main window not found");
    }
    Ok(())
}

/// Set the voice engine state on the Dynamic Island.
/// This is called from the main window's VoiceEngine store to update the island window's
/// active module state (recording timer, status, etc.).
/// Pass `null` (None) to clear the voice module from the island.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceIslandState {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub activity_type: Option<String>,
}

#[tauri::command]
pub fn voice_set_island_state(
    app: AppHandle,
    state: Option<VoiceIslandState>,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("island") else {
        eprintln!("[voice] voice_set_island_state: island window not found");
        return Err("island window not found".into());
    };
    let is_active = state.is_some();
    window
        .emit("voice:island-state-changed", &state)
        .map_err(|e| format!("failed to emit island state: {e}"))?;
    eprintln!(
        "[voice] voice_set_island_state: emitted state={}",
        if is_active { "active" } else { "null" }
    );
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

    eprintln!("[island] set_island_enabled({enabled}) called");

    if enabled {
        #[cfg(target_os = "windows")]
        {
            ISLAND_EXPANDED.store(false, Ordering::SeqCst);
            LAST_EXPAND_CHANGE_MS.store(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64,
                Ordering::Relaxed,
            );
        }

        if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
            eprintln!("[island] set_background_color on re-enable failed: {e}");
        }

        position_top_center_expanded(&window).unwrap_or_else(|e| {
            eprintln!("[island] reposition on re-enable failed: {e}");
        });

        window.show().map_err(|e| e.to_string())?;

        let _ = window.emit("island:hide", ());

        #[cfg(target_os = "windows")]
        {
            let _ = window.set_ignore_cursor_events(false);
            start_mouse_monitor(app.clone());
        }

        eprintln!("[island] set_island_enabled(true): complete");
    } else {
        window.hide().map_err(|e| e.to_string())?;
        eprintln!("[island] set_island_enabled(false): window hidden");
    }

    Ok(())
}
