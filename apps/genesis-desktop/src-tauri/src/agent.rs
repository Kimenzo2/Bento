// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::spawn_timeout;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};

use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WebviewWindow, WebviewWindowBuilder};

/// macOS window level for the agent dock — NSFloatingWindowLevel (5).
/// Above normal windows but below the menu bar, so the dock is always reachable.
#[cfg(target_os = "macos")]
const AGENT_MACOS_WINDOW_LEVEL: i64 = 5;

/// macOS collection behavior: visible on all Spaces + fullscreen auxiliary.
#[cfg(target_os = "macos")]
const AGENT_MACOS_COLLECTION_BEHAVIOR: i64 = 0 | (1 << 1) | (1 << 8);

// ── Screen capture via xcap (no browser permission dialog) ────────────────

/// Capture the primary monitor as a base64-encoded JPEG data URI.
///
/// Uses the `xcap` crate to capture the screen directly from the OS,
/// bypassing the browser's `getDisplayMedia()` API entirely.
/// The result is a `data:image/jpeg;base64,...` string ready for `<img>`.
///
/// Runs on tokio's blocking thread pool via `spawn_timeout!` because
/// xcap screen capture is a synchronous OS call that can take 100-500ms
/// and would otherwise block the main IPC thread.
///
/// # Errors
/// - No primary monitor found
/// - xcap capture failure
/// - JPEG encoding failure
#[tauri::command]
pub async fn capture_screen() -> Result<String, String> {
    spawn_timeout!(15, {
        eprintln!("[capture_screen] starting...");
        use base64::Engine;
        use std::io::Cursor;
        use xcap::Monitor;

        let monitors = match Monitor::all() {
            Ok(m) => {
                eprintln!("[capture_screen] found {} monitors", m.len());
                m
            }
            Err(e) => {
                eprintln!("[capture_screen] FAILED to enumerate monitors: {e}");
                return Err(format!("Failed to enumerate monitors: {e}"));
            }
        };

        let monitor = match monitors
            .into_iter()
            .find(|m| m.is_primary().unwrap_or(false))
        {
            Some(m) => {
                eprintln!("[capture_screen] found primary monitor");
                m
            }
            None => {
                eprintln!("[capture_screen] FAILED: no primary monitor");
                return Err("No primary monitor found".to_string());
            }
        };

        let image = match monitor.capture_image() {
            Ok(img) => {
                eprintln!(
                    "[capture_screen] captured image: {}x{}",
                    img.width(),
                    img.height()
                );
                img
            }
            Err(e) => {
                eprintln!("[capture_screen] FAILED to capture image: {e}");
                return Err(format!("Failed to capture screen: {e}"));
            }
        };

        // xcap returns ImageBuffer<Rgba<u8>> — wrap in DynamicImage for JPEG encoding
        let dyn_img = image::DynamicImage::from(image);
        let mut buf = Cursor::new(Vec::new());
        if let Err(e) = dyn_img.write_to(&mut buf, image::ImageFormat::Jpeg) {
            eprintln!("[capture_screen] FAILED to encode JPEG: {e}");
            return Err(format!("Failed to encode JPEG: {e}"));
        }

        let bytes = buf.into_inner();
        let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let result = format!("data:image/jpeg;base64,{b64}");
        eprintln!(
            "[capture_screen] success: {} bytes, {} base64 chars",
            bytes.len(),
            b64.len()
        );
        Ok(result)
    })
}

/// Get the agent window if it exists, or create it programmatically.
/// This avoids spawning a hidden WebView2 process for users who have the
/// agent dock disabled (the default).
///
/// When creating a new window, `init_agent_window` is called automatically
/// so the window is fully initialized regardless of which code path triggers
/// its first creation.
fn get_or_create_agent_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window("agent") {
        return Ok(window);
    }
    let window = WebviewWindowBuilder::new(app, "agent", tauri::WebviewUrl::App("/agent".into()))
        .title("Bento Agent")
        .inner_size(AGENT_W, AGENT_H)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .visible(false)
        .build()
        .map_err(|e| e.to_string())?;
    init_agent_window(&window);
    Ok(window)
}

/// Compact dimensions when idle — only the dock bar is visible.
const AGENT_W: f64 = 340.0;
const AGENT_H: f64 = 60.0;

