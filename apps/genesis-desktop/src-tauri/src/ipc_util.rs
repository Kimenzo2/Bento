/// Execute a synchronous blocking operation on tokio's blocking thread pool
/// with a configurable timeout.
///
/// Use this inside any async Tauri command that performs blocking OS calls
/// (file I/O, WebView2 window creation, ShellExecuteW, DWM compositor, etc.)
/// so the tokio async worker thread is never starved and the main thread IPC
/// handler never blocks.
///
/// # Triple-nested Result handling
///
/// The macro internally handles all three layers:
/// 1. `tokio::time::timeout` → `Result<T, Elapsed>` (outer)
/// 2. `tokio::task::spawn_blocking` → `Result<T, JoinError>` (middle)
/// 3. The user's closure → `Result<(), E>` (inner)
///
/// On timeout → returns `Err("timed out after Ns")`
/// On panic  → returns `Err("blocking task panicked: ...")`
/// On error  → passes through the user's error
///
/// # Usage
///
/// ```ignore
/// #[tauri::command]
/// pub async fn my_command(app: AppHandle) -> Result<(), String> {
///     // All captured variables are moved into the closure
///     spawn_timeout!(5, {
///         do_blocking_work(&app)?;
///         Ok(())
///     })
/// }
/// ```
///
/// # Safety
///
/// - All variables used in `$body` are **moved** into the closure via `move ||`.
///   They are unavailable after the macro call (unless cloned beforehand).
/// - `#[cfg]` blocks inside `$body` work as expected (evaluated at compile time).
/// - The body must return `Result<T, String>` for `?` to propagate correctly.
/// - `#[track_caller]` is applied so that timeout/panic error messages include
///   the file:line:column of the calling site, making debugging much faster.
#[macro_export]
macro_rules! spawn_timeout {
    ($secs:expr, $body:expr) => {
        // Capture file!() and line!() at the macro call site (not inside closures,
        // where #[track_caller] doesn't propagate). This gives precise location
        // info in timeout/panic error messages: "IPC call timed out after 5s (at island.rs:148)"
        {
            let _caller_file = file!();
            let _caller_line = line!();
            tokio::time::timeout(
                std::time::Duration::from_secs($secs),
                tokio::task::spawn_blocking(move || $body),
            )
            .await
            .map_err(|_elapsed| {
                format!(
                    "IPC call timed out after {}s (at {_caller_file}:{_caller_line})",
                    $secs
                )
            })?
            .map_err(|join_err| {
                format!("blocking task panicked at {_caller_file}:{_caller_line}: {join_err}")
            })?
        }
    };
}
