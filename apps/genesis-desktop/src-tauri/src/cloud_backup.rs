use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

use aes_gcm_siv::{aead::Aead, Aes256GcmSiv, KeyInit, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::Utc;
use keyring::Entry;
use rand::RngCore;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::settings::{self, CloudBackupSchedule, CloudBackupScope, DesktopSettings};

const AUTH_KEYRING_SERVICE: &str = "Bento Desktop";
const AUTH_KEYRING_SERVICE_ROLE_ACCOUNT: &str = "supabase-service-role";

const BACKUP_KEY_ACCOUNT: &str = "cloud-backup-encryption-key";
const RESTORE_STAGING_DIR: &str = "cloud-backup-restore";
const BACKUP_PREFIX: &str = "cloud-backups";
const BACKUP_OBJECT_EXTENSION: &str = "bkp";
const BACKUP_SCHEMA_VERSION: u32 = 1;
const BACKUP_RETRY_WINDOW_SECS: i64 = 30 * 60;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupObjectInfo {
    pub object_path: String,
    pub backup_id: String,
    pub created_at: String,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupState {
    pub configured: bool,
    pub bucket_ready: bool,
    pub has_service_role: bool,
    pub enabled: bool,
    pub schedule_enabled: bool,
    pub schedule: CloudBackupSchedule,
    pub scope: CloudBackupScope,
    pub selected_modules: Vec<String>,
    pub project_url: String,
    pub bucket_name: String,
    pub last_backup_at: Option<String>,
    pub last_backup_size_bytes: Option<u64>,
    pub last_backup_object_path: Option<String>,
    pub last_backup_status: Option<String>,
    pub storage_usage_bytes: Option<u64>,
    pub backups: Vec<CloudBackupObjectInfo>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupRunResult {
    pub object_path: String,
    pub backup_id: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub storage_usage_bytes: Option<u64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupRestoreResult {
    pub object_path: String,
    pub backup_id: String,
    pub requires_restart: bool,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudBackupKeyState {
    pub has_service_role_key: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudBackupBundle {
    schema_version: u32,
    backup_id: String,
    created_at: String,
    created_at_ms: i64,
    app_version: String,
    scope: CloudBackupScope,
    selected_modules: Vec<String>,
    files: Vec<CloudBackupFile>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CloudBackupFile {
    path: String,
    module_ids: Vec<String>,
    size_bytes: u64,
    modified_at_ms: Option<i64>,
    bytes_b64: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StorageObjectInfo {
    name: String,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
    #[serde(default)]
    metadata: Option<StorageObjectMetadata>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StorageObjectMetadata {
    #[serde(default)]
    size: Option<u64>,
}

fn storage_key_for_module(module_id: &str) -> Option<&'static str> {
    match module_id {
        "dashboard" | "settings" | "grocery" | "recipes" | "time" | "goals" | "clipboard"
        | "breathing" | "voice-memos" | "countdown" | "telemetry" | "ai" => Some("app.db"),
        "notes" => Some("notes.db"),
        "tasks" => Some("tasks.db"),
        "journal" => Some("journal.db"),
        "passwords" => Some("passwords.db"),
        "budget" => Some("budget.db"),
        "health" => Some("health.db"),
        "habits" => Some("habits.db"),
        "focus" => Some("focus.db"),
        "flashcards" => Some("flashcards.db"),
        "reading" => Some("reading.db"),
        _ => None,
    }
}

fn default_module_ids() -> Vec<String> {
    [
        "dashboard",
        "notes",
        "journal",
        "tasks",
        "habits",
        "focus",
        "passwords",
        "health",
        "budget",
        "flashcards",
        "reading",
        "grocery",
        "recipes",
        "time",
        "goals",
        "clipboard",
        "breathing",
        "voice-memos",
        "countdown",
        "telemetry",
        "ai",
        "settings",
    ]
    .into_iter()
    .map(ToString::to_string)
    .collect()
}

fn backup_sources_for_scope(settings: &DesktopSettings) -> Vec<(String, Vec<String>)> {
    let mut selected = if settings.cloud_backup.scope == CloudBackupScope::Selected {
        settings.cloud_backup.selected_modules.clone()
    } else {
        default_module_ids()
    };
    selected.retain(|module| storage_key_for_module(module).is_some());
    selected.sort();
    selected.dedup();

    let mut by_path: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for module in selected {
        if let Some(path) = storage_key_for_module(&module) {
            by_path
                .entry(path.to_string())
                .or_default()
                .insert(module.clone());
        }
    }

    by_path
        .into_iter()
        .map(|(path, modules)| (path, modules.into_iter().collect()))
        .collect()
}

fn service_role_key() -> Result<Option<String>, String> {
    let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_SERVICE_ROLE_ACCOUNT)
        .map_err(|error| error.to_string())?;
    match entry.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn load_or_create_backup_key() -> Result<[u8; 32], String> {
    let entry =
        Entry::new(AUTH_KEYRING_SERVICE, BACKUP_KEY_ACCOUNT).map_err(|error| error.to_string())?;

    match entry.get_password() {
        Ok(password) => {
            let decoded = B64
                .decode(password.as_bytes())
                .map_err(|error| error.to_string())?;
            let key: [u8; 32] = decoded
                .try_into()
                .map_err(|_| "Invalid cloud backup key length in keyring.".to_string())?;
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => {
            let mut key = [0u8; 32];
            let mut rng = rand::rngs::OsRng;
            rng.fill_bytes(&mut key);
            entry
                .set_password(&B64.encode(key))
                .map_err(|error| error.to_string())?;
            Ok(key)
        }
        Err(error) => Err(error.to_string()),
    }
}

fn encrypt_bundle(bundle: &CloudBackupBundle) -> Result<Vec<u8>, String> {
    let key = load_or_create_backup_key()?;
    let cipher = Aes256GcmSiv::new_from_slice(&key).map_err(|error| error.to_string())?;
    let nonce_bytes = rand_nonce();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let payload = serde_json::to_vec(bundle).map_err(|error| error.to_string())?;
    let encrypted = cipher
        .encrypt(nonce, payload.as_ref())
        .map_err(|error| error.to_string())?;
    let mut output = nonce_bytes.to_vec();
    output.extend_from_slice(&encrypted);
    Ok(output)
}

fn decrypt_bundle(bytes: &[u8]) -> Result<CloudBackupBundle, String> {
    if bytes.len() < 12 {
        return Err("Encrypted backup payload is truncated.".to_string());
    }

    let key = load_or_create_backup_key()?;
    let cipher = Aes256GcmSiv::new_from_slice(&key).map_err(|error| error.to_string())?;
    let (nonce_bytes, payload) = bytes.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let decrypted = cipher
        .decrypt(nonce, payload)
        .map_err(|error| error.to_string())?;
    serde_json::from_slice(&decrypted).map_err(|error| error.to_string())
}

fn rand_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    let mut rng = rand::thread_rng();
    rng.fill_bytes(&mut nonce);
    nonce
}

fn backup_file_name(backup_id: &str) -> String {
    format!("{BACKUP_PREFIX}/{backup_id}.{BACKUP_OBJECT_EXTENSION}")
}

fn backup_id_from_object_path(object_path: &str) -> String {
    Path::new(object_path)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(object_path)
        .to_string()
}

fn settings_path(app: &AppHandle) -> PathBuf {
    settings::settings_file_path(app)
}

fn backup_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(RESTORE_STAGING_DIR))
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|error| error.to_string())
}

fn project_url(settings: &DesktopSettings) -> Result<String, String> {
    let value = settings.cloud_backup.project_url.trim();
    if value.is_empty() {
        return Err("Cloud backup project URL is missing.".to_string());
    }

    Ok(value.trim_end_matches('/').to_string())
}

fn anon_key(settings: &DesktopSettings) -> Result<String, String> {
    let value = settings.cloud_backup.anon_key.trim();
    if value.is_empty() {
        return Err("Cloud backup anon key is missing.".to_string());
    }

    Ok(value.to_string())
}

async fn current_access_token(auth: &crate::auth::AuthManager) -> Result<Option<String>, String> {
    Ok(auth
        .current_session()
        .await
        .map(|session| session.access_token))
}

async fn ensure_bucket(
    client: &Client,
    project_url: &str,
    anon_key: &str,
    auth_header: &str,
    bucket_name: &str,
    allow_create: bool,
) -> Result<(), String> {
    let bucket_url = format!("{project_url}/storage/v1/bucket/{bucket_name}");
    let response = client
        .get(&bucket_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {auth_header}"))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    if status != StatusCode::NOT_FOUND || !allow_create {
        return Err(format!(
            "Cloud backup bucket '{bucket_name}' is not available. {status}",
            status = status
        ));
    }

    let create_url = format!("{project_url}/storage/v1/bucket");
    let response = client
        .post(&create_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {auth_header}"))
        .json(&serde_json::json!({
            "name": bucket_name,
            "public": false,
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    Err(format!(
        "Unable to create cloud backup bucket '{bucket_name}'. {} {}",
        status, body
    ))
}

async fn list_backup_objects(
    client: &Client,
    project_url: &str,
    anon_key: &str,
    auth_header: &str,
    bucket_name: &str,
) -> Result<Vec<StorageObjectInfo>, String> {
    let list_url = format!("{project_url}/storage/v1/object/list/{bucket_name}");
    let response = client
        .post(&list_url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {auth_header}"))
        .json(&serde_json::json!({
            "prefix": format!("{BACKUP_PREFIX}/"),
            "limit": 1000,
            "offset": 0,
            "sortBy": { "column": "created_at", "order": "desc" },
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to list cloud backup objects: {} {}",
            status, body
        ));
    }

    response
        .json::<Vec<StorageObjectInfo>>()
        .await
        .map_err(|error| error.to_string())
}

async fn delete_backup_object(
    client: &Client,
    project_url: &str,
    anon_key: &str,
    auth_header: &str,
    bucket_name: &str,
    object_path: &str,
) -> Result<(), String> {
    let url = format!("{project_url}/storage/v1/object/{bucket_name}");
    let response = client
        .delete(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {auth_header}"))
        .json(&serde_json::json!({
            "prefixes": [object_path],
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    Err(format!(
        "Failed to delete cloud backup object: {} {}",
        status, body
    ))
}

async fn download_backup_object(
    client: &Client,
    project_url: &str,
    anon_key: &str,
    auth_header: &str,
    bucket_name: &str,
    object_path: &str,
) -> Result<Vec<u8>, String> {
    let url = format!("{project_url}/storage/v1/object/{bucket_name}/{object_path}");
    let response = client
        .get(&url)
        .header("apikey", anon_key)
        .header("Authorization", format!("Bearer {auth_header}"))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to download cloud backup object: {} {}",
            status, body
        ));
    }

    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| error.to_string())
}

fn load_local_file(path: &Path) -> Result<(Vec<u8>, Option<i64>, u64), String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified_at_ms = metadata
        .modified()
        .ok()
        .and_then(|timestamp| timestamp.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| i64::try_from(duration.as_millis()).unwrap_or(i64::MAX));
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok((bytes, modified_at_ms, metadata.len()))
}

fn collect_bundle_files(
    app: &AppHandle,
    settings: &DesktopSettings,
) -> Result<Vec<CloudBackupFile>, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let mut files = Vec::new();
    let mut seen = BTreeSet::new();

    for (path, module_ids) in backup_sources_for_scope(settings) {
        if !seen.insert(path.clone()) {
            continue;
        }

        let file_path = data_dir.join(&path);
        if !file_path.exists() {
            continue;
        }

        let (bytes, modified_at_ms, size_bytes) = load_local_file(&file_path)?;
        files.push(CloudBackupFile {
            path,
            module_ids,
            size_bytes,
            modified_at_ms,
            bytes_b64: B64.encode(bytes),
        });
    }

    let settings_path = settings_path(app);
    if settings_path.exists() {
        let (bytes, modified_at_ms, size_bytes) = load_local_file(&settings_path)?;
        files.push(CloudBackupFile {
            path: "settings.json".to_string(),
            module_ids: vec!["settings".to_string()],
            size_bytes,
            modified_at_ms,
            bytes_b64: B64.encode(bytes),
        });
    }

    Ok(files)
}

fn current_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn parse_backup_object_info(object: StorageObjectInfo) -> Option<CloudBackupObjectInfo> {
    if !object.name.starts_with(&format!("{BACKUP_PREFIX}/")) {
        return None;
    }

    let backup_id = backup_id_from_object_path(&object.name);
    let size_bytes = object.metadata.and_then(|meta| meta.size).unwrap_or(0);
    let created_at = object
        .created_at
        .or(object.updated_at)
        .unwrap_or_else(|| Utc::now().to_rfc3339());

    Some(CloudBackupObjectInfo {
        object_path: object.name,
        backup_id,
        created_at,
        size_bytes,
    })
}

async fn persist_state_after_backup(
    app: &AppHandle,
    object_path: &str,
    backup_id: &str,
    created_at: &str,
    size_bytes: u64,
    storage_usage_bytes: Option<u64>,
    status_message: &str,
) -> Result<(), String> {
    settings::update_desktop_settings(app, |settings| {
        settings.cloud_backup.last_backup_at = Some(created_at.to_string());
        settings.cloud_backup.last_backup_size_bytes = Some(size_bytes);
        settings.cloud_backup.last_backup_object_path = Some(object_path.to_string());
        settings.cloud_backup.last_backup_status = Some(status_message.to_string());
        settings.cloud_backup.storage_usage_bytes = storage_usage_bytes;
        let _ = backup_id;
    })
    .map(|_| ())
}

fn read_current_settings(app: &AppHandle) -> DesktopSettings {
    settings::current_settings(app)
}

async fn state_snapshot(
    app: &AppHandle,
    auth: &crate::auth::AuthManager,
) -> Result<(DesktopSettings, String, String, String, bool), String> {
    let settings = read_current_settings(app);
    let project_url = project_url(&settings)?;
    let anon_key = anon_key(&settings)?;
    let auth_header = service_role_key()?
        .or(current_access_token(auth).await?)
        .unwrap_or_default();
    let has_service_role = service_role_key()?.is_some();
    if auth_header.is_empty() {
        return Err(
            "Cloud backup requires an active Supabase session or a configured service role key."
                .to_string(),
        );
    }

    Ok((
        settings,
        project_url,
        anon_key,
        auth_header,
        has_service_role,
    ))
}

async fn ensure_backup_ready(
    client: &Client,
    settings: &DesktopSettings,
    project_url: &str,
    anon_key: &str,
    auth_header: &str,
) -> Result<(), String> {
    ensure_bucket(
        client,
        project_url,
        anon_key,
        auth_header,
        &settings.cloud_backup.bucket_name,
        true,
    )
    .await
}

fn staging_manifest_path(root: &Path) -> PathBuf {
    root.join("pending-manifest.json")
}

fn staging_payload_dir(root: &Path) -> PathBuf {
    root.join("payload")
}

fn write_staged_restore(app: &AppHandle, bundle: &CloudBackupBundle) -> Result<PathBuf, String> {
    let root = backup_root(app)?;
    fs::create_dir_all(staging_payload_dir(&root)).map_err(|error| error.to_string())?;

    let mut manifest_entries = Vec::new();

    for file in &bundle.files {
        let decoded = B64
            .decode(file.bytes_b64.as_bytes())
            .map_err(|error| error.to_string())?;
        let output_path = staging_payload_dir(&root).join(&file.path);
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::write(&output_path, decoded).map_err(|error| error.to_string())?;
        manifest_entries.push(serde_json::json!({
            "path": file.path,
            "moduleIds": file.module_ids,
        }));
    }

    let manifest = serde_json::json!({
        "schemaVersion": BACKUP_SCHEMA_VERSION,
        "backupId": bundle.backup_id,
        "createdAt": bundle.created_at,
        "entries": manifest_entries,
    });

    let manifest_path = staging_manifest_path(&root);
    fs::write(
        &manifest_path,
        serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    Ok(root)
}

fn merge_preserving_cloud_backup_config(
    current: &DesktopSettings,
    restored: &DesktopSettings,
) -> DesktopSettings {
    let mut merged = restored.clone();
    merged.cloud_backup = current.cloud_backup.clone();
    merged
}

fn warn_if_newer_local_data(
    app: &AppHandle,
    bundle: &CloudBackupBundle,
) -> Result<Vec<String>, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let backup_created = chrono::DateTime::parse_from_rfc3339(&bundle.created_at)
        .map_err(|error| error.to_string())?
        .timestamp_millis();

    let mut warnings = Vec::new();
    for file in &bundle.files {
        let candidate = data_dir.join(&file.path);
        if let Ok(metadata) = fs::metadata(&candidate) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                    let modified_ms = i64::try_from(duration.as_millis()).unwrap_or(i64::MAX);
                    if modified_ms > backup_created {
                        warnings.push(format!(
                            "{} was modified after this backup was created.",
                            file.path
                        ));
                    }
                }
            }
        }
    }

    Ok(warnings)
}

#[tauri::command]
pub async fn get_state(
    app: AppHandle,
    auth: State<'_, crate::auth::AuthManager>,
) -> Result<CloudBackupState, String> {
    let settings = read_current_settings(&app);
    let configured = !settings.cloud_backup.project_url.trim().is_empty()
        && !settings.cloud_backup.anon_key.trim().is_empty()
        && !settings.cloud_backup.bucket_name.trim().is_empty();
    let has_service_role = service_role_key()?.is_some();

    if !configured {
        return Ok(CloudBackupState {
            configured: false,
            bucket_ready: false,
            has_service_role,
            enabled: settings.cloud_backup.enabled,
            schedule_enabled: settings.cloud_backup.schedule_enabled,
            schedule: settings.cloud_backup.schedule,
            scope: settings.cloud_backup.scope,
            selected_modules: settings.cloud_backup.selected_modules,
            project_url: settings.cloud_backup.project_url,
            bucket_name: settings.cloud_backup.bucket_name,
            last_backup_at: settings.cloud_backup.last_backup_at,
            last_backup_size_bytes: settings.cloud_backup.last_backup_size_bytes,
            last_backup_object_path: settings.cloud_backup.last_backup_object_path,
            last_backup_status: settings.cloud_backup.last_backup_status,
            storage_usage_bytes: settings.cloud_backup.storage_usage_bytes,
            backups: Vec::new(),
        });
    }

    let client = build_client()?;
    let (settings_snapshot, project_url, anon_key, auth_header, has_service_role) =
        state_snapshot(&app, auth.inner()).await?;
    let bucket_name = settings_snapshot.cloud_backup.bucket_name.clone();

    let bucket_ready = ensure_bucket(
        &client,
        &project_url,
        &anon_key,
        &auth_header,
        &bucket_name,
        false,
    )
    .await
    .is_ok();

    let backups = if bucket_ready {
        list_backup_objects(&client, &project_url, &anon_key, &auth_header, &bucket_name)
            .await
            .unwrap_or_default()
            .into_iter()
            .filter_map(parse_backup_object_info)
            .collect()
    } else {
        Vec::new()
    };

    let storage_usage_bytes = backups.iter().map(|entry| entry.size_bytes).sum::<u64>();

    Ok(CloudBackupState {
        configured,
        bucket_ready,
        has_service_role,
        enabled: settings_snapshot.cloud_backup.enabled,
        schedule_enabled: settings_snapshot.cloud_backup.schedule_enabled,
        schedule: settings_snapshot.cloud_backup.schedule,
        scope: settings_snapshot.cloud_backup.scope,
        selected_modules: settings_snapshot.cloud_backup.selected_modules,
        project_url: settings_snapshot.cloud_backup.project_url,
        bucket_name,
        last_backup_at: settings_snapshot.cloud_backup.last_backup_at,
        last_backup_size_bytes: settings_snapshot.cloud_backup.last_backup_size_bytes,
        last_backup_object_path: settings_snapshot.cloud_backup.last_backup_object_path,
        last_backup_status: settings_snapshot.cloud_backup.last_backup_status,
        storage_usage_bytes: Some(storage_usage_bytes),
        backups,
    })
}

#[tauri::command]
pub async fn get_key_state() -> Result<CloudBackupKeyState, String> {
    Ok(CloudBackupKeyState {
        has_service_role_key: service_role_key()?.is_some(),
    })
}

#[tauri::command]
pub async fn set_service_role_key(value: String) -> Result<CloudBackupKeyState, String> {
    let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_SERVICE_ROLE_ACCOUNT)
        .map_err(|error| error.to_string())?;
    entry
        .set_password(value.trim())
        .map_err(|error| error.to_string())?;
    get_key_state().await
}

#[tauri::command]
pub async fn clear_service_role_key() -> Result<CloudBackupKeyState, String> {
    let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_SERVICE_ROLE_ACCOUNT)
        .map_err(|error| error.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => get_key_state().await,
        Err(error) => Err(format!("{error}")),
    }
}

#[tauri::command]
pub async fn test_connection(
    app: AppHandle,
    auth: State<'_, crate::auth::AuthManager>,
) -> Result<CloudBackupState, String> {
    get_state(app, auth).await
}

#[tauri::command]
pub async fn backup_now(
    app: AppHandle,
    auth: State<'_, crate::auth::AuthManager>,
) -> Result<CloudBackupRunResult, String> {
    backup_now_with_auth(app, auth.inner()).await
}

async fn backup_now_with_auth(
    app: AppHandle,
    auth: &crate::auth::AuthManager,
) -> Result<CloudBackupRunResult, String> {
    let client = build_client()?;
    let (settings_snapshot, project_url, anon_key, auth_header, _) =
        state_snapshot(&app, auth).await?;

    if settings_snapshot.cloud_backup.selected_modules.is_empty()
        && settings_snapshot.cloud_backup.scope == CloudBackupScope::Selected
    {
        return Err("Select at least one module to back up.".to_string());
    }

    ensure_backup_ready(
        &client,
        &settings_snapshot,
        &project_url,
        &anon_key,
        &auth_header,
    )
    .await?;

    let files = collect_bundle_files(&app, &settings_snapshot)?;
    let bundle = CloudBackupBundle {
        schema_version: BACKUP_SCHEMA_VERSION,
        backup_id: Uuid::new_v4().to_string(),
        created_at: Utc::now().to_rfc3339(),
        created_at_ms: Utc::now().timestamp_millis(),
        app_version: current_app_version(),
        scope: settings_snapshot.cloud_backup.scope,
        selected_modules: settings_snapshot.cloud_backup.selected_modules.clone(),
        files,
    };

    let payload = encrypt_bundle(&bundle)?;
    let object_path = backup_file_name(&bundle.backup_id);
    let upload_url = format!(
        "{project_url}/storage/v1/object/{bucket_name}/{object_path}",
        bucket_name = settings_snapshot.cloud_backup.bucket_name
    );

    let response = client
        .post(&upload_url)
        .header("apikey", &anon_key)
        .header("Authorization", format!("Bearer {auth_header}"))
        .header("Content-Type", "application/octet-stream")
        .header("x-upsert", "true")
        .body(payload.clone())
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to upload cloud backup: {} {}",
            status, body
        ));
    }

    let storage_usage_bytes = list_backup_objects(
        &client,
        &project_url,
        &anon_key,
        &auth_header,
        &settings_snapshot.cloud_backup.bucket_name,
    )
    .await
    .ok()
    .map(|objects| {
        objects
            .into_iter()
            .filter_map(parse_backup_object_info)
            .map(|entry| entry.size_bytes)
            .sum::<u64>()
    });

    let result = CloudBackupRunResult {
        object_path: object_path.clone(),
        backup_id: bundle.backup_id.clone(),
        created_at: bundle.created_at.clone(),
        size_bytes: payload.len() as u64,
        storage_usage_bytes,
    };

    persist_state_after_backup(
        &app,
        &result.object_path,
        &result.backup_id,
        &result.created_at,
        result.size_bytes,
        result.storage_usage_bytes,
        "Cloud backup completed successfully.",
    )
    .await?;

    Ok(result)
}

