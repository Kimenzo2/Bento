use std::{collections::HashMap, fs, ops::Bound, path::PathBuf, sync::Arc};

use serde::{Deserialize, Serialize};
use tantivy::{
    Index, IndexReader, ReloadPolicy, Term,
    collector::TopDocs,
    directory::MmapDirectory,
    query::{BooleanQuery, FastFieldRangeQuery, Occur, Query, QueryParser, TermQuery},
    schema::{
        Field, IndexRecordOption,
        document::{TantivyDocument, Value},
    },
};
use tauri::State;
use tokio::sync::Mutex;

use super::{
    schema::{SearchFields, build_schema},
    snapshot,
};

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

struct ModuleIndex {
    index: Index,
    reader: IndexReader,
    fields: SearchFields,
}

pub struct SearchService {
    base_dir: PathBuf,
    cache: Mutex<HashMap<String, Arc<ModuleIndex>>>,
}

impl SearchService {
    pub fn new(base_dir: PathBuf) -> Result<Self, String> {
        let root = base_dir.join("search");
        fs::create_dir_all(root.join("indexes")).map_err(|error| error.to_string())?;
        fs::create_dir_all(root.join("snapshots")).map_err(|error| error.to_string())?;

        Ok(Self {
            base_dir,
            cache: Mutex::new(HashMap::new()),
        })
    }

    pub async fn index_content(&self, document: SearchDocument) -> Result<(), String> {
        let module_id = normalize_module_id(&document.module_id);
        let handle = self.ensure_module_index(&module_id).await?;

        let mut snapshot_docs = snapshot::load_module_snapshot(&self.base_dir, &module_id)?;
        snapshot_docs.insert(document.id.clone(), document.clone());
        snapshot::save_module_snapshot(&self.base_dir, &module_id, &snapshot_docs)?;

        self.upsert_document(&handle, &document).await
    }

    pub async fn delete_from_index(&self, module_id: String, id: String) -> Result<(), String> {
        let module_id = normalize_module_id(&module_id);
        let handle = self.ensure_module_index(&module_id).await?;

        let mut snapshot_docs = snapshot::load_module_snapshot(&self.base_dir, &module_id)?;
        snapshot_docs.remove(&id);
        snapshot::save_module_snapshot(&self.base_dir, &module_id, &snapshot_docs)?;

        self.delete_document(&handle, &id).await
    }

    pub async fn rebuild_index(&self, module_id: String) -> Result<(), String> {
        let module_id = normalize_module_id(&module_id);
        let docs = snapshot::load_module_snapshot(&self.base_dir, &module_id)?;

        self.reset_module_index(&module_id).await?;
        let handle = self.ensure_module_index(&module_id).await?;

        if docs.is_empty() {
            return Ok(());
        }

        let mut writer = handle
            .index
            .writer::<TantivyDocument>(50_000_000)
            .map_err(|error| error.to_string())?;
        for document in docs.values() {
            writer
                .add_document(Self::to_tantivy_document(&handle.fields, document))
                .map_err(|error| error.to_string())?;
        }
        writer.commit().map_err(|error| error.to_string())?;
        handle.reader.reload().map_err(|error| error.to_string())?;
        Ok(())
    }

    pub async fn search_in_module(
        &self,
        module_id: String,
        query: SearchQuery,
    ) -> Result<Vec<SearchHit>, String> {
        let module_id = normalize_module_id(&module_id);
        let handle = self.ensure_module_index(&module_id).await?;
        let snapshot_docs = snapshot::load_module_snapshot(&self.base_dir, &module_id)?;
        let limit = query.limit.unwrap_or(25).clamp(1, 100);
        let offset = query.offset.unwrap_or(0);

        if query.query.trim().is_empty() {
            let mut docs: Vec<SearchDocument> = snapshot_docs.values().cloned().collect();
            docs.sort_by(|left, right| {
                let left_key = left.updated_at.or(left.created_at).unwrap_or_default();
                let right_key = right.updated_at.or(right.created_at).unwrap_or_default();
                right_key.cmp(&left_key)
            });

            return Ok(docs
                .into_iter()
                .skip(offset)
                .take(limit)
                .map(|document| SearchHit {
                    score: 0.0,
                    document,
                })
                .collect());
        }

        let search_query = self.build_query(&handle, &query)?;
        let searcher = handle.reader.searcher();
        let hits: Vec<(f32, tantivy::DocAddress)> = searcher
            .search(
                &search_query,
                &TopDocs::with_limit(limit + offset).order_by_score(),
            )
            .map_err(|error| error.to_string())?;

        let mut results = Vec::new();
        for (score, address) in hits.into_iter().skip(offset) {
            let doc: TantivyDocument = searcher
                .doc::<TantivyDocument>(address)
                .map_err(|error| error.to_string())?;
            let Some(id) = doc
                .get_first(handle.fields.id)
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
            else {
                continue;
            };

            if let Some(document) = snapshot_docs.get(&id).cloned() {
                results.push(SearchHit { score, document });
            }
        }

        Ok(results)
    }

