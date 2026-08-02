// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use chrono::Datelike;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::util::time;
use super::super::chat::ToolDefinition;

pub fn definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "list_budget_categories".into(),
            description: "List all budget categories with their monthly budget, current month spending, and remaining amount.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "create_budget_category".into(),
            description: "Create a new budget category for tracking expenses and income.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Category name (required)"},
                    "group_name": {"type": "string", "description": "Group name, e.g. 'Housing', 'Food', 'Transport'"},
                    "icon": {"type": "string", "description": "Icon name"},
                    "color": {"type": "string", "description": "Hex color code"}
                },
                "required": ["name"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "add_transaction".into(),
            description: "Add a new financial transaction (income or expense). Amount must be positive. Use negative amounts in note if needed.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "category_id": {"type": "string", "description": "Category ID (use 'uncategorized' if none)"},
                    "amount": {"type": "number", "description": "Transaction amount (positive number, required)"},
                    "type": {"type": "string", "enum": ["income", "expense"], "description": "Transaction type (required)"},
                    "note": {"type": "string", "description": "Description or merchant name"},
                    "date_key": {"type": "string", "description": "Date in YYYY-MM-DD format, defaults to today"},
                    "project": {"type": "string", "description": "Optional project tag"}
                },
                "required": ["category_id", "amount", "type"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_transactions".into(),
            description: "List transactions for a given month with optional pagination.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "YYYY-MM format, defaults to current month"},
                    "limit": {"type": "integer", "description": "Max results (default 50, max 500)"},
                    "offset": {"type": "integer", "description": "Result offset for pagination"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_transaction".into(),
            description: "Permanently delete a transaction by its ID.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "string", "description": "The unique ID of the transaction to delete"}
                },
                "required": ["transaction_id"]
            }),
            auto_execute: false,
        },
        ToolDefinition {
            name: "get_monthly_overview".into(),
            description: "Get a monthly financial overview: total income, expenses, net savings, savings rate, and top spending categories.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "month": {"type": "string", "description": "YYYY-MM format, defaults to current month"}
                }
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "list_bills".into(),
            description: "List all active recurring bills with their due day, amount, and current month payment status.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {}
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "add_bill".into(),
            description: "Add a new recurring bill with name, amount, due day of month, and optional category.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Bill name (required)"},
                    "amount": {"type": "number", "description": "Bill amount (required)"},
                    "due_day": {"type": "integer", "description": "Day of month due (1-31, required)"},
                    "category_id": {"type": "string", "description": "Optional category ID"},
                    "auto_pay": {"type": "boolean", "description": "Whether the bill is auto-paid"}
                },
                "required": ["name", "amount", "due_day"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "toggle_bill_paid".into(),
            description: "Toggle a bill's paid/unpaid status for the current month.".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "bill_id": {"type": "string", "description": "The unique ID of the bill"}
                },
                "required": ["bill_id"]
            }),
            auto_execute: true,
        },
        ToolDefinition {
            name: "delete_bill".into(),
            description: "Soft-delete a recurring bill (deactivates it without removing history).".into(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "bill_id": {"type": "string", "description": "The unique ID of the bill to delete"}
                },
                "required": ["bill_id"]
            }),
            auto_execute: false,
        },
    ]
}

pub async fn try_execute(name: &str, args: &Value, pool: &SqlitePool) -> Result<Option<Value>, String> {
    match name {
        "list_budget_categories" => Ok(Some(list_categories(pool).await?)),
        "create_budget_category" => Ok(Some(create_category(args, pool).await?)),
        "add_transaction" => Ok(Some(add_transaction(args, pool).await?)),
        "list_transactions" => Ok(Some(list_transactions(args, pool).await?)),
        "delete_transaction" => Ok(Some(delete_transaction(args, pool).await?)),
        "get_monthly_overview" => Ok(Some(monthly_overview(args, pool).await?)),
        "list_bills" => Ok(Some(list_bills(pool).await?)),
        "add_bill" => Ok(Some(add_bill(args, pool).await?)),
        "toggle_bill_paid" => Ok(Some(toggle_bill_paid(args, pool).await?)),
        "delete_bill" => Ok(Some(delete_bill(args, pool).await?)),
        _ => Ok(None),
    }
}

fn current_month() -> String {
    let now = chrono::Utc::now();
    format!("{:04}-{:02}", now.year(), now.month())
}

async fn list_categories(pool: &SqlitePool) -> Result<Value, String> {
    let month = current_month();
    let month_pattern = format!("{}%", month);

    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, i64, Option<String>)>(
        "SELECT c.id, c.name, c.group_name, c.icon, c.monthly_budget, c.color FROM budget_categories c ORDER BY c.group_name, c.name"
    )
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let mut categories = Vec::new();
    for (id, name, group, icon, budget, color) in rows {
        let spent: f64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE category_id = ? AND tx_type = 'expense' AND date_key LIKE ?"
        )
        .bind(&id).bind(&month_pattern)
        .fetch_one(pool).await.unwrap_or(0.0);

        categories.push(json!({
            "id": id, "name": name, "group": group, "icon": icon,
            "monthlyBudget": budget, "color": color,
            "spentThisMonth": (spent * 100.0).round() / 100.0,
            "remaining": (budget as f64 - spent).max(0.0)
        }));
    }

    Ok(json!({ "categories": categories, "count": categories.len() }))
}

