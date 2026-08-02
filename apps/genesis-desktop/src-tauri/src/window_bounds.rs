#![cfg_attr(debug_assertions, allow(dead_code))]
// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use tauri::{Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};
#[cfg(not(debug_assertions))]
use tauri_plugin_window_state::{StateFlags, WindowExt};

const MIN_SHELL_WIDTH: u32 = 1024;
const MIN_SHELL_HEIGHT: u32 = 680;
const DEFAULT_SHELL_WIDTH: u32 = 1280;
const DEFAULT_SHELL_HEIGHT: u32 = 800;
const VISIBILITY_THRESHOLD: f64 = 0.95;

#[derive(Clone, Copy)]
struct Bounds {
    left: i64,
    top: i64,
    right: i64,
    bottom: i64,
}

impl Bounds {
    fn width(self) -> i64 {
        self.right - self.left
    }
    fn height(self) -> i64 {
        self.bottom - self.top
    }
    fn area(self) -> u64 {
        self.width().max(0) as u64 * self.height().max(0) as u64
    }
}

fn bounds_from_position(position: PhysicalPosition<i32>, size: PhysicalSize<u32>) -> Bounds {
    Bounds {
        left: position.x as i64,
        top: position.y as i64,
        right: position.x as i64 + size.width as i64,
        bottom: position.y as i64 + size.height as i64,
    }
}

fn bounds_from_monitor(monitor: &Monitor) -> Bounds {
    let work_area = monitor.work_area();
    Bounds {
        left: work_area.position.x as i64,
        top: work_area.position.y as i64,
        right: work_area.position.x as i64 + work_area.size.width as i64,
        bottom: work_area.position.y as i64 + work_area.size.height as i64,
    }
}

fn intersection_area(a: Bounds, b: Bounds) -> u64 {
    let left = a.left.max(b.left);
    let top = a.top.max(b.top);
    let right = a.right.min(b.right);
    let bottom = a.bottom.min(b.bottom);
    if right <= left || bottom <= top {
        0
    } else {
        ((right - left) as u64) * ((bottom - top) as u64)
    }
}

fn best_monitor(window_bounds: Bounds, monitors: &[Monitor]) -> Option<&Monitor> {
    monitors
        .iter()
        .max_by_key(|m| intersection_area(window_bounds, bounds_from_monitor(m)))
}

fn should_recenter_window(window_bounds: Bounds, monitors: &[Monitor]) -> bool {
    let window_area = window_bounds.area();
    if window_area == 0 || monitors.is_empty() {
        return true;
    }
    let best_visible = monitors
        .iter()
        .map(|m| intersection_area(window_bounds, bounds_from_monitor(m)))
        .max()
        .unwrap_or(0);
    (best_visible as f64) < (window_area as f64) * VISIBILITY_THRESHOLD
}

fn recenter_and_show(window: &WebviewWindow) -> tauri::Result<()> {
    if window.is_maximized()? {
        window.unmaximize()?;
    }
    window.center()?;
    window.show()?;
    #[cfg(target_os = "windows")]
    {
        // Tauri/WebView2 can lose all click input after a hidden window is
        // shown again. Re-toggling resizable restores input on Windows and is
        // already used on the main startup path.
        window.set_resizable(false)?;
        window.set_resizable(true)?;
    }
    window.set_focus()?;
    Ok(())
}

fn fit_shell_to_monitor(window: &WebviewWindow, monitor: &Monitor) -> tauri::Result<()> {
    if window.is_maximized()? {
        window.unmaximize()?;
    }
    let work_area = monitor.work_area();
    let target_w = DEFAULT_SHELL_WIDTH.min(work_area.size.width.max(1));
    let target_h = DEFAULT_SHELL_HEIGHT.min(work_area.size.height.max(1));
    let target_x =
        work_area.position.x + ((work_area.size.width.saturating_sub(target_w)) / 2) as i32;
    let target_y =
        work_area.position.y + ((work_area.size.height.saturating_sub(target_h)) / 2) as i32;
    window.set_size(tauri::Size::Physical(PhysicalSize::new(target_w, target_h)))?;
    window.set_position(tauri::Position::Physical(PhysicalPosition::new(
        target_x, target_y,
    )))?;
    window.show()?;
    #[cfg(target_os = "windows")]
    {
        // Match the startup workaround so transition-to-shell does not leave
        // the webview visible but non-interactive on Windows.
        window.set_resizable(false)?;
        window.set_resizable(true)?;
    }
    window.set_focus()?;
    Ok(())
}

fn enforce_min_shell_size(window: &WebviewWindow) -> tauri::Result<()> {
    if let Ok(current_size) = window.outer_size() {
        let new_w = current_size.width.max(MIN_SHELL_WIDTH);
        let new_h = current_size.height.max(MIN_SHELL_HEIGHT);
        if new_w != current_size.width || new_h != current_size.height {
            window.set_size(tauri::Size::Physical(PhysicalSize::new(new_w, new_h)))?;
        }
    }
    Ok(())
}

