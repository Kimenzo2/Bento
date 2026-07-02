use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::LazyLock;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager, WebviewWindow};

/// Compact dimensions when idle — only the dock bar is visible.
const AGENT_W: f64 = 340.0;
const AGENT_H: f64 = 60.0;
/// Expanded height when the composer or listening panel is open.
const AGENT_H_EXPANDED: f64 = 200.0;

/// Cursor polling interval in milliseconds (~30 fps like island).
const POLL_MS: u64 = 33;
/// Margin (px) for entering the dock hit area.
const ENTER_MARGIN: f64 = 10.0;
/// Larger margin for exiting — prevents flickering at the boundary.
const EXIT_MARGIN: f64 = 30.0;
/// Cooldown after showing the window before the mouse monitor starts toggling.
/// Prevents the race where show() forces click-through OFF then the monitor
/// immediately forces it back ON because the cursor hasn't moved yet.
const SHOW_COOLDOWN_MS: u64 = 300;
/// Maximum consecutive hidden polls before the monitor thread self-destructs.
/// At 33ms per poll, 200 polls ≈ 6.6 seconds of being hidden.
/// Prevents zombie thread accumulation (S1 fix).
const MAX_HIDDEN_POLLS: u32 = 200;

static INITIAL_POSITION_SET: AtomicBool = AtomicBool::new(false);
/// When true, the composer is open — expands the hit area vertically.
static COMPOSER_OPEN: AtomicBool = AtomicBool::new(false);
/// When true, the mouse monitor pauses — set during drag operations.
static DRAG_IN_PROGRESS: AtomicBool = AtomicBool::new(false);
/// Timestamp (ms since process start) when the window was last shown.
/// The mouse monitor ignores toggle requests during the cooldown after show.
static SHOW_TIMESTAMP_MS: AtomicU64 = AtomicU64::new(0);
/// Signal for the mouse monitor thread to stop (S1 fix: no zombie threads).
static MONITOR_STOP: AtomicBool = AtomicBool::new(false);

/// Remove the CS_DROPSHADOW class style from the window class.
/// Prevents DWM from drawing drop shadows on this transparent window.
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

/// Setup the agent dock window — transparency, shadow removal, positioning.
pub fn setup_agent_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Ensure any previous monitor is stopped (defensive — should not happen at setup).
    MONITOR_STOP.store(true, Ordering::SeqCst);
    thread::sleep(Duration::from_millis(POLL_MS * 2));
    MONITOR_STOP.store(false, Ordering::SeqCst);

    let Some(window) = app.get_webview_window("agent") else {
        eprintln!("[agent] window not found in config");
        return Ok(());
    };

    // Strip the DWM drop-shadow — required for transparent windows on Windows.
    #[cfg(target_os = "windows")]
    remove_class_shadow(&window).unwrap_or_else(|e| {
        eprintln!("[agent] remove_class_shadow failed: {e}");
    });

    // Transparent webview background — prevents white flash.
    // MUST happen before show() on Windows.
    if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
        eprintln!("[agent] set_background_color failed: {e}");
    }

    // Pre-warm the webview compositor so the first frame is transparent.
    #[cfg(target_os = "windows")]
    {
        let _ = window.eval("document.body.style.background='transparent'");
    }

    // Position at bottom-right.
    position_bottom_right(&window, false).unwrap_or_else(|e| {
        eprintln!("[agent] initial positioning failed: {e}");
    });
    INITIAL_POSITION_SET.store(true, Ordering::SeqCst);

    // Start the mouse monitor — toggles click-through based on cursor position.
    start_mouse_monitor(app.handle().clone());

    Ok(())
}

/// Signal the mouse monitor thread to shut down.
/// Called on app teardown or when the agent window is permanently disabled.
pub fn stop_mouse_monitor() {
    MONITOR_STOP.store(true, Ordering::SeqCst);
}