async fn create_category(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?;
    let id = Uuid::new_v4().to_string();
    let group = args["group_name"].as_str().unwrap_or("Other");
    let icon = args["icon"].as_str().unwrap_or("wallet");
    let color = args["color"].as_str().unwrap_or("#6366f1");
    let now_ms = time::now_ms();

    sqlx::query(
        "INSERT INTO budget_categories (id, name, group_name, icon, monthly_budget, color, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)"
    )
    .bind(&id).bind(name).bind(group).bind(icon).bind(color).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to create category: {e}"))?;

    Ok(json!({ "id": id, "name": name, "data_coverage": 1.0, "message": format!("Category \"{name}\" created.") }))
}

async fn add_transaction(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let category_id = args["category_id"].as_str().ok_or("category_id is required")?;
    let amount = args["amount"].as_f64().ok_or("amount is required")?;
    let tx_type = args["type"].as_str().ok_or("type is required")?;
    if amount < 0.0 { return Err("Amount must be positive.".to_string()); }
    if tx_type != "income" && tx_type != "expense" { return Err("type must be 'income' or 'expense'.".to_string()); }

    let id = Uuid::new_v4().to_string();
    let note = args["note"].as_str().unwrap_or("");
    let project = args["project"].as_str().unwrap_or("");
    let cm = current_month();
    let date_key = args["date_key"].as_str().unwrap_or(&cm);
    let now_ms = time::now_ms();

    sqlx::query(
        "INSERT INTO budget_transactions (id, category_id, amount, tx_type, note, date_key, project, recurring, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)"
    )
    .bind(&id).bind(category_id).bind(amount).bind(tx_type).bind(note).bind(date_key).bind(project).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to add transaction: {e}"))?;

    Ok(json!({ "id": id, "amount": amount, "type": tx_type, "data_coverage": 1.0, "message": format!("{tx_type} of ${:.2} recorded.", amount) }))
}

async fn list_transactions(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let cm = current_month();
    let month = args["month"].as_str().unwrap_or(&cm);
    let limit = args["limit"].as_i64().unwrap_or(50).min(500);
    let offset = args["offset"].as_i64().unwrap_or(0);
    let pattern = format!("{}%", month);

    let rows = sqlx::query_as::<_, (String, Option<String>, f64, String, Option<String>, String, Option<String>, i64)>(
        "SELECT t.id, c.name as category_name, t.amount, t.tx_type, t.note, t.date_key, t.project, t.created_at FROM budget_transactions t LEFT JOIN budget_categories c ON c.id = t.category_id WHERE t.date_key LIKE ? ORDER BY t.date_key DESC, t.created_at DESC LIMIT ? OFFSET ?"
    )
    .bind(&pattern).bind(limit).bind(offset)
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let transactions: Vec<Value> = rows.into_iter().map(|(id, cat, amount, tx_type, note, date, project, created)| {
        json!({"id": id, "category": cat, "amount": amount, "type": tx_type, "note": note, "date": date, "project": project, "createdAt": created})
    }).collect();

    Ok(json!({ "transactions": transactions, "count": transactions.len(), "month": month }))
}

async fn delete_transaction(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let tx_id = args["transaction_id"].as_str().ok_or("transaction_id is required")?;
    sqlx::query("DELETE FROM budget_transactions WHERE id = ?").bind(tx_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to delete transaction: {e}"))?;
    Ok(json!({ "id": tx_id, "data_coverage": 1.0, "message": "Transaction deleted." }))
}

async fn monthly_overview(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let month = args["month"].as_str().map(|s| s.to_string()).unwrap_or_else(current_month);
    let pattern = format!("{}%", month);

    let income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?"
    )
    .bind(&pattern).fetch_one(pool).await.unwrap_or(0.0);

    let expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key LIKE ?"
    )
    .bind(&pattern).fetch_one(pool).await.unwrap_or(0.0);

    let net = income - expenses;
    let savings_rate = if income > 0.0 { ((net / income) * 100.0 * 100.0).round() / 100.0 } else { 0.0 };

    let top_cats: Vec<(Option<String>, f64)> = sqlx::query_as(
        "SELECT c.name, COALESCE(SUM(t.amount), 0.0) as total FROM budget_transactions t LEFT JOIN budget_categories c ON c.id = t.category_id WHERE t.tx_type = 'expense' AND t.date_key LIKE ? GROUP BY c.name ORDER BY total DESC LIMIT 5"
    )
    .bind(&pattern).fetch_all(pool).await.unwrap_or_default();

    Ok(json!({
        "month": month,
        "totalIncome": (income * 100.0).round() / 100.0,
        "totalExpenses": (expenses * 100.0).round() / 100.0,
        "netSavings": (net * 100.0).round() / 100.0,
        "savingsRate": savings_rate,
        "topCategories": top_cats.into_iter().map(|(name, total)| json!({"category": name, "amount": (total * 100.0).round() / 100.0})).collect::<Vec<_>>(),
        "data_coverage": 1.0
    }))
}

