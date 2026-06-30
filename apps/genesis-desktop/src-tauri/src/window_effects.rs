use tauri::{AppHandle, Manager};
use tauri::window::{Color, Effect, EffectsBuilder};
use tauri::utils::config::WindowEffectsConfig;

#[tauri::command]
pub fn set_window_glass(app: AppHandle, enabled: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("no main window")?;

    if !enabled {
        window
            .set_effects(None::<WindowEffectsConfig>)
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        use tauri_plugin_liquid_glass::LiquidGlassExt;

        let supported = app.liquid_glass().is_supported();
        if supported {
            app.liquid_glass()
                .set_effect(&window, Default::default())
                .map_err(|e| e.to_string())?;
            return Ok(());
        }

        window
            .set_effects(
                EffectsBuilder::new()
                    .effects(vec![Effect::UnderWindowBackground])
                    .build(),
            )
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        window
            .set_effects(
                EffectsBuilder::new()
                    .effects(vec![Effect::Acrylic])
                    .color(Color(32, 32, 32, 200))
                    .build(),
            )
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {}

    Ok(())
}
