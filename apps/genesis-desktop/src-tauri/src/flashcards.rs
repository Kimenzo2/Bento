// ─────────────────────────────────────────────────────────────────────────────
// Flashcards / Bento Recall — SQLite-backed
// Tables: flashcard_decks, flashcard_cards
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ═══ TYPES (mirrors frontend exactly with camelCase) ═══════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallCardRow {
    pub id: String,
    pub deck_id: String,
    pub context: String,
    pub cue: String,
    pub anchor: String,
    pub created_at: i64,
    pub due_at: i64,
    pub reviewed_at: Option<i64>,
    pub interval_days: i64,
    pub ease: f64,
    pub streak: i64,
    pub mastery: i64,
    pub pinned: bool,
    pub archived: bool,
    pub source: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallDeckRow {
    pub id: String,
    pub title: String,
    pub context: String,
    pub note: String,
    pub created_at: i64,
    pub archived: bool,
    pub cards: Vec<RecallCardRow>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewDeckPayload {
    pub title: String,
    pub context: String,
    pub note: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCardPayload {
    pub deck_id: String,
    pub cue: String,
    pub anchor: String,
    pub context: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GradeCardPayload {
    pub card_id: String,
    pub grade: String, // "again" | "hard" | "good" | "easy"
    pub due_at: i64,
    pub interval_days: i64,
    pub ease: f64,
    pub streak: i64,
    pub mastery: i64,
}

// ═══ TABLE BOOTSTRAP ══════════════════════════════════════════════════════════

pub async fn ensure_flashcards_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let ddl = [
        r#"CREATE TABLE IF NOT EXISTS flashcard_decks (
            id         TEXT    PRIMARY KEY,
            title      TEXT    NOT NULL,
            context    TEXT    NOT NULL DEFAULT 'Focus',
            note       TEXT    NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            archived   INTEGER NOT NULL DEFAULT 0
        )"#,
        r#"CREATE TABLE IF NOT EXISTS flashcard_cards (
            id             TEXT    PRIMARY KEY,
            deck_id        TEXT    NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
            context        TEXT    NOT NULL DEFAULT 'Focus',
            cue            TEXT    NOT NULL,
            anchor         TEXT    NOT NULL,
            created_at     INTEGER NOT NULL,
            due_at         INTEGER NOT NULL,
            reviewed_at    INTEGER,
            interval_days  INTEGER NOT NULL DEFAULT 1,
            ease           REAL    NOT NULL DEFAULT 2.0,
            streak         INTEGER NOT NULL DEFAULT 0,
            mastery        INTEGER NOT NULL DEFAULT 0,
            pinned         INTEGER NOT NULL DEFAULT 0,
            archived       INTEGER NOT NULL DEFAULT 0,
            source         TEXT    NOT NULL DEFAULT ''
        )"#,
        r#"CREATE INDEX IF NOT EXISTS idx_flashcard_cards_deck_id ON flashcard_cards(deck_id)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_flashcard_cards_due_at ON flashcard_cards(due_at)"#,
        r#"CREATE INDEX IF NOT EXISTS idx_flashcard_cards_context ON flashcard_cards(context)"#,
    ];
    for sql in ddl {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ═══ HELPERS ═══════════════════════════════════════════════════════════════════

async fn fetch_cards_for_deck(
    pool: &sqlx::SqlitePool,
    deck_id: &str,
) -> Result<Vec<RecallCardRow>, String> {
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,deck_id,context,cue,anchor,created_at,due_at,reviewed_at,
                interval_days,ease,streak,mastery,pinned,archived,source
         FROM flashcard_cards WHERE deck_id = ? ORDER BY created_at DESC",
    )
    .bind(deck_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| RecallCardRow {
            id: r.try_get("id").unwrap_or_default(),
            deck_id: r.try_get("deck_id").unwrap_or_default(),
            context: r.try_get("context").unwrap_or_default(),
            cue: r.try_get("cue").unwrap_or_default(),
            anchor: r.try_get("anchor").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
            due_at: r.try_get("due_at").unwrap_or(0),
            reviewed_at: r.try_get("reviewed_at").unwrap_or(None),
            interval_days: r.try_get("interval_days").unwrap_or(1),
            ease: r.try_get("ease").unwrap_or(2.0),
            streak: r.try_get("streak").unwrap_or(0),
            mastery: r.try_get("mastery").unwrap_or(0),
            pinned: r.try_get::<i64, _>("pinned").unwrap_or(0) == 1,
            archived: r.try_get::<i64, _>("archived").unwrap_or(0) == 1,
            source: r.try_get("source").unwrap_or_default(),
        })
        .collect())
}

async fn fetch_deck_row(
    pool: &sqlx::SqlitePool,
    deck_id: &str,
) -> Result<Option<RecallDeckRow>, String> {
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT id,title,context,note,created_at,archived
         FROM flashcard_decks WHERE id = ?",
    )
    .bind(deck_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(row) = row else { return Ok(None) };

    let id: String = row.try_get("id").unwrap_or_default();
    let cards = fetch_cards_for_deck(pool, &id).await?;

    Ok(Some(RecallDeckRow {
        id,
        title: row.try_get("title").unwrap_or_default(),
        context: row.try_get("context").unwrap_or_default(),
        note: row.try_get("note").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or(0),
        archived: row.try_get::<i64, _>("archived").unwrap_or(0) == 1,
        cards,
    }))
}

// ═══ LIST ALL DECKS ═══════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_list(
    state: State<'_, BentoAppState>,
) -> Result<Vec<RecallDeckRow>, String> {
    ensure_flashcards_tables(&state.db()).await?;
    use sqlx::Row;

    let rows = sqlx::query(
        "SELECT id,title,context,note,created_at,archived
         FROM flashcard_decks ORDER BY created_at DESC",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let cards = fetch_cards_for_deck(&state.db(), &id).await?;
        result.push(RecallDeckRow {
            id,
            title: row.try_get("title").unwrap_or_default(),
            context: row.try_get("context").unwrap_or_default(),
            note: row.try_get("note").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or(0),
            archived: row.try_get::<i64, _>("archived").unwrap_or(0) == 1,
            cards,
        });
    }
    Ok(result)
}