#[tauri::command]
pub async fn restore_backup(
    app: AppHandle,
    auth: State<'_, crate::auth::AuthManager>,
    object_path: String,
) -> Result<CloudBackupRestoreResult, String> {
    let client = build_client()?;
    let (settings_snapshot, project_url, anon_key, auth_header, _) =
        state_snapshot(&app, auth.inner()).await?;

    let bytes = download_backup_object(
        &client,
        &project_url,
        &anon_key,
        &auth_header,
        &settings_snapshot.cloud_backup.bucket_name,
        &object_path,
    )
    .await?;

    let bundle = decrypt_bundle(&bytes)?;
    let warnings = warn_if_newer_local_data(&app, &bundle)?;
    let root = write_staged_restore(&app, &bundle)?;

    if let Some(settings_file) = staging_payload_dir(&root).join("settings.json").to_str() {
        let restored_settings = settings::current_settings(&app);
        let raw = fs::read_to_string(settings_file).map_err(|error| error.to_string())?;
        let parsed =
            serde_json::from_str::<DesktopSettings>(&raw).map_err(|error| error.to_string())?;
        let merged = merge_preserving_cloud_backup_config(&restored_settings, &parsed);
        let payload = serde_json::to_string_pretty(&merged).map_err(|error| error.to_string())?;
        fs::write(settings_file, payload).map_err(|error| error.to_string())?;
    }

    Ok(CloudBackupRestoreResult {
        object_path,
        backup_id: bundle.backup_id,
        requires_restart: true,
        warnings,
    })
}

