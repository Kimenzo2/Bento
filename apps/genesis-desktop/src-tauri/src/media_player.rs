use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

static AUDIO_LEVELS: std::sync::OnceLock<std::sync::Mutex<Vec<f64>>> = std::sync::OnceLock::new();
static IS_PLAYING: AtomicBool = AtomicBool::new(false);
static LAST_PLAYED: std::sync::OnceLock<std::sync::Mutex<Option<NowPlayingData>>> =
    std::sync::OnceLock::new();

#[derive(Debug, Serialize, Clone, Default)]
pub struct NowPlayingData {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub artwork_base64: Option<String>,
    pub duration: Option<f64>,
    pub elapsed_time: Option<f64>,
    pub is_playing: bool,
    pub audio_levels: Option<Vec<f64>>,
    pub app_name: Option<String>,
}

pub fn init_audio_state() {
    let _ = AUDIO_LEVELS.set(std::sync::Mutex::new(vec![0.15; 6]));
    let _ = LAST_PLAYED.set(std::sync::Mutex::new(None));
}

fn get_audio_levels_internal() -> Vec<f64> {
    AUDIO_LEVELS
        .get()
        .map(|m| m.lock().unwrap().clone())
        .unwrap_or_else(|| vec![0.15; 6])
}

fn set_audio_levels(levels: Vec<f64>) {
    if let Some(m) = AUDIO_LEVELS.get() {
        *m.lock().unwrap() = levels;
    }
}

#[tauri::command]
pub fn get_audio_levels() -> Vec<f64> {
    get_audio_levels_internal()
}

fn save_last_played(data: &NowPlayingData) {
    if let Some(m) = LAST_PLAYED.get() {
        *m.lock().unwrap() = Some(data.clone());
    }
}

fn get_last_played_or_default(levels: Vec<f64>) -> NowPlayingData {
    if let Some(m) = LAST_PLAYED.get() {
        if let Ok(guard) = m.lock() {
            if let Some(last) = &*guard {
                let mut data = last.clone();
                data.is_playing = false;
                data.audio_levels = Some(levels);
                return data;
            }
        }
    }
    NowPlayingData {
        audio_levels: Some(levels),
        ..Default::default()
    }
}

#[cfg(target_os = "windows")]
fn send_media_key(key: u16) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;
    unsafe {
        let inputs = [
            KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            },
            KEYBDINPUT {
                wVk: key,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        ];
        let input = [
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 { ki: inputs[0] },
            },
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 { ki: inputs[1] },
            },
        ];
        SendInput(2, &input as *const _, std::mem::size_of::<INPUT>() as i32);
    }
}

const VK_MEDIA_PLAY_PAUSE: u16 = 0xB3;
const VK_MEDIA_NEXT_TRACK: u16 = 0xB0;
const VK_MEDIA_PREV_TRACK: u16 = 0xB1;

#[cfg(target_os = "windows")]
fn get_now_playing_windows() -> NowPlayingData {
    use std::process::Command;

    let levels = get_audio_levels_internal();

    let script = r#"
        Add-Type -AssemblyName System.Windows.Forms
        $player = [System.Windows.Forms.SystemInformation]::PowerStatus
        try {
            $sapi = New-Object -ComObject "SAPI.SpVoice" -ErrorAction Stop
        } catch { $sapi = $null }

        $wmPlayer = New-Object -ComObject "WMPlayer.OCX" -ErrorAction SilentlyContinue
        if ($wmPlayer -and $wmPlayer.mediaCollection.count -gt 0) {
            $media = $wmPlayer.controls.currentItem
            if ($media) {
                $title = $media.name
                $artist = $media.getItemInfo("Author")
                $album = $media.getItemInfo("Album")
                $dur = $media.duration
                $pos = $wmPlayer.controls.currentPosition
                $isPlaying = $wmPlayer.controls.isAvailable("play")
                $result = @{title=$title; artist=$artist; album=$album; duration=$dur; position=$pos; playing=$isPlaying; app="Windows Media Player"}
                return ($result | ConvertTo-Json -Compress)
            }
        }

        return "{}"
    "#;

    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(script)
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok()
            } else {
                None
            }
        });

    let parsed_levels = levels.clone();
    let parsed = output.and_then(|o| {
        let v: std::collections::HashMap<String, serde_json::Value> =
            serde_json::from_str(&o).ok()?;
        let title = v.get("title").and_then(|t| t.as_str()).map(|s| s.to_string());
        let artist = v.get("artist").and_then(|t| t.as_str()).map(|s| s.to_string());
        let album = v.get("album").and_then(|t| t.as_str()).map(|s| s.to_string());
        let app = v.get("app").and_then(|t| t.as_str()).map(|s| s.to_string());
        let duration = v.get("duration").and_then(|d| d.as_f64());
        let position = v.get("position").and_then(|d| d.as_f64());
        let is_playing = v.get("playing").and_then(|p| p.as_bool()).unwrap_or(false);

        IS_PLAYING.store(is_playing, Ordering::Relaxed);

        Some(NowPlayingData {
            title,
            artist,
            album,
            artwork_base64: None,
            duration,
            elapsed_time: position,
            is_playing,
            audio_levels: Some(parsed_levels),
            app_name: app,
        })
    });

    if let Some(ref data) = parsed {
        save_last_played(data);
        return data.clone();
    }

    get_last_played_or_default(levels)
}

