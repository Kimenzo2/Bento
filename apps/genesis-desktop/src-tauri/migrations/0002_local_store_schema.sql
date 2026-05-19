-- ═══════════════════════════════════════════════════════════════════════
-- ANYTYPE BLOCK STORAGE SCHEMA — Phase 2C transcription
-- Source: anytype-ts internal data model + Phase 2A TypeScript interfaces
-- ═══════════════════════════════════════════════════════════════════════
-- TRANSCRIPTION: Field names match Anytype's TypeScript source adapted
-- to SQLite conventions. All JSON fields use TEXT columns with JSON
-- serialization (SQLite's native JSON functions).
-- ═══════════════════════════════════════════════════════════════════════

-- ─── objects ──────────────────────────────────────────────────────────
-- Derived from the Object interface in interface/object.ts
-- Each object is a top-level entity (page, task, note, etc.)

CREATE TABLE IF NOT EXISTS objects (
    id              TEXT PRIMARY KEY,
    type            TEXT NOT NULL,         -- BlockType value (page, task, note, etc.)
    layout          TEXT NOT NULL,         -- ObjectLayout enum value
    name            TEXT,                  -- Object title/name
    icon            TEXT,                  -- Emoji or icon URL
    cover           TEXT,                  -- Cover image URL or color
    is_archived     INTEGER DEFAULT 0,
    is_deleted      INTEGER DEFAULT 0,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    space_id        TEXT,                  -- Workspace/space this object belongs to
    details         TEXT DEFAULT '{}'      -- JSON blob for extensible fields
);

-- ─── blocks ───────────────────────────────────────────────────────────
-- Derived from the Block interface in interface/block/index.ts
-- Each block belongs to an object and represents a content node.

CREATE TABLE IF NOT EXISTS blocks (
    id              TEXT PRIMARY KEY,
    object_id       TEXT NOT NULL,
    parent_id       TEXT,                  -- Parent block for nesting
    type            TEXT NOT NULL,         -- BlockType enum value
    content         TEXT NOT NULL DEFAULT '{}',  -- JSON of the specific content type
    fields          TEXT DEFAULT '{}',     -- Extended JSON fields from Anytype
    align           INTEGER DEFAULT 0,     -- BlockHAlign enum value
    bg_color        TEXT,                  -- Background color
    position        INTEGER NOT NULL,      -- Order within parent
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_object_id ON blocks(object_id);
CREATE INDEX IF NOT EXISTS idx_blocks_parent_id ON blocks(parent_id);

-- ─── relations ────────────────────────────────────────────────────────
-- Key-value metadata for objects, derived from ObjectDetail pattern

CREATE TABLE IF NOT EXISTS relations (
    id              TEXT NOT NULL,
    object_id       TEXT NOT NULL,
    key             TEXT NOT NULL,
    value           TEXT DEFAULT 'null',   -- JSON-serialized value
    PRIMARY KEY (object_id, key),
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relations_key ON relations(key);

-- ─── marks ────────────────────────────────────────────────────────────
-- Text formatting marks on blocks, derived from Mark interface

CREATE TABLE IF NOT EXISTS marks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id        TEXT NOT NULL,
    type            INTEGER NOT NULL,      -- MarkType enum value
    param           TEXT,                  -- URL for links, color for Color/BgColor
    range_start     INTEGER NOT NULL,
    range_end       INTEGER NOT NULL,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marks_block_id ON marks(block_id);

-- ─── object_children ───────────────────────────────────────────────────
-- Block tree order: maps parent blocks to their ordered children

CREATE TABLE IF NOT EXISTS object_children (
    object_id       TEXT NOT NULL,
    block_id        TEXT NOT NULL,
    child_id        TEXT NOT NULL,
    position        INTEGER NOT NULL,
    PRIMARY KEY (block_id, child_id),
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
    FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
    FOREIGN KEY (child_id) REFERENCES blocks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_object_children_object ON object_children(object_id);
CREATE INDEX IF NOT EXISTS idx_object_children_block ON object_children(block_id);
