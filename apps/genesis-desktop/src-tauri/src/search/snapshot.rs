use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use super::service::SearchDocument;

fn normalize_module_id(module_id: &str) -> String {
    module_id
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_') {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn snapshot_root(base_dir: &Path) -> PathBuf {
    base_dir.join("search").join("snapshots")
}

fn snapshot_path(base_dir: &Path, module_id: &str) -> PathBuf {
    snapshot_root(base_dir).join(format!("{}.json", normalize_module_id(module_id)))
}

pub fn load_module_snapshot(
    base_dir: &Path,
    module_id: &str,
) -> Result<BTreeMap<String, SearchDocument>, String> {
    let path = snapshot_path(base_dir, module_id);
    if !path.exists() {
        return Ok(BTreeMap::new());
    }

    let raw = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    if raw.trim().is_empty() {
        return Ok(BTreeMap::new());
    }

    serde_json::from_str(&raw).map_err(|error| error.to_string())
}

pub fn save_module_snapshot(
    base_dir: &Path,
    module_id: &str,
    docs: &BTreeMap<String, SearchDocument>,
) -> Result<(), String> {
    let dir = snapshot_root(base_dir);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;

    let path = snapshot_path(base_dir, module_id);
    let tmp_path = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(docs).map_err(|error| error.to_string())?;

    fs::write(&tmp_path, json).map_err(|error| error.to_string())?;
    if path.exists() {
        fs::remove_file(&path).map_err(|error| error.to_string())?;
    }
    fs::rename(&tmp_path, &path).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn clear_module_snapshot(base_dir: &Path, module_id: &str) -> Result<(), String> {
    let path = snapshot_path(base_dir, module_id);
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}
