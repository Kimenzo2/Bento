// ══════════════════════════════════════════════════════════════════════════
// NUTRITION BACKEND — Rust commands for the Nutrition frontend module.
//
// Sections covered:
//   Water     → water_logs table    (log_water, get_today_water, reset_water, weekly_water)
//   Meals     → meals + meal_foods   (log_meal, get_today_meals, delete_meal, add_food)
//   Macros    → derived from meal_foods + nutrition_goals
//   Goals     → nutrition_goals       (get_goals, update_goals)
//   Reminders → nutrition_reminders   (get/save/delete/toggle)
//   Summary   → aggregated today view (get_today_summary)
//   Export    → CSV/JSON data dumps
// ══════════════════════════════════════════════════════════════════════════

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn now_ms() -> i64 {
    time::now_ms()
}

/// Start of the current calendar day in local-time ms.
fn today_start_ms() -> i64 {
    time::start_of_today()
}

fn today_end_ms() -> i64 {
    time::start_of_today() + 86_399_999
}

// ─── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaterEntry {
    pub id: String,
    pub amount_ml: i64,
    pub logged_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayWater {
    pub total_ml: i64,
    pub goal_ml: i64,
    pub percentage: i64,
    pub entries: Vec<WaterEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyWaterDay {
    pub date: String,      // "YYYY-MM-DD"
    pub day_label: String, // "Mon", "Tue" …
    pub total_ml: i64,
    pub goal_ml: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FoodItem {
    pub id: String,
    pub meal_id: String,
    pub name: String,
    pub quantity: f64,
    pub unit: String,
    pub calories_kcal: i64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MealEntry {
    pub id: String,
    pub name: String,
    pub meal_type: String, // "breakfast" | "lunch" | "dinner" | "snack" | "meal"
    pub notes: String,
    pub total_kcal: i64,
    pub logged_at: i64,
    pub foods: Vec<FoodItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NutritionGoals {
    pub water_goal_ml: i64,
    pub calorie_goal: i64,
    pub protein_goal_g: i64,
    pub carbs_goal_g: i64,
    pub fat_goal_g: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroTotals {
    pub calories_kcal: i64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodaySummary {
    pub water: TodayWater,
    pub meals: Vec<MealEntry>,
    pub macros: MacroTotals,
    pub goals: NutritionGoals,
    pub meals_logged: i64,
    pub calories_remaining: i64,
    pub next_cue: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NutritionReminder {
    pub id: String,
    pub label: String,
    pub detail: String,
    pub mode: String,     // "Active" | "Scheduled" | "Smart"
    pub schedule: String, // JSON blob
    pub enabled: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogWaterParams {
    pub amount_ml: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogMealParams {
    pub name: String,
    pub meal_type: Option<String>,
    pub notes: Option<String>,
    pub total_kcal: Option<i64>,
    pub logged_at: Option<i64>,
    pub foods: Option<Vec<LogFoodParams>>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LogFoodParams {
    pub name: String,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub calories_kcal: Option<i64>,
    pub protein_g: Option<f64>,
    pub carbs_g: Option<f64>,
    pub fat_g: Option<f64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct UpdateGoalsParams {
    pub water_goal_ml: Option<i64>,
    pub calorie_goal: Option<i64>,
    pub protein_goal_g: Option<i64>,
    pub carbs_goal_g: Option<i64>,
    pub fat_goal_g: Option<i64>,
}

impl Default for UpdateGoalsParams {
    fn default() -> Self {
        Self {
            water_goal_ml: None,
            calorie_goal: None,
            protein_goal_g: None,
            carbs_goal_g: None,
            fat_goal_g: None,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveReminderParams {
    pub id: Option<String>,
    pub label: String,
    pub detail: Option<String>,
    pub mode: Option<String>,
    pub schedule: Option<String>,
    pub enabled: Option<bool>,
}

// ─── Water commands ───────────────────────────────────────────────────────────

/// Log a water intake entry.
/// Negative amount_ml = remove water (up to 0 floor enforced on query side).
#[tauri::command]
pub async fn nutrition_log_water(
    state: State<'_, BentoAppState>,
    params: LogWaterParams,
) -> Result<WaterEntry, String> {
    if params.amount_ml == 0 {
        return Err("amount_ml must be non-zero".to_string());
    }
    let db = state.db();
    let id = Uuid::new_v4().to_string();
    let logged_at = now_ms();

    sqlx::query("INSERT INTO water_logs (id, amount_ml, logged_at) VALUES (?, ?, ?)")
        .bind(&id)
        .bind(params.amount_ml)
        .bind(logged_at)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(WaterEntry {
        id,
        amount_ml: params.amount_ml,
        logged_at,
    })
}

/// Get today's hydration: total, goal, percentage, and individual entries.
#[tauri::command]
pub async fn nutrition_get_today_water(
    state: State<'_, BentoAppState>,
) -> Result<TodayWater, String> {
    let db = state.db();
    let start = today_start_ms();
    let end = today_end_ms();

    let goals = fetch_goals(&db).await?;

    let entries: Vec<WaterEntry> = sqlx::query(
        "SELECT id, amount_ml, logged_at FROM water_logs WHERE logged_at >= ? AND logged_at <= ? ORDER BY logged_at ASC",
    )
    .bind(start)
    .bind(end)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?
    .into_iter()
    .map(|row| WaterEntry {
        id:        row.try_get("id").unwrap_or_default(),
        amount_ml: row.try_get("amount_ml").unwrap_or(0),
        logged_at: row.try_get("logged_at").unwrap_or(0),
    })
    .collect();

    let total_ml: i64 = entries.iter().map(|e| e.amount_ml).sum::<i64>().max(0);
    let pct = if goals.water_goal_ml > 0 {
        ((total_ml * 100) / goals.water_goal_ml).min(100)
    } else {
        0
    };

    Ok(TodayWater {
        total_ml,
        goal_ml: goals.water_goal_ml,
        percentage: pct,
        entries,
    })
}

/// Delete all of today's water logs (reset button).
#[tauri::command]
pub async fn nutrition_reset_water(state: State<'_, BentoAppState>) -> Result<(), String> {
    let db = state.db();
    sqlx::query("DELETE FROM water_logs WHERE logged_at >= ? AND logged_at <= ?")
        .bind(today_start_ms())
        .bind(today_end_ms())
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Get water totals for the past 7 days (for the Water section chart).
#[tauri::command]
pub async fn nutrition_get_weekly_water(
    state: State<'_, BentoAppState>,
) -> Result<Vec<WeeklyWaterDay>, String> {
    let db = state.db();
    let goals = fetch_goals(&db).await?;
    let week_start = today_start_ms() - 6 * 86_400_000;

    let rows = sqlx::query(
        r#"
        SELECT
            DATE(logged_at / 1000, 'unixepoch', 'localtime') AS day,
            SUM(amount_ml) AS total_ml
        FROM water_logs
        WHERE logged_at >= ? AND amount_ml > 0
        GROUP BY day
        ORDER BY day ASC
        "#,
    )
    .bind(week_start)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    // Build a map from the query results
    let mut day_map: std::collections::HashMap<String, i64> = rows
        .into_iter()
        .map(|row| {
            let day: String = row.try_get("day").unwrap_or_default();
            let ml: i64 = row.try_get("total_ml").unwrap_or(0);
            (day, ml)
        })
        .collect();

    // Fill in all 7 days (including empty ones)
    let day_labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let mut result = Vec::with_capacity(7);
    for offset in 0..7i64 {
        let ts_ms = week_start + offset * 86_400_000;
        let dt = chrono::DateTime::from_timestamp_millis(ts_ms)
            .unwrap_or_default()
            .with_timezone(&chrono::Local);
        let date = dt.format("%Y-%m-%d").to_string();
        let weekday = dt.weekday() as usize;
        let total_ml = day_map.remove(&date).unwrap_or(0).max(0);
        result.push(WeeklyWaterDay {
            date,
            day_label: day_labels[weekday % 7].to_string(),
            total_ml,
            goal_ml: goals.water_goal_ml,
        });
    }

    Ok(result)
}

// ─── Meals commands ───────────────────────────────────────────────────────────

/// Log a meal (with optional food items).
#[tauri::command]
pub async fn nutrition_log_meal(
    state: State<'_, BentoAppState>,
    params: LogMealParams,
) -> Result<MealEntry, String> {
    let db = state.db();
    let id = Uuid::new_v4().to_string();
    let now = now_ms();
    let logged_at = params.logged_at.unwrap_or(now);
    let meal_type = params.meal_type.unwrap_or_else(|| "meal".to_string());
    let notes = params.notes.unwrap_or_default();

    // Derive total_kcal from foods if not provided
    let foods = params.foods.clone().unwrap_or_default();
    let derived_kcal: i64 = foods.iter().map(|f| f.calories_kcal.unwrap_or(0)).sum();
    let total_kcal = params.total_kcal.unwrap_or(derived_kcal);

    sqlx::query(
        "INSERT INTO meals (id, name, meal_type, notes, total_kcal, logged_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&params.name)
    .bind(&meal_type)
    .bind(&notes)
    .bind(total_kcal)
    .bind(logged_at)
    .bind(now)
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    // Insert food items
    let mut food_entries = Vec::with_capacity(foods.len());
    for food in &foods {
        let fid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO meal_foods (id, meal_id, name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&fid)
        .bind(&id)
        .bind(&food.name)
        .bind(food.quantity.unwrap_or(1.0))
        .bind(food.unit.as_deref().unwrap_or("serving"))
        .bind(food.calories_kcal.unwrap_or(0))
        .bind(food.protein_g.unwrap_or(0.0))
        .bind(food.carbs_g.unwrap_or(0.0))
        .bind(food.fat_g.unwrap_or(0.0))
        .bind(now)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;

        food_entries.push(FoodItem {
            id: fid,
            meal_id: id.clone(),
            name: food.name.clone(),
            quantity: food.quantity.unwrap_or(1.0),
            unit: food.unit.clone().unwrap_or_else(|| "serving".to_string()),
            calories_kcal: food.calories_kcal.unwrap_or(0),
            protein_g: food.protein_g.unwrap_or(0.0),
            carbs_g: food.carbs_g.unwrap_or(0.0),
            fat_g: food.fat_g.unwrap_or(0.0),
            created_at: now,
        });
    }

    Ok(MealEntry {
        id,
        name: params.name,
        meal_type,
        notes,
        total_kcal,
        logged_at,
        foods: food_entries,
    })
}

/// Get all meals logged today with their food items.
#[tauri::command]
pub async fn nutrition_get_today_meals(
    state: State<'_, BentoAppState>,
) -> Result<Vec<MealEntry>, String> {
    let db = state.db();
    fetch_meals_for_range(&db, today_start_ms(), today_end_ms()).await
}

/// Get meals for a specific ISO date (YYYY-MM-DD).
#[tauri::command]
pub async fn nutrition_get_meals_for_date(
    state: State<'_, BentoAppState>,
    date: String,
) -> Result<Vec<MealEntry>, String> {
    let db = state.db();
    // Parse the date and compute start/end in ms
    let dt = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    let start = dt
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(chrono::Local)
        .unwrap()
        .timestamp_millis();
    let end = start + 86_399_999;
    fetch_meals_for_range(&db, start, end).await
}

async fn fetch_meals_for_range(
    db: &sqlx::SqlitePool,
    start: i64,
    end: i64,
) -> Result<Vec<MealEntry>, String> {
    let rows = sqlx::query(
        "SELECT id, name, meal_type, notes, total_kcal, logged_at FROM meals WHERE logged_at >= ? AND logged_at <= ? ORDER BY logged_at ASC",
    )
    .bind(start)
    .bind(end)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    let mut meals = Vec::with_capacity(rows.len());
    for row in rows {
        let meal_id: String = row.try_get("id").unwrap_or_default();
        let foods = fetch_foods_for_meal(db, &meal_id).await?;
        meals.push(MealEntry {
            id: meal_id,
            name: row.try_get("name").unwrap_or_default(),
            meal_type: row
                .try_get("meal_type")
                .unwrap_or_else(|_| "meal".to_string()),
            notes: row.try_get("notes").unwrap_or_default(),
            total_kcal: row.try_get("total_kcal").unwrap_or(0),
            logged_at: row.try_get("logged_at").unwrap_or(0),
            foods,
        });
    }
    Ok(meals)
}

async fn fetch_foods_for_meal(
    db: &sqlx::SqlitePool,
    meal_id: &str,
) -> Result<Vec<FoodItem>, String> {
    let rows = sqlx::query(
        "SELECT id, meal_id, name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, created_at FROM meal_foods WHERE meal_id = ? ORDER BY created_at ASC",
    )
    .bind(meal_id)
    .fetch_all(db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| FoodItem {
            id: row.try_get("id").unwrap_or_default(),
            meal_id: row.try_get("meal_id").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            quantity: row.try_get("quantity").unwrap_or(1.0),
            unit: row
                .try_get("unit")
                .unwrap_or_else(|_| "serving".to_string()),
            calories_kcal: row.try_get("calories_kcal").unwrap_or(0),
            protein_g: row.try_get("protein_g").unwrap_or(0.0),
            carbs_g: row.try_get("carbs_g").unwrap_or(0.0),
            fat_g: row.try_get("fat_g").unwrap_or(0.0),
            created_at: row.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

/// Delete a meal and all its food items.
#[tauri::command]
pub async fn nutrition_delete_meal(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db();
    sqlx::query("DELETE FROM meals WHERE id = ?")
        .bind(&id)
        .execute(&db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Add a food item to an existing meal (and update meal total_kcal).
#[tauri::command]
pub async fn nutrition_add_food_to_meal(
    state: State<'_, BentoAppState>,
    meal_id: String,
    food: LogFoodParams,
) -> Result<FoodItem, String> {
    let db = state.db();
    let id = Uuid::new_v4().to_string();
    let now = now_ms();

    sqlx::query(
        "INSERT INTO meal_foods (id, meal_id, name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&meal_id)
    .bind(&food.name)
    .bind(food.quantity.unwrap_or(1.0))
    .bind(food.unit.as_deref().unwrap_or("serving"))
    .bind(food.calories_kcal.unwrap_or(0))
    .bind(food.protein_g.unwrap_or(0.0))
    .bind(food.carbs_g.unwrap_or(0.0))
    .bind(food.fat_g.unwrap_or(0.0))
    .bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    // Recalculate meal total_kcal from all foods
    sqlx::query(
        "UPDATE meals SET total_kcal = (SELECT COALESCE(SUM(calories_kcal),0) FROM meal_foods WHERE meal_id = ?), updated_at = ? WHERE id = ?",
    )
    .bind(&meal_id)
    .bind(now)
    .bind(&meal_id)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(FoodItem {
        id,
        meal_id,
        name: food.name,
        quantity: food.quantity.unwrap_or(1.0),
        unit: food.unit.unwrap_or_else(|| "serving".to_string()),
        calories_kcal: food.calories_kcal.unwrap_or(0),
        protein_g: food.protein_g.unwrap_or(0.0),
        carbs_g: food.carbs_g.unwrap_or(0.0),
        fat_g: food.fat_g.unwrap_or(0.0),
        created_at: now,
    })
}

// ─── Goals commands ───────────────────────────────────────────────────────────

async fn fetch_goals(db: &sqlx::SqlitePool) -> Result<NutritionGoals, String> {
    let row = sqlx::query(
        "SELECT water_goal_ml, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM nutrition_goals WHERE id = 1",
    )
    .fetch_one(db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(NutritionGoals {
        water_goal_ml: row.try_get("water_goal_ml").unwrap_or(2000),
        calorie_goal: row.try_get("calorie_goal").unwrap_or(2200),
        protein_goal_g: row.try_get("protein_goal_g").unwrap_or(150),
        carbs_goal_g: row.try_get("carbs_goal_g").unwrap_or(250),
        fat_goal_g: row.try_get("fat_goal_g").unwrap_or(70),
    })
}

/// Get the user's daily nutrition goals.
#[tauri::command]
pub async fn nutrition_get_goals(
    state: State<'_, BentoAppState>,
) -> Result<NutritionGoals, String> {
    fetch_goals(&state.db()).await
}

/// Update any combination of daily goals.
#[tauri::command]
pub async fn nutrition_update_goals(
    state: State<'_, BentoAppState>,
    params: UpdateGoalsParams,
) -> Result<NutritionGoals, String> {
    let db = state.db();
    let now = now_ms();
    let existing = fetch_goals(&db).await?;

    let water = params.water_goal_ml.unwrap_or(existing.water_goal_ml);
    let cal = params.calorie_goal.unwrap_or(existing.calorie_goal);
    let prot = params.protein_goal_g.unwrap_or(existing.protein_goal_g);
    let carbs = params.carbs_goal_g.unwrap_or(existing.carbs_goal_g);
    let fat = params.fat_goal_g.unwrap_or(existing.fat_goal_g);

    sqlx::query(
        "UPDATE nutrition_goals SET water_goal_ml=?, calorie_goal=?, protein_goal_g=?, carbs_goal_g=?, fat_goal_g=?, updated_at=? WHERE id=1",
    )
    .bind(water).bind(cal).bind(prot).bind(carbs).bind(fat).bind(now)
    .execute(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(NutritionGoals {
        water_goal_ml: water,
        calorie_goal: cal,
        protein_goal_g: prot,
        carbs_goal_g: carbs,
        fat_goal_g: fat,
    })
}

// ─── Today summary (combines water + meals + macros) ─────────────────────────

/// Full today snapshot: water, meals, macro totals, goals, next reminder cue.
#[tauri::command]
pub async fn nutrition_get_today_summary(
    state: State<'_, BentoAppState>,
) -> Result<TodaySummary, String> {
    let db = state.db();
    let goals = fetch_goals(&db).await?;
    let start = today_start_ms();
    let end = today_end_ms();

    // Water
    let water_entries: Vec<WaterEntry> = sqlx::query(
        "SELECT id, amount_ml, logged_at FROM water_logs WHERE logged_at >= ? AND logged_at <= ? ORDER BY logged_at ASC",
    )
    .bind(start).bind(end)
    .fetch_all(&db).await.map_err(|e| e.to_string())?
    .into_iter()
    .map(|row| WaterEntry {
        id:        row.try_get("id").unwrap_or_default(),
        amount_ml: row.try_get("amount_ml").unwrap_or(0),
        logged_at: row.try_get("logged_at").unwrap_or(0),
    })
    .collect();

    let total_water_ml: i64 = water_entries
        .iter()
        .map(|e| e.amount_ml)
        .sum::<i64>()
        .max(0);
    let water_pct = if goals.water_goal_ml > 0 {
        ((total_water_ml * 100) / goals.water_goal_ml).min(100)
    } else {
        0
    };

    // Meals
    let meals = fetch_meals_for_range(&db, start, end).await?;
    let meals_logged = meals.len() as i64;

    // Macro totals from all food items logged today
    let macro_row = sqlx::query(
        r#"
        SELECT
            COALESCE(SUM(mf.calories_kcal), 0) AS cal,
            COALESCE(SUM(mf.protein_g), 0.0)   AS prot,
            COALESCE(SUM(mf.carbs_g),   0.0)   AS carb,
            COALESCE(SUM(mf.fat_g),     0.0)   AS fat
        FROM meal_foods mf
        JOIN meals m ON mf.meal_id = m.id
        WHERE m.logged_at >= ? AND m.logged_at <= ?
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_one(&db)
    .await
    .map_err(|e| e.to_string())?;

    let cal_total: i64 = macro_row.try_get::<i64, _>("cal").unwrap_or(0);
    let prot_total: f64 = macro_row.try_get::<f64, _>("prot").unwrap_or(0.0);
    let carb_total: f64 = macro_row.try_get::<f64, _>("carb").unwrap_or(0.0);
    let fat_total: f64 = macro_row.try_get::<f64, _>("fat").unwrap_or(0.0);

    // Fallback: sum from meal total_kcal when no food items are detailed
    let meal_kcal_sum: i64 = meals.iter().map(|m| m.total_kcal).sum();
    let effective_cal = if cal_total > 0 {
        cal_total
    } else {
        meal_kcal_sum
    };

    let cal_remaining = (goals.calorie_goal - effective_cal).max(0);

    // Next reminder cue: nearest enabled reminder after now
    let next_cue: Option<String> = sqlx::query(
        "SELECT label FROM nutrition_reminders WHERE enabled = 1 ORDER BY created_at ASC LIMIT 1",
    )
    .fetch_optional(&db)
    .await
    .map_err(|e| e.to_string())?
    .map(|row| row.try_get::<String, _>("label").unwrap_or_default());

    Ok(TodaySummary {
        water: TodayWater {
            total_ml: total_water_ml,
            goal_ml: goals.water_goal_ml,
            percentage: water_pct,
            entries: water_entries,
        },
        meals,
        macros: MacroTotals {
            calories_kcal: effective_cal,
            protein_g: prot_total,
            carbs_g: carb_total,
            fat_g: fat_total,
        },
        goals: goals.clone(),
        meals_logged,
        calories_remaining: cal_remaining,
        next_cue,
    })
}

// ─── Macros commands ──────────────────────────────────────────────────────────

/// Get macro totals for a specific date (or today if None).
#[tauri::command]
pub async fn nutrition_get_macro_totals(
    state: State<'_, BentoAppState>,
    date: Option<String>,
) -> Result<MacroTotals, String> {
    let db = state.db();
    let (start, end) = if let Some(d) = date {
        let dt = chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").map_err(|e| e.to_string())?;
        let s = dt
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(chrono::Local)
            .unwrap()
            .timestamp_millis();
        (s, s + 86_399_999)
    } else {
        (today_start_ms(), today_end_ms())
    };

    let row = sqlx::query(
        r#"
        SELECT
            COALESCE(SUM(mf.calories_kcal), 0)  AS cal,
            COALESCE(SUM(mf.protein_g), 0.0)    AS prot,
            COALESCE(SUM(mf.carbs_g),   0.0)    AS carb,
            COALESCE(SUM(mf.fat_g),     0.0)    AS fat
        FROM meal_foods mf
        JOIN meals m ON mf.meal_id = m.id
        WHERE m.logged_at >= ? AND m.logged_at <= ?
        "#,
    )
    .bind(start)
    .bind(end)
    .fetch_one(&db)
    .await
    .map_err(|e| e.to_string())?;

    // Fallback to meal total_kcal if no food items are broken down
    let food_kcal: i64 = row.try_get::<i64, _>("cal").unwrap_or(0);
    let meal_kcal: i64 =
        if food_kcal == 0 {
            sqlx::query_scalar::<_,i64>(
            "SELECT COALESCE(SUM(total_kcal),0) FROM meals WHERE logged_at >= ? AND logged_at <= ?"
        )
        .bind(start).bind(end)
        .fetch_one(&db).await.unwrap_or(0)
        } else {
            0
        };

    Ok(MacroTotals {
        calories_kcal: food_kcal.max(meal_kcal),
        protein_g: row.try_get::<f64, _>("prot").unwrap_or(0.0),
        carbs_g: row.try_get::<f64, _>("carb").unwrap_or(0.0),
        fat_g: row.try_get::<f64, _>("fat").unwrap_or(0.0),
    })
}

// ─── Reminders commands ───────────────────────────────────────────────────────

/// List all nutrition reminders.
#[tauri::command]
pub async fn nutrition_get_reminders(
    state: State<'_, BentoAppState>,
) -> Result<Vec<NutritionReminder>, String> {
    let db = state.db();
    let rows = sqlx::query(
        "SELECT id, label, detail, mode, schedule, enabled, created_at, updated_at FROM nutrition_reminders ORDER BY created_at ASC",
    )
    .fetch_all(&db).await.map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| NutritionReminder {
            id: row.try_get("id").unwrap_or_default(),
            label: row.try_get("label").unwrap_or_default(),
            detail: row.try_get("detail").unwrap_or_default(),
            mode: row.try_get("mode").unwrap_or_else(|_| "Active".to_string()),
            schedule: row.try_get("schedule").unwrap_or_else(|_| "{}".to_string()),
            enabled: row.try_get::<i64, _>("enabled").unwrap_or(1) == 1,
            created_at: row.try_get("created_at").unwrap_or(0),
            updated_at: row.try_get("updated_at").unwrap_or(0),
        })
        .collect())
}

/// Create or update a reminder.
#[tauri::command]
pub async fn nutrition_save_reminder(
    state: State<'_, BentoAppState>,
    params: SaveReminderParams,
) -> Result<NutritionReminder, String> {
    let db = state.db();
    let now = now_ms();
    let id = params.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let detail = params.detail.unwrap_or_default();
    let mode = params.mode.unwrap_or_else(|| "Active".to_string());
    let schedule = params.schedule.unwrap_or_else(|| "{}".to_string());
    let enabled = params.enabled.unwrap_or(true);

    sqlx::query(
        r#"
        INSERT INTO nutrition_reminders (id, label, detail, mode, schedule, enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            label = excluded.label, detail = excluded.detail,
            mode = excluded.mode, schedule = excluded.schedule,
            enabled = excluded.enabled, updated_at = excluded.updated_at
        "#,
    )
    .bind(&id).bind(&params.label).bind(&detail).bind(&mode)
    .bind(&schedule).bind(if enabled { 1i64 } else { 0i64 })
    .bind(now).bind(now)
    .execute(&db).await.map_err(|e| e.to_string())?;

    Ok(NutritionReminder {
        id,
        label: params.label,
        detail,
        mode,
        schedule,
        enabled,
        created_at: now,
        updated_at: now,
    })
}

/// Delete a reminder.
#[tauri::command]
pub async fn nutrition_delete_reminder(
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM nutrition_reminders WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Toggle a reminder's enabled state.
#[tauri::command]
pub async fn nutrition_toggle_reminder(
    state: State<'_, BentoAppState>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    sqlx::query("UPDATE nutrition_reminders SET enabled = ?, updated_at = ? WHERE id = ?")
        .bind(if enabled { 1i64 } else { 0i64 })
        .bind(now_ms())
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Hydration history stats ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HydrationStats {
    pub streak_days: i64,
    pub weekly_avg_ml: i64,
    pub best_day_ml: i64,
    pub best_day_date: String,
}

/// Hydration streak + averages for the Water section stats card.
#[tauri::command]
pub async fn nutrition_get_hydration_stats(
    state: State<'_, BentoAppState>,
) -> Result<HydrationStats, String> {
    let db = state.db();

    // Daily totals for the past 30 days
    let rows = sqlx::query(
        r#"
        SELECT
            DATE(logged_at / 1000, 'unixepoch', 'localtime') AS day,
            SUM(amount_ml) AS total_ml
        FROM water_logs
        WHERE logged_at >= ? AND amount_ml > 0
        GROUP BY day
        ORDER BY day DESC
        "#,
    )
    .bind(today_start_ms() - 29 * 86_400_000)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    let goals = fetch_goals(&db).await?;
    let goal = goals.water_goal_ml;

    let mut streak = 0i64;
    let mut best_ml = 0i64;
    let mut best_date = String::new();
    let mut weekly_sum = 0i64;
    let mut weekly_days = 0i64;
    let week_cutoff = today_start_ms() - 6 * 86_400_000;
    let _today_str = chrono::Local::now().format("%Y-%m-%d").to_string();

    for (i, row) in rows.iter().enumerate() {
        let day: String = row.try_get("day").unwrap_or_default();
        let ml: i64 = row.try_get::<i64, _>("total_ml").unwrap_or(0).max(0);

        if ml > best_ml {
            best_ml = ml;
            best_date = day.clone();
        }

        // Streak: consecutive days from today where goal was met
        if i == 0 && ml >= goal {
            streak += 1;
        } else if i > 0 && streak == i as i64 && ml >= goal {
            streak += 1;
        }

        // Weekly average (last 7 days)
        let day_ts = chrono::NaiveDate::parse_from_str(&day, "%Y-%m-%d")
            .map(|d| {
                d.and_hms_opt(0, 0, 0)
                    .unwrap()
                    .and_local_timezone(chrono::Local)
                    .unwrap()
                    .timestamp_millis()
            })
            .unwrap_or(0);

        if day_ts >= week_cutoff {
            weekly_sum += ml;
            weekly_days += 1;
        }
    }

    let weekly_avg = if weekly_days > 0 {
        weekly_sum / weekly_days
    } else {
        0
    };

    Ok(HydrationStats {
        streak_days: streak,
        weekly_avg_ml: weekly_avg,
        best_day_ml: best_ml,
        best_day_date: best_date,
    })
}

// ─── Export ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NutritionExportRow {
    pub date: String,
    pub water_ml: i64,
    pub calories_kcal: i64,
    pub protein_g: f64,
    pub carbs_g: f64,
    pub fat_g: f64,
    pub meals_count: i64,
}

/// Export nutrition data as a structured array (frontend converts to CSV/PDF).
#[tauri::command]
pub async fn nutrition_export_data(
    state: State<'_, BentoAppState>,
    days: Option<i64>,
) -> Result<Vec<NutritionExportRow>, String> {
    let db = state.db();
    let days = days.unwrap_or(14).max(1).min(365);
    let since = today_start_ms() - (days - 1) * 86_400_000;

    let rows = sqlx::query(
        r#"
        SELECT
            DATE(d.day_ms / 1000, 'unixepoch', 'localtime') AS day,
            COALESCE(w.water_ml, 0)  AS water_ml,
            COALESCE(m.kcal,   0)   AS kcal,
            COALESCE(m.prot,   0.0) AS prot,
            COALESCE(m.carb,   0.0) AS carb,
            COALESCE(m.fat,    0.0) AS fat,
            COALESCE(m.cnt,    0)   AS cnt
        FROM (
            -- Generate one row per day using water_logs dates union meal dates
            SELECT DISTINCT
                (CAST(logged_at / 86400000 AS INTEGER) * 86400000) AS day_ms
            FROM water_logs WHERE logged_at >= ?
            UNION
            SELECT DISTINCT
                (CAST(logged_at / 86400000 AS INTEGER) * 86400000) AS day_ms
            FROM meals WHERE logged_at >= ?
        ) d
        LEFT JOIN (
            SELECT
                (CAST(logged_at / 86400000 AS INTEGER) * 86400000) AS day_ms,
                SUM(amount_ml) AS water_ml
            FROM water_logs WHERE logged_at >= ? AND amount_ml > 0
            GROUP BY day_ms
        ) w ON d.day_ms = w.day_ms
        LEFT JOIN (
            SELECT
                (CAST(logged_at / 86400000 AS INTEGER) * 86400000) AS day_ms,
                SUM(total_kcal) AS kcal,
                COUNT(*)        AS cnt,
                0.0 AS prot, 0.0 AS carb, 0.0 AS fat
            FROM meals WHERE logged_at >= ?
            GROUP BY day_ms
        ) m ON d.day_ms = m.day_ms
        ORDER BY d.day_ms DESC
        "#,
    )
    .bind(since)
    .bind(since)
    .bind(since)
    .bind(since)
    .fetch_all(&db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| NutritionExportRow {
            date: row.try_get("day").unwrap_or_default(),
            water_ml: row.try_get("water_ml").unwrap_or(0),
            calories_kcal: row.try_get("kcal").unwrap_or(0),
            protein_g: row.try_get("prot").unwrap_or(0.0),
            carbs_g: row.try_get("carb").unwrap_or(0.0),
            fat_g: row.try_get("fat").unwrap_or(0.0),
            meals_count: row.try_get("cnt").unwrap_or(0),
        })
        .collect())
}