/// Window procedure for the agent dock — handles WM_NCHITTEST to provide
/// per-pixel click-through outside the interactive dock bounds.
#[cfg(target_os = "windows")]
static ORIGINAL_AGENT_WNDPROC: std::sync::atomic::AtomicUsize =
    std::sync::atomic::AtomicUsize::new(0);

/// Tracks whether the agent WebView2 window is currently shown (visible).
/// Used by the global shortcut handler to avoid a blocking `is_visible()` IPC
/// call from the shortcut thread (same pattern as ISLAND_VISIBLE).
/// Updated atomically by all show/hide operations.
pub(crate) static AGENT_VISIBLE: AtomicBool = AtomicBool::new(false);

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

/// Apply visual properties and positioning to the agent window.
/// Shared between first-time setup and runtime re-enable.
fn init_agent_window(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "windows")]
    remove_class_shadow(window).unwrap_or_else(|e| {
        eprintln!("[agent] remove_class_shadow failed: {e}");
    });

    if let Err(e) = window.set_background_color(Some(tauri::webview::Color(0, 0, 0, 0))) {
        eprintln!("[agent] set_background_color failed: {e}");
    }

    #[cfg(target_os = "macos")]
    if let Err(e) = set_agent_macos_window_level(window) {
        eprintln!("[agent] macOS window level setup failed: {e}");
    }
}

/// Setup the agent dock window — transparency, shadow removal, positioning.
pub fn setup_agent_window(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = get_or_create_agent_window(app.handle())?;

    init_agent_window(&window);

    // Install WM_NCHITTEST hook + WS_EX_NOACTIVATE for per-pixel click-through.
    #[cfg(target_os = "windows")]
    if let Err(e) = prepare_agent_window_for_hit_test(&window) {
        eprintln!("[agent] hit test setup failed: {e}");
    }

    Ok(())
}

/// Signal the mouse monitor thread to shut down.
/// No-op since the polling thread was replaced with WM_NCHITTEST.
pub fn stop_mouse_monitor() {}

/// Apply WS_EX_NOACTIVATE + subclass agent window with WM_NCHITTEST.
///
/// - WS_EX_NOACTIVATE prevents the transparent agent window from stealing focus.
/// - WM_NCHITTEST returns HTTRANSPARENT outside the interactive dock bounds for
///   per-pixel click-through without a polling thread.
#[cfg(target_os = "windows")]
fn prepare_agent_window_for_hit_test(
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
        // WS_EX_LAYERED: required for true per-pixel transparency on Windows.
        // WS_EX_NOACTIVATE: prevents the transparent window from stealing focus.
        SetWindowLongW(
            hwnd,
            GWL_EXSTYLE,
            ex_style | (WS_EX_NOACTIVATE as i32) | (WS_EX_LAYERED as i32),
        );

        let prev = SetWindowLongPtrW(
            hwnd,
            GWLP_WNDPROC,
            agent_hit_test_proc as *const () as isize,
        );
        ORIGINAL_AGENT_WNDPROC.store(prev as usize, Ordering::Relaxed);
    }

    eprintln!("[agent] WM_NCHITTEST hook + WS_EX_NOACTIVATE + WS_EX_LAYERED applied");
    Ok(())
}