#[tauri::command]
pub async fn delete_backup(
    app: AppHandle,
    auth: State<'_, crate::auth::AuthManager>,
    object_path: String,
) -> Result<CloudBackupState, String> {
    let client = build_client()?;
    let (settings_snapshot, project_url, anon_key, auth_header, _) =
        state_snapshot(&app, auth.inner()).await?;

    delete_backup_object(
        &client,
        &project_url,
        &anon_key,
        &auth_header,
        &settings_snapshot.cloud_backup.bucket_name,
        &object_path,
    )
    .await?;

    let storage_usage_bytes = list_backup_objects(
        &client,
        &project_url,
        &anon_key,
        &auth_header,
        &settings_snapshot.cloud_backup.bucket_name,
    )
    .await
    .ok()
    .map(|objects| {
        objects
            .into_iter()
            .filter_map(parse_backup_object_info)
            .map(|entry| entry.size_bytes)
            .sum::<u64>()
    });

    if let Some(storage_usage_bytes) = storage_usage_bytes {
        settings::update_desktop_settings(&app, |settings| {
            settings.cloud_backup.storage_usage_bytes = Some(storage_usage_bytes);
        })
        .map_err(|error| error.to_string())?;
    }

    get_state(app, auth).await
}

pub fn apply_pending_restore(app: &AppHandle) -> Result<Option<String>, String> {
    let root = backup_root(app)?;
    let manifest_path = staging_manifest_path(&root);
    let payload_dir = staging_payload_dir(&root);
    if !manifest_path.exists() || !payload_dir.exists() {
        return Ok(None);
    }

    let manifest_raw = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
    let manifest: serde_json::Value =
        serde_json::from_str(&manifest_raw).map_err(|error| error.to_string())?;

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    for entry in fs::read_dir(&payload_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let source = entry.path();
        let relative = source
            .strip_prefix(&payload_dir)
            .map_err(|error| error.to_string())?;
        let destination = data_dir.join(relative);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        fs::copy(&source, &destination).map_err(|error| error.to_string())?;
    }

    let _ = fs::remove_file(&manifest_path);
    let _ = fs::remove_dir_all(&payload_dir);

    Ok(manifest
        .get("backupId")
        .and_then(|value| value.as_str())
        .map(ToString::to_string))
}

