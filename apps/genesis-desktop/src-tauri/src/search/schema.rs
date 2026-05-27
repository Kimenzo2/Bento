use tantivy::schema::{FAST, Field, STORED, STRING, Schema, SchemaBuilder, TEXT};

#[derive(Clone, Copy)]
pub struct SearchFields {
    pub module_id: Field,
    pub id: Field,
    pub title: Field,
    pub body: Field,
    pub tags_text: Field,
    pub tags_exact: Field,
    pub projects_text: Field,
    pub projects_exact: Field,
    pub kind: Field,
    pub source_ref: Field,
    pub extra: Field,
    pub created_at: Field,
    pub updated_at: Field,
}

pub fn build_schema() -> (Schema, SearchFields) {
    let mut builder = SchemaBuilder::default();
    let module_id = builder.add_text_field("module_id", STRING | STORED);
    let id = builder.add_text_field("id", STRING | STORED);
    let title = builder.add_text_field("title", TEXT | STORED);
    let body = builder.add_text_field("body", TEXT | STORED);
    let tags_text = builder.add_text_field("tags_text", TEXT | STORED);
    let tags_exact = builder.add_text_field("tags_exact", STRING | STORED);
    let projects_text = builder.add_text_field("projects_text", TEXT | STORED);
    let projects_exact = builder.add_text_field("projects_exact", STRING | STORED);
    let kind = builder.add_text_field("kind", STRING | STORED);
    let source_ref = builder.add_text_field("source_ref", STRING | STORED);
    let extra = builder.add_text_field("extra", TEXT | STORED);
    let created_at = builder.add_i64_field("created_at", FAST | STORED);
    let updated_at = builder.add_i64_field("updated_at", FAST | STORED);

    let schema = builder.build();
    let fields = SearchFields {
        module_id,
        id,
        title,
        body,
        tags_text,
        tags_exact,
        projects_text,
        projects_exact,
        kind,
        source_ref,
        extra,
        created_at,
        updated_at,
    };

    (schema, fields)
}
