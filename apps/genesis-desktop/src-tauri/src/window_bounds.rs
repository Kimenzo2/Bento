use tauri::{Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};
use tauri_plugin_window_state::{StateFlags, WindowExt};

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
        let width = self.width().max(0) as u64;
        let height = self.height().max(0) as u64;
        width * height
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

fn should_recenter_window(window_bounds: Bounds, monitors: &[Monitor]) -> bool {
    let window_area = window_bounds.area();

    if window_area == 0 || monitors.is_empty() {
        return true;
    }

    let best_visible_area = monitors
        .iter()
        .map(|monitor| intersection_area(window_bounds, bounds_from_monitor(monitor)))
        .max()
        .unwrap_or(0);

    best_visible_area * 2 < window_area
}

fn recenter_and_show(window: &WebviewWindow) -> tauri::Result<()> {
    if window.is_maximized()? {
        window.unmaximize()?;
    }

    window.center()?;
    window.show()?;
    window.set_focus()?;

    Ok(())
}

pub fn restore_main_window(window: &WebviewWindow) -> tauri::Result<()> {
    let restore_flags = StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED;

    window.restore_state(restore_flags)?;

    let monitors = window.available_monitors()?;
    let position = match window.outer_position() {
        Ok(position) => position,
        Err(_) => {
            return recenter_and_show(window);
        }
    };
    let size = match window.outer_size() {
        Ok(size) => size,
        Err(_) => {
            return recenter_and_show(window);
        }
    };

    let window_bounds = bounds_from_position(position, size);

    if should_recenter_window(window_bounds, &monitors) {
        recenter_and_show(window)?;
        return Ok(());
    }

    window.show()?;
    window.set_focus()?;

    Ok(())
}