// ═══ CREATE DECK ══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_deck_create(
    state: State<'_, BentoAppState>,
    payload: NewDeckPayload,
) -> Result<RecallDeckRow, String> {
    ensure_flashcards_tables(&state.db()).await?;
    if payload.title.trim().is_empty() {
        return Err("Deck title is required.".into());
    }
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO flashcard_decks (id,title,context,note,created_at,archived)
         VALUES (?,?,?,?,?,0)",
    )
    .bind(&id)
    .bind(payload.title.trim())
    .bind(&payload.context)
    .bind(&payload.note)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(RecallDeckRow {
        id,
        title: payload.title,
        context: payload.context,
        note: payload.note,
        created_at: now,
        archived: false,
        cards: vec![],
    })
}

// ═══ DELETE DECK ══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_deck_delete(
    state: State<'_, BentoAppState>,
    deck_id: String,
) -> Result<(), String> {
    ensure_flashcards_tables(&state.db()).await?;
    sqlx::query("DELETE FROM flashcard_cards WHERE deck_id = ?")
        .bind(&deck_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM flashcard_decks WHERE id = ?")
        .bind(&deck_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ CREATE CARD ══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_card_create(
    state: State<'_, BentoAppState>,
    payload: NewCardPayload,
) -> Result<RecallCardRow, String> {
    ensure_flashcards_tables(&state.db()).await?;
    if payload.cue.trim().is_empty() || payload.anchor.trim().is_empty() {
        return Err("Cue and anchor are required.".into());
    }

    // Verify deck exists
    let deck_exists = sqlx::query("SELECT id FROM flashcard_decks WHERE id = ?")
        .bind(&payload.deck_id)
        .fetch_optional(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if deck_exists.is_none() {
        return Err("Deck not found.".into());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO flashcard_cards
         (id,deck_id,context,cue,anchor,created_at,due_at,reviewed_at,
          interval_days,ease,streak,mastery,pinned,archived,source)
         VALUES (?,?,?,?,?,?,?,NULL,1,2.0,0,45,0,0,?)",
    )
    .bind(&id)
    .bind(&payload.deck_id)
    .bind(&payload.context)
    .bind(payload.cue.trim())
    .bind(payload.anchor.trim())
    .bind(now)
    .bind(now) // due_at = now (due immediately)
    .bind("") // source
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(RecallCardRow {
        id,
        deck_id: payload.deck_id,
        context: payload.context,
        cue: payload.cue,
        anchor: payload.anchor,
        created_at: now,
        due_at: now,
        reviewed_at: None,
        interval_days: 1,
        ease: 2.0,
        streak: 0,
        mastery: 45,
        pinned: false,
        archived: false,
        source: String::new(),
    })
}

// ═══ GRADE CARD (SRS update) ═════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_card_grade(
    state: State<'_, BentoAppState>,
    payload: GradeCardPayload,
) -> Result<RecallCardRow, String> {
    ensure_flashcards_tables(&state.db()).await?;

    sqlx::query(
        "UPDATE flashcard_cards
         SET due_at=?, interval_days=?, ease=?, streak=?, mastery=?, reviewed_at=?
         WHERE id=?",
    )
    .bind(payload.due_at)
    .bind(payload.interval_days)
    .bind(payload.ease)
    .bind(payload.streak)
    .bind(payload.mastery)
    .bind(payload.due_at)
    .bind(&payload.card_id)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Fetch updated card
    use sqlx::Row;
    let row = sqlx::query(
        "SELECT id,deck_id,context,cue,anchor,created_at,due_at,reviewed_at,
                interval_days,ease,streak,mastery,pinned,archived,source
         FROM flashcard_cards WHERE id = ?",
    )
    .bind(&payload.card_id)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(RecallCardRow {
        id: row.try_get("id").unwrap_or_default(),
        deck_id: row.try_get("deck_id").unwrap_or_default(),
        context: row.try_get("context").unwrap_or_default(),
        cue: row.try_get("cue").unwrap_or_default(),
        anchor: row.try_get("anchor").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or(0),
        due_at: row.try_get("due_at").unwrap_or(0),
        reviewed_at: row.try_get("reviewed_at").unwrap_or(None),
        interval_days: row.try_get("interval_days").unwrap_or(1),
        ease: row.try_get("ease").unwrap_or(2.0),
        streak: row.try_get("streak").unwrap_or(0),
        mastery: row.try_get("mastery").unwrap_or(0),
        pinned: row.try_get::<i64, _>("pinned").unwrap_or(0) == 1,
        archived: row.try_get::<i64, _>("archived").unwrap_or(0) == 1,
        source: row.try_get("source").unwrap_or_default(),
    })
}

// ═══ TOGGLE PIN ══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_card_toggle_pin(
    state: State<'_, BentoAppState>,
    card_id: String,
) -> Result<RecallCardRow, String> {
    ensure_flashcards_tables(&state.db()).await?;
    use sqlx::Row;

    let cur: i64 = sqlx::query("SELECT pinned FROM flashcard_cards WHERE id=?")
        .bind(&card_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?
        .try_get("pinned")
        .unwrap_or(0);

    let new_val = if cur == 0 { 1i64 } else { 0i64 };
    sqlx::query("UPDATE flashcard_cards SET pinned=? WHERE id=?")
        .bind(new_val)
        .bind(&card_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    let row = sqlx::query(
        "SELECT id,deck_id,context,cue,anchor,created_at,due_at,reviewed_at,
                interval_days,ease,streak,mastery,pinned,archived,source
         FROM flashcard_cards WHERE id=?",
    )
    .bind(&card_id)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(RecallCardRow {
        id: row.try_get("id").unwrap_or_default(),
        deck_id: row.try_get("deck_id").unwrap_or_default(),
        context: row.try_get("context").unwrap_or_default(),
        cue: row.try_get("cue").unwrap_or_default(),
        anchor: row.try_get("anchor").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or(0),
        due_at: row.try_get("due_at").unwrap_or(0),
        reviewed_at: row.try_get("reviewed_at").unwrap_or(None),
        interval_days: row.try_get("interval_days").unwrap_or(1),
        ease: row.try_get("ease").unwrap_or(2.0),
        streak: row.try_get("streak").unwrap_or(0),
        mastery: row.try_get("mastery").unwrap_or(0),
        pinned: row.try_get::<i64, _>("pinned").unwrap_or(0) == 1,
        archived: row.try_get::<i64, _>("archived").unwrap_or(0) == 1,
        source: row.try_get("source").unwrap_or_default(),
    })
}

// ═══ ARCHIVE / RESTORE CARD ══════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_card_archive(
    state: State<'_, BentoAppState>,
    card_id: String,
) -> Result<(), String> {
    ensure_flashcards_tables(&state.db()).await?;
    sqlx::query("UPDATE flashcard_cards SET archived=1 WHERE id=?")
        .bind(&card_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn flashcards_card_restore(
    state: State<'_, BentoAppState>,
    card_id: String,
) -> Result<(), String> {
    ensure_flashcards_tables(&state.db()).await?;
    sqlx::query("UPDATE flashcard_cards SET archived=0 WHERE id=?")
        .bind(&card_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ SEARCH ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_search(
    state: State<'_, BentoAppState>,
    query: String,
) -> Result<Vec<RecallDeckRow>, String> {
    ensure_flashcards_tables(&state.db()).await?;
    use sqlx::Row;

    let pattern = format!("%{}%", query);
    let rows = sqlx::query(
        "SELECT DISTINCT d.id,d.title,d.context,d.note,d.created_at,d.archived
         FROM flashcard_decks d
         LEFT JOIN flashcard_cards c ON c.deck_id = d.id
         WHERE d.title LIKE ?
            OR d.note LIKE ?
            OR c.cue LIKE ?
            OR c.anchor LIKE ?
         ORDER BY d.created_at DESC",
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let cards = fetch_cards_for_deck(&state.db(), &id).await?;
        result.push(RecallDeckRow {
            id,
            title: row.try_get("title").unwrap_or_default(),
            context: row.try_get("context").unwrap_or_default(),
            note: row.try_get("note").unwrap_or_default(),
            created_at: row.try_get("created_at").unwrap_or(0),
            archived: row.try_get::<i64, _>("archived").unwrap_or(0) == 1,
            cards,
        });
    }
    Ok(result)
}

// ═══ REVIEW QUEUE ═════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn flashcards_review_queue(
    state: State<'_, BentoAppState>,
    deck_id: Option<String>,
) -> Result<Vec<RecallCardRow>, String> {
    ensure_flashcards_tables(&state.db()).await?;
    use sqlx::Row;

    let now = time::now_ms();
    let rows = if let Some(did) = deck_id {
        sqlx::query(
            "SELECT id,deck_id,context,cue,anchor,created_at,due_at,reviewed_at,
                    interval_days,ease,streak,mastery,pinned,archived,source
             FROM flashcard_cards
             WHERE deck_id = ? AND archived = 0 AND due_at <= ?
             ORDER BY pinned DESC, due_at ASC, mastery DESC",
        )
        .bind(&did)
        .bind(now)
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query(
            "SELECT id,deck_id,context,cue,anchor,created_at,due_at,reviewed_at,
                    interval_days,ease,streak,mastery,pinned,archived,source
             FROM flashcard_cards
             WHERE archived = 0 AND due_at <= ?
             ORDER BY pinned DESC, due_at ASC, mastery DESC",
        )
        .bind(now)
        .fetch_all(&state.db())
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(rows
        .into_iter()
        .map(|r| RecallCardRow {
            id: r.try_get("id").unwrap_or_default(),
            deck_id: r.try_get("deck_id").unwrap_or_default(),
            context: r.try_get("context").unwrap_or_default(),
            cue: r.try_get("cue").unwrap_or_default(),
            anchor: r.try_get("anchor").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
            due_at: r.try_get("due_at").unwrap_or(0),
            reviewed_at: r.try_get("reviewed_at").unwrap_or(None),
            interval_days: r.try_get("interval_days").unwrap_or(1),
            ease: r.try_get("ease").unwrap_or(2.0),
            streak: r.try_get("streak").unwrap_or(0),
            mastery: r.try_get("mastery").unwrap_or(0),
            pinned: r.try_get::<i64, _>("pinned").unwrap_or(0) == 1,
            archived: r.try_get::<i64, _>("archived").unwrap_or(0) == 1,
            source: r.try_get("source").unwrap_or_default(),
        })
        .collect())
}