    pub async fn clear_all_user_indexes(&self) -> Result<(), String> {
        self.cache.lock().await.clear();

        let search_root = self.base_dir.join("search");
        let indexes = search_root.join("indexes");
        let snapshots = search_root.join("snapshots");

        if indexes.exists() {
            fs::remove_dir_all(&indexes).map_err(|error| error.to_string())?;
        }
        if snapshots.exists() {
            fs::remove_dir_all(&snapshots).map_err(|error| error.to_string())?;
        }

        fs::create_dir_all(&indexes).map_err(|error| error.to_string())?;
        fs::create_dir_all(&snapshots).map_err(|error| error.to_string())?;
        Ok(())
    }

    async fn upsert_document(
        &self,
        handle: &Arc<ModuleIndex>,
        document: &SearchDocument,
    ) -> Result<(), String> {
        let mut writer = handle
            .index
            .writer::<TantivyDocument>(50_000_000)
            .map_err(|error| error.to_string())?;
        writer.delete_term(Term::from_field_text(handle.fields.id, &document.id));
        writer
            .add_document(Self::to_tantivy_document(&handle.fields, document))
            .map_err(|error| error.to_string())?;
        writer.commit().map_err(|error| error.to_string())?;
        handle.reader.reload().map_err(|error| error.to_string())?;
        Ok(())
    }

    async fn delete_document(&self, handle: &Arc<ModuleIndex>, id: &str) -> Result<(), String> {
        let mut writer = handle
            .index
            .writer::<TantivyDocument>(50_000_000)
            .map_err(|error| error.to_string())?;
        writer.delete_term(Term::from_field_text(handle.fields.id, id));
        writer.commit().map_err(|error| error.to_string())?;
        handle.reader.reload().map_err(|error| error.to_string())?;
        Ok(())
    }

    async fn reset_module_index(&self, module_id: &str) -> Result<(), String> {
        let mut cache = self.cache.lock().await;
        cache.remove(module_id);

        let index_dir = self.index_dir(module_id);
        if index_dir.exists() {
            fs::remove_dir_all(&index_dir).map_err(|error| error.to_string())?;
        }

        fs::create_dir_all(&index_dir).map_err(|error| error.to_string())?;
        Ok(())
    }

    async fn ensure_module_index(&self, module_id: &str) -> Result<Arc<ModuleIndex>, String> {
        if let Some(handle) = self.cache.lock().await.get(module_id).cloned() {
            return Ok(handle);
        }

        let index_dir = self.index_dir(module_id);
        fs::create_dir_all(&index_dir).map_err(|error| error.to_string())?;

        let (schema, fields) = build_schema();
        let directory = MmapDirectory::open(&index_dir).map_err(|error| error.to_string())?;
        let index = Index::open_or_create(directory, schema).map_err(|error| error.to_string())?;

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(|error| error.to_string())?;

        let handle = Arc::new(ModuleIndex {
            index,
            reader,
            fields,
        });

        let mut cache = self.cache.lock().await;
        cache.insert(module_id.to_string(), handle.clone());
        Ok(handle)
    }

