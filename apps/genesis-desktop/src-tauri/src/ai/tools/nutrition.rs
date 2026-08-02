// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "log_meal".into(),
            description: "Log a meal with name, meal type (breakfast/lunch/dinner/snack), optional total calories, notes, and optional food items with macros.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Meal name (required)"},
                    "meal_type": {"type": "string", "enum": ["breakfast", "lunch", "dinner", "snack"], "description": "Type of meal"},
                    "total_kcal": {"type": "integer", "description": "Optional total calorie estimate"},
                    "notes": {"type": "string", "description": "Optional notes"},
                    "foods": {"type": "array", "items": {"type": "object", "properties": {
                        "name": {"type": "string"},
                        "quantity": {"type": "number"},
                        "unit": {"type": "string"},
                        "calories": {"type": "integer"},
                        "protein_g": {"type": "number"},
                        "carbs_g": {"type": "number"},
                        "fat_g": {"type": "number"}
                    }}, "description": "Optional list of food items in this meal"}
                },
                "required": ["name", "meal_type"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_today_meals".into(),
            description: "Get all meals logged today with their food items and total calories.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_meal".into(),
            description: "Delete a meal by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "meal_id": {"type": "string", "description": "The unique ID of the meal to delete"}
                },
                "required": ["meal_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "log_water".into(),
            description: "Log water intake in milliliters. Use negative amount to remove water.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "amount_ml": {"type": "integer", "description": "Amount of water in ml (positive to add, negative to remove)"}
                },
                "required": ["amount_ml"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_water_today".into(),
            description: "Get today's water intake total and goal progress.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_nutrition_goals".into(),
            description: "Get daily nutrition goals: water, calories, protein, carbs, and fat targets.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "update_nutrition_goals".into(),
            description: "Update daily nutrition goals: water (ml), calories, protein (g), carbs (g), and fat (g).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "water_goal_ml": {"type": "integer", "description": "Daily water goal in ml"},
                    "calorie_goal": {"type": "integer", "description": "Daily calorie goal"},
                    "protein_goal_g": {"type": "integer", "description": "Daily protein goal in grams"},
                    "carbs_goal_g": {"type": "integer", "description": "Daily carbs goal in grams"},
                    "fat_goal_g": {"type": "integer", "description": "Daily fat goal in grams"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "get_nutrition_today".into(),
            description: "Get today's complete nutrition snapshot: meals, water, macros, and goal progress.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "log_meal" => Ok(Some(log_meal(args, pool).await?)),
        "get_today_meals" => Ok(Some(get_today_meals(pool).await?)),
        "delete_meal" => Ok(Some(delete_meal(args, pool).await?)),
        "log_water" => Ok(Some(log_water(args, pool).await?)),
        "get_water_today" => Ok(Some(get_water_today(pool).await?)),
        "get_nutrition_goals" => Ok(Some(get_nutrition_goals(pool).await?)),
        "update_nutrition_goals" => Ok(Some(update_nutrition_goals(args, pool).await?)),
        "get_nutrition_today" => Ok(Some(get_nutrition_today(pool).await?)),
        _ => Ok(None),
    }
}