async fn list_bills(pool: &SqlitePool) -> Result<Value, String> {
    let month = current_month();
    let month_pattern = format!("{}%", month);

    let rows = sqlx::query_as::<_, (String, String, f64, i64, Option<String>, bool, bool)>(
        "SELECT b.id, b.name, b.amount, b.due_day, c.name as category_name, b.auto_pay, CASE WHEN bp.id IS NOT NULL THEN 1 ELSE 0 END as paid_this_month FROM budget_bills b LEFT JOIN budget_categories c ON c.id = b.category_id LEFT JOIN budget_bill_payments bp ON bp.bill_id = b.id AND bp.date_key LIKE ? WHERE b.active = 1 ORDER BY b.due_day, b.name"
    )
    .bind(&month_pattern)
    .fetch_all(pool).await
    .map_err(|e| format!("DB error: {e}"))?;

    let bills: Vec<Value> = rows.into_iter().map(|(id, name, amount, due_day, cat, auto_pay, paid)| {
        json!({"id": id, "name": name, "amount": amount, "dueDay": due_day, "category": cat, "autoPay": auto_pay, "paidThisMonth": paid})
    }).collect();

    Ok(json!({ "bills": bills, "count": bills.len() }))
}

async fn add_bill(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let name = args["name"].as_str().ok_or("name is required")?;
    let amount = args["amount"].as_f64().ok_or("amount is required")?;
    let due_day = args["due_day"].as_i64().ok_or("due_day is required")?;
    if !(1..=31).contains(&due_day) { return Err("due_day must be between 1 and 31.".to_string()); }

    let id = Uuid::new_v4().to_string();
    let category_id = args["category_id"].as_str().unwrap_or("");
    let auto_pay = args["auto_pay"].as_bool().unwrap_or(false);
    let now_ms = time::now_ms();

    sqlx::query(
        "INSERT INTO budget_bills (id, name, amount, due_day, category_id, auto_pay, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)"
    )
    .bind(&id).bind(name).bind(amount).bind(due_day).bind(category_id).bind(auto_pay).bind(now_ms)
    .execute(pool).await
    .map_err(|e| format!("Failed to add bill: {e}"))?;

    Ok(json!({ "id": id, "name": name, "amount": amount, "dueDay": due_day, "data_coverage": 1.0, "message": format!("Bill \"{name}\" added.") }))
}

async fn toggle_bill_paid(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let bill_id = args["bill_id"].as_str().ok_or("bill_id is required")?;
    let month = current_month();

    let existing: Option<String> = sqlx::query_scalar("SELECT id FROM budget_bill_payments WHERE bill_id = ? AND date_key = ?")
        .bind(bill_id).bind(&month)
        .fetch_optional(pool).await
        .map_err(|e| format!("DB error: {e}"))?;

    if let Some(payment_id) = existing {
        sqlx::query("DELETE FROM budget_bill_payments WHERE id = ?").bind(&payment_id)
            .execute(pool).await.ok();
        Ok(json!({ "billId": bill_id, "paid": false, "data_coverage": 1.0, "message": "Bill marked as unpaid." }))
    } else {
        let id = Uuid::new_v4().to_string();
        let now_ms = time::now_ms();
        let amount: f64 = sqlx::query_scalar("SELECT amount FROM budget_bills WHERE id = ?")
            .bind(bill_id).fetch_one(pool).await.unwrap_or(0.0);
        sqlx::query("INSERT INTO budget_bill_payments (id, bill_id, amount, paid_at, date_key) VALUES (?, ?, ?, ?, ?)")
            .bind(&id).bind(bill_id).bind(amount).bind(now_ms).bind(&month)
            .execute(pool).await
            .map_err(|e| format!("Failed to mark bill paid: {e}"))?;
        Ok(json!({ "billId": bill_id, "paid": true, "data_coverage": 1.0, "message": "Bill marked as paid." }))
    }
}

async fn delete_bill(args: &Value, pool: &SqlitePool) -> Result<Value, String> {
    let bill_id = args["bill_id"].as_str().ok_or("bill_id is required")?;
    sqlx::query("DELETE FROM budget_bill_payments WHERE bill_id = ?").bind(bill_id).execute(pool).await.ok();
    sqlx::query("UPDATE budget_bills SET active = 0 WHERE id = ?").bind(bill_id)
        .execute(pool).await
        .map_err(|e| format!("Failed to deactivate bill: {e}"))?;
    Ok(json!({ "id": bill_id, "data_coverage": 1.0, "message": "Bill deactivated." }))
}
