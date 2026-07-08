// ─────────────────────────────────────────────────────────────────────────────
// Recipes Tauri Commands — SQLite-backed
// Tables: recipes, recipe_ingredients, recipe_steps, recipe_collections,
//         pantry_items, shopping_items, meal_plan, diet_profile, cook_history
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::search::{SearchDocument, SearchService};
use crate::util::time;

fn today_key() -> String {
    time::date_key(time::now_ms())
}

fn current_week_key() -> String {
    let now = chrono::Utc::now();
    format!("{}-W{:02}", now.format("%Y"), now.format("%V"))
}

fn json_vec(s: String) -> Vec<String> {
    serde_json::from_str(&s).unwrap_or_default()
}

fn recipe_search_document(recipe: &RecipeRow) -> SearchDocument {
    let mut body_parts = vec![
        recipe.title.clone(),
        recipe.time_label.clone(),
        recipe.meal.clone(),
        recipe.difficulty.clone(),
        recipe.notes.clone(),
        recipe
            .ingredients
            .iter()
            .map(|item| format!("{} {}", item.name, item.amount))
            .collect::<Vec<_>>()
            .join(" "),
        recipe
            .steps
            .iter()
            .map(|step| step.instruction.clone())
            .collect::<Vec<_>>()
            .join(" "),
    ];

    body_parts.retain(|part| !part.trim().is_empty());

    SearchDocument {
        module_id: "recipes".to_string(),
        id: recipe.id.clone(),
        title: recipe.title.clone(),
        body: body_parts.join("\n"),
        tags: recipe
            .tags
            .iter()
            .chain(recipe.diet_tags.iter())
            .chain(recipe.allergens.iter())
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty())
            .collect(),
        projects: recipe
            .collection_ids
            .iter()
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty())
            .collect(),
        kind: Some(recipe.meal.clone()),
        created_at: Some(recipe.created_at),
        updated_at: Some(recipe.updated_at),
        source_ref: Some(recipe.id.clone()),
        extra: serde_json::json!({
            "favorite": recipe.favorite,
            "rating": recipe.rating,
            "cookedCount": recipe.cooked_count,
            "servings": recipe.servings,
            "calories": recipe.calories,
            "protein": recipe.protein,
            "carbs": recipe.carbs,
            "fat": recipe.fat
        }),
    }
}

async fn fetch_recipe_row(
    pool: &sqlx::SqlitePool,
    recipe_id: &str,
) -> Result<Option<RecipeRow>, String> {
    use sqlx::Row;

    let row = sqlx::query(
        "SELECT id,title,time_label,cook_time_min,servings,calories,protein,carbs,fat,
                image_url,favorite,meal,difficulty,tags,diet_tags,allergens,rating,
                cooked_count,last_cooked,collection_ids,notes,created_at,updated_at
         FROM recipes WHERE id = ?",
    )
    .bind(recipe_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return Ok(None);
    };

    let ingredients = fetch_ingredients(pool, recipe_id).await?;
    let steps = fetch_steps(pool, recipe_id).await?;

    Ok(Some(RecipeRow {
        id: row.try_get("id").unwrap_or_default(),
        title: row.try_get("title").unwrap_or_default(),
        time_label: row.try_get("time_label").unwrap_or_default(),
        cook_time_min: row.try_get("cook_time_min").unwrap_or(0),
        servings: row.try_get("servings").unwrap_or(2),
        calories: row.try_get("calories").unwrap_or(0),
        protein: row.try_get("protein").unwrap_or(0),
        carbs: row.try_get("carbs").unwrap_or(0),
        fat: row.try_get("fat").unwrap_or(0),
        image_url: row.try_get("image_url").unwrap_or_default(),
        favorite: row.try_get::<i64, _>("favorite").unwrap_or(0) == 1,
        meal: row.try_get("meal").unwrap_or_default(),
        difficulty: row.try_get("difficulty").unwrap_or_default(),
        tags: json_vec(row.try_get("tags").unwrap_or_else(|_| "[]".into())),
        diet_tags: json_vec(row.try_get("diet_tags").unwrap_or_else(|_| "[]".into())),
        allergens: json_vec(row.try_get("allergens").unwrap_or_else(|_| "[]".into())),
        rating: row.try_get("rating").unwrap_or(0),
        cooked_count: row.try_get("cooked_count").unwrap_or(0),
        last_cooked: row.try_get("last_cooked").unwrap_or(None),
        collection_ids: json_vec(
            row.try_get("collection_ids")
                .unwrap_or_else(|_| "[]".into()),
        ),
        notes: row.try_get("notes").unwrap_or_default(),
        ingredients,
        steps,
        created_at: row.try_get("created_at").unwrap_or(0),
        updated_at: row.try_get("updated_at").unwrap_or(0),
    }))
}

async fn fetch_ingredients(
    pool: &sqlx::SqlitePool,
    recipe_id: &str,
) -> Result<Vec<IngredientRow>, String> {
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, recipe_id, name, amount, amount_imperial, substitutes, checked, position
         FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position",
    )
    .bind(recipe_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| IngredientRow {
            id: r.try_get("id").unwrap_or_default(),
            recipe_id: r.try_get("recipe_id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            amount: r.try_get("amount").unwrap_or_default(),
            amount_imperial: r.try_get("amount_imperial").unwrap_or(None),
            substitutes: json_vec(r.try_get("substitutes").unwrap_or_else(|_| "[]".into())),
            checked: r.try_get::<i64, _>("checked").unwrap_or(0) == 1,
            position: r.try_get("position").unwrap_or(0),
        })
        .collect())
}

async fn fetch_steps(pool: &sqlx::SqlitePool, recipe_id: &str) -> Result<Vec<StepRow>, String> {
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, recipe_id, step_order, instruction, duration_min, video_url
         FROM recipe_steps WHERE recipe_id = ? ORDER BY step_order",
    )
    .bind(recipe_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| StepRow {
            id: r.try_get("id").unwrap_or_default(),
            recipe_id: r.try_get("recipe_id").unwrap_or_default(),
            step_order: r.try_get("step_order").unwrap_or(0),
            instruction: r.try_get("instruction").unwrap_or_default(),
            duration_min: r.try_get("duration_min").unwrap_or(None),
            video_url: r.try_get("video_url").unwrap_or(None),
            completed: false,
        })
        .collect())
}

