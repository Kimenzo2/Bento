// ─────────────────────────────────────────────────────────────────────────────
// TheMealDB API Client — Discover & Import Recipes
// ─────────────────────────────────────────────────────────────────────────────

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

use crate::db::BentoAppState;
use crate::recipes::{NewIngredient, NewRecipePayload, NewStep, RecipeRow};
use crate::util::time;

// ── API Base ──────────────────────────────────────────────────────────────────
const MEALDB_BASE: &str = "https://www.themealdb.com/api/json/v1/1";

// ── Cache TTLs (milliseconds) ────────────────────────────────────────────────
const CACHE_TTL_SEARCH: i64 = 3_600_000; // 1 hour
const CACHE_TTL_LIST: i64 = 86_400_000; // 24 hours

// ── TheMealDB Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct MealDbSearchResponse {
    meals: Option<Vec<MealDbMeal>>,
}

#[derive(Debug, Deserialize)]
struct MealDbLookupResponse {
    meals: Option<Vec<MealDbFullMeal>>,
}

#[derive(Debug, Deserialize)]
struct MealDbCategoriesResponse {
    categories: Option<Vec<MealDbCategory>>,
}

#[derive(Debug, Deserialize)]
struct MealDbListResponse {
    meals: Option<Vec<MealDbListItem>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MealDbListItem {
    #[serde(rename = "strMeal")]
    str_meal: String,
    #[serde(rename = "strMealThumb")]
    str_meal_thumb: String,
    #[serde(rename = "idMeal")]
    id_meal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealDbMeal {
    #[serde(rename = "idMeal")]
    pub id_meal: String,
    #[serde(rename = "strMeal")]
    pub str_meal: String,
    #[serde(rename = "strCategory")]
    pub str_category: Option<String>,
    #[serde(rename = "strArea")]
    pub str_area: Option<String>,
    #[serde(rename = "strMealThumb")]
    pub str_meal_thumb: String,
    #[serde(rename = "strTags")]
    pub str_tags: Option<String>,
    #[serde(rename = "strInstructions")]
    pub str_instructions: Option<String>,
    #[serde(rename = "strYoutube")]
    pub str_youtube: Option<String>,
    #[serde(rename = "strSource")]
    pub str_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealDbFullMeal {
    #[serde(rename = "idMeal")]
    pub id_meal: String,
    #[serde(rename = "strMeal")]
    pub str_meal: String,
    #[serde(rename = "strCategory")]
    pub str_category: Option<String>,
    #[serde(rename = "strArea")]
    pub str_area: Option<String>,
    #[serde(rename = "strInstructions")]
    pub str_instructions: Option<String>,
    #[serde(rename = "strMealThumb")]
    pub str_meal_thumb: String,
    #[serde(rename = "strTags")]
    pub str_tags: Option<String>,
    #[serde(rename = "strYoutube")]
    pub str_youtube: Option<String>,
    #[serde(rename = "strSource")]
    pub str_source: Option<String>,

    // TheMealDB has strIngredient1..20 and strMeasure1..20
    #[serde(flatten)]
    pub extra: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealDbCategory {
    #[serde(rename = "idCategory")]
    pub id_category: String,
    #[serde(rename = "strCategory")]
    pub str_category: String,
    #[serde(rename = "strCategoryThumb")]
    pub str_category_thumb: String,
    #[serde(rename = "strCategoryDescription")]
    pub str_category_description: Option<String>,
}

// ── Frontend-facing types (camelCase for Tauri IPC) ───────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverRecipeSummary {
    pub id: String,
    pub title: String,
    pub category: String,
    pub area: String,
    pub image_url: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverRecipeDetail {
    pub id: String,
    pub title: String,
    pub category: String,
    pub area: String,
    pub image_url: String,
    pub tags: Vec<String>,
    pub instructions: String,
    pub youtube_url: String,
    pub source_url: String,
    pub ingredients: Vec<DiscoverIngredient>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverIngredient {
    pub name: String,
    pub measure: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverCategory {
    pub id: String,
    pub name: String,
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverFilterOption {
    pub name: String,
}

// ── Cache Helpers ─────────────────────────────────────────────────────────────

async fn ensure_cache_table(pool: &sqlx::SqlitePool) -> Result<(), String> {
    sqlx::query(
        r#"CREATE TABLE IF NOT EXISTS meal_cache (
            cache_key TEXT PRIMARY KEY,
            data      TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )"#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

async fn cache_get(pool: &sqlx::SqlitePool, key: &str, ttl_ms: i64) -> Option<String> {
    use sqlx::Row;
    let row = sqlx::query("SELECT data, created_at FROM meal_cache WHERE cache_key = ?")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()?;
    let (data, created_at): (String, i64) = (
        row.as_ref()?.try_get("data").ok()?,
        row?.try_get("created_at").ok()?,
    );
    if time::now_ms() - created_at > ttl_ms {
        // Expired — remove and return None
        let _ = sqlx::query("DELETE FROM meal_cache WHERE cache_key = ?")
            .bind(key)
            .execute(pool)
            .await;
        return None;
    }
    Some(data)
}

async fn cache_set(pool: &sqlx::SqlitePool, key: &str, data: &str) -> Result<(), String> {
    let now = time::now_ms();
    sqlx::query(
        r#"INSERT OR REPLACE INTO meal_cache (cache_key, data, created_at)
           VALUES (?, ?, ?)"#,
    )
    .bind(key)
    .bind(data)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── HTTP Helper ───────────────────────────────────────────────────────────────

async fn fetch_json(url: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("BentoDesktop/0.1")
        .build()
        .map_err(|e| format!("HTTP client creation failed: {e}"))?;
    let resp = client.get(url).send().await.map_err(|e| {
        if e.is_timeout() {
            "TheMealDB request timed out — check your internet connection.".to_string()
        } else if e.is_connect() {
            "Could not connect to TheMealDB — you may be offline.".to_string()
        } else {
            format!("TheMealDB request failed: {e}")
        }
    })?;
    resp.text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))
}

// ── Ingredient extraction from flattened HashMap ─────────────────────────────

fn extract_ingredients(extra: &HashMap<String, String>) -> Vec<DiscoverIngredient> {
    let mut result = Vec::new();
    for i in 1..=20 {
        let ing_key = format!("strIngredient{i}");
        let meas_key = format!("strMeasure{i}");
        let name = extra
            .get(&ing_key)
            .map(|s| s.trim())
            .unwrap_or("")
            .to_string();
        let measure = extra
            .get(&meas_key)
            .map(|s| s.trim())
            .unwrap_or("")
            .to_string();
        if name.is_empty() {
            continue;
        }
        result.push(DiscoverIngredient { name, measure });
    }
    result
}

fn parse_tags(tags_str: Option<String>) -> Vec<String> {
    match tags_str {
        Some(t) if !t.trim().is_empty() => t
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect(),
        _ => vec![],
    }
}

// ── Map TheMealDB detail to recipe save payload ──────────────────────────────

fn meal_detail_to_recipe_payload(meal: &MealDbFullMeal) -> NewRecipePayload {
    let ingredients = extract_ingredients(&meal.extra);
    let tags = parse_tags(meal.str_tags.clone());

    // Parse instructions into numbered steps
    let raw_instructions = meal.str_instructions.as_deref().unwrap_or("");
    let steps: Vec<NewStep> = raw_instructions
        .split('\n')
        .map(|line| line.trim())
        .filter(|line| !line.is_empty() && line.len() > 3)
        .map(|instruction| NewStep {
            instruction: instruction.to_string(),
            duration_min: None,
            video_url: None,
        })
        .collect();

    let category = meal.str_category.as_deref().unwrap_or("Miscellaneous");
    let area = meal.str_area.as_deref().unwrap_or("Unknown");

    // Determine meal type from category
    let meal_type = match category {
        "Breakfast" | "Dessert" => "Breakfast".to_string(),
        "Side" | "Starter" | "Appetizer" => "Snack".to_string(),
        _ => "Dinner".to_string(),
    };

    // Difficulty based on step count
    let difficulty = if steps.len() > 10 {
        "Hard".to_string()
    } else if steps.len() > 5 {
        "Medium".to_string()
    } else {
        "Easy".to_string()
    };

    // Time estimate: rough guess based on category
    let time_estimate = match category {
        "Breakfast" | "Dessert" => "30 min".to_string(),
        _ => "45 min".to_string(),
    };

    NewRecipePayload {
        title: meal.str_meal.clone(),
        time_label: time_estimate,
        cook_time_min: if category == "Breakfast" || category == "Dessert" {
            30
        } else {
            45
        },
        servings: 4,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        image_url: meal.str_meal_thumb.clone(),
        meal: meal_type,
        difficulty,
        tags,
        diet_tags: vec![],
        allergens: vec![],
        notes: format!(
            "Imported from TheMealDB\nArea: {area}\nSource: {}",
            meal.str_source.as_deref().unwrap_or("")
        ),
        ingredients: ingredients
            .into_iter()
            .map(|ing| NewIngredient {
                name: ing.name,
                amount: ing.measure,
                amount_imperial: None,
                substitutes: vec![],
            })
            .collect(),
        steps,
    }
}

// ═══ TAURI COMMANDS ═══════════════════════════════════════════════════════════

/// Search meals by name
#[tauri::command]
pub async fn discover_search(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    query: String,
) -> Result<Vec<DiscoverRecipeSummary>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    let cache_key = format!("search:{}", query.to_lowercase().trim());
    if let Some(cached) = cache_get(&state.db(), &cache_key, CACHE_TTL_SEARCH).await {
        return serde_json::from_str(&cached).map_err(|e| e.to_string());
    }

    let url = format!("{MEALDB_BASE}/search.php?s={}", urlencoding(&query));
    let body = fetch_json(&url).await?;

    let resp: MealDbSearchResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB response: {e}"))?;

    let meals: Vec<DiscoverRecipeSummary> = resp
        .meals
        .unwrap_or_default()
        .into_iter()
        .map(|m| DiscoverRecipeSummary {
            id: m.id_meal,
            title: m.str_meal,
            category: m.str_category.unwrap_or_default(),
            area: m.str_area.unwrap_or_default(),
            image_url: m.str_meal_thumb,
            tags: parse_tags(m.str_tags),
        })
        .collect();

    let json = serde_json::to_string(&meals).map_err(|e| e.to_string())?;
    cache_set(&state.db(), &cache_key, &json).await?;

    Ok(meals)
}

/// Get random meal
#[tauri::command]
pub async fn discover_random(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<DiscoverRecipeDetail, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    let url = format!("{MEALDB_BASE}/random.php");
    let body = fetch_json(&url).await?;

    let resp: MealDbLookupResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB response: {e}"))?;

    let meal = resp
        .meals
        .and_then(|mut v| v.pop())
        .ok_or_else(|| "No random meal returned from TheMealDB".to_string())?;

    Ok(map_full_meal_to_detail(&meal))
}

/// Get full meal detail by ID
#[tauri::command]
pub async fn discover_meal_detail(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    meal_id: String,
) -> Result<DiscoverRecipeDetail, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    let cache_key = format!("detail:{}", meal_id);
    if let Some(cached) = cache_get(&state.db(), &cache_key, CACHE_TTL_SEARCH).await {
        return serde_json::from_str(&cached).map_err(|e| e.to_string());
    }

    let url = format!("{MEALDB_BASE}/lookup.php?i={meal_id}");
    let body = fetch_json(&url).await?;

    let resp: MealDbLookupResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB response: {e}"))?;

    let meal = resp
        .meals
        .and_then(|mut v| v.pop())
        .ok_or_else(|| format!("Meal with ID {meal_id} not found"))?;

    let detail = map_full_meal_to_detail(&meal);
    let json = serde_json::to_string(&detail).map_err(|e| e.to_string())?;
    cache_set(&state.db(), &cache_key, &json).await?;

    Ok(detail)
}

/// List all categories
#[tauri::command]
pub async fn discover_categories(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<DiscoverCategory>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    let cache_key = "categories".to_string();
    if let Some(cached) = cache_get(&state.db(), &cache_key, CACHE_TTL_LIST).await {
        return serde_json::from_str(&cached).map_err(|e| e.to_string());
    }

    let url = format!("{MEALDB_BASE}/categories.php");
    let body = fetch_json(&url).await?;

    let resp: MealDbCategoriesResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB categories: {e}"))?;

    let cats: Vec<DiscoverCategory> = resp
        .categories
        .unwrap_or_default()
        .into_iter()
        .map(|c| DiscoverCategory {
            id: c.id_category,
            name: c.str_category,
            thumbnail: c.str_category_thumb,
        })
        .collect();

    let json = serde_json::to_string(&cats).map_err(|e| e.to_string())?;
    cache_set(&state.db(), &cache_key, &json).await?;

    Ok(cats)
}

/// List all areas
#[tauri::command]
pub async fn discover_areas(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<DiscoverFilterOption>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    let cache_key = "areas".to_string();
    if let Some(cached) = cache_get(&state.db(), &cache_key, CACHE_TTL_LIST).await {
        return serde_json::from_str(&cached).map_err(|e| e.to_string());
    }

    let url = format!("{MEALDB_BASE}/list.php?a=list");
    let body = fetch_json(&url).await?;

    let resp: MealDbListResponse =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse TheMealDB areas: {e}"))?;

    let areas: Vec<DiscoverFilterOption> = resp
        .meals
        .unwrap_or_default()
        .into_iter()
        .map(|m| DiscoverFilterOption { name: m.str_meal })
        .collect();

    let json = serde_json::to_string(&areas).map_err(|e| e.to_string())?;
    cache_set(&state.db(), &cache_key, &json).await?;

    Ok(areas)
}

/// Filter meals by category
#[tauri::command]
pub async fn discover_filter_by_category(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    category: String,
) -> Result<Vec<DiscoverRecipeSummary>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    filter_meals(
        &state,
        &format!("filter_category:{}", category),
        &format!("{MEALDB_BASE}/filter.php?c={}", urlencoding(&category)),
    )
    .await
}

/// Filter meals by area
#[tauri::command]
pub async fn discover_filter_by_area(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    area: String,
) -> Result<Vec<DiscoverRecipeSummary>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    filter_meals(
        &state,
        &format!("filter_area:{}", area),
        &format!("{MEALDB_BASE}/filter.php?a={}", urlencoding(&area)),
    )
    .await
}

/// Filter meals by ingredient
#[tauri::command]
pub async fn discover_filter_by_ingredient(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    ingredient: String,
) -> Result<Vec<DiscoverRecipeSummary>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    filter_meals(
        &state,
        &format!("filter_ingredient:{}", ingredient),
        &format!("{MEALDB_BASE}/filter.php?i={}", urlencoding(&ingredient)),
    )
    .await
}

/// List all ingredients
#[tauri::command]
pub async fn discover_ingredients(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<DiscoverFilterOption>, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    let cache_key = "ingredients".to_string();
    if let Some(cached) = cache_get(&state.db(), &cache_key, CACHE_TTL_LIST).await {
        return serde_json::from_str(&cached).map_err(|e| e.to_string());
    }

    let url = format!("{MEALDB_BASE}/list.php?i=list");
    let body = fetch_json(&url).await?;

    let resp: MealDbListResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB ingredients: {e}"))?;

    let ingredients: Vec<DiscoverFilterOption> = resp
        .meals
        .unwrap_or_default()
        .into_iter()
        .map(|m| DiscoverFilterOption { name: m.str_meal })
        .collect();

    let json = serde_json::to_string(&ingredients).map_err(|e| e.to_string())?;
    cache_set(&state.db(), &cache_key, &json).await?;

    Ok(ingredients)
}

/// Import a TheMealDB meal into the local recipes database
#[tauri::command]
pub async fn discover_import_meal(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    search: State<'_, crate::search::SearchService>,
    meal_id: String,
) -> Result<RecipeRow, String> {
    crate::auth::require_billing_tier(&auth, "meal_db").await?;

    ensure_cache_table(&state.db()).await?;

    // Fetch full detail
    let url = format!("{MEALDB_BASE}/lookup.php?i={meal_id}");
    let body = fetch_json(&url).await?;

    let resp: MealDbLookupResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB response: {e}"))?;

    let meal = resp
        .meals
        .and_then(|mut v| v.pop())
        .ok_or_else(|| format!("Meal with ID {meal_id} not found"))?;

    // Convert to recipe payload
    let payload = meal_detail_to_recipe_payload(&meal);

    // Save via the existing recipe save logic
    crate::recipes::recipe_save_internal(&state.db(), &search, payload).await
}

// ═══ Internal helpers ═════════════════════════════════════════════════════════

fn map_full_meal_to_detail(meal: &MealDbFullMeal) -> DiscoverRecipeDetail {
    DiscoverRecipeDetail {
        id: meal.id_meal.clone(),
        title: meal.str_meal.clone(),
        category: meal.str_category.clone().unwrap_or_default(),
        area: meal.str_area.clone().unwrap_or_default(),
        image_url: meal.str_meal_thumb.clone(),
        tags: parse_tags(meal.str_tags.clone()),
        instructions: meal.str_instructions.clone().unwrap_or_default(),
        youtube_url: meal.str_youtube.clone().unwrap_or_default(),
        source_url: meal.str_source.clone().unwrap_or_default(),
        ingredients: extract_ingredients(&meal.extra),
    }
}

async fn filter_meals(
    state: &State<'_, BentoAppState>,
    cache_key: &str,
    url: &str,
) -> Result<Vec<DiscoverRecipeSummary>, String> {
    ensure_cache_table(&state.db()).await?;

    if let Some(cached) = cache_get(&state.db(), cache_key, CACHE_TTL_SEARCH).await {
        return serde_json::from_str(&cached).map_err(|e| e.to_string());
    }

    let body = fetch_json(url).await?;

    let resp: MealDbSearchResponse = serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse TheMealDB response: {e}"))?;

    // Filter results only have idMeal, strMeal, strMealThumb — no category/area
    // We need to enrich them with lookup, but for now show what we have
    let meals: Vec<DiscoverRecipeSummary> = resp
        .meals
        .unwrap_or_default()
        .into_iter()
        .map(|m| DiscoverRecipeSummary {
            id: m.id_meal,
            title: m.str_meal,
            category: String::new(),
            area: String::new(),
            image_url: m.str_meal_thumb,
            tags: vec![],
        })
        .collect();

    let json = serde_json::to_string(&meals).map_err(|e| e.to_string())?;
    cache_set(&state.db(), cache_key, &json).await?;

    Ok(meals)
}

fn urlencoding(s: &str) -> String {
    // Simple URL encoding for TheMealDB queries
    s.replace(' ', "%20")
        .replace(',', "%2C")
        .replace('/', "%2F")
        .replace('&', "%26")
}
