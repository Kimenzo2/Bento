// object/mod.rs — port of core/create.go + core/object.go + core/details.go
// Go source: core/create.go, core/object.go, core/details.go

use std::sync::Arc;
use uuid::Uuid;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

use crate::domain::{
    Details, FullId, RelationKey, DetailValue, InternalFlag,
    ObjectTypeKey, Layout, relation_key,
};
use crate::store::{ObjectStore, Query, Filter, FilterCondition, FilterValue, Record};
use crate::session::Context;

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE TYPES  (mirrors pb.Rpc* structs)
// ═══════════════════════════════════════════════════════════════════════════

// ── ObjectCreate ──────────────────────────────────────────────────────────
/// Mirrors Go: pb.RpcObjectCreateRequest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateRequest {
    pub space_id:              String,
    pub details:               Details,
    pub internal_flags:        Vec<InternalFlag>,
    pub template_id:           String,
    pub object_type_unique_key: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateResponse {
    pub object_id: String,
    pub details:   Details,
    pub error:     RpcError,
}

// ── ObjectCreateSet ───────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateSetRequest {
    pub space_id:       String,
    pub details:        Details,
    pub source:         Vec<String>,  // setOf keys
    pub internal_flags: Vec<InternalFlag>,
    pub template_id:    String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateSetResponse {
    pub object_id: String,
    pub details:   Details,
    pub error:     RpcError,
}

// ── ObjectCreateBookmark ──────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateBookmarkRequest {
    pub space_id:   String,
    pub details:    Details,
    pub template_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateBookmarkResponse {
    pub object_id: String,
    pub details:   Details,
    pub error:     RpcError,
}

// ── ObjectCreateObjectType ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateObjectTypeRequest {
    pub space_id:       String,
    pub details:        Details,
    pub internal_flags: Vec<InternalFlag>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateObjectTypeResponse {
    pub object_id: String,
    pub details:   Details,
    pub error:     RpcError,
}

// ── ObjectCreateRelation ──────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateRelationRequest {
    pub space_id: String,
    pub details:  Details,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateRelationResponse {
    pub object_id: String,
    pub key:       String,
    pub details:   Details,
    pub error:     RpcError,
}

// ── ObjectCreateRelationOption ────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateRelationOptionRequest {
    pub space_id: String,
    pub details:  Details,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCreateRelationOptionResponse {
    pub object_id: String,
    pub details:   Details,
    pub error:     RpcError,
}

// ── ObjectDuplicate ───────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectDuplicateRequest  { pub space_id: String, pub context_id: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectDuplicateResponse { pub id: String, pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListDuplicateRequest  { pub space_id: String, pub object_ids: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListDuplicateResponse { pub ids: Vec<String>, pub error: RpcError }