    fn build_query(
        &self,
        handle: &Arc<ModuleIndex>,
        query: &SearchQuery,
    ) -> Result<Box<dyn Query>, String> {
        let mut parser = QueryParser::for_index(
            &handle.index,
            vec![
                handle.fields.title,
                handle.fields.body,
                handle.fields.tags_text,
                handle.fields.projects_text,
                handle.fields.kind,
            ],
        );
        parser.set_conjunction_by_default();

        if query.fuzzy {
            parser.set_field_fuzzy(handle.fields.title, true, 1, true);
            parser.set_field_fuzzy(handle.fields.body, true, 1, true);
            parser.set_field_fuzzy(handle.fields.tags_text, true, 1, true);
            parser.set_field_fuzzy(handle.fields.projects_text, true, 1, true);
        }

        let mut clauses: Vec<(Occur, Box<dyn Query>)> = Vec::new();

        let text_query = parser
            .parse_query(&query.query)
            .map_err(|error| error.to_string())?;
        clauses.push((Occur::Must, text_query));

        if let Some(kind) = query.kind.as_ref().filter(|value| !value.trim().is_empty()) {
            clauses.push((
                Occur::Must,
                Box::new(TermQuery::new(
                    Term::from_field_text(handle.fields.kind, kind.trim()),
                    IndexRecordOption::Basic,
                )),
            ));
        }

        if !query.tags.is_empty() {
            let tag_clauses = query
                .tags
                .iter()
                .filter(|value| !value.trim().is_empty())
                .map(|tag| {
                    (
                        Occur::Must,
                        Box::new(TermQuery::new(
                            Term::from_field_text(
                                handle.fields.tags_exact,
                                &normalize_filter_value(tag),
                            ),
                            IndexRecordOption::Basic,
                        )) as Box<dyn Query>,
                    )
                })
                .collect::<Vec<_>>();
            if !tag_clauses.is_empty() {
                clauses.push((Occur::Must, Box::new(BooleanQuery::new(tag_clauses))));
            }
        }

        if !query.projects.is_empty() {
            let project_clauses = query
                .projects
                .iter()
                .filter(|value| !value.trim().is_empty())
                .map(|project| {
                    (
                        Occur::Must,
                        Box::new(TermQuery::new(
                            Term::from_field_text(
                                handle.fields.projects_exact,
                                &normalize_filter_value(project),
                            ),
                            IndexRecordOption::Basic,
                        )) as Box<dyn Query>,
                    )
                })
                .collect::<Vec<_>>();
            if !project_clauses.is_empty() {
                clauses.push((Occur::Must, Box::new(BooleanQuery::new(project_clauses))));
            }
        }

        if query.created_after.is_some() || query.created_before.is_some() {
            clauses.push((
                Occur::Must,
                Box::new(build_range_query(
                    handle.fields.created_at,
                    query.created_after,
                    query.created_before,
                )),
            ));
        }

        if query.updated_after.is_some() || query.updated_before.is_some() {
            clauses.push((
                Occur::Must,
                Box::new(build_range_query(
                    handle.fields.updated_at,
                    query.updated_after,
                    query.updated_before,
                )),
            ));
        }

        if clauses.len() == 1 {
            Ok(clauses.remove(0).1)
        } else {
            Ok(Box::new(BooleanQuery::new(clauses)))
        }
    }

    fn to_tantivy_document(fields: &SearchFields, document: &SearchDocument) -> TantivyDocument {
        let mut doc = TantivyDocument::default();
        doc.add_text(fields.module_id, &document.module_id);
        doc.add_text(fields.id, &document.id);
        doc.add_text(fields.title, &document.title);
        doc.add_text(fields.body, &document.body);
        doc.add_text(fields.kind, document.kind.as_deref().unwrap_or(""));

        for tag in document
            .tags
            .iter()
            .map(|value| normalize_filter_value(value))
        {
            if tag.is_empty() {
                continue;
            }
            doc.add_text(fields.tags_text, &tag);
            doc.add_text(fields.tags_exact, &tag);
        }

        for project in document
            .projects
            .iter()
            .map(|value| normalize_filter_value(value))
        {
            if project.is_empty() {
                continue;
            }
            doc.add_text(fields.projects_text, &project);
            doc.add_text(fields.projects_exact, &project);
        }

        if let Some(source_ref) = document
            .source_ref
            .as_ref()
            .filter(|value| !value.trim().is_empty())
        {
            doc.add_text(fields.source_ref, source_ref);
        }

        if !document.extra.is_null() {
            doc.add_text(fields.extra, &document.extra.to_string());
        }

        doc.add_i64(fields.created_at, document.created_at.unwrap_or_default());
        doc.add_i64(
            fields.updated_at,
            document
                .updated_at
                .unwrap_or_else(|| document.created_at.unwrap_or_default()),
        );
        doc
    }

    fn index_dir(&self, module_id: &str) -> PathBuf {
        self.base_dir
            .join("search")
            .join("indexes")
            .join(normalize_module_id(module_id))
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

fn normalize_filter_value(value: &str) -> String {
    value.trim().to_lowercase()
}

fn build_range_query(field: Field, after: Option<i64>, before: Option<i64>) -> FastFieldRangeQuery {
    let lower = after
        .map(|value| Bound::Included(Term::from_field_i64(field, value)))
        .unwrap_or(Bound::Unbounded);
    let upper = before
        .map(|value| Bound::Included(Term::from_field_i64(field, value)))
        .unwrap_or(Bound::Unbounded);
    FastFieldRangeQuery::new(lower, upper)
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