#[tauri::command]
pub async fn get_now_playing() -> NowPlayingData {
    #[cfg(target_os = "windows")]
    {
        get_now_playing_windows()
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let script = r#"
            tell application "System Events"
                set spotifyRunning to (name of processes) contains "Spotify"
                set musicRunning to (name of processes) contains "Music"
                set safariRunning to (name of processes) contains "Safari"
            end tell

            set output to ""

            if spotifyRunning then
                tell application "Spotify"
                    set output to output & "{ ""app"": ""Spotify"", ""title"": " & quoted form of (current track's name) & ", ""artist"": " & quoted form of (current track's artist) & ", ""album"": " & quoted form of (current track's album) & ", ""duration"": " & (duration of current track as integer) & ", ""position"": " & (player position as integer) & ", ""playing"": " & (player state is playing as string) & " }" & linefeed
                end tell
            end if

            if musicRunning then
                tell application "Music"
                    if player state is playing or player state is paused then
                        set output to output & "{ ""app"": ""Music"", ""title"": " & quoted form of (name of current track) & ", ""artist"": " & quoted form of (artist of current track) & ", ""album"": " & quoted form of (album of current track) & ", ""duration"": " & (duration of current track as integer) & ", ""position"": " & (player position as integer) & ", ""playing"": " & (player state is playing as string) & " }" & linefeed
                    end if
                end tell
            end if

            if safariRunning then
                tell application "Safari"
                    try
                        repeat with w in windows
                            repeat with t in tabs of w
                                try
                                    set tabURL to URL of t
                                    if tabURL contains "youtube.com" or tabURL contains "music.youtube.com" or tabURL contains "open.spotify.com" or tabURL contains "soundcloud.com" then
                                        set mediaInfo to do JavaScript "
                                            (function() {
                                                var v = document.querySelector('video');
                                                var a = document.querySelector('audio');
                                                var m = v || a;
                                                if (!m) return JSON.stringify({found:false});
                                                return JSON.stringify({
                                                    found: true,
                                                    title: document.title || '',
                                                    duration: m.duration || 0,
                                                    position: m.currentTime || 0,
                                                    playing: !m.paused
                                                });
                                            })();
                                        " in t
                                        set output to output & "{ ""app"": ""Safari"", ""url"": " & quoted form of tabURL & ", " & text 2 thru -1 of mediaInfo & linefeed
                                    end if
                                end try
                            end repeat
                        end repeat
                    end try
                end tell
            end if

            return output
        "#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    String::from_utf8(o.stdout).ok()
                } else {
                    None
                }
            });

        let levels = get_audio_levels_internal();
        let mac_levels = levels.clone();
        let now_playing = output.and_then(|o| {
            let lines: Vec<&str> = o.lines().filter(|l| !l.is_empty()).collect();
            let first = lines.first()?;
            let v: std::collections::HashMap<String, serde_json::Value> =
                serde_json::from_str(first).ok()?;

            let title = v.get("title").and_then(|t| t.as_str()).map(|s| s.to_string());
            let artist = v.get("artist").and_then(|t| t.as_str()).map(|s| s.to_string());
            let album = v.get("album").and_then(|t| t.as_str()).map(|s| s.to_string());
            let app = v.get("app").and_then(|t| t.as_str()).map(|s| s.to_string());
            let duration = v.get("duration").and_then(|d| d.as_f64());
            let position = v.get("position").and_then(|d| d.as_f64());
            let is_playing = v
                .get("playing")
                .and_then(|p| p.as_str())
                .map(|s| s == "true")
                .unwrap_or(false);

            IS_PLAYING.store(is_playing, Ordering::Relaxed);

            Some(NowPlayingData {
                title,
                artist,
                album,
                artwork_base64: None,
                duration,
                elapsed_time: position,
                is_playing,
                audio_levels: Some(mac_levels),
                app_name: app,
            })
        });

        if let Some(ref data) = now_playing {
            save_last_played(data);
            return data.clone();
        }

        get_last_played_or_default(levels)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let levels = get_audio_levels_internal();
        get_last_played_or_default(levels)
    }
}