/// Background thread that polls the cursor position and toggles click-through.
///
/// When the cursor is within (or near) the dock window bounds, click-through
/// is disabled so the user can click the dock. When the cursor is outside,
/// click-through is enabled — clicks pass through the transparent window.
///
/// Hysteresis (larger exit margin) prevents flickering at the boundary.
///
/// SAFETY: Self-terminates after MAX_HIDDEN_POLLS consecutive hidden polls
/// to prevent zombie thread accumulation (island.rs pattern + our own MONITOR_STOP).
#[cfg(target_os = "windows")]
fn start_mouse_monitor(app: AppHandle) {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let _ = thread::Builder::new()
        .name("agent-mouse-monitor".into())
        .spawn(move || {
            let mut was_inside = false;
            let mut hidden_count: u32 = 0;

            loop {
                thread::sleep(Duration::from_millis(POLL_MS));

                // S1: Check stop signal — allows clean shutdown.
                if MONITOR_STOP.load(Ordering::Relaxed) {
                    eprintln!("[agent] mouse monitor stopped via signal");
                    return;
                }

                let Some(window) = app.get_webview_window("agent") else {
                    eprintln!("[agent] mouse monitor: window gone, exiting");
                    return;
                };

                // Skip when hidden — track consecutive hidden polls to self-destruct.
                if !window.is_visible().unwrap_or(false) {
                    hidden_count += 1;
                    if hidden_count > MAX_HIDDEN_POLLS {
                        eprintln!("[agent] mouse monitor: hidden too long, exiting");
                        return; // thread exits
                    }
                    was_inside = false;
                    continue;
                }
                hidden_count = 0;

                // Pause during drag.
                if DRAG_IN_PROGRESS.load(Ordering::Relaxed) {
                    was_inside = false;
                    continue;
                }

                // Respect cooldown after show — don't fight with the show command's
                // set_ignore_cursor_events(false). The cursor may not be over
                // the dock yet, so we'd immediately re-enable click-through.
                let now_ms = now_millis();
                let show_ts = SHOW_TIMESTAMP_MS.load(Ordering::Relaxed);
                if show_ts > 0 && now_ms.saturating_sub(show_ts) < SHOW_COOLDOWN_MS {
                    was_inside = false;
                    continue;
                }

                let mut pt = POINT { x: 0, y: 0 };
                if unsafe { GetCursorPos(&mut pt) } == 0 {
                    continue;
                }

                let Ok(pos) = window.outer_position() else { continue; };
                let Ok(size) = window.outer_size() else { continue; };

                let win_x = pos.x as f64;
                let win_y = pos.y as f64;
                let win_h = size.height as f64;

                // Expand hit area when composer is open.
                let dock_h = if COMPOSER_OPEN.load(Ordering::Relaxed) {
                    AGENT_H_EXPANDED
                } else {
                    AGENT_H
                };

                // Dock sits at the bottom-right of the window.
                let dock_x = win_x;
                let dock_y = win_y + (win_h - dock_h);

                let margin = if was_inside { EXIT_MARGIN } else { ENTER_MARGIN };

                let inside = pt.x as f64 >= dock_x - margin
                    && pt.x as f64 <= dock_x + AGENT_W + margin
                    && pt.y as f64 >= dock_y - margin
                    && pt.y as f64 <= dock_y + dock_h + margin;

                if inside != was_inside {
                    was_inside = inside;
                    if let Err(e) = window.set_ignore_cursor_events(!inside) {
                        eprintln!("[agent] set_ignore_cursor_events failed: {e}");
                    }
                }
            }
        });
}

#[cfg(not(target_os = "windows"))]
fn start_mouse_monitor(_app: AppHandle) {}

/// Get current time in milliseconds since process start.
fn now_millis() -> u64 {
    static START: LazyLock<std::time::Instant> = LazyLock::new(std::time::Instant::now);
    START.elapsed().as_millis() as u64
}