/// Custom window procedure: returns HTTRANSPARENT outside the interactive dock bounds.
/// The dock sits at the bottom of the window — only the visible dock bar area
/// receives mouse events; the transparent area above passes clicks through.
#[cfg(target_os = "windows")]
unsafe extern "system" fn agent_hit_test_proc(
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
            let _win_w = (rect.right - rect.left) as f64;
            let win_h = (rect.bottom - rect.top) as f64;

            let dock_w = AGENT_CURRENT_W.load(Ordering::Relaxed) as f64;
            let dock_h = AGENT_CURRENT_H.load(Ordering::Relaxed) as f64;

            let inside = (cursor_x as f64) >= win_x
                && (cursor_x as f64) <= win_x + dock_w
                && (cursor_y as f64) >= win_y + win_h - dock_h
                && (cursor_y as f64) <= win_y + win_h;

            if !inside {
                return HTTRANSPARENT;
            }
        }
    }

    let original = ORIGINAL_AGENT_WNDPROC.load(std::sync::atomic::Ordering::Relaxed);
    if original != 0 {
        let proc: unsafe extern "system" fn(isize, u32, usize, isize) -> isize =
            std::mem::transmute(original);
        CallWindowProcW(Some(proc), hwnd, msg, wparam, lparam)
    } else {
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

/// Set the macOS window level and collection behavior for the agent dock.
/// Using objc2 msg_send! on the NSWindow obtained from the webview's view.
#[cfg(target_os = "macos")]
fn set_agent_macos_window_level(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    use objc2::runtime::AnyObject;
    use objc2::*;
    use raw_window_handle::HasWindowHandle;

    let handle = window.window_handle()?;
    let raw_window_handle::RawWindowHandle::AppKit(appkit) = handle.as_raw() else {
        return Err("unexpected non-AppKit raw window handle".into());
    };

    unsafe {
        let ns_view = appkit.ns_view.as_ptr() as *mut AnyObject;
        let ns_win: *mut AnyObject = msg_send![ns_view, window];
        let _: () = msg_send![ns_win, setLevel: AGENT_MACOS_WINDOW_LEVEL];
        let _: () = msg_send![ns_win, setCollectionBehavior: AGENT_MACOS_COLLECTION_BEHAVIOR];
    }

    Ok(())
}

/// Dynamic size for hit-test (set by ResizeObserver in frontend).
static AGENT_CURRENT_W: AtomicI32 = AtomicI32::new(AGENT_W as i32);
static AGENT_CURRENT_H: AtomicI32 = AtomicI32::new(AGENT_H as i32);

/// Resize the agent window to the exact content size reported by the frontend.
/// This enables flexible sizing for screenshots, large text, and other dynamic content.
///
/// Stores dimensions in atomics immediately for hit-testing, then schedules the
/// WebView2 compositor calls (set_size + set_position) on the main thread via
/// run_on_main_thread so the IPC thread is never blocked.
#[tauri::command]
pub fn agent_set_size(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = get_or_create_agent_window(&app)?;

    // Clamp to screen dimensions (use 80% of monitor as max to avoid off-screen).
    let max_w = 1200.0_f64;
    let max_h = 900.0_f64;
    let w = width.max(AGENT_W as f64).min(max_w) as i32;
    let h = height.max(AGENT_H as f64).min(max_h) as i32;

    // Only resize if dimensions changed significantly (prevents resize loops).
    // 3px tolerance absorbs sub-pixel content flicker that causes rapid resize
    // oscillation on WebView2 when content re-lays out after a native resize.
    let prev_w = AGENT_CURRENT_W.load(Ordering::Relaxed);
    let prev_h = AGENT_CURRENT_H.load(Ordering::Relaxed);
    if (w - prev_w).abs() <= 3 && (h - prev_h).abs() <= 3 {
        return Ok(());
    }

    // Update atomics immediately — WM_NCHITTEST uses these for hit-test bounds,
    // so they reflect the new size even before the compositor finishes.
    AGENT_CURRENT_W.store(w, Ordering::Relaxed);
    AGENT_CURRENT_H.store(h, Ordering::Relaxed);

    // Schedule compositor work on the main thread to avoid blocking IPC.
    let _ = app.run_on_main_thread(move || {
        let scale = window.scale_factor().unwrap_or(1.0);
        let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: (w as f64 * scale) as u32,
            height: (h as f64 * scale) as u32,
        }));
    });

    #[cfg(debug_assertions)]
    eprintln!("[agent] agent_set_size({w}, {h})");
    Ok(())
}

