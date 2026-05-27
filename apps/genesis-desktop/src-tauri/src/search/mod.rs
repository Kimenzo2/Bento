pub mod schema;
pub mod service;
pub mod snapshot;

pub use service::{
    SearchDocument, SearchHit, SearchQuery, SearchService, delete_from_index, index_content,
    rebuild_index, search_in_module,
};
