#[tauri::command]
pub fn ping() -> Result<String, String> {
    eprintln!("[ping] ping called");
    Ok("pong".to_string())
}