/// Position the agent window at bottom-right of the primary monitor.
/// `expanded` accounts for the composer being open.
fn position_bottom_right(
    window: &WebviewWindow,
    expanded: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let Some(monitor) = window.app_handle().primary_monitor()? else {
        return Err("no primary monitor found".into());
    };

    let monitor_pos = monitor.position();
    let physical_w = monitor.size().width as i32;
    let physical_h = monitor.size().height as i32;
    let scale = monitor.scale_factor();

    let win_h = if expanded { AGENT_H_EXPANDED } else { AGENT_H };
    let win_phys_w = (AGENT_W * scale) as i32;
    let win_phys_h = (win_h * scale) as i32;

    let x = monitor_pos.x + physical_w - win_phys_w - (24.0 * scale) as i32;
    let y = monitor_pos.y + physical_h - win_phys_h - (24.0 * scale) as i32;

    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
        x: x.max(monitor_pos.x),
        y: y.max(monitor_pos.y),
    }))?;
    Ok(())
}

/// Shared logic for showing the agent window: position, click-through, show, focus.
/// Returns the window handle on success.
fn show_agent_window_impl(app: &AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("agent") else {
        return Err("agent window not found".into());
    };

    if !INITIAL_POSITION_SET.swap(true, Ordering::SeqCst) {
        position_bottom_right(&window, false).unwrap_or_else(|e| {
            eprintln!("[agent] initial position on show failed: {e}");
        });
    }

    // Record show timestamp BEFORE show() so the cooldown covers the entire operation.
    SHOW_TIMESTAMP_MS.store(now_millis(), Ordering::SeqCst);

    window.show().map_err(|e| e.to_string())?;

    // S2: Set click-through OFF AFTER show(), not before.
    // This avoids the race where set_ignore_cursor_events(false) is overwritten
    // by the monitor's first poll before the cooldown kicks in.
    #[cfg(target_os = "windows")]
    if let Err(e) = window.set_ignore_cursor_events(false) {
        eprintln!("[agent] set_ignore_cursor_events(false) after show failed: {e}");
    }

    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle the agent window visibility.
#[tauri::command]
pub fn toggle_agent(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("agent") else {
        return Err("agent window not found".into());
    };

    if window.is_visible().unwrap_or(false) {
        window.hide().map_err(|e| e.to_string())?;
        // Reset composer state on hide so next show starts clean.
        COMPOSER_OPEN.store(false, Ordering::SeqCst);
    } else {
        show_agent_window_impl(&app)?;
    }
    Ok(())
}

/// Show and focus the agent window.
#[tauri::command]
pub fn show_agent(app: AppHandle) -> Result<(), String> {
    show_agent_window_impl(&app)
}

/// Hide the agent window.
#[tauri::command]
pub fn hide_agent(app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window("agent") else {
        return Err("agent window not found".into());
    };
    COMPOSER_OPEN.store(false, Ordering::SeqCst);
    window.hide().map_err(|e| e.to_string())?;
    Ok(())
}

/// Notify the mouse monitor that the composer state changed.
#[tauri::command]
pub fn agent_set_composer_open(open: bool) {
    COMPOSER_OPEN.store(open, Ordering::SeqCst);
}

/// Start dragging the agent window. Pauses the mouse monitor during drag.
#[tauri::command]
pub fn agent_start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    DRAG_IN_PROGRESS.store(true, Ordering::SeqCst);
    let result = window.start_dragging().map_err(|e| e.to_string());
    DRAG_IN_PROGRESS.store(false, Ordering::SeqCst);
    result
}

/// Focus the main Bento window from the agent.
///
/// SAFETY: Never throws if the main window is gone.
/// The main window is shown only if it was previously visible; if it was
/// intentionally hidden/minimized by the user, we respect that state.
#[tauri::command]
pub fn focus_main_from_agent(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Only attempt to show + focus if the window is already visible.
        // If the user minimized or hid the main window, don't force it back.
        if window.is_visible().unwrap_or(false) {
            let _ = window.set_focus().map_err(|e: tauri::Error| e.to_string());
        } else {
            // Window exists but is hidden — bring it back as the user expects
            // (they initiated an action in the agent that requires the main window).
            window.show().map_err(|e: tauri::Error| e.to_string())?;
            window.set_focus().map_err(|e: tauri::Error| e.to_string())?;
        }
    }
    Ok(())
}