#[tauri::command]
pub async fn media_play_pause() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        send_media_key(VK_MEDIA_PLAY_PAUSE);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let script = r#"
            tell application "System Events"
                set spotifyRunning to (name of processes) contains "Spotify"
                set musicRunning to (name of processes) contains "Music"
            end tell
            if spotifyRunning then
                tell application "Spotify" to playpause
            else if musicRunning then
                tell application "Music" to playpause
            end if
        "#;
        Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn media_next_track() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        send_media_key(VK_MEDIA_NEXT_TRACK);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let script = r#"
            tell application "System Events"
                set spotifyRunning to (name of processes) contains "Spotify"
                set musicRunning to (name of processes) contains "Music"
            end tell
            if spotifyRunning then
                tell application "Spotify" to next track
            else if musicRunning then
                tell application "Music" to next track
            end if
        "#;
        Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn media_previous_track() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        send_media_key(VK_MEDIA_PREV_TRACK);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let script = r#"
            tell application "System Events"
                set spotifyRunning to (name of processes) contains "Spotify"
                set musicRunning to (name of processes) contains "Music"
            end tell
            if spotifyRunning then
                tell application "Spotify" to previous track
            else if musicRunning then
                tell application "Music" to previous track
            end if
        "#;
        Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(())
    }
}

#[tauri::command]
pub async fn media_seek(position: f64) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = position;
        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let script = format!(
            r#"
            tell application "System Events"
                set spotifyRunning to (name of processes) contains "Spotify"
                set musicRunning to (name of processes) contains "Music"
            end tell
            if spotifyRunning then
                tell application "Spotify" to set player position to {}
            else if musicRunning then
                tell application "Music" to set player position to {}
            end if
        "#,
            position, position
        );
        Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = position;
        Ok(())
    }
}

#[tauri::command]
pub fn activate_media_app(app_name: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let app = match app_name.to_lowercase().as_str() {
            "music" => "Music",
            "spotify" => "Spotify",
            "safari" => "Safari",
            _ => &app_name,
        };
        Command::new("open")
            .arg("-a")
            .arg(app)
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        match app_name.to_lowercase().as_str() {
            "spotify" => {
                let _ = Command::new("cmd").args(["/C", "start", "spotify:"]).spawn();
            }
            _ => {
                let _ = Command::new("cmd")
                    .args(["/C", "start", &app_name])
                    .spawn();
            }
        }
        Ok(())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = app_name;
        Ok(())
    }
}

pub fn setup_audio_monitoring(app_handle: tauri::AppHandle) {
    if AUDIO_LEVELS.get().is_none() {
        let _ = AUDIO_LEVELS.set(std::sync::Mutex::new(vec![0.15; 6]));
    }

    std::thread::spawn(move || {
        let mut t = 0.0f64;
        let mut prev_levels = vec![0.15; 6];
        let mut beat_phase = 0.0f64;
        let mut energy = 0.5f64;

        let frame_duration = std::time::Duration::from_micros(33333);
        let mut next_frame = std::time::Instant::now();

        loop {
            if !IS_PLAYING.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(200));
                next_frame = std::time::Instant::now();
                continue;
            }

            t += 0.0333;

            let energy_wave = (t * 0.15).sin() * 0.3 + 0.9;
            energy = energy * 0.995 + energy_wave * 0.005;

            beat_phase += 0.0333 * 2.67 * std::f64::consts::PI * 2.67;
            let beat = beat_phase.sin().max(0.0).powf(4.0);

            let noise = || -> f64 {
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                ((t * 10000.0) as u64).hash(&mut hasher);
                (hasher.finish() % 1000) as f64 / 1000.0 - 0.5
            };

            let mut levels = vec![0.0; 6];

            levels[0] = energy * (0.4 + beat * 0.5 + noise() * 0.1);
            levels[1] = energy * (0.35 + beat * 0.3 + (t * 3.2).sin() * 0.15 + noise() * 0.08);
            levels[2] =
                energy * (0.3 + (t * 5.7).sin() * 0.2 + (t * 7.3).cos() * 0.1 + noise() * 0.1);
            levels[3] =
                energy * (0.28 + (t * 4.1).sin() * 0.18 + (t * 6.8).cos() * 0.12 + noise() * 0.08);
            levels[4] = energy * (0.22 + (t * 8.3).sin() * 0.15 + beat * 0.1 + noise() * 0.1);
            levels[5] =
                energy * (0.18 + (t * 11.2).sin() * 0.1 + (t * 9.7).cos() * 0.08 + noise() * 0.06);

            for i in 0..6 {
                let smoothing = if levels[i] > prev_levels[i] { 0.5 } else { 0.25 };
                levels[i] = prev_levels[i] + (levels[i] - prev_levels[i]) * smoothing;
                levels[i] = levels[i].clamp(0.08, 0.92);
            }

            prev_levels = levels.clone();

            set_audio_levels(levels.clone());
            let _ = app_handle.emit("audio-levels-update", levels);

            next_frame += frame_duration;
            let now = std::time::Instant::now();
            if next_frame > now {
                std::thread::sleep(next_frame - now);
            } else {
                next_frame = now + frame_duration;
            }
        }
    });
}