/// Shared logic for showing the agent window: position, click-through, show, focus.
/// Creates the window if it doesn't exist yet (lazy init).
fn show_agent_window_impl(app: &AppHandle) -> Result<(), String> {
    let window = get_or_create_agent_window(app)?;

    window.show().map_err(|e| e.to_string())?;
    AGENT_VISIBLE.store(true, Ordering::SeqCst);

    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle the agent window visibility.
/// Uses `AGENT_VISIBLE` atomic to avoid a blocking `is_visible()` WebView2 IPC
/// call from the shortcut thread or tray event handler.
#[tauri::command]
pub fn toggle_agent(app: AppHandle) -> Result<(), String> {
    let window = get_or_create_agent_window(&app)?;

    if AGENT_VISIBLE.load(Ordering::SeqCst) {
        window.hide().map_err(|e| e.to_string())?;
        AGENT_VISIBLE.store(false, Ordering::SeqCst);
    } else {
        show_agent_window_impl(&app)?;
        // show_agent_window_impl sets AGENT_VISIBLE internally
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
    let window = get_or_create_agent_window(&app)?;
    window.hide().map_err(|e| e.to_string())?;
    AGENT_VISIBLE.store(false, Ordering::SeqCst);
    Ok(())
}

/// Start dragging the agent window. Pauses the mouse monitor during drag.
#[tauri::command]
pub fn agent_start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

/// Set up the system tray icon with context menu.
///
/// - Left-click: toggles the agent window.
/// - Right-click menu: Show Agent / Hide Agent / Quit
///
/// The tray persists even when all windows are hidden, allowing the app
/// to run in the background permanently.
pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder};

    let show = MenuItemBuilder::with_id("show_agent", "Show Agent").build(app)?;
    let hide = MenuItemBuilder::with_id("hide_agent", "Hide Agent").build(app)?;
    let sep = tauri::menu::PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit Bento").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &hide, &sep, &quit])
        .build()?;

    let Some(icon) = app.default_window_icon().cloned() else {
        eprintln!("[agent] no default window icon found, skipping tray setup");
        return Ok(());
    };

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = crate::agent::toggle_agent(app.clone());
            }
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_agent" => {
                let _ = crate::agent::show_agent(app.clone());
            }
            "hide_agent" => {
                let _ = crate::agent::hide_agent(app.clone());
            }
            "quit" => {
                // Signal mouse monitor to stop, then use the existing graceful shutdown path
                // (saves state, emits lifecycle events, closes DB connections).
                stop_mouse_monitor();
                let _ = crate::commands::quit_app(app.clone());
            }
            _ => {}
        })
        .build(app)?;

    eprintln!("[agent] tray icon created");
    Ok(())
}

/// Enable or disable the Agent Dock at runtime.
/// When disabled, the agent window is hidden and the mouse monitor is stopped.
/// When re-enabled, the window is shown (it was pre-created at startup so
/// only fast `show()`/`hide()` calls are made — no WebView2 creation).
///
/// SAFETY: WebviewWindowBuilder::build() MUST run on the main thread
/// (Windows Win32 thread affinity). The window is pre-created during
/// app startup in lib.rs so this command never touches the builder.
///
/// Compositor calls (show/hide/set_position) are scheduled on the main
/// thread via run_on_main_thread to avoid blocking the IPC thread.
/// AGENT_VISIBLE is updated immediately for the shortcut handler.
#[tauri::command]
pub fn set_agent_dock_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    eprintln!("[agent] set_agent_dock_enabled({enabled}) called");

    let window = match get_or_create_agent_window(&app) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[agent] set_agent_dock_enabled: failed to get/create window: {e}");
            return Err(format!("Failed to get/create agent window: {e}"));
        }
    };

    if enabled {
        AGENT_VISIBLE.store(true, Ordering::SeqCst);
        let _ = app.run_on_main_thread(move || {
            let _ = window.show();
        });
        eprintln!("[agent] set_agent_dock_enabled(true): complete");
    } else {
        AGENT_VISIBLE.store(false, Ordering::SeqCst);
        stop_mouse_monitor();
        let _ = app.run_on_main_thread(move || {
            let _ = window.hide();
        });
        eprintln!("[agent] set_agent_dock_enabled(false): window hidden, monitor stopped");
    }

    Ok(())
}

/// Focus the main Bento window from the agent.
///
/// Schedules show + set_focus on the main thread via run_on_main_thread
/// so the IPC thread is never blocked by synchronous WebView2 compositor
/// calls (is_visible, show, set_focus). Whether the window was previously
/// hidden or visible, show() is always safe (no-op if already visible).
/// Errors are discarded — the user can manually refocus if this fails.
#[tauri::command]
pub fn focus_main_from_agent(app: AppHandle) -> Result<(), String> {
    let app_clone = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(window) = app_clone.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    });
    Ok(())
}