// ── ObjectOpen / Close / Show / Refresh ──────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectOpenRequest {
    pub space_id:                          String,
    pub object_id:                         String,
    pub include_relations_as_dependents:   bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectOpenResponse {
    pub blocks:  Vec<crate::block::Block>,
    pub details: Details,
    pub error:   RpcError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCloseRequest  { pub space_id: String, pub object_id: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectCloseResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectShowRequest {
    pub space_id:  String,
    pub object_id: String,
    pub include_relations_as_dependents: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectShowResponse {
    pub blocks:  Vec<crate::block::Block>,
    pub details: Details,
    pub error:   RpcError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectRefreshRequest  { pub space_id: String, pub object_id: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectRefreshResponse { pub error: RpcError }

// ── ObjectSearch ──────────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSearchRequest {
    pub space_id:  String,
    pub filters:   Vec<crate::store::Filter>,
    pub sorts:     Vec<crate::store::Sort>,
    pub full_text: String,
    pub offset:    usize,
    pub limit:     usize,
    pub keys:      Vec<RelationKey>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSearchResponse {
    pub records: Vec<Details>,
    pub error:   RpcError,
}

// ── ObjectListDelete ──────────────────────────────────────────────────────
/// Mirrors Go: pb.RpcObjectListDeleteRequest — hard-delete archived objects
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListDeleteRequest  { pub space_id: String, pub object_ids: Vec<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListDeleteResponse { pub deleted_ids: Vec<String>, pub error: RpcError }

// ── ObjectSetDetails ──────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailEntry { pub key: RelationKey, pub value: DetailValue }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetDetailsRequest {
    pub context_id: String,
    pub space_id:   String,
    pub details:    Vec<DetailEntry>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetDetailsResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetDetailsRequest {
    pub space_id:   String,
    pub object_ids: Vec<String>,
    pub details:    Vec<DetailEntry>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetDetailsResponse { pub error: RpcError }

// ── ObjectSetInternalFlags ────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetInternalFlagsRequest {
    pub space_id:       String,
    pub context_id:     String,
    pub internal_flags: Vec<InternalFlag>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetInternalFlagsResponse { pub error: RpcError }

// ── ObjectSetIsFavorite / IsArchived ──────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetIsFavoriteRequest  { pub space_id: String, pub context_id: String, pub is_favorite: bool }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetIsFavoriteResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetIsArchivedRequest  { pub space_id: String, pub context_id: String, pub is_archived: bool }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetIsArchivedResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetIsArchivedRequest  { pub space_id: String, pub object_ids: Vec<String>, pub is_archived: bool }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetIsArchivedResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetIsFavoriteRequest  { pub space_id: String, pub object_ids: Vec<String>, pub is_favorite: bool }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetIsFavoriteResponse { pub error: RpcError }

// ── ObjectSetLayout ───────────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetLayoutRequest  { pub space_id: String, pub context_id: String, pub layout: Layout }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetLayoutResponse { pub error: RpcError }

// ── ObjectSetObjectType ───────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetObjectTypeRequest {
    pub space_id:             String,
    pub context_id:           String,
    pub object_type_unique_key: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectSetObjectTypeResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetObjectTypeRequest {
    pub space_id:             String,
    pub object_ids:           Vec<String>,
    pub object_type_unique_key: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListSetObjectTypeResponse { pub error: RpcError }

// ── ObjectRelationAdd / Delete ────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectRelationAddRequest {
    pub space_id:      String,
    pub context_id:    String,
    pub relation_keys: Vec<RelationKey>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectRelationAddResponse { pub error: RpcError }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectRelationDeleteRequest {
    pub space_id:      String,
    pub context_id:    String,
    pub relation_keys: Vec<RelationKey>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectRelationDeleteResponse { pub error: RpcError }

// ── ObjectListModifyDetailValues ──────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModifyOperation {
    pub relation_key: RelationKey,
    pub add_ids:      Vec<String>,
    pub remove_ids:   Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListModifyDetailValuesRequest {
    pub space_id:    String,
    pub object_ids:  Vec<String>,
    pub operations:  Vec<ModifyOperation>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListModifyDetailValuesResponse { pub error: RpcError }

// ── ObjectBookmarkFetch ───────────────────────────────────────────────────
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectBookmarkFetchRequest  { pub space_id: String, pub context_id: String, pub url: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectBookmarkFetchResponse { pub error: RpcError }

// ── Shared error type ─────────────────────────────────────────────────────
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RpcError { pub code: i32, pub description: String }

impl RpcError {
    pub fn ok() -> Self { Self { code: 0, description: String::new() } }
    pub fn unknown(msg: impl std::fmt::Display) -> Self { Self { code: 1, description: msg.to_string() } }
    pub fn bad_input(msg: impl std::fmt::Display) -> Self { Self { code: 2, description: msg.to_string() } }
}

// ═══════════════════════════════════════════════════════════════════════════
// ObjectService  (mirrors Go: objectcreator.Service + detailservice.Service)
// ═══════════════════════════════════════════════════════════════════════════
pub struct ObjectService {
    store:         Arc<ObjectStore>,
    block_service: Arc<crate::block::editor::BlockService>,
}

impl ObjectService {
    pub fn new(store: Arc<ObjectStore>, block_service: Arc<crate::block::editor::BlockService>) -> Self {
        Self { store, block_service }
    }

    fn ok() -> RpcError { RpcError::ok() }
    fn err(e: anyhow::Error) -> RpcError { RpcError::unknown(e) }

    // ─────────────────────────────────────────────────────────────────────
    // CORE OBJECT CREATE  (Go: objectcreator.Service.CreateObject)
    // ─────────────────────────────────────────────────────────────────────
    fn create_object(
        &self,
        space_id: &str,
        object_type_key: ObjectTypeKey,
        mut details: Details,
        _template_id: &str,
    ) -> Result<(String, Details)> {
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();

        // Fill system details — mirrors Go: objectcreator.fillSystemDetails
        details.set_string(relation_key::id(),           id.clone());
        details.set_string(relation_key::space_id(),     space_id.to_owned());
        details.set_string(relation_key::object_type(),  object_type_key.as_str().to_owned());
        details.set(relation_key::created_date(),  DetailValue::Timestamp(now));
        details.set(relation_key::last_modified(), DetailValue::Timestamp(now));
        if !details.has(&relation_key::is_archived()) {
            details.set_bool(relation_key::is_archived(), false);
        }
        if !details.has(&relation_key::is_favorite()) {
            details.set_bool(relation_key::is_favorite(), false);
        }

        self.store.upsert(space_id, &id, &details)?;
        Ok((id, details))
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectCreate  (Go: mw.ObjectCreate)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_create(&self, req: ObjectCreateRequest) -> ObjectCreateResponse {
        // Resolve type from unique key string — mirrors Go: objectcreator.CreateObjectUsingObjectUniqueTypeKey
        let type_key = object_type_key_from_str(&req.object_type_unique_key)
            .unwrap_or(ObjectTypeKey::Note);
        match self.create_object(&req.space_id, type_key, req.details, &req.template_id) {
            Ok((id, d)) => ObjectCreateResponse { object_id: id, details: d, error: Self::ok() },
            Err(e)      => ObjectCreateResponse { object_id: String::new(), details: Details::new(), error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectCreateSet  (Go: mw.ObjectCreateSet)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_create_set(&self, req: ObjectCreateSetRequest) -> ObjectCreateSetResponse {
        let mut details = req.details;
        details.set_string_list(relation_key::set_of(), req.source);
        match self.create_object(&req.space_id, ObjectTypeKey::Set, details, &req.template_id) {
            Ok((id, d)) => ObjectCreateSetResponse { object_id: id, details: d, error: Self::ok() },
            Err(e)      => ObjectCreateSetResponse { object_id: String::new(), details: Details::new(), error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectCreateBookmark  (Go: mw.ObjectCreateBookmark)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_create_bookmark(&self, req: ObjectCreateBookmarkRequest) -> ObjectCreateBookmarkResponse {
        match self.create_object(&req.space_id, ObjectTypeKey::Bookmark, req.details, &req.template_id) {
            Ok((id, d)) => ObjectCreateBookmarkResponse { object_id: id, details: d, error: Self::ok() },
            Err(e)      => ObjectCreateBookmarkResponse { object_id: String::new(), details: Details::new(), error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectCreateObjectType  (Go: mw.ObjectCreateObjectType)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_create_object_type(&self, req: ObjectCreateObjectTypeRequest) -> ObjectCreateObjectTypeResponse {
        match self.create_object(&req.space_id, ObjectTypeKey::ObjectType, req.details, "") {
            Ok((id, d)) => ObjectCreateObjectTypeResponse { object_id: id, details: d, error: Self::ok() },
            Err(e)      => ObjectCreateObjectTypeResponse { object_id: String::new(), details: Details::new(), error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectCreateRelation  (Go: mw.ObjectCreateRelation)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_create_relation(&self, req: ObjectCreateRelationRequest) -> ObjectCreateRelationResponse {
        match self.create_object(&req.space_id, ObjectTypeKey::Relation, req.details, "") {
            Ok((id, d)) => {
                let key = d.get_string(&relation_key::relation_key()).unwrap_or("").to_owned();
                ObjectCreateRelationResponse { object_id: id, key, details: d, error: Self::ok() }
            }
            Err(e) => ObjectCreateRelationResponse {
                object_id: String::new(), key: String::new(),
                details: Details::new(), error: Self::err(e),
            },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectCreateRelationOption  (Go: mw.ObjectCreateRelationOption)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_create_relation_option(&self, req: ObjectCreateRelationOptionRequest) -> ObjectCreateRelationOptionResponse {
        match self.create_object(&req.space_id, ObjectTypeKey::RelationOption, req.details, "") {
            Ok((id, d)) => ObjectCreateRelationOptionResponse { object_id: id, details: d, error: Self::ok() },
            Err(e)      => ObjectCreateRelationOptionResponse { object_id: String::new(), details: Details::new(), error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectDuplicate / ObjectListDuplicate  (Go: mw.ObjectDuplicate / mw.ObjectListDuplicate)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_duplicate(&self, req: ObjectDuplicateRequest) -> ObjectDuplicateResponse {
        match self.duplicate_one(&req.space_id, &req.context_id) {
            Ok(id)  => ObjectDuplicateResponse { id, error: Self::ok() },
            Err(e)  => ObjectDuplicateResponse { id: String::new(), error: Self::err(e) },
        }
    }

    pub fn object_list_duplicate(&self, req: ObjectListDuplicateRequest) -> ObjectListDuplicateResponse {
        let mut ids  = Vec::new();
        let mut last_err: Option<anyhow::Error> = None;
        for oid in &req.object_ids {
            match self.duplicate_one(&req.space_id, oid) {
                Ok(id)  => ids.push(id),
                Err(e)  => { last_err = Some(e); }
            }
        }
        let error = last_err.map(Self::err).unwrap_or_else(Self::ok);
        ObjectListDuplicateResponse { ids, error }
    }

    fn duplicate_one(&self, space_id: &str, object_id: &str) -> Result<String> {
        let details = self.store.get_by_id(space_id, object_id)?
            .ok_or_else(|| anyhow!("object not found: {object_id}"))?;
        let new_id  = Uuid::new_v4().to_string();
        let now     = chrono::Utc::now();
        let mut new_details = details.clone();
        new_details.set_string(relation_key::id(),          new_id.clone());
        new_details.set(relation_key::created_date(),  DetailValue::Timestamp(now));
        new_details.set(relation_key::last_modified(), DetailValue::Timestamp(now));
        self.store.upsert(space_id, &new_id, &new_details)?;
        Ok(new_id)
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectOpen / Close / Show / Refresh  (Go: bs.OpenBlock / CloseBlock / ShowBlock)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_open(&self, req: ObjectOpenRequest) -> ObjectOpenResponse {
        let id = FullId::new(req.space_id.clone(), req.object_id.clone());
        match self.block_service.open_block(&id, req.include_relations_as_dependents) {
            Ok(blocks) => {
                let details = self.store.get_by_id(&req.space_id, &req.object_id)
                    .ok().flatten().unwrap_or_default();
                ObjectOpenResponse { blocks, details, error: Self::ok() }
            }
            Err(e) => ObjectOpenResponse { blocks: vec![], details: Details::new(), error: Self::err(e) },
        }
    }

    pub fn object_close(&self, req: ObjectCloseRequest) -> ObjectCloseResponse {
        let id = FullId::new(req.space_id, req.object_id);
        self.block_service.close_block(&id);
        ObjectCloseResponse { error: Self::ok() }
    }

    pub fn object_show(&self, req: ObjectShowRequest) -> ObjectShowResponse {
        let id = FullId::new(req.space_id.clone(), req.object_id.clone());
        match self.block_service.show_block(&id) {
            Ok(blocks) => {
                let details = self.store.get_by_id(&req.space_id, &req.object_id)
                    .ok().flatten().unwrap_or_default();
                ObjectShowResponse { blocks, details, error: Self::ok() }
            }
            Err(e) => ObjectShowResponse { blocks: vec![], details: Details::new(), error: Self::err(e) },
        }
    }

    pub fn object_refresh(&self, req: ObjectRefreshRequest) -> ObjectRefreshResponse {
        // Close and re-open to get fresh state — mirrors Go: bs.ObjectRefresh
        let space_id = req.space_id.clone();
        let object_id = req.object_id.clone();
        self.block_service.close_block(&FullId::new(space_id.clone(), object_id.clone()));
        self.block_service.open_block(&FullId::new(space_id, object_id), false).ok();
        ObjectRefreshResponse { error: Self::ok() }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSearch  (Go: mw.ObjectSearch)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_search(&self, req: ObjectSearchRequest) -> ObjectSearchResponse {
        let query = crate::store::Query {
            space_id:   Some(req.space_id),
            filters:    req.filters,
            sorts:      req.sorts,
            text_query: if req.full_text.is_empty() { None } else { Some(req.full_text) },
            limit:      req.limit,
            offset:     req.offset,
            keys:       req.keys,
            prefix_name_query: true,
        };
        match self.store.query(&query) {
            Ok(records) => ObjectSearchResponse {
                records: records.into_iter().map(|r| r.details).collect(),
                error: Self::ok(),
            },
            Err(e) => ObjectSearchResponse { records: vec![], error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectListDelete  (Go: mw.ObjectListDelete → bs.DeleteArchivedObjects)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_list_delete(&self, req: ObjectListDeleteRequest) -> ObjectListDeleteResponse {
        match self.store.delete_objects(&req.space_id, &req.object_ids) {
            Ok(deleted) => ObjectListDeleteResponse { deleted_ids: deleted, error: Self::ok() },
            Err(e)      => ObjectListDeleteResponse { deleted_ids: vec![], error: Self::err(e) },
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSetDetails  (Go: mw.ObjectSetDetails → detailservice.SetDetails)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_set_details(&self, req: ObjectSetDetailsRequest) -> ObjectSetDetailsResponse {
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            for entry in &req.details {
                d.set(entry.key.clone(), entry.value.clone());
            }
            Ok(d)
        });
        ObjectSetDetailsResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectListSetDetails  (Go: mw.ObjectListSetDetails → detailservice.SetDetailsList)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_list_set_details(&self, req: ObjectListSetDetailsRequest) -> ObjectListSetDetailsResponse {
        let mut last_err: Option<anyhow::Error> = None;
        for oid in &req.object_ids {
            let r = self.store.modify_details(&req.space_id, oid, |mut d| {
                for entry in &req.details { d.set(entry.key.clone(), entry.value.clone()); }
                Ok(d)
            });
            if let Err(e) = r { last_err = Some(e); }
        }
        ObjectListSetDetailsResponse { error: last_err.map(Self::err).unwrap_or_else(Self::ok) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSetInternalFlags  (Go: mw.ObjectSetInternalFlags → ds.ModifyDetails)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_set_internal_flags(&self, req: ObjectSetInternalFlagsRequest) -> ObjectSetInternalFlagsResponse {
        let flags = req.internal_flags;
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            // Store internal flags as a stringified list in details
            let flag_strs: Vec<String> = flags.iter().map(|f| format!("{:?}", f)).collect();
            d.set_string_list(RelationKey::new("internalFlags"), flag_strs);
            Ok(d)
        });
        ObjectSetInternalFlagsResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSetIsFavorite  (Go: mw.ObjectSetIsFavorite → detailservice.SetIsFavorite)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_set_is_favorite(&self, req: ObjectSetIsFavoriteRequest) -> ObjectSetIsFavoriteResponse {
        let r = self.store.set_favorite(&req.space_id, &req.context_id, req.is_favorite);
        ObjectSetIsFavoriteResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn object_list_set_is_favorite(&self, req: ObjectListSetIsFavoriteRequest) -> ObjectListSetIsFavoriteResponse {
        let mut last_err = None;
        for oid in &req.object_ids {
            if let Err(e) = self.store.set_favorite(&req.space_id, oid, req.is_favorite) {
                last_err = Some(e);
            }
        }
        ObjectListSetIsFavoriteResponse { error: last_err.map(Self::err).unwrap_or_else(Self::ok) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSetIsArchived  (Go: mw.ObjectSetIsArchived → detailservice.SetIsArchived)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_set_is_archived(&self, req: ObjectSetIsArchivedRequest) -> ObjectSetIsArchivedResponse {
        let r = self.store.set_archived(&req.space_id, &req.context_id, req.is_archived);
        ObjectSetIsArchivedResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn object_list_set_is_archived(&self, req: ObjectListSetIsArchivedRequest) -> ObjectListSetIsArchivedResponse {
        let mut last_err = None;
        for oid in &req.object_ids {
            if let Err(e) = self.store.set_archived(&req.space_id, oid, req.is_archived) {
                last_err = Some(e);
            }
        }
        ObjectListSetIsArchivedResponse { error: last_err.map(Self::err).unwrap_or_else(Self::ok) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSetLayout  (Go: mw.ObjectSetLayout → bs.SetLayout)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_set_layout(&self, req: ObjectSetLayoutRequest) -> ObjectSetLayoutResponse {
        let layout = req.layout;
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            d.set(relation_key::layout(), DetailValue::Int(layout as i64));
            Ok(d)
        });
        ObjectSetLayoutResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectSetObjectType  (Go: mw.ObjectSetObjectType → bs.SetObjectTypes)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_set_object_type(&self, req: ObjectSetObjectTypeRequest) -> ObjectSetObjectTypeResponse {
        let key = req.object_type_unique_key.clone();
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            d.set_string(relation_key::object_type(), key);
            Ok(d)
        });
        ObjectSetObjectTypeResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    pub fn object_list_set_object_type(&self, req: ObjectListSetObjectTypeRequest) -> ObjectListSetObjectTypeResponse {
        let mut any_succeed = false;
        let mut last_err: Option<anyhow::Error> = None;
        for oid in &req.object_ids {
            let key = req.object_type_unique_key.clone();
            let r = self.store.modify_details(&req.space_id, oid, |mut d| {
                d.set_string(relation_key::object_type(), key);
                Ok(d)
            });
            match r {
                Ok(_)  => any_succeed = true,
                Err(e) => last_err = Some(e),
            }
        }
        // Mirrors Go: if any succeed, return ok  
        let error = if any_succeed { Self::ok() } else {
            last_err.map(Self::err).unwrap_or_else(Self::ok)
        };
        ObjectListSetObjectTypeResponse { error }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectRelationAdd  (Go: mw.ObjectRelationAdd → detailservice.ModifyDetails)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_relation_add(&self, req: ObjectRelationAddRequest) -> ObjectRelationAddResponse {
        if req.relation_keys.is_empty() {
            return ObjectRelationAddResponse {
                error: RpcError::bad_input("relation keys list is empty"),
            };
        }
        let keys = req.relation_keys.clone();
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            for key in &keys {
                if !d.has(key) {
                    // Default value: null (mirrors Go: domain.Null())
                    d.set(key.clone(), DetailValue::Null);
                }
            }
            Ok(d)
        });
        ObjectRelationAddResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectRelationDelete  (Go: mw.ObjectRelationDelete → bs.RemoveRelations)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_relation_delete(&self, req: ObjectRelationDeleteRequest) -> ObjectRelationDeleteResponse {
        let keys = req.relation_keys.clone();
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            for key in &keys { d.0.remove(key); }
            Ok(d)
        });
        ObjectRelationDeleteResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectListModifyDetailValues  (Go: mw.ObjectListModifyDetailValues)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_list_modify_detail_values(&self, req: ObjectListModifyDetailValuesRequest) -> ObjectListModifyDetailValuesResponse {
        let mut last_err: Option<anyhow::Error> = None;
        for oid in &req.object_ids {
            let ops = req.operations.clone();
            let r = self.store.modify_details(&req.space_id, oid, |mut d| {
                for op in &ops {
                    // Get current list value, add/remove ids
                    let mut current: Vec<String> = d.get_string_list(&op.relation_key)
                        .map(|s| s.to_vec()).unwrap_or_default();
                    for id in &op.remove_ids { current.retain(|v| v != id); }
                    for id in &op.add_ids {
                        if !current.contains(id) { current.push(id.clone()); }
                    }
                    d.set_string_list(op.relation_key.clone(), current);
                }
                Ok(d)
            });
            if let Err(e) = r { last_err = Some(e); }
        }
        ObjectListModifyDetailValuesResponse { error: last_err.map(Self::err).unwrap_or_else(Self::ok) }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ObjectBookmarkFetch  (Go: mw.ObjectBookmarkFetch → bs.ObjectBookmarkFetch)
    // ─────────────────────────────────────────────────────────────────────
    pub fn object_bookmark_fetch(&self, req: ObjectBookmarkFetchRequest) -> ObjectBookmarkFetchResponse {
        // Async in Go — we store the URL in details and return ok.
        // Real impl would spawn a task to fetch URL metadata.
        let r = self.store.modify_details(&req.space_id, &req.context_id, |mut d| {
            d.set_string(RelationKey::new("source"), req.url);
            Ok(d)
        });
        ObjectBookmarkFetchResponse { error: r.map(|_| Self::ok()).unwrap_or_else(Self::err) }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
fn object_type_key_from_str(s: &str) -> Option<ObjectTypeKey> {
    match s {
        "ot-note"          => Some(ObjectTypeKey::Note),
        "ot-page"          => Some(ObjectTypeKey::Page),
        "ot-task"          => Some(ObjectTypeKey::Task),
        "ot-set"           => Some(ObjectTypeKey::Set),
        "ot-collection"    => Some(ObjectTypeKey::Collection),
        "ot-bookmark"      => Some(ObjectTypeKey::Bookmark),
        "ot-objectType"    => Some(ObjectTypeKey::ObjectType),
        "ot-relation"      => Some(ObjectTypeKey::Relation),
        "ot-relationOption"=> Some(ObjectTypeKey::RelationOption),
        "ot-template"      => Some(ObjectTypeKey::Template),
        _                  => None,
    }
}
