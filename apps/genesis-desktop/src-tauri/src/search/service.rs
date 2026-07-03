use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::PathBuf;

use neo_frizbee::{match_list, Config, Scoring};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;

use super::snapshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchDocument {
    pub module_id: String,
    pub id: String,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub projects: Vec<String>,
    pub kind: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub source_ref: Option<String>,
    #[serde(default)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub query: String,
    #[serde(default)]
    pub limit: Option<usize>,
    #[serde(default)]
    pub offset: Option<usize>,
    #[serde(default)]
    pub fuzzy: bool,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub projects: Vec<String>,
    pub kind: Option<String>,
    pub created_after: Option<i64>,
    pub created_before: Option<i64>,
    pub updated_after: Option<i64>,
    pub updated_before: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub score: f32,
    pub document: SearchDocument,
}

struct ModuleCache {
    documents: BTreeMap<String, SearchDocument>,
}

pub struct SearchService {
    base_dir: PathBuf,
    cache: Mutex<HashMap<String, ModuleCache>>,
}

impl SearchService {
    pub fn new(base_dir: PathBuf) -> Result<Self, String> {
        let root = base_dir.join("search");
        fs::create_dir_all(root.join("indexes")).map_err(|e| e.to_string())?;
        fs::create_dir_all(root.join("snapshots")).map_err(|e| e.to_string())?;

        Ok(Self {
            base_dir,
            cache: Mutex::new(HashMap::new()),
        })
    }

    pub async fn index_content(&self, document: SearchDocument) -> Result<(), String> {
        let module_id = normalize_module_id(&document.module_id);
        let mut cache = self.cache.lock().await;

        let module = cache.entry(module_id.clone()).or_insert(ModuleCache {
            documents: BTreeMap::new(),
        });
        module
            .documents
            .insert(document.id.clone(), document.clone());

        snapshot::save_module_snapshot(&self.base_dir, &module_id, &module.documents)?;
        Ok(())
    }

    pub async fn delete_from_index(&self, module_id: String, id: String) -> Result<(), String> {
        let module_id = normalize_module_id(&module_id);
        let mut cache = self.cache.lock().await;

        if let Some(module) = cache.get_mut(&module_id) {
            module.documents.remove(&id);
            snapshot::save_module_snapshot(&self.base_dir, &module_id, &module.documents)?;
        }
        Ok(())
    }

    pub async fn rebuild_index(&self, module_id: String) -> Result<(), String> {
        let module_id = normalize_module_id(&module_id);
        let docs = snapshot::load_module_snapshot(&self.base_dir, &module_id)?;

        let mut cache = self.cache.lock().await;
        cache.insert(module_id, ModuleCache { documents: docs });
        Ok(())
    }

    pub async fn search_in_module(
        &self,
        module_id: String,
        query: SearchQuery,
    ) -> Result<Vec<SearchHit>, String> {
        let module_id = normalize_module_id(&module_id);
        let mut cache = self.cache.lock().await;

        let module = cache.entry(module_id.clone()).or_insert_with(|| {
            let docs =
                snapshot::load_module_snapshot(&self.base_dir, &module_id).unwrap_or_default();
            ModuleCache { documents: docs }
        });

        let limit = query.limit.unwrap_or(25).clamp(1, 100);
        let offset = query.offset.unwrap_or(0);

        let filtered = Self::apply_filters(&module.documents, &query);

        if query.query.trim().is_empty() {
            let mut docs: Vec<&SearchDocument> = filtered;
            docs.sort_by(|a, b| {
                let a_key = a.updated_at.or(a.created_at).unwrap_or_default();
                let b_key = b.updated_at.or(b.created_at).unwrap_or_default();
                b_key.cmp(&a_key)
            });

            return Ok(docs
                .into_iter()
                .skip(offset)
                .take(limit)
                .map(|d| SearchHit {
                    score: 0.0,
                    document: d.clone(),
                })
                .collect());
        }

        let total = filtered.len();
        let mut haystacks: Vec<String> = Vec::with_capacity(total);
        let mut title_only: Vec<String> = Vec::with_capacity(total);

        for doc in &filtered {
            let combined = build_search_text(doc);
            haystacks.push(combined);
            title_only.push(doc.title.clone());
        }

        let needle = query.query.trim();

        let config = Config {
            max_typos: None,
            sort: false,
            scoring: Scoring {
                // Boost exact matches and consecutive matches
                exact_match_bonus: 30_000,
                ..Default::default()
            },
        };

        let combined_matches = if total > 100 {
            match_list(needle, &haystacks, &config)
        } else {
            match_list(needle, &haystacks, &config)
        };

        let title_matches = match_list(needle, &title_only, &config);

        let mut scored: Vec<(f32, &SearchDocument)> = Vec::with_capacity(combined_matches.len());

        for cm in &combined_matches {
            let idx = cm.index as usize;
            if idx >= filtered.len() {
                continue;
            }

            let mut score = cm.score as f32;
            let tm = title_matches.iter().find(|m| m.index == cm.index);
            if let Some(tm) = tm {
                score += (tm.score as f32) * 2.0;
            }

            if cm.exact || tm.map_or(false, |m| m.exact) {
                score += 50_000.0;
            }

            scored.push((score, filtered[idx]));
        }

        scored.sort_unstable_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

        Ok(scored
            .into_iter()
            .skip(offset)
            .take(limit)
            .map(|(score, doc)| SearchHit {
                score,
                document: doc.clone(),
            })
            .collect())
    }