fn clamp_to_monitor_area(window: &WebviewWindow, monitors: &[Monitor]) -> tauri::Result<()> {
    let position = match window.outer_position() {
        Ok(p) => p,
        Err(_) => return Ok(()),
    };
    let size = match window.outer_size() {
        Ok(s) => s,
        Err(_) => return Ok(()),
    };
    let window_bounds = bounds_from_position(position, size);
    let monitor = match best_monitor(window_bounds, monitors) {
        Some(m) => m,
        None => return Ok(()),
    };
    let mb = bounds_from_monitor(monitor);
    let new_w = (size.width as i64).min(mb.width()).max(1) as u32;
    let new_h = (size.height as i64).min(mb.height()).max(1) as u32;
    let mut new_x = position.x as i64;
    let mut new_y = position.y as i64;
    if new_x < mb.left {
        new_x = mb.left;
    }
    if new_y < mb.top {
        new_y = mb.top;
    }
    if new_x + new_w as i64 > mb.right {
        new_x = (mb.right - new_w as i64).max(mb.left);
    }
    if new_y + new_h as i64 > mb.bottom {
        new_y = (mb.bottom - new_h as i64).max(mb.top);
    }
    let pos_changed = new_x != position.x as i64 || new_y != position.y as i64;
    let size_changed = new_w != size.width || new_h != size.height;
    if size_changed {
        window.set_size(tauri::Size::Physical(PhysicalSize::new(new_w, new_h)))?;
    }
    if pos_changed {
        window.set_position(tauri::Position::Physical(PhysicalPosition::new(
            new_x as i32,
            new_y as i32,
        )))?;
    }
    Ok(())
}

/// Transition from narrow login window → full shell.
/// Dev builds: just maximize + show.
/// Release builds: fit the shell to the active monitor work area.
pub fn transition_to_shell(window: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(not(debug_assertions))]
    {
        let monitors = window.available_monitors().unwrap_or_default();
        if let Ok(position) = window.outer_position() {
            if let Ok(size) = window.outer_size() {
                let window_bounds = bounds_from_position(position, size);
                if let Some(monitor) =
                    best_monitor(window_bounds, &monitors).or_else(|| monitors.first())
                {
                    fit_shell_to_monitor(window, monitor)?;
                    return Ok(());
                }
            }
        }
        if let Some(monitor) = monitors.first() {
            fit_shell_to_monitor(window, monitor)?;
            return Ok(());
        }
    }
    window.maximize()?;
    window.show()?;
    window.set_focus()?;
    Ok(())
}

/// Restore the main window from tray/hidden state.
/// Dev builds: set default size, center, show.
/// Release builds: restore full saved state with bounds checking.
pub fn restore_main_window(window: &WebviewWindow) -> tauri::Result<()> {
    #[cfg(not(debug_assertions))]
    {
        let restore_flags = StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED;
        window.restore_state(restore_flags)?;
        enforce_min_shell_size(window)?;
        let monitors = window.available_monitors()?;
        let position = match window.outer_position() {
            Ok(p) => p,
            Err(_) => return recenter_and_show(window),
        };
        let size = match window.outer_size() {
            Ok(s) => s,
            Err(_) => return recenter_and_show(window),
        };
        let window_bounds = bounds_from_position(position, size);
        if size.width < MIN_SHELL_WIDTH || size.height < MIN_SHELL_HEIGHT {
            if let Some(monitor) =
                best_monitor(window_bounds, &monitors).or_else(|| monitors.first())
            {
                fit_shell_to_monitor(window, monitor)?;
                return Ok(());
            }
            return recenter_and_show(window);
        }
        if should_recenter_window(window_bounds, &monitors) {
            recenter_and_show(window)?;
            return Ok(());
        }
        clamp_to_monitor_area(window, &monitors)?;
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    // Dev: simple center + show at default size
    #[cfg(debug_assertions)]
    {
        window.set_size(tauri::Size::Physical(PhysicalSize::new(
            DEFAULT_SHELL_WIDTH,
            DEFAULT_SHELL_HEIGHT,
        )))?;
        recenter_and_show(window)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enforce_min_shell_size_does_not_shrink_big_windows() {
        assert_eq!(1920u32.max(MIN_SHELL_WIDTH), 1920);
        assert_eq!(1080u32.max(MIN_SHELL_HEIGHT), 1080);
    }

    #[test]
    fn enforce_min_shell_size_bumps_tiny_login_window() {
        assert_eq!(400u32.max(MIN_SHELL_WIDTH), 1024);
        assert_eq!(480u32.max(MIN_SHELL_HEIGHT), 680);
    }

    #[test]
    fn intersection_works_when_one_bounds_inside_another() {
        let outer = Bounds {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };
        let inner = Bounds {
            left: 100,
            top: 100,
            right: 500,
            bottom: 500,
        };
        assert_eq!(intersection_area(inner, outer), 160_000);
    }

    #[test]
    fn intersection_returns_zero_when_disjoint() {
        let a = Bounds {
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
        };
        let b = Bounds {
            left: 200,
            top: 200,
            right: 300,
            bottom: 300,
        };
        assert_eq!(intersection_area(a, b), 0);
    }

    #[test]
    fn visibility_threshold_fails_for_mostly_offscreen_window() {
        let window_bounds = Bounds {
            left: -1800,
            top: 0,
            right: 200,
            bottom: 1080,
        };
        let monitor_bounds = Bounds {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };
        let visible = intersection_area(window_bounds, monitor_bounds) as f64;
        let total = window_bounds.area() as f64;
        assert!(visible < total * VISIBILITY_THRESHOLD);
    }

    #[test]
    fn visibility_threshold_passes_for_almost_fully_visible_window() {
        let window_bounds = Bounds {
            left: 0,
            top: 0,
            right: 1930,
            bottom: 1080,
        };
        let monitor_bounds = Bounds {
            left: 0,
            top: 0,
            right: 1920,
            bottom: 1080,
        };
        let visible = intersection_area(window_bounds, monitor_bounds) as f64;
        let total = window_bounds.area() as f64;
        assert!(visible >= total * VISIBILITY_THRESHOLD);
    }
}