async fn log_meal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?;
    let meal_type = args["meal_type"].as_str().unwrap_or("snack");
    let notes = args["notes"].as_str().unwrap_or("");
    let total_kcal = args["total_kcal"].as_i64();
    let now_ms = time::now_ms();

    let meal_id = Uuid::new_v4().to_string();

    let mut tx = pool.begin().await.map_err(|e| format!("Transaction error: {e}"))?;

    sqlx::query(
        "INSERT INTO meals (id, name, meal_type, notes, total_kcal, logged_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&meal_id).bind(name).bind(meal_type).bind(notes).bind(total_kcal).bind(now_ms).bind(now_ms).bind(now_ms)
    .execute(&mut *tx).await
    .map_err(|e| format!("Failed to log meal: {e}"))?;

    let mut foods_logged = 0i64;
    if let Some(foods) = args["foods"].as_array() {
        for food in foods {
            let food_id = Uuid::new_v4().to_string();
            let food_name = food["name"].as_str().unwrap_or("Food");
            let qty = food["quantity"].as_f64().unwrap_or(1.0);
            let unit = food["unit"].as_str().unwrap_or("serving");
            let kcal = food["calories"].as_i64();
            let protein = food["protein_g"].as_f64();
            let carbs = food["carbs_g"].as_f64();
            let fat = food["fat_g"].as_f64();

            sqlx::query(
                "INSERT INTO meal_foods (id, meal_id, name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&food_id).bind(&meal_id).bind(food_name).bind(qty).bind(unit)
            .bind(kcal).bind(protein).bind(carbs).bind(fat).bind(now_ms)
            .execute(&mut *tx).await.ok();
            foods_logged += 1;
        }
    }

    tx.commit().await.map_err(|e| format!("Commit error: {e}"))?;

    Ok(json!({
        "id": meal_id, "name": name, "mealType": meal_type,
        "totalKcal": total_kcal, "foodsLogged": foods_logged,
        "data_coverage": 1.0,
        "message": format!("Meal \"{name}\" logged.")
    }))
}

async fn get_today_meals(pool: &SqlitePool) -> Result<Value, String> {
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + time::DAY_MS;

    let meals = sqlx::query_as::<_, (String, String, String, Option<i64>, Option<String>, i64)>(
        "SELECT id, name, meal_type, total_kcal, notes, logged_at FROM meals WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at"
    )
    .bind(today_start).bind(tomorrow_start)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get meals: {e}"))?;

    let mut result = Vec::new();
    for (id, name, meal_type, kcal, notes, logged_at) in meals {
        let foods = sqlx::query_as::<_, (String, String, f64, String, Option<i64>, Option<f64>, Option<f64>, Option<f64>)>(
            "SELECT id, name, quantity, unit, calories_kcal, protein_g, carbs_g, fat_g FROM meal_foods WHERE meal_id = ?"
        )
        .bind(&id)
        .fetch_all(pool).await.unwrap_or_default();

        let foods_val: Vec<Value> = foods.into_iter().map(|(fid, fname, qty, unit, kcal, protein, carbs, fat)| {
            json!({"id": fid, "name": fname, "quantity": qty, "unit": unit, "calories": kcal, "proteinG": protein, "carbsG": carbs, "fatG": fat})
        }).collect();

        result.push(json!({
            "id": id, "name": name, "mealType": meal_type,
            "totalKcal": kcal, "notes": notes, "loggedAt": logged_at,
            "foods": foods_val
        }));
    }

    Ok(json!({ "meals": result, "count": result.len() }))
}

async fn delete_meal(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let meal_id = args["meal_id"].as_str().ok_or("meal_id is required")?;
    let result = sqlx::query("DELETE FROM meals WHERE id = ?")
        .bind(meal_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete meal: {e}"))?;
    if result.rows_affected() == 0 {
        return Err(format!("Meal \"{meal_id}\" not found."));
    }
    Ok(json!({ "id": meal_id, "data_coverage": 1.0, "message": "Meal deleted." }))
}

async fn log_water(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let amount_ml = args["amount_ml"].as_i64().ok_or("amount_ml is required")?;
    let id = Uuid::new_v4().to_string();
    let now_ms = time::now_ms();

    sqlx::query("INSERT INTO water_logs (id, amount_ml, logged_at) VALUES (?, ?, ?)")
        .bind(&id).bind(amount_ml).bind(now_ms)
        .execute(pool).await
        .map_err(|e| format!("Failed to log water: {e}"))?;

    Ok(json!({
        "id": id, "amountMl": amount_ml,
        "data_coverage": 1.0,
        "message": format!("{}ml water logged.", amount_ml.abs())
    }))
}

async fn get_water_today(pool: &SqlitePool) -> Result<Value, String> {
    let today_start = time::start_of_today();
    let tomorrow_start = today_start + time::DAY_MS;

    let entries = sqlx::query_as::<_, (String, i64, i64)>(
        "SELECT id, amount_ml, logged_at FROM water_logs WHERE logged_at >= ? AND logged_at < ? ORDER BY logged_at"
    )
    .bind(today_start).bind(tomorrow_start)
    .fetch_all(pool).await
    .map_err(|e| format!("Failed to get water: {e}"))?;

    let total_ml: i64 = entries.iter().map(|(_, amt, _)| amt).sum();
    let goal: i64 = sqlx::query_scalar("SELECT water_goal_ml FROM nutrition_goals WHERE id = 1")
        .fetch_one(pool).await.unwrap_or(2000);

    Ok(json!({
        "totalMl": total_ml.max(0),
        "goalMl": goal,
        "progress": if goal > 0 { (total_ml.max(0) as f64 / goal as f64 * 100.0 * 10.0).round() / 10.0 } else { 0.0 },
        "entries": entries.into_iter().map(|(id, amt, ts)| json!({"id": id, "amountMl": amt, "loggedAt": ts})).collect::<Vec<_>>()
    }))
}

async fn get_nutrition_goals(pool: &SqlitePool) -> Result<Value, String> {
    let row = sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
        "SELECT water_goal_ml, calorie_goal, protein_goal_g, carbs_goal_g, fat_goal_g FROM nutrition_goals WHERE id = 1"
    )
    .fetch_optional(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    match row {
        Some((water, cal, protein, carbs, fat)) => Ok(json!({
            "waterGoalMl": water, "calorieGoal": cal,
            "proteinGoalG": protein, "carbsGoalG": carbs, "fatGoalG": fat,
            "data_coverage": 1.0
        })),
        None => Ok(json!({
            "waterGoalMl": 2000, "calorieGoal": 2000,
            "proteinGoalG": 50, "carbsGoalG": 250, "fatGoalG": 65,
            "data_coverage": 0.0
        })),
    }
}

async fn update_nutrition_goals(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let mut cols: Vec<&str> = Vec::new();
    if args.get("water_goal_ml").is_some() { cols.push("water_goal_ml = ?"); }
    if args.get("calorie_goal").is_some() { cols.push("calorie_goal = ?"); }
    if args.get("protein_goal_g").is_some() { cols.push("protein_goal_g = ?"); }
    if args.get("carbs_goal_g").is_some() { cols.push("carbs_goal_g = ?"); }
    if args.get("fat_goal_g").is_some() { cols.push("fat_goal_g = ?"); }
    if cols.is_empty() { return Err("No goals to update.".to_string()); }

    let now_ms = time::now_ms();
    cols.push("updated_at = ?");
    let sql = format!("UPDATE nutrition_goals SET {} WHERE id = 1", cols.join(", "));
    let mut query = sqlx::query(&sql);

    if let Some(v) = args["water_goal_ml"].as_i64() { query = query.bind(v); }
    if let Some(v) = args["calorie_goal"].as_i64() { query = query.bind(v); }
    if let Some(v) = args["protein_goal_g"].as_i64() { query = query.bind(v); }
    if let Some(v) = args["carbs_goal_g"].as_i64() { query = query.bind(v); }
    if let Some(v) = args["fat_goal_g"].as_i64() { query = query.bind(v); }
    query = query.bind(now_ms);

    query.execute(pool).await.map_err(|e| format!("Failed to update goals: {e}"))?;

    Ok(json!({ "data_coverage": 1.0, "message": "Nutrition goals updated." }))
}

async fn get_nutrition_today(pool: &SqlitePool) -> Result<Value, String> {
    let meals = get_today_meals(pool).await?;
    let water = get_water_today(pool).await?;
    let goals = get_nutrition_goals(pool).await?;

    let total_kcal: i64 = meals["meals"].as_array().map(|arr| {
        arr.iter().filter_map(|m| m["totalKcal"].as_i64()).sum()
    }).unwrap_or(0);

    Ok(json!({
        "meals": meals["meals"],
        "mealCount": meals["count"],
        "water": water,
        "totalCalories": total_kcal,
        "goals": goals,
        "data_coverage": 1.0
    }))
}