    pub async fn clear_all_user_indexes(&self) -> Result<(), String> {
        self.cache.lock().await.clear();

        let search_root = self.base_dir.join("search");
        let indexes = search_root.join("indexes");
        let snapshots = search_root.join("snapshots");

        if indexes.exists() {
            fs::remove_dir_all(&indexes).map_err(|e| e.to_string())?;
        }
        if snapshots.exists() {
            fs::remove_dir_all(&snapshots).map_err(|e| e.to_string())?;
        }

        fs::create_dir_all(&indexes).map_err(|e| e.to_string())?;
        fs::create_dir_all(&snapshots).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn apply_filters<'a>(
        documents: &'a BTreeMap<String, SearchDocument>,
        query: &SearchQuery,
    ) -> Vec<&'a SearchDocument> {
        let mut filtered: Vec<&SearchDocument> = documents.values().collect();

        if let Some(kind) = query.kind.as_ref().filter(|k| !k.trim().is_empty()) {
            filtered.retain(|d| d.kind.as_deref() == Some(kind.trim()));
        }

        if !query.tags.is_empty() {
            let required: Vec<String> = query
                .tags
                .iter()
                .map(|t| t.trim().to_lowercase())
                .filter(|t| !t.is_empty())
                .collect();
            if !required.is_empty() {
                filtered.retain(|d| {
                    let doc_tags: Vec<String> =
                        d.tags.iter().map(|t| t.trim().to_lowercase()).collect();
                    required.iter().all(|r| doc_tags.contains(r))
                });
            }
        }

        if !query.projects.is_empty() {
            let required: Vec<String> = query
                .projects
                .iter()
                .map(|p| p.trim().to_lowercase())
                .filter(|p| !p.is_empty())
                .collect();
            if !required.is_empty() {
                filtered.retain(|d| {
                    let doc_projects: Vec<String> =
                        d.projects.iter().map(|p| p.trim().to_lowercase()).collect();
                    required.iter().all(|r| doc_projects.contains(r))
                });
            }
        }

        if let Some(after) = query.created_after {
            filtered.retain(|d| d.created_at.unwrap_or(0) >= after);
        }
        if let Some(before) = query.created_before {
            filtered.retain(|d| d.created_at.unwrap_or(0) <= before);
        }
        if let Some(after) = query.updated_after {
            filtered.retain(|d| d.updated_at.or(d.created_at).unwrap_or(0) >= after);
        }
        if let Some(before) = query.updated_before {
            filtered.retain(|d| d.updated_at.or(d.created_at).unwrap_or(0) <= before);
        }

        filtered
    }
}

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

fn build_search_text(doc: &SearchDocument) -> String {
    let mut parts = Vec::new();
    parts.push(doc.title.as_str());
    parts.push(" ");
    parts.push(doc.body.as_str());

    for tag in &doc.tags {
        parts.push(" ");
        parts.push(tag.as_str());
    }

    let mut result = String::with_capacity(
        doc.title.len() + doc.body.len() + doc.tags.iter().map(|t| t.len()).sum::<usize>() + 32,
    );
    for part in parts {
        result.push_str(part);
    }
    result
}

#[tauri::command]
pub async fn index_content(
    state: State<'_, SearchService>,
    document: SearchDocument,
) -> Result<(), String> {
    state.index_content(document).await
}

#[tauri::command]
pub async fn search_in_module(
    state: State<'_, SearchService>,
    module_id: String,
    query: SearchQuery,
) -> Result<Vec<SearchHit>, String> {
    state.search_in_module(module_id, query).await
}

#[tauri::command]
pub async fn rebuild_index(
    state: State<'_, SearchService>,
    module_id: String,
) -> Result<(), String> {
    state.rebuild_index(module_id).await
}

#[tauri::command]
pub async fn delete_from_index(
    state: State<'_, SearchService>,
    module_id: String,
    id: String,
) -> Result<(), String> {
    state.delete_from_index(module_id, id).await
}