// ═══ TYPES ═══════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngredientRow {
    pub id: String,
    pub recipe_id: String,
    pub name: String,
    pub amount: String,
    pub amount_imperial: Option<String>,
    pub substitutes: Vec<String>,
    pub checked: bool,
    pub position: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepRow {
    pub id: String,
    pub recipe_id: String,
    pub step_order: i64,
    pub instruction: String,
    pub duration_min: Option<i64>,
    pub video_url: Option<String>,
    pub completed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeRow {
    pub id: String,
    pub title: String,
    pub time_label: String,
    pub cook_time_min: i64,
    pub servings: i64,
    pub calories: i64,
    pub protein: i64,
    pub carbs: i64,
    pub fat: i64,
    pub image_url: String,
    pub favorite: bool,
    pub meal: String,
    pub difficulty: String,
    pub tags: Vec<String>,
    pub diet_tags: Vec<String>,
    pub allergens: Vec<String>,
    pub rating: i64,
    pub cooked_count: i64,
    pub last_cooked: Option<String>,
    pub collection_ids: Vec<String>,
    pub notes: String,
    pub ingredients: Vec<IngredientRow>,
    pub steps: Vec<StepRow>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewIngredient {
    pub name: String,
    pub amount: String,
    pub amount_imperial: Option<String>,
    pub substitutes: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewStep {
    pub instruction: String,
    pub duration_min: Option<i64>,
    pub video_url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRecipePayload {
    pub title: String,
    pub time_label: String,
    pub cook_time_min: i64,
    pub servings: i64,
    pub calories: i64,
    pub protein: i64,
    pub carbs: i64,
    pub fat: i64,
    pub image_url: String,
    pub meal: String,
    pub difficulty: String,
    pub tags: Vec<String>,
    pub diet_tags: Vec<String>,
    pub allergens: Vec<String>,
    pub notes: String,
    pub ingredients: Vec<NewIngredient>,
    pub steps: Vec<NewStep>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRow {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub color: String,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PantryItemRow {
    pub id: String,
    pub name: String,
    pub category: String,
    pub in_stock: bool,
    pub low_stock: bool,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShoppingItemRow {
    pub id: String,
    pub name: String,
    pub amount: String,
    pub category: String,
    pub checked: bool,
    pub from_recipe: String,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MealPlanRow {
    pub id: String,
    pub day_index: i64,
    pub meal_type: String,
    pub recipe_id: Option<String>,
    pub recipe_label: String,
    pub week_key: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DietProfileRow {
    pub diets: Vec<String>,
    pub allergens: Vec<String>,
    pub unit: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CookHistoryRow {
    pub id: String,
    pub recipe_id: String,
    pub recipe_title: String,
    pub cooked_at: i64,
    pub date_key: String,
}

// ═══ TABLE BOOTSTRAP ══════════════════════════════════════════════════════════

pub async fn ensure_recipes_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let ddl = [
        r#"CREATE TABLE IF NOT EXISTS recipes (
            id            TEXT    PRIMARY KEY,
            title         TEXT    NOT NULL,
            time_label    TEXT    NOT NULL DEFAULT '',
            cook_time_min INTEGER NOT NULL DEFAULT 0,
            servings      INTEGER NOT NULL DEFAULT 2,
            calories      INTEGER NOT NULL DEFAULT 0,
            protein       INTEGER NOT NULL DEFAULT 0,
            carbs         INTEGER NOT NULL DEFAULT 0,
            fat           INTEGER NOT NULL DEFAULT 0,
            image_url     TEXT    NOT NULL DEFAULT '',
            favorite      INTEGER NOT NULL DEFAULT 0,
            meal          TEXT    NOT NULL DEFAULT '',
            difficulty    TEXT    NOT NULL DEFAULT 'Easy',
            tags          TEXT    NOT NULL DEFAULT '[]',
            diet_tags     TEXT    NOT NULL DEFAULT '[]',
            allergens     TEXT    NOT NULL DEFAULT '[]',
            rating        INTEGER NOT NULL DEFAULT 0,
            cooked_count  INTEGER NOT NULL DEFAULT 0,
            last_cooked   TEXT,
            collection_ids TEXT   NOT NULL DEFAULT '[]',
            notes         TEXT    NOT NULL DEFAULT '',
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id              TEXT    PRIMARY KEY,
            recipe_id       TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            name            TEXT    NOT NULL,
            amount          TEXT    NOT NULL DEFAULT '',
            amount_imperial TEXT,
            substitutes     TEXT    NOT NULL DEFAULT '[]',
            checked         INTEGER NOT NULL DEFAULT 0,
            position        INTEGER NOT NULL DEFAULT 0
        )"#,
        r#"CREATE TABLE IF NOT EXISTS recipe_steps (
            id           TEXT    PRIMARY KEY,
            recipe_id    TEXT    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            step_order   INTEGER NOT NULL DEFAULT 0,
            instruction  TEXT    NOT NULL,
            duration_min INTEGER,
            video_url    TEXT
        )"#,
        r#"CREATE TABLE IF NOT EXISTS recipe_collections (
            id         TEXT    PRIMARY KEY,
            name       TEXT    NOT NULL,
            emoji      TEXT    NOT NULL DEFAULT '📁',
            color      TEXT    NOT NULL DEFAULT 'var(--primary)',
            created_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS pantry_items (
            id         TEXT    PRIMARY KEY,
            name       TEXT    NOT NULL UNIQUE,
            category   TEXT    NOT NULL DEFAULT 'Pantry',
            in_stock   INTEGER NOT NULL DEFAULT 1,
            low_stock  INTEGER NOT NULL DEFAULT 0,
            updated_at INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS shopping_items (
            id          TEXT    PRIMARY KEY,
            name        TEXT    NOT NULL UNIQUE,
            amount      TEXT    NOT NULL DEFAULT '',
            category    TEXT    NOT NULL DEFAULT 'Pantry',
            checked     INTEGER NOT NULL DEFAULT 0,
            from_recipe TEXT    NOT NULL DEFAULT '',
            created_at  INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS meal_plan (
            id           TEXT    PRIMARY KEY,
            day_index    INTEGER NOT NULL,
            meal_type    TEXT    NOT NULL,
            recipe_id    TEXT,
            recipe_label TEXT    NOT NULL DEFAULT '',
            week_key     TEXT    NOT NULL,
            UNIQUE(day_index, meal_type, week_key)
        )"#,
        r#"CREATE TABLE IF NOT EXISTS diet_profile (
            id             TEXT    PRIMARY KEY,
            diets_json     TEXT    NOT NULL DEFAULT '[]',
            allergens_json TEXT    NOT NULL DEFAULT '[]',
            unit           TEXT    NOT NULL DEFAULT 'metric',
            created_at     INTEGER NOT NULL,
            updated_at     INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS cook_history (
            id           TEXT    PRIMARY KEY,
            recipe_id    TEXT    NOT NULL DEFAULT '',
            recipe_title TEXT    NOT NULL,
            cooked_at    INTEGER NOT NULL,
            date_key     TEXT    NOT NULL
        )"#,
    ];
    for sql in ddl {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ═══ RECIPES CRUD ════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn recipes_list(auth: State<'_, crate::auth::AuthManager>, state: State<'_, BentoAppState>) -> Result<Vec<RecipeRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,title,time_label,cook_time_min,servings,calories,protein,carbs,fat,
                image_url,favorite,meal,difficulty,tags,diet_tags,allergens,rating,
                cooked_count,last_cooked,collection_ids,notes,created_at,updated_at
         FROM recipes ORDER BY updated_at DESC",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        let id: String = row.try_get("id").unwrap_or_default();
        let ingredients = fetch_ingredients(&state.db(), &id).await?;
        let steps = fetch_steps(&state.db(), &id).await?;
        result.push(RecipeRow {
            id: id.clone(),
            title: row.try_get("title").unwrap_or_default(),
            time_label: row.try_get("time_label").unwrap_or_default(),
            cook_time_min: row.try_get("cook_time_min").unwrap_or(0),
            servings: row.try_get("servings").unwrap_or(2),
            calories: row.try_get("calories").unwrap_or(0),
            protein: row.try_get("protein").unwrap_or(0),
            carbs: row.try_get("carbs").unwrap_or(0),
            fat: row.try_get("fat").unwrap_or(0),
            image_url: row.try_get("image_url").unwrap_or_default(),
            favorite: row.try_get::<i64, _>("favorite").unwrap_or(0) == 1,
            meal: row.try_get("meal").unwrap_or_default(),
            difficulty: row.try_get("difficulty").unwrap_or_default(),
            tags: json_vec(row.try_get("tags").unwrap_or_else(|_| "[]".into())),
            diet_tags: json_vec(row.try_get("diet_tags").unwrap_or_else(|_| "[]".into())),
            allergens: json_vec(row.try_get("allergens").unwrap_or_else(|_| "[]".into())),
            rating: row.try_get("rating").unwrap_or(0),
            cooked_count: row.try_get("cooked_count").unwrap_or(0),
            last_cooked: row.try_get("last_cooked").unwrap_or(None),
            collection_ids: json_vec(
                row.try_get("collection_ids")
                    .unwrap_or_else(|_| "[]".into()),
            ),
            notes: row.try_get("notes").unwrap_or_default(),
            ingredients,
            steps,
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        });
    }
    Ok(result)
}

/// Internal save function — callable from both the Tauri command and meal_db import.
pub async fn recipe_save_internal(
    pool: &sqlx::SqlitePool,
    search: &SearchService,
    payload: NewRecipePayload,
) -> Result<RecipeRow, String> {
    ensure_recipes_tables(pool).await?;
    if payload.title.trim().is_empty() {
        return Err("Recipe title is required.".into());
    }
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        r#"INSERT INTO recipes
           (id,title,time_label,cook_time_min,servings,calories,protein,carbs,fat,
            image_url,favorite,meal,difficulty,tags,diet_tags,allergens,rating,
            cooked_count,last_cooked,collection_ids,notes,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,0,0,NULL,'[]',?,?,?)"#,
    )
    .bind(&id)
    .bind(&payload.title)
    .bind(&payload.time_label)
    .bind(payload.cook_time_min)
    .bind(payload.servings)
    .bind(payload.calories)
    .bind(payload.protein)
    .bind(payload.carbs)
    .bind(payload.fat)
    .bind(&payload.image_url)
    .bind(&payload.meal)
    .bind(&payload.difficulty)
    .bind(serde_json::to_string(&payload.tags).unwrap_or_else(|_| "[]".into()))
    .bind(serde_json::to_string(&payload.diet_tags).unwrap_or_else(|_| "[]".into()))
    .bind(serde_json::to_string(&payload.allergens).unwrap_or_else(|_| "[]".into()))
    .bind(&payload.notes)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    for (i, ing) in payload.ingredients.iter().enumerate() {
        let iid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO recipe_ingredients
             (id,recipe_id,name,amount,amount_imperial,substitutes,checked,position)
             VALUES (?,?,?,?,?,?,0,?)",
        )
        .bind(&iid)
        .bind(&id)
        .bind(&ing.name)
        .bind(&ing.amount)
        .bind(&ing.amount_imperial)
        .bind(serde_json::to_string(&ing.substitutes).unwrap_or_else(|_| "[]".into()))
        .bind(i as i64)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    for (i, step) in payload.steps.iter().enumerate() {
        let sid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO recipe_steps
             (id,recipe_id,step_order,instruction,duration_min,video_url)
             VALUES (?,?,?,?,?,?)",
        )
        .bind(&sid)
        .bind(&id)
        .bind(i as i64)
        .bind(&step.instruction)
        .bind(step.duration_min)
        .bind(&step.video_url)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    let ingredients = fetch_ingredients(pool, &id).await?;
    let steps = fetch_steps(pool, &id).await?;
    let recipe = RecipeRow {
        id,
        title: payload.title,
        time_label: payload.time_label,
        cook_time_min: payload.cook_time_min,
        servings: payload.servings,
        calories: payload.calories,
        protein: payload.protein,
        carbs: payload.carbs,
        fat: payload.fat,
        image_url: payload.image_url,
        favorite: false,
        meal: payload.meal,
        difficulty: payload.difficulty,
        tags: payload.tags,
        diet_tags: payload.diet_tags,
        allergens: payload.allergens,
        rating: 0,
        cooked_count: 0,
        last_cooked: None,
        collection_ids: vec![],
        notes: payload.notes,
        ingredients,
        steps,
        created_at: now,
        updated_at: now,
    };

    if let Err(error) = search.index_content(recipe_search_document(&recipe)).await {
        eprintln!("recipes search index update failed: {error}");
    }

    Ok(recipe)
}

#[tauri::command]
pub async fn recipe_save(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    payload: NewRecipePayload,
) -> Result<RecipeRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    recipe_save_internal(&state.db(), &search, payload).await
}

#[tauri::command]
pub async fn recipe_delete(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    recipe_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    sqlx::query("DELETE FROM recipes WHERE id = ?")
        .bind(&recipe_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if let Err(error) = search
        .delete_from_index("recipes".to_string(), recipe_id)
        .await
    {
        eprintln!("recipes search delete failed: {error}");
    }
    Ok(())
}

#[tauri::command]
pub async fn recipe_toggle_favorite(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    recipe_id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT favorite FROM recipes WHERE id = ?")
        .bind(&recipe_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let cur: i64 = row.try_get("favorite").unwrap_or(0);
    let new_val = if cur == 0 { 1i64 } else { 0i64 };
    sqlx::query("UPDATE recipes SET favorite=?,updated_at=? WHERE id=?")
        .bind(new_val)
        .bind(time::now_ms())
        .bind(&recipe_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(new_val == 1)
}

#[tauri::command]
pub async fn recipe_rate(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    recipe_id: String,
    rating: i64,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    sqlx::query("UPDATE recipes SET rating=?,updated_at=? WHERE id=?")
        .bind(rating)
        .bind(time::now_ms())
        .bind(&recipe_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn recipe_add_to_collection(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    search: State<'_, SearchService>,
    recipe_id: String,
    collection_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT collection_ids FROM recipes WHERE id=?")
        .bind(&recipe_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let raw: String = row
        .try_get("collection_ids")
        .unwrap_or_else(|_| "[]".into());
    let mut ids: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
    if !ids.contains(&collection_id) {
        ids.push(collection_id);
    }
    sqlx::query("UPDATE recipes SET collection_ids=?,updated_at=? WHERE id=?")
        .bind(serde_json::to_string(&ids).unwrap_or_else(|_| "[]".into()))
        .bind(time::now_ms())
        .bind(&recipe_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    if let Some(recipe) = fetch_recipe_row(&state.db(), &recipe_id).await? {
        if let Err(error) = search.index_content(recipe_search_document(&recipe)).await {
            eprintln!("recipe search index update failed: {error}");
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn recipe_toggle_ingredient(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    ingredient_id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT checked FROM recipe_ingredients WHERE id=?")
        .bind(&ingredient_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let cur: i64 = row.try_get("checked").unwrap_or(0);
    let new_val = if cur == 0 { 1i64 } else { 0i64 };
    sqlx::query("UPDATE recipe_ingredients SET checked=? WHERE id=?")
        .bind(new_val)
        .bind(&ingredient_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(new_val == 1)
}

// ═══ COLLECTIONS ══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn collections_list(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
) -> Result<Vec<CollectionRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,name,emoji,color,created_at FROM recipe_collections ORDER BY created_at",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| CollectionRow {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            emoji: r.try_get("emoji").unwrap_or_else(|_| "📁".into()),
            color: r.try_get("color").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn collection_create(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    name: String,
    emoji: String,
) -> Result<CollectionRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    if name.trim().is_empty() {
        return Err("Collection name required.".into());
    }
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    sqlx::query(
        "INSERT INTO recipe_collections (id,name,emoji,color,created_at) VALUES (?,?,?,'var(--primary)',?)",
    )
    .bind(&id).bind(name.trim()).bind(emoji.trim()).bind(now)
    .execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(CollectionRow {
        id,
        name,
        emoji,
        color: "var(--primary)".into(),
        created_at: now,
    })
}

#[tauri::command]
pub async fn collection_delete(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    collection_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    sqlx::query("DELETE FROM recipe_collections WHERE id=?")
        .bind(&collection_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ PANTRY ═══════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn pantry_list(auth: State<'_, crate::auth::AuthManager>, state: State<'_, BentoAppState>) -> Result<Vec<PantryItemRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,name,category,in_stock,low_stock,updated_at FROM pantry_items ORDER BY category,name",
    )
    .fetch_all(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| PantryItemRow {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            category: r.try_get("category").unwrap_or_default(),
            in_stock: r.try_get::<i64, _>("in_stock").unwrap_or(1) == 1,
            low_stock: r.try_get::<i64, _>("low_stock").unwrap_or(0) == 1,
            updated_at: r.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn pantry_upsert(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    name: String,
    category: String,
    in_stock: bool,
    low_stock: bool,
) -> Result<PantryItemRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let now = time::now_ms();
    use sqlx::Row;
    let existing = sqlx::query("SELECT id FROM pantry_items WHERE name=? COLLATE NOCASE")
        .bind(&name)
        .fetch_optional(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let id = if let Some(row) = existing {
        let eid: String = row
            .try_get("id")
            .unwrap_or_else(|_| Uuid::new_v4().to_string());
        sqlx::query(
            "UPDATE pantry_items SET in_stock=?,low_stock=?,category=?,updated_at=? WHERE id=?",
        )
        .bind(in_stock as i64)
        .bind(low_stock as i64)
        .bind(&category)
        .bind(now)
        .bind(&eid)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
        eid
    } else {
        let nid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO pantry_items (id,name,category,in_stock,low_stock,updated_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(&nid).bind(&name).bind(&category).bind(in_stock as i64).bind(low_stock as i64).bind(now)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
        nid
    };
    Ok(PantryItemRow {
        id,
        name,
        category,
        in_stock,
        low_stock,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn pantry_toggle(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    item_id: String,
) -> Result<PantryItemRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT * FROM pantry_items WHERE id=?")
        .bind(&item_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let cur: i64 = row.try_get("in_stock").unwrap_or(1);
    let new_val = if cur == 1 { 0i64 } else { 1i64 };
    let now = time::now_ms();
    sqlx::query("UPDATE pantry_items SET in_stock=?,low_stock=0,updated_at=? WHERE id=?")
        .bind(new_val)
        .bind(now)
        .bind(&item_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(PantryItemRow {
        id: item_id,
        name: row.try_get("name").unwrap_or_default(),
        category: row.try_get("category").unwrap_or_default(),
        in_stock: new_val == 1,
        low_stock: false,
        updated_at: now,
    })
}

// ═══ SHOPPING LIST ════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn shopping_list(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
) -> Result<Vec<ShoppingItemRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,name,amount,category,checked,from_recipe,created_at
         FROM shopping_items ORDER BY category,name",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| ShoppingItemRow {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            amount: r.try_get("amount").unwrap_or_default(),
            category: r.try_get("category").unwrap_or_default(),
            checked: r.try_get::<i64, _>("checked").unwrap_or(0) == 1,
            from_recipe: r.try_get("from_recipe").unwrap_or_default(),
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn shopping_add(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    name: String,
    amount: String,
    category: String,
    from_recipe: String,
) -> Result<ShoppingItemRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    sqlx::query(
        "INSERT OR IGNORE INTO shopping_items (id,name,amount,category,checked,from_recipe,created_at)
         VALUES (?,?,?,?,0,?,?)",
    )
    .bind(&id).bind(&name).bind(&amount).bind(&category).bind(&from_recipe).bind(now)
    .execute(&state.db()).await.map_err(|e| e.to_string())?;
    Ok(ShoppingItemRow {
        id,
        name,
        amount,
        category,
        checked: false,
        from_recipe,
        created_at: now,
    })
}

#[tauri::command]
pub async fn shopping_toggle(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    item_id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT checked FROM shopping_items WHERE id=?")
        .bind(&item_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let cur: i64 = row.try_get("checked").unwrap_or(0);
    let new_val = if cur == 0 { 1i64 } else { 0i64 };
    sqlx::query("UPDATE shopping_items SET checked=? WHERE id=?")
        .bind(new_val)
        .bind(&item_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(new_val == 1)
}

#[tauri::command]
pub async fn shopping_delete(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    item_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    sqlx::query("DELETE FROM shopping_items WHERE id=?")
        .bind(&item_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn shopping_clear_checked(auth: State<'_, crate::auth::AuthManager>, state: State<'_, BentoAppState>) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    sqlx::query("DELETE FROM shopping_items WHERE checked=1")
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn shopping_add_from_recipe(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    recipe_id: String,
) -> Result<Vec<ShoppingItemRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let title_row = sqlx::query("SELECT title FROM recipes WHERE id=?")
        .bind(&recipe_id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    let title: String = title_row.try_get("title").unwrap_or_default();
    let ings = fetch_ingredients(&state.db(), &recipe_id).await?;
    let mut added = Vec::new();
    for ing in ings {
        let exists = sqlx::query("SELECT id FROM shopping_items WHERE name=? COLLATE NOCASE")
            .bind(&ing.name)
            .fetch_optional(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        if exists.is_none() {
            let id = Uuid::new_v4().to_string();
            let now = time::now_ms();
            sqlx::query(
                "INSERT INTO shopping_items (id,name,amount,category,checked,from_recipe,created_at)
                 VALUES (?,?,?,'Pantry',0,?,?)",
            )
            .bind(&id).bind(&ing.name).bind(&ing.amount).bind(&title).bind(now)
            .execute(&state.db()).await.map_err(|e| e.to_string())?;
            added.push(ShoppingItemRow {
                id,
                name: ing.name,
                amount: ing.amount,
                category: "Pantry".into(),
                checked: false,
                from_recipe: title.clone(),
                created_at: now,
            });
        }
    }
    Ok(added)
}

// ═══ MEAL PLAN ════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn meal_plan_get(auth: State<'_, crate::auth::AuthManager>, state: State<'_, BentoAppState>) -> Result<Vec<MealPlanRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let week = current_week_key();
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,day_index,meal_type,recipe_id,recipe_label,week_key
         FROM meal_plan WHERE week_key=? ORDER BY day_index,meal_type",
    )
    .bind(&week)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| MealPlanRow {
            id: r.try_get("id").unwrap_or_default(),
            day_index: r.try_get("day_index").unwrap_or(0),
            meal_type: r.try_get("meal_type").unwrap_or_default(),
            recipe_id: r.try_get("recipe_id").unwrap_or(None),
            recipe_label: r.try_get("recipe_label").unwrap_or_default(),
            week_key: r.try_get("week_key").unwrap_or_default(),
        })
        .collect())
}

#[tauri::command]
pub async fn meal_plan_set(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    day_index: i64,
    meal_type: String,
    recipe_id: Option<String>,
    recipe_label: String,
) -> Result<MealPlanRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let week = current_week_key();
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO meal_plan (id,day_index,meal_type,recipe_id,recipe_label,week_key)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(day_index,meal_type,week_key) DO UPDATE SET
             recipe_id=excluded.recipe_id, recipe_label=excluded.recipe_label"#,
    )
    .bind(&id)
    .bind(day_index)
    .bind(&meal_type)
    .bind(&recipe_id)
    .bind(&recipe_label)
    .bind(&week)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(MealPlanRow {
        id,
        day_index,
        meal_type,
        recipe_id,
        recipe_label,
        week_key: week,
    })
}

#[tauri::command]
pub async fn meal_plan_clear_slot(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    day_index: i64,
    meal_type: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let week = current_week_key();
    sqlx::query("DELETE FROM meal_plan WHERE day_index=? AND meal_type=? AND week_key=?")
        .bind(day_index)
        .bind(&meal_type)
        .bind(&week)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ DIET PROFILE ══════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn diet_profile_get(auth: State<'_, crate::auth::AuthManager>, state: State<'_, BentoAppState>) -> Result<DietProfileRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT diets_json,allergens_json,unit FROM diet_profile LIMIT 1")
        .fetch_optional(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if let Some(r) = row {
        Ok(DietProfileRow {
            diets: json_vec(r.try_get("diets_json").unwrap_or_else(|_| "[]".into())),
            allergens: json_vec(r.try_get("allergens_json").unwrap_or_else(|_| "[]".into())),
            unit: r.try_get("unit").unwrap_or_else(|_| "metric".into()),
        })
    } else {
        Ok(DietProfileRow {
            diets: vec![],
            allergens: vec![],
            unit: "metric".into(),
        })
    }
}

#[tauri::command]
pub async fn diet_profile_save(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    diets: Vec<String>,
    allergens: Vec<String>,
    unit: String,
) -> Result<DietProfileRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let now = time::now_ms();
    sqlx::query(
        r#"INSERT INTO diet_profile (id,diets_json,allergens_json,unit,created_at,updated_at)
           VALUES ('singleton',?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             diets_json=excluded.diets_json,
             allergens_json=excluded.allergens_json,
             unit=excluded.unit,
             updated_at=excluded.updated_at"#,
    )
    .bind(serde_json::to_string(&diets).unwrap_or_else(|_| "[]".into()))
    .bind(serde_json::to_string(&allergens).unwrap_or_else(|_| "[]".into()))
    .bind(&unit)
    .bind(now)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(DietProfileRow {
        diets,
        allergens,
        unit,
    })
}

// ═══ COOK HISTORY ═════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn cook_history_list(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
) -> Result<Vec<CookHistoryRow>, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id,recipe_id,recipe_title,cooked_at,date_key
         FROM cook_history ORDER BY cooked_at DESC LIMIT 50",
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|r| CookHistoryRow {
            id: r.try_get("id").unwrap_or_default(),
            recipe_id: r.try_get("recipe_id").unwrap_or_default(),
            recipe_title: r.try_get("recipe_title").unwrap_or_default(),
            cooked_at: r.try_get("cooked_at").unwrap_or(0),
            date_key: r.try_get("date_key").unwrap_or_default(),
        })
        .collect())
}

#[tauri::command]
pub async fn cook_history_add(auth: State<'_, crate::auth::AuthManager>, 
    state: State<'_, BentoAppState>,
    recipe_id: String,
    recipe_title: String,
) -> Result<CookHistoryRow, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let date = today_key();
    sqlx::query(
        "INSERT INTO cook_history (id,recipe_id,recipe_title,cooked_at,date_key) VALUES (?,?,?,?,?)",
    )
    .bind(&id).bind(&recipe_id).bind(&recipe_title).bind(now).bind(&date)
    .execute(&state.db()).await.map_err(|e| e.to_string())?;
    // Bump cooked_count + last_cooked on the recipe
    sqlx::query(
        "UPDATE recipes SET cooked_count=cooked_count+1, last_cooked=?, updated_at=? WHERE id=?",
    )
    .bind(&date)
    .bind(now)
    .bind(&recipe_id)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;
    Ok(CookHistoryRow {
        id,
        recipe_id,
        recipe_title,
        cooked_at: now,
        date_key: date,
    })
}

// ═══ SEED (first-run mock data) ═══════════════════════════════════════════════

#[tauri::command]
pub async fn recipes_seed_if_empty(auth: State<'_, crate::auth::AuthManager>, state: State<'_, BentoAppState>) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "recipes").await?;

    ensure_recipes_tables(&state.db()).await?;
    use sqlx::Row;
    let row = sqlx::query("SELECT COUNT(*) as c FROM recipes")
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    if row.try_get::<i64, _>("c").unwrap_or(0) > 0 {
        return Ok(false);
    }

    let now = time::now_ms();

    // ── Seed collections ──
    let cid0 = Uuid::new_v4().to_string();
    let cid1 = Uuid::new_v4().to_string();
    for (cid, name, emoji) in [
        (cid0.as_str(), "Weeknight Dinners", "🍽️"),
        (cid1.as_str(), "Quick & Healthy", "⚡"),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO recipe_collections (id,name,emoji,color,created_at) VALUES (?,?,?,'var(--primary)',?)",
        )
        .bind(cid).bind(name).bind(emoji).bind(now)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    }

    // ── Seed pantry ──
    for (name, cat, ins, low) in [
        ("Eggs", "Dairy & Eggs", 1i64, 0i64),
        ("Pasta", "Dry Goods", 1, 0),
        ("Olive oil", "Oils", 1, 0),
        ("Garlic", "Produce", 1, 0),
        ("Onion", "Produce", 1, 0),
        ("Canned tomatoes", "Pantry", 1, 0),
        ("Coconut milk", "Pantry", 0, 0),
        ("Chicken thighs", "Meat", 0, 0),
        ("Avocado", "Produce", 1, 1),
        ("Greek yogurt", "Dairy & Eggs", 1, 0),
        ("Frozen berries", "Frozen", 0, 0),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO pantry_items (id,name,category,in_stock,low_stock,updated_at) VALUES (?,?,?,?,?,?)",
        )
        .bind(Uuid::new_v4().to_string()).bind(name).bind(cat).bind(ins).bind(low).bind(now)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    }

    // ── Seed shopping list ──
    for (name, amount, cat, checked, from) in [
        (
            "Chicken thighs",
            "600g",
            "Meat & Fish",
            0i64,
            "Chicken Curry",
        ),
        ("Coconut milk", "400ml", "Pantry", 0, "Chicken Curry"),
        ("Spaghetti", "200g", "Dry Goods", 1, "Pasta Carbonara"),
        ("Pancetta", "100g", "Meat & Fish", 0, "Pasta Carbonara"),
        (
            "Frozen mixed berries",
            "200g",
            "Frozen",
            0,
            "Berry Smoothie",
        ),
        (
            "Pecorino Romano",
            "100g",
            "Dairy & Eggs",
            0,
            "Pasta Carbonara",
        ),
        ("Crushed tomatoes", "400g", "Pantry", 1, "Shakshuka"),
        ("Red bell pepper", "1 large", "Produce", 0, "Shakshuka"),
        ("Romaine lettuce", "1 head", "Produce", 0, "Caesar Salad"),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO shopping_items (id,name,amount,category,checked,from_recipe,created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(Uuid::new_v4().to_string()).bind(name).bind(amount)
        .bind(cat).bind(checked).bind(from).bind(now)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    }

    // ── Seed cook history ──
    for (title, date) in [
        ("Berry Smoothie", "2026-05-22"),
        ("Avocado Toast", "2026-05-21"),
        ("Shakshuka", "2026-05-19"),
        ("Chicken Curry", "2026-05-18"),
        ("Pasta Carbonara", "2026-05-16"),
    ] {
        sqlx::query(
            "INSERT OR IGNORE INTO cook_history (id,recipe_id,recipe_title,cooked_at,date_key) VALUES (?,?,?,?,?)",
        )
        .bind(Uuid::new_v4().to_string()).bind("").bind(title).bind(now).bind(date)
        .execute(&state.db()).await.map_err(|e| e.to_string())?;
    }

    // ── Seed recipes ──
    struct Seed {
        title: &'static str,
        time_label: &'static str,
        cook_time_min: i64,
        servings: i64,
        calories: i64,
        protein: i64,
        carbs: i64,
        fat: i64,
        image_url: &'static str,
        meal: &'static str,
        difficulty: &'static str,
        tags: &'static [&'static str],
        diet_tags: &'static [&'static str],
        allergens: &'static [&'static str],
        notes: &'static str,
        favorite: i64,
        rating: i64,
        cooked_count: i64,
        last_cooked: Option<&'static str>,
        col: &'static str, // "0", "1", "both"
        ingredients: &'static [(
            &'static str,
            &'static str,
            Option<&'static str>,
            &'static [&'static str],
        )],
        steps: &'static [(&'static str, Option<i64>)],
    }

    let seeds: &[Seed] = &[
        Seed {
            title: "Pasta Carbonara",
            time_label: "25 min",
            cook_time_min: 25,
            servings: 2,
            calories: 520,
            protein: 22,
            carbs: 68,
            fat: 18,
            image_url: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600",
            meal: "Dinner",
            difficulty: "Medium",
            tags: &["Italian", "Pasta", "Quick"],
            diet_tags: &[],
            allergens: &["Gluten", "Dairy", "Eggs"],
            notes: "Remove pan from heat before adding eggs or they scramble.",
            favorite: 1,
            rating: 5,
            cooked_count: 7,
            last_cooked: Some("2026-05-20"),
            col: "0",
            ingredients: &[
                ("Spaghetti", "200g", Some("7 oz"), &[]),
                ("Pancetta", "100g", Some("3.5 oz"), &[]),
                (
                    "Eggs",
                    "3 large",
                    Some("3 large"),
                    &["Egg yolks only (richer)"],
                ),
                (
                    "Pecorino Romano",
                    "50g",
                    Some("1.75 oz"),
                    &["Parmesan cheese"],
                ),
                ("Black pepper", "1 tsp", Some("1 tsp"), &[]),
                ("Salt", "to taste", Some("to taste"), &[]),
            ],
            steps: &[
                ("Bring a large pot of salted water to a boil.", None),
                (
                    "Cook spaghetti until al dente, reserve 1 cup pasta water.",
                    Some(10),
                ),
                (
                    "Render pancetta in a pan over medium heat until crispy.",
                    Some(8),
                ),
                (
                    "Whisk eggs, pecorino, and black pepper together in a bowl.",
                    None,
                ),
                (
                    "Remove pan from heat. Toss pasta with pancetta, then fold in egg mixture.",
                    Some(3),
                ),
                (
                    "Serve immediately with extra pecorino and black pepper.",
                    None,
                ),
            ],
        },
        Seed {
            title: "Avocado Toast",
            time_label: "10 min",
            cook_time_min: 10,
            servings: 1,
            calories: 340,
            protein: 9,
            carbs: 32,
            fat: 21,
            image_url: "https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=600",
            meal: "Breakfast",
            difficulty: "Easy",
            tags: &["Healthy", "Quick", "Vegetarian"],
            diet_tags: &["Vegetarian"],
            allergens: &["Gluten", "Dairy"],
            notes: "Add a poached egg on top for extra protein.",
            favorite: 0,
            rating: 4,
            cooked_count: 12,
            last_cooked: Some("2026-05-21"),
            col: "1",
            ingredients: &[
                (
                    "Sourdough bread",
                    "2 slices",
                    Some("2 slices"),
                    &["Whole wheat", "Rye bread"],
                ),
                ("Ripe avocado", "1 large", Some("1 large"), &[]),
                (
                    "Feta cheese",
                    "30g",
                    Some("1 oz"),
                    &["Ricotta", "Goat cheese"],
                ),
                ("Chili flakes", "pinch", Some("pinch"), &[]),
                ("Lemon juice", "1 tsp", Some("1 tsp"), &[]),
            ],
            steps: &[
                ("Toast sourdough until golden and crispy.", Some(3)),
                ("Mash avocado with lemon juice, salt and pepper.", None),
                ("Spread avocado generously on toast.", None),
                ("Top with crumbled feta and chili flakes.", None),
            ],
        },
        Seed {
            title: "Chicken Curry",
            time_label: "45 min",
            cook_time_min: 45,
            servings: 4,
            calories: 480,
            protein: 38,
            carbs: 24,
            fat: 26,
            image_url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600",
            meal: "Dinner",
            difficulty: "Medium",
            tags: &["Indian", "Spicy", "Comfort"],
            diet_tags: &["Gluten-Free"],
            allergens: &[],
            notes: "Leftovers taste even better the next day.",
            favorite: 1,
            rating: 5,
            cooked_count: 5,
            last_cooked: Some("2026-05-18"),
            col: "0",
            ingredients: &[
                ("Chicken thighs", "600g", Some("1.3 lb"), &[]),
                ("Coconut milk", "400ml", Some("13.5 fl oz"), &[]),
                ("Curry paste", "3 tbsp", Some("3 tbsp"), &[]),
                ("Onion", "1 large", Some("1 large"), &[]),
                ("Garlic", "4 cloves", Some("4 cloves"), &[]),
                ("Basmati rice", "300g", Some("1.5 cups"), &[]),
            ],
            steps: &[
                (
                    "Dice onion and sauté in oil over medium heat until golden.",
                    Some(8),
                ),
                (
                    "Add garlic and curry paste. Cook 2 minutes until fragrant.",
                    Some(2),
                ),
                ("Add chicken pieces and brown on all sides.", Some(6)),
                (
                    "Pour in coconut milk. Simmer uncovered until cooked through.",
                    Some(20),
                ),
                ("Serve over steamed basmati rice.", None),
            ],
        },
        Seed {
            title: "Berry Smoothie",
            time_label: "5 min",
            cook_time_min: 5,
            servings: 2,
            calories: 220,
            protein: 6,
            carbs: 42,
            fat: 4,
            image_url: "https://images.unsplash.com/photo-1553530666-ba11a7ddc1a6?w=600",
            meal: "Snack",
            difficulty: "Easy",
            tags: &["Healthy", "No-cook", "Quick"],
            diet_tags: &["Vegetarian", "Gluten-Free"],
            allergens: &["Dairy"],
            notes: "Use frozen fruit for a thicker smoothie.",
            favorite: 0,
            rating: 4,
            cooked_count: 18,
            last_cooked: Some("2026-05-22"),
            col: "1",
            ingredients: &[
                ("Frozen mixed berries", "200g", Some("7 oz"), &[]),
                ("Greek yogurt", "150g", Some("5.3 oz"), &["Coconut yogurt"]),
                ("Banana", "1 medium", Some("1 medium"), &[]),
                ("Honey", "1 tsp", Some("1 tsp"), &[]),
                (
                    "Milk",
                    "100ml",
                    Some("3.4 fl oz"),
                    &["Oat milk", "Almond milk"],
                ),
            ],
            steps: &[
                ("Add all ingredients to a blender.", None),
                ("Blend on high for 45 seconds until smooth.", Some(1)),
                ("Pour into glasses and serve immediately.", None),
            ],
        },
        Seed {
            title: "Shakshuka",
            time_label: "30 min",
            cook_time_min: 30,
            servings: 2,
            calories: 310,
            protein: 18,
            carbs: 22,
            fat: 16,
            image_url: "https://images.unsplash.com/photo-1590412200988-a436970781fa?w=600",
            meal: "Breakfast",
            difficulty: "Easy",
            tags: &["Middle Eastern", "Eggs", "Vegetarian"],
            diet_tags: &["Vegetarian", "Gluten-Free"],
            allergens: &["Eggs", "Dairy"],
            notes: "Don't overcook the eggs — runny yolks are essential.",
            favorite: 1,
            rating: 5,
            cooked_count: 9,
            last_cooked: Some("2026-05-19"),
            col: "both",
            ingredients: &[
                ("Eggs", "4 large", Some("4 large"), &[]),
                ("Crushed tomatoes", "400g tin", Some("14 oz tin"), &[]),
                ("Red bell pepper", "1 large", Some("1 large"), &[]),
                ("Onion", "1 medium", Some("1 medium"), &[]),
                ("Cumin", "1 tsp", Some("1 tsp"), &[]),
                ("Feta cheese", "50g", Some("1.75 oz"), &[]),
            ],
            steps: &[
                ("Sauté diced onion and pepper until softened.", Some(7)),
                (
                    "Add spices and cook 1 minute. Pour in crushed tomatoes.",
                    Some(1),
                ),
                ("Simmer sauce for 10 minutes, season well.", Some(10)),
                ("Make 4 wells and crack an egg into each.", None),
                (
                    "Cover and cook until whites are set but yolks still runny.",
                    Some(8),
                ),
                ("Crumble feta on top and serve with crusty bread.", None),
            ],
        },
        Seed {
            title: "Caesar Salad",
            time_label: "20 min",
            cook_time_min: 20,
            servings: 2,
            calories: 290,
            protein: 14,
            carbs: 18,
            fat: 19,
            image_url: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=600",
            meal: "Lunch",
            difficulty: "Easy",
            tags: &["Salad", "Classic", "Quick"],
            diet_tags: &[],
            allergens: &["Dairy", "Fish", "Gluten"],
            notes: "Chill the bowl beforehand for an extra-crisp salad.",
            favorite: 0,
            rating: 4,
            cooked_count: 6,
            last_cooked: Some("2026-05-17"),
            col: "1",
            ingredients: &[
                ("Romaine lettuce", "1 head", Some("1 head"), &[]),
                ("Parmesan", "40g", Some("1.4 oz"), &[]),
                ("Croutons", "1 cup", Some("1 cup"), &[]),
                ("Caesar dressing", "4 tbsp", Some("4 tbsp"), &[]),
                ("Anchovy fillets", "4 pieces", Some("4 pieces"), &[]),
            ],
            steps: &[
                ("Wash and tear romaine into bite-sized pieces.", None),
                ("Whisk dressing with lemon juice and minced anchovy.", None),
                (
                    "Toss lettuce with dressing, croutons, and shaved parmesan.",
                    None,
                ),
            ],
        },
    ];

    for seed in seeds {
        let rid = Uuid::new_v4().to_string();
        let col_ids_json = match seed.col {
            "0" => serde_json::to_string(&[&cid0]).unwrap_or_else(|_| "[]".into()),
            "1" => serde_json::to_string(&[&cid1]).unwrap_or_else(|_| "[]".into()),
            "both" => serde_json::to_string(&[&cid0, &cid1]).unwrap_or_else(|_| "[]".into()),
            _ => "[]".into(),
        };

        sqlx::query(
            r#"INSERT INTO recipes
               (id,title,time_label,cook_time_min,servings,calories,protein,carbs,fat,
                image_url,favorite,meal,difficulty,tags,diet_tags,allergens,rating,
                cooked_count,last_cooked,collection_ids,notes,created_at,updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"#,
        )
        .bind(&rid)
        .bind(seed.title)
        .bind(seed.time_label)
        .bind(seed.cook_time_min)
        .bind(seed.servings)
        .bind(seed.calories)
        .bind(seed.protein)
        .bind(seed.carbs)
        .bind(seed.fat)
        .bind(seed.image_url)
        .bind(seed.favorite)
        .bind(seed.meal)
        .bind(seed.difficulty)
        .bind(serde_json::to_string(&seed.tags).unwrap_or_else(|_| "[]".into()))
        .bind(serde_json::to_string(&seed.diet_tags).unwrap_or_else(|_| "[]".into()))
        .bind(serde_json::to_string(&seed.allergens).unwrap_or_else(|_| "[]".into()))
        .bind(seed.rating)
        .bind(seed.cooked_count)
        .bind(seed.last_cooked)
        .bind(&col_ids_json)
        .bind(seed.notes)
        .bind(now)
        .bind(now)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

        for (i, (name, amount, amount_imperial, subs)) in seed.ingredients.iter().enumerate() {
            sqlx::query(
                "INSERT INTO recipe_ingredients (id,recipe_id,name,amount,amount_imperial,substitutes,checked,position)
                 VALUES (?,?,?,?,?,?,0,?)",
            )
            .bind(Uuid::new_v4().to_string()).bind(&rid).bind(name).bind(amount)
            .bind(amount_imperial)
            .bind(serde_json::to_string(subs).unwrap_or_else(|_| "[]".into()))
            .bind(i as i64)
            .execute(&state.db()).await.map_err(|e| e.to_string())?;
        }

        for (i, (instruction, duration_min)) in seed.steps.iter().enumerate() {
            sqlx::query(
                "INSERT INTO recipe_steps (id,recipe_id,step_order,instruction,duration_min,video_url)
                 VALUES (?,?,?,?,?,NULL)",
            )
            .bind(Uuid::new_v4().to_string()).bind(&rid).bind(i as i64)
            .bind(instruction).bind(duration_min)
            .execute(&state.db()).await.map_err(|e| e.to_string())?;
        }
    }

    Ok(true)
}