pub async fn maybe_run_scheduled_backup(
    app: AppHandle,
    auth: crate::auth::AuthManager,
) -> Result<Option<CloudBackupRunResult>, String> {
    let settings_snapshot = read_current_settings(&app);
    if !settings_snapshot.cloud_backup.enabled || !settings_snapshot.cloud_backup.schedule_enabled {
        return Ok(None);
    }

    let last_backup_at = settings_snapshot
        .cloud_backup
        .last_backup_at
        .as_ref()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|value| value.timestamp());

    let now = Utc::now().timestamp();
    let due = match settings_snapshot.cloud_backup.schedule {
        CloudBackupSchedule::Daily => last_backup_at
            .map(|value| now - value >= 24 * 60 * 60)
            .unwrap_or(true),
        CloudBackupSchedule::Weekly => last_backup_at
            .map(|value| now - value >= 7 * 24 * 60 * 60)
            .unwrap_or(true),
    };

    if !due {
        return Ok(None);
    }

    match backup_now_with_auth(app.clone(), &auth).await {
        Ok(result) => Ok(Some(result)),
        Err(error) => {
            settings::update_desktop_settings(&app, |settings| {
                settings.cloud_backup.last_backup_status =
                    Some(format!("Scheduled backup failed: {error}"));
            })
            .map_err(|update_error| update_error.to_string())?;
            Err(error)
        }
    }
}

pub fn spawn_cloud_backup_worker(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(
            BACKUP_RETRY_WINDOW_SECS as u64,
        ));
        loop {
            interval.tick().await;
            let auth = match app.try_state::<crate::auth::AuthManager>() {
                Some(state) => state.inner().clone(),
                None => continue,
            };
            let _ = maybe_run_scheduled_backup(app.clone(), auth).await;
        }
    });
}
