// ─────────────────────────────────────────────────────────────────────────────
// Budget / Intelligent Budget Planner — Tauri Commands (SQLite)
// Tables:
//   budget_categories      (id, name, group_name, icon, monthly_budget, color, created_at)
//   budget_transactions    (id, category_id, amount, type, note, date_key, project, recurring, created_at)
//   budget_bills           (id, name, amount, due_day, category_id, auto_pay, active, created_at)
//   budget_bill_payments   (id, bill_id, amount, paid_at, date_key)
//   budget_ai_costs        (id, provider, model, cost, tokens_in, tokens_out, date_key, note)
//   budget_templates       (id, name, total_income, created_at)
//   budget_template_items  (id, template_id, category_name, amount)
//   budget_monthly_summary (id, year_month, total_income, total_expenses, generated_at)
// ─────────────────────────────────────────────────────────────────────────────

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::db::BentoAppState;
use crate::util::time;

// ── Date helpers ────────────────────────────────────────────────────────────

fn today_key() -> String {
    time::date_key(time::now_ms())
}

fn current_year_month() -> String {
    let now = chrono::Utc::now();
    now.format("%Y-%m").to_string()
}

// ═════════════════════════════════════════════════════════════════════════════
// SHARED TYPES
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetCategory {
    pub id: String,
    pub name: String,
    pub group_name: String,
    pub icon: String,
    pub monthly_budget: f64,
    pub color: String,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetCategoryWithSpending {
    pub id: String,
    pub name: String,
    pub group_name: String,
    pub icon: String,
    pub monthly_budget: f64,
    pub color: String,
    pub spent: f64,
    pub remaining: f64,
    pub percent_used: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: f64,
    pub tx_type: String, // "income" | "expense"
    pub note: Option<String>,
    pub date_key: String,
    pub project: Option<String>,
    pub recurring: bool,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    pub category_id: Option<String>,
    pub amount: f64,
    pub tx_type: String,
    pub note: Option<String>,
    pub date_key: Option<String>,
    pub project: Option<String>,
    pub recurring: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Bill {
    pub id: String,
    pub name: String,
    pub amount: f64,
    pub due_day: u8,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub auto_pay: bool,
    pub active: bool,
    pub created_at: i64,
    pub paid_this_month: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewBill {
    pub name: String,
    pub amount: f64,
    pub due_day: u8,
    pub category_id: Option<String>,
    pub auto_pay: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCostEntry {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub cost: f64,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub date_key: String,
    pub note: Option<String>,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewAiCostEntry {
    pub provider: String,
    pub model: String,
    pub cost: f64,
    pub tokens_in: u64,
    pub tokens_out: u64,
    pub date_key: Option<String>,
    pub note: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyOverview {
    pub year_month: String,
    pub total_income: f64,
    pub total_expenses: f64,
    pub previous_month_income: f64,
    pub net_savings: f64,
    pub savings_rate: f64,
    pub top_categories: Vec<CategorySpending>,
    pub transaction_count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySpending {
    pub category_id: String,
    pub category_name: String,
    pub icon: String,
    pub color: String,
    pub spent: f64,
    pub budget: f64,
    pub percent_used: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CashFlowProjection {
    pub month: String,
    pub projected_income: f64,
    pub projected_expenses: f64,
    pub projected_balance: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCostSummary {
    pub provider: String,
    pub total_cost: f64,
    pub total_tokens_in: u64,
    pub total_tokens_out: u64,
    pub month_count: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetTemplate {
    pub id: String,
    pub name: String,
    pub total_income: f64,
    pub created_at: i64,
    pub items: Vec<TemplateItem>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateItem {
    pub id: String,
    pub category_name: String,
    pub amount: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinancialHealthScore {
    pub score: u8,
    pub savings_rate_grade: String,
    pub budget_adherence: String,
    pub bill_payment_rate: String,
    pub debt_income_ratio: String,
    pub insights: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrossModuleSpending {
    pub grocery_spending: f64,
    pub reading_spending: f64,
    pub ai_cost_total: f64,
    pub total_cross_module: f64,
}

// ═════════════════════════════════════════════════════════════════════════════
// CATEGORY COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedBudget {
    pub category_id: String,
    pub category_name: String,
    pub group_name: String,
    pub icon: String,
    pub color: String,
    pub average_spent: f64,
    pub suggested_budget: f64,
    pub current_budget: f64,
    pub months_of_data: u64,
}

#[tauri::command]
pub async fn budget_suggest_limits(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<SuggestedBudget>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    // Calculate the date 3 months ago
    let three_months_ago = {
        let now = chrono::Utc::now();
        let past = now - chrono::Months::new(3);
        past.format("%Y-%m-%d").to_string()
    };

    use sqlx::Row;

    // Get all expense transactions grouped by category over the last 3 months
    let rows = sqlx::query(
        r#"SELECT
            c.id, c.name, c.group_name, c.icon, c.color, c.monthly_budget,
            COALESCE(SUM(t.amount), 0.0) AS total_spent,
            COUNT(DISTINCT substr(t.date_key,1,7)) AS active_months
         FROM budget_categories c
         LEFT JOIN budget_transactions t ON t.category_id = c.id
            AND t.tx_type = 'expense'
            AND t.date_key >= ?
         GROUP BY c.id
         ORDER BY total_spent DESC"#,
    )
    .bind(&three_months_ago)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let now = chrono::Utc::now();
    let window_start = now - chrono::Months::new(3);
    let total_months_in_window = {
        // Number of months between window_start and now (minimum 1)
        let months_diff = ((now.year() - window_start.year()) * 12 + now.month() as i32
            - window_start.month() as i32)
            .max(1);
        months_diff as u64
    };

    let suggestions: Vec<SuggestedBudget> = rows
        .into_iter()
        .map(|r| {
            let id: String = r.try_get("id").unwrap_or_default();
            let name: String = r.try_get("name").unwrap_or_default();
            let group_name: String = r.try_get("group_name").unwrap_or_default();
            let icon: String = r.try_get("icon").unwrap_or_default();
            let color: String = r.try_get("color").unwrap_or_default();
            let current_budget: f64 = r.try_get("monthly_budget").unwrap_or(0.0);
            let total_spent: f64 = r.try_get("total_spent").unwrap_or(0.0);
            let active_months: i64 = r.try_get("active_months").unwrap_or(0);

            let months = if active_months > 0 {
                active_months as u64
            } else {
                // Category exists but no spending — use window size
                1
            };

            let average_spent = if total_spent > 0.0 {
                total_spent / months as f64
            } else {
                0.0
            };

            // Round suggested budget up to the nearest "nice" number
            // with a 20% buffer above the average
            let suggested_budget = if average_spent > 0.0 {
                let with_buffer = average_spent * 1.2; // 20% buffer
                round_up_nice(with_buffer)
            } else {
                0.0
            };

            SuggestedBudget {
                category_id: id,
                category_name: name,
                group_name,
                icon,
                color,
                average_spent,
                suggested_budget,
                current_budget,
                months_of_data: total_months_in_window,
            }
        })
        .collect();

    Ok(suggestions)
}

/// Rounds a number up to the nearest "nice" budget-friendly value
fn round_up_nice(value: f64) -> f64 {
    if value <= 0.0 {
        return 0.0;
    }
    let thresholds = [
        (10.0, 5.0),
        (25.0, 10.0),
        (50.0, 25.0),
        (100.0, 50.0),
        (250.0, 100.0),
        (500.0, 250.0),
        (1000.0, 500.0),
        (2500.0, 1000.0),
        (5000.0, 2500.0),
        (10000.0, 5000.0),
    ];

    for &(threshold, step) in &thresholds {
        if value <= threshold {
            let rounded = (value / step).ceil() * step;
            return rounded.max(step); // ensure at least one step
        }
    }
    // For values above 10,000, round to nearest 5000
    (value / 5000.0).ceil() * 5000.0
}

pub async fn ensure_budget_tables(pool: &sqlx::SqlitePool) -> Result<(), String> {
    let migrations = [
        r#"CREATE TABLE IF NOT EXISTS budget_categories (
            id            TEXT    PRIMARY KEY,
            name          TEXT    NOT NULL,
            group_name    TEXT    NOT NULL DEFAULT 'Other',
            icon          TEXT    NOT NULL DEFAULT 'wallet',
            monthly_budget REAL   NOT NULL DEFAULT 0,
            color         TEXT    NOT NULL DEFAULT '#6366f1',
            created_at    INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS budget_transactions (
            id          TEXT    PRIMARY KEY,
            category_id TEXT,
            amount      REAL    NOT NULL,
            tx_type     TEXT    NOT NULL DEFAULT 'expense',
            note        TEXT,
            date_key    TEXT    NOT NULL,
            project     TEXT,
            recurring   INTEGER NOT NULL DEFAULT 0,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE SET NULL
        )"#,
        "CREATE INDEX IF NOT EXISTS idx_budget_tx_date ON budget_transactions(date_key DESC)",
        "CREATE INDEX IF NOT EXISTS idx_budget_tx_cat  ON budget_transactions(category_id)",
        "CREATE INDEX IF NOT EXISTS idx_budget_tx_type ON budget_transactions(tx_type)",
        r#"CREATE TABLE IF NOT EXISTS budget_bills (
            id          TEXT    PRIMARY KEY,
            name        TEXT    NOT NULL,
            amount      REAL    NOT NULL,
            due_day     INTEGER NOT NULL DEFAULT 1,
            category_id TEXT,
            auto_pay    INTEGER NOT NULL DEFAULT 0,
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  INTEGER NOT NULL,
            FOREIGN KEY (category_id) REFERENCES budget_categories(id) ON DELETE SET NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS budget_bill_payments (
            id       TEXT    PRIMARY KEY,
            bill_id  TEXT    NOT NULL,
            amount   REAL    NOT NULL,
            paid_at  INTEGER NOT NULL,
            date_key TEXT    NOT NULL,
            FOREIGN KEY (bill_id) REFERENCES budget_bills(id) ON DELETE CASCADE
        )"#,
        "CREATE INDEX IF NOT EXISTS idx_budget_bp_bill ON budget_bill_payments(bill_id)",
        "CREATE INDEX IF NOT EXISTS idx_budget_bp_date ON budget_bill_payments(date_key)",
        r#"CREATE TABLE IF NOT EXISTS budget_ai_costs (
            id         TEXT    PRIMARY KEY,
            provider   TEXT    NOT NULL,
            model      TEXT    NOT NULL DEFAULT '',
            cost       REAL    NOT NULL DEFAULT 0,
            tokens_in  INTEGER NOT NULL DEFAULT 0,
            tokens_out INTEGER NOT NULL DEFAULT 0,
            date_key   TEXT    NOT NULL,
            note       TEXT,
            created_at INTEGER NOT NULL
        )"#,
        "CREATE INDEX IF NOT EXISTS idx_budget_ai_date    ON budget_ai_costs(date_key)",
        "CREATE INDEX IF NOT EXISTS idx_budget_ai_provider ON budget_ai_costs(provider)",
        r#"CREATE TABLE IF NOT EXISTS budget_templates (
            id           TEXT    PRIMARY KEY,
            name         TEXT    NOT NULL,
            total_income REAL    NOT NULL DEFAULT 0,
            created_at   INTEGER NOT NULL
        )"#,
        r#"CREATE TABLE IF NOT EXISTS budget_template_items (
            id            TEXT    PRIMARY KEY,
            template_id   TEXT    NOT NULL,
            category_name TEXT    NOT NULL,
            amount        REAL    NOT NULL,
            FOREIGN KEY (template_id) REFERENCES budget_templates(id) ON DELETE CASCADE
        )"#,
        // Not used for queries directly — summary cache for dashboards
        r#"CREATE TABLE IF NOT EXISTS budget_monthly_summary (
            id             TEXT    PRIMARY KEY,
            year_month     TEXT    NOT NULL UNIQUE,
            total_income   REAL    NOT NULL DEFAULT 0,
            total_expenses REAL    NOT NULL DEFAULT 0,
            generated_at   INTEGER NOT NULL
        )"#,
    ];

    for sql in migrations {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn budget_list_categories(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<BudgetCategoryWithSpending>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let month_prefix = format!("{}%", current_year_month());

    let rows = sqlx::query(
        r#"SELECT
            c.id, c.name, c.group_name, c.icon, c.monthly_budget, c.color, c.created_at,
            COALESCE(SUM(CASE WHEN t.tx_type = 'expense' AND t.date_key LIKE ? THEN t.amount ELSE 0.0 END), 0.0) AS spent
         FROM budget_categories c
         LEFT JOIN budget_transactions t ON t.category_id = c.id
         GROUP BY c.id
         ORDER BY c.group_name, c.name"#,
    )
    .bind(&month_prefix)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    use sqlx::Row;
    let result = rows
        .into_iter()
        .map(|r| {
            let budget: f64 = r.try_get("monthly_budget").unwrap_or(0.0);
            let spent: f64 = r.try_get("spent").unwrap_or(0.0);
            let remaining = budget - spent;
            let percent = if budget > 0.0 {
                spent / budget * 100.0
            } else {
                if spent > 0.0 {
                    100.0
                } else {
                    0.0
                }
            };
            BudgetCategoryWithSpending {
                id: r.try_get("id").unwrap_or_default(),
                name: r.try_get("name").unwrap_or_default(),
                group_name: r.try_get("group_name").unwrap_or_default(),
                icon: r.try_get("icon").unwrap_or_default(),
                monthly_budget: budget,
                color: r.try_get("color").unwrap_or_default(),
                spent,
                remaining,
                percent_used: percent,
            }
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn budget_set_category_budget(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    category_id: String,
    monthly_budget: f64,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;
    sqlx::query("UPDATE budget_categories SET monthly_budget = ? WHERE id = ?")
        .bind(monthly_budget)
        .bind(&category_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn budget_create_category(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    name: String,
    group_name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<BudgetCategory, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO budget_categories (id, name, group_name, icon, monthly_budget, color, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    )
    .bind(&id)
    .bind(name.trim())
    .bind(group_name.as_deref().unwrap_or("Other"))
    .bind(icon.as_deref().unwrap_or("wallet"))
    .bind(color.as_deref().unwrap_or("#6366f1"))
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(BudgetCategory {
        id,
        name,
        group_name: group_name.unwrap_or_else(|| "Other".into()),
        icon: icon.unwrap_or_else(|| "wallet".into()),
        monthly_budget: 0.0,
        color: color.unwrap_or_else(|| "#6366f1".into()),
        created_at: now,
    })
}

#[tauri::command]
pub async fn budget_update_category(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    category_id: String,
    name: String,
    group_name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    sqlx::query(
        "UPDATE budget_categories SET name = ?, group_name = ?, icon = ?, color = ? WHERE id = ?",
    )
    .bind(name.trim())
    .bind(group_name.as_deref().unwrap_or("Other"))
    .bind(icon.as_deref().unwrap_or("wallet"))
    .bind(color.as_deref().unwrap_or("#6366f1"))
    .bind(&category_id)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn budget_delete_category(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    category_id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    // Set FK references to NULL first, then delete
    sqlx::query("UPDATE budget_transactions SET category_id = NULL WHERE category_id = ?")
        .bind(&category_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("UPDATE budget_bills SET category_id = NULL WHERE category_id = ?")
        .bind(&category_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DELETE FROM budget_categories WHERE id = ?")
        .bind(&category_id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// TRANSACTION COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_add_transaction(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    tx: NewTransaction,
) -> Result<Transaction, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let date = tx.date_key.unwrap_or_else(today_key);

    if tx.amount < 0.0 {
        return Err("Amount cannot be negative.".into());
    }
    if tx.tx_type != "income" && tx.tx_type != "expense" {
        return Err("Transaction type must be 'income' or 'expense'.".into());
    }

    sqlx::query(
        "INSERT INTO budget_transactions (id, category_id, amount, tx_type, note, date_key, project, recurring, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&tx.category_id)
    .bind(tx.amount)
    .bind(&tx.tx_type)
    .bind(&tx.note)
    .bind(&date)
    .bind(&tx.project)
    .bind(tx.recurring as i64)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let cat_name: Option<String> = if let Some(ref cid) = tx.category_id {
        sqlx::query_scalar("SELECT name FROM budget_categories WHERE id = ?")
            .bind(cid)
            .fetch_optional(&state.db())
            .await
            .map_err(|e| e.to_string())?
    } else {
        None
    };

    Ok(Transaction {
        id,
        category_id: tx.category_id,
        category_name: cat_name,
        amount: tx.amount,
        tx_type: tx.tx_type,
        note: tx.note,
        date_key: date,
        project: tx.project,
        recurring: tx.recurring,
        created_at: now,
    })
}

#[tauri::command]
pub async fn budget_list_transactions(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    month: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<Transaction>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let month_filter = month.unwrap_or_else(current_year_month);
    let pattern = format!("{}%", month_filter);
    let lim = limit.unwrap_or(100).clamp(1, 1000);
    let off = offset.unwrap_or(0).max(0);

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT t.id, t.category_id, c.name AS category_name, t.amount, t.tx_type,
                  t.note, t.date_key, t.project, t.recurring, t.created_at
           FROM budget_transactions t
           LEFT JOIN budget_categories c ON c.id = t.category_id
           WHERE t.date_key LIKE ?
           ORDER BY t.date_key DESC, t.created_at DESC
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern)
    .bind(lim)
    .bind(off)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| Transaction {
            id: r.try_get("id").unwrap_or_default(),
            category_id: r.try_get("category_id").unwrap_or(None),
            category_name: r.try_get("category_name").unwrap_or(None),
            amount: r.try_get("amount").unwrap_or(0.0),
            tx_type: r.try_get("tx_type").unwrap_or_default(),
            note: r.try_get("note").unwrap_or(None),
            date_key: r.try_get("date_key").unwrap_or_default(),
            project: r.try_get("project").unwrap_or(None),
            recurring: r.try_get::<i64, _>("recurring").unwrap_or(0) != 0,
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn budget_delete_transaction(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;
    sqlx::query("DELETE FROM budget_transactions WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn budget_update_transaction(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
    tx: NewTransaction,
) -> Result<Transaction, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    if tx.amount < 0.0 {
        return Err("Amount cannot be negative.".into());
    }
    if tx.tx_type != "income" && tx.tx_type != "expense" {
        return Err("Transaction type must be 'income' or 'expense'.".into());
    }

    let date = tx.date_key.unwrap_or_else(today_key);

    sqlx::query(
        "UPDATE budget_transactions SET category_id = ?, amount = ?, tx_type = ?, note = ?, date_key = ?, project = ?, recurring = ? WHERE id = ?",
    )
    .bind(&tx.category_id)
    .bind(tx.amount)
    .bind(&tx.tx_type)
    .bind(&tx.note)
    .bind(&date)
    .bind(&tx.project)
    .bind(tx.recurring as i64)
    .bind(&id)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Fetch the existing created_at
    let created_at: i64 = sqlx::query_scalar("SELECT created_at FROM budget_transactions WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.db())
        .await
        .map_err(|e| e.to_string())?;

    let cat_name: Option<String> = if let Some(ref cid) = tx.category_id {
        sqlx::query_scalar("SELECT name FROM budget_categories WHERE id = ?")
            .bind(cid)
            .fetch_optional(&state.db())
            .await
            .map_err(|e| e.to_string())?
    } else {
        None
    };

    Ok(Transaction {
        id,
        category_id: tx.category_id,
        category_name: cat_name,
        amount: tx.amount,
        tx_type: tx.tx_type,
        note: tx.note,
        date_key: date,
        project: tx.project,
        recurring: tx.recurring,
        created_at,
    })
}

// ═════════════════════════════════════════════════════════════════════════════
// BILLS COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_add_bill(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    bill: NewBill,
) -> Result<Bill, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    if bill.name.trim().is_empty() {
        return Err("Bill name is required.".into());
    }
    if bill.amount < 0.0 {
        return Err("Amount cannot be negative.".into());
    }
    let due = bill.due_day.clamp(1, 31);

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO budget_bills (id, name, amount, due_day, category_id, auto_pay, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
    )
    .bind(&id)
    .bind(bill.name.trim())
    .bind(bill.amount)
    .bind(due as i64)
    .bind(&bill.category_id)
    .bind(bill.auto_pay as i64)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let cat_name: Option<String> = if let Some(ref cid) = bill.category_id {
        sqlx::query_scalar("SELECT name FROM budget_categories WHERE id = ?")
            .bind(cid)
            .fetch_optional(&state.db())
            .await
            .map_err(|e| e.to_string())?
    } else {
        None
    };

    Ok(Bill {
        id,
        name: bill.name,
        amount: bill.amount,
        due_day: due,
        category_id: bill.category_id,
        category_name: cat_name,
        auto_pay: bill.auto_pay,
        active: true,
        created_at: now,
        paid_this_month: false,
    })
}

#[tauri::command]
pub async fn budget_list_bills(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<Bill>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let month_prefix = format!("{}%", current_year_month());

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT b.id, b.name, b.amount, b.due_day, b.category_id, c.name AS category_name,
                  b.auto_pay, b.active, b.created_at,
                  CASE WHEN bp.id IS NOT NULL THEN 1 ELSE 0 END AS paid_this_month
           FROM budget_bills b
           LEFT JOIN budget_categories c ON c.id = b.category_id
           LEFT JOIN budget_bill_payments bp ON bp.bill_id = b.id AND bp.date_key LIKE ?
           WHERE b.active = 1
           ORDER BY b.due_day, b.name"#,
    )
    .bind(&month_prefix)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| Bill {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            amount: r.try_get("amount").unwrap_or(0.0),
            due_day: r.try_get::<i64, _>("due_day").unwrap_or(1) as u8,
            category_id: r.try_get("category_id").unwrap_or(None),
            category_name: r.try_get("category_name").unwrap_or(None),
            auto_pay: r.try_get::<i64, _>("auto_pay").unwrap_or(0) != 0,
            active: r.try_get::<i64, _>("active").unwrap_or(1) != 0,
            created_at: r.try_get("created_at").unwrap_or(0),
            paid_this_month: r.try_get::<i64, _>("paid_this_month").unwrap_or(0) != 0,
        })
        .collect())
}

#[tauri::command]
pub async fn budget_toggle_bill_paid(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    bill_id: String,
) -> Result<bool, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let date = today_key();

    // Check if already paid this month
    let existing =
        sqlx::query("SELECT id FROM budget_bill_payments WHERE bill_id = ? AND date_key = ?")
            .bind(&bill_id)
            .bind(&date)
            .fetch_optional(&state.db())
            .await
            .map_err(|e| e.to_string())?;

    if existing.is_some() {
        // Unpay
        sqlx::query("DELETE FROM budget_bill_payments WHERE bill_id = ? AND date_key = ?")
            .bind(&bill_id)
            .bind(&date)
            .execute(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        // Mark paid
        let id = Uuid::new_v4().to_string();
        let now = time::now_ms();
        let amount: f64 = sqlx::query_scalar("SELECT amount FROM budget_bills WHERE id = ?")
            .bind(&bill_id)
            .fetch_one(&state.db())
            .await
            .map_err(|e| e.to_string())?;
        sqlx::query(
            "INSERT INTO budget_bill_payments (id, bill_id, amount, paid_at, date_key) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&bill_id)
        .bind(amount)
        .bind(now)
        .bind(&date)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn budget_delete_bill(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;
    sqlx::query("DELETE FROM budget_bill_payments WHERE bill_id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE budget_bills SET active = 0 WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// AI COSTS COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_add_ai_cost(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    entry: NewAiCostEntry,
) -> Result<AiCostEntry, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    if entry.provider.trim().is_empty() {
        return Err("Provider name is required.".into());
    }
    if entry.cost < 0.0 {
        return Err("Cost cannot be negative.".into());
    }

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();
    let date = entry.date_key.unwrap_or_else(today_key);

    sqlx::query(
        "INSERT INTO budget_ai_costs (id, provider, model, cost, tokens_in, tokens_out, date_key, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(entry.provider.trim())
    .bind(&entry.model)
    .bind(entry.cost)
    .bind(entry.tokens_in as i64)
    .bind(entry.tokens_out as i64)
    .bind(&date)
    .bind(&entry.note)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(AiCostEntry {
        id,
        provider: entry.provider,
        model: entry.model,
        cost: entry.cost,
        tokens_in: entry.tokens_in,
        tokens_out: entry.tokens_out,
        date_key: date,
        note: entry.note,
        created_at: now,
    })
}

#[tauri::command]
pub async fn budget_list_ai_costs(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    month: Option<String>,
) -> Result<Vec<AiCostEntry>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let pattern = if let Some(ref m) = month {
        format!("{}%", m)
    } else {
        format!("{}%", current_year_month())
    };

    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, provider, model, cost, tokens_in, tokens_out, date_key, note, created_at
         FROM budget_ai_costs WHERE date_key LIKE ?
         ORDER BY date_key DESC, created_at DESC",
    )
    .bind(&pattern)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| AiCostEntry {
            id: r.try_get("id").unwrap_or_default(),
            provider: r.try_get("provider").unwrap_or_default(),
            model: r.try_get("model").unwrap_or_default(),
            cost: r.try_get("cost").unwrap_or(0.0),
            tokens_in: r.try_get::<i64, _>("tokens_in").unwrap_or(0) as u64,
            tokens_out: r.try_get::<i64, _>("tokens_out").unwrap_or(0) as u64,
            date_key: r.try_get("date_key").unwrap_or_default(),
            note: r.try_get("note").unwrap_or(None),
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

#[tauri::command]
pub async fn budget_ai_cost_summary(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<AiCostSummary>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT provider,
                  SUM(cost) AS total_cost,
                  SUM(tokens_in) AS total_tokens_in,
                  SUM(tokens_out) AS total_tokens_out,
                  COUNT(DISTINCT substr(date_key,1,7)) AS month_count
           FROM budget_ai_costs
           GROUP BY provider
           ORDER BY total_cost DESC"#,
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| AiCostSummary {
            provider: r.try_get("provider").unwrap_or_default(),
            total_cost: r.try_get("total_cost").unwrap_or(0.0),
            total_tokens_in: r.try_get::<i64, _>("total_tokens_in").unwrap_or(0) as u64,
            total_tokens_out: r.try_get::<i64, _>("total_tokens_out").unwrap_or(0) as u64,
            month_count: r.try_get::<i64, _>("month_count").unwrap_or(0) as u64,
        })
        .collect())
}

#[tauri::command]
pub async fn budget_delete_ai_cost(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;
    sqlx::query("DELETE FROM budget_ai_costs WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD / OVERVIEW COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_monthly_overview(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    month: Option<String>,
) -> Result<MonthlyOverview, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let ym = month.unwrap_or_else(current_year_month);
    let pattern = format!("{}%", ym);

    // Total income
    let total_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    )
    .bind(&pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Total expenses
    let total_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key LIKE ?",
    )
    .bind(&pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let net = total_income - total_expenses;
    let savings_rate = if total_income > 0.0 {
        net / total_income * 100.0
    } else {
        0.0
    };

    // Previous month income (for trend indicator)
    let prev_ym = previous_year_month(&ym);
    let prev_pattern = format!("{}%", prev_ym);
    let previous_month_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    )
    .bind(&prev_pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Transaction count
    let tx_count: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM budget_transactions WHERE date_key LIKE ?",
    )
    .bind(&pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Top spending categories
    use sqlx::Row;
    let cat_rows = sqlx::query(
        r#"SELECT c.id, c.name, c.icon, c.color,
                  COALESCE(SUM(t.amount), 0.0) AS spent, c.monthly_budget
           FROM budget_categories c
           LEFT JOIN budget_transactions t ON t.category_id = c.id AND t.tx_type = 'expense' AND t.date_key LIKE ?
           GROUP BY c.id
           HAVING spent > 0
           ORDER BY spent DESC
           LIMIT 10"#,
    )
    .bind(&pattern)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let top_categories: Vec<CategorySpending> = cat_rows
        .into_iter()
        .map(|r| {
            let budget: f64 = r.try_get("monthly_budget").unwrap_or(0.0);
            let spent: f64 = r.try_get("spent").unwrap_or(0.0);
            let percent = if budget > 0.0 {
                spent / budget * 100.0
            } else {
                0.0
            };
            CategorySpending {
                category_id: r.try_get("id").unwrap_or_default(),
                category_name: r.try_get("name").unwrap_or_default(),
                icon: r.try_get("icon").unwrap_or_default(),
                color: r.try_get("color").unwrap_or_default(),
                spent,
                budget,
                percent_used: percent,
            }
        })
        .collect();

    Ok(MonthlyOverview {
        year_month: ym,
        total_income,
        total_expenses,
        previous_month_income,

        net_savings: net,
        savings_rate,
        top_categories,
        transaction_count: tx_count as u64,
    })
}

#[tauri::command]
pub async fn budget_financial_health(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<FinancialHealthScore, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let current_ym = current_year_month();
    let last_3_months = {
        let now = chrono::Utc::now();
        let three_months_ago = now - chrono::Months::new(3);
        three_months_ago.format("%Y-%m").to_string()
    };

    // Average savings rate over last 3 months
    let income_3: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions
         WHERE tx_type = 'income' AND date_key >= ?",
    )
    .bind(format!("{}%", last_3_months))
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let expense_3: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions
         WHERE tx_type = 'expense' AND date_key >= ?",
    )
    .bind(format!("{}%", last_3_months))
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let savings_rate_pct = if income_3 > 0.0 {
        (income_3 - expense_3) / income_3 * 100.0
    } else {
        0.0
    };

    // Budget adherence: categories where spent <= budget
    let cat_count: f64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM budget_categories WHERE monthly_budget > 0",
    )
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())? as f64;

    let cat_over: f64 = sqlx::query_scalar::<_, i64>(
        r#"SELECT COUNT(*) FROM (
            SELECT c.id, COALESCE(SUM(t.amount), 0.0) AS spent, c.monthly_budget
            FROM budget_categories c
            LEFT JOIN budget_transactions t ON t.category_id = c.id AND t.tx_type = 'expense'
                AND t.date_key LIKE ?
            GROUP BY c.id
            HAVING c.monthly_budget > 0 AND spent > c.monthly_budget
        )"#,
    )
    .bind(format!("{}%", current_ym))
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())? as f64;

    let adherence_pct = if cat_count > 0.0 {
        ((cat_count - cat_over) / cat_count * 100.0).max(0.0)
    } else {
        100.0
    };

    // Bill payment rate
    let total_due: f64 =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM budget_bills WHERE active = 1")
            .fetch_one(&state.db())
            .await
            .map_err(|e| e.to_string())? as f64;

    let month_prefix = format!("{}%", current_ym);
    let paid: f64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT bill_id) FROM budget_bill_payments WHERE date_key LIKE ?",
    )
    .bind(&month_prefix)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())? as f64;

    let bill_rate = if total_due > 0.0 {
        (paid / total_due * 100.0).min(100.0)
    } else {
        100.0
    };

    // Compute overall score
    let savings_score = (savings_rate_pct / 20.0 * 25.0).min(25.0); // 25 pts max at 20%+
    let adherence_score = (adherence_pct / 100.0 * 30.0).min(30.0); // 30 pts
    let bill_score = (bill_rate / 100.0 * 20.0).min(20.0); // 20 pts
    let base_score = savings_score + adherence_score + bill_score;
    let diversity_bonus = if cat_count >= 5.0 {
        15.0
    } else {
        (cat_count / 5.0 * 15.0).min(15.0)
    };
    let consistency_bonus = if income_3 > 0.0 { 10.0 } else { 0.0 };

    let score = (base_score + diversity_bonus + consistency_bonus).round() as u8;

    // Insights
    let mut insights = vec![];

    if savings_rate_pct >= 20.0 {
        insights.push(format!(
            "Excellent savings rate of {:.0}% — you're building strong financial security.",
            savings_rate_pct
        ));
    } else if savings_rate_pct >= 10.0 {
        insights.push(format!(
            "Good savings rate at {:.0}%. Try to push toward 20% for optimal growth.",
            savings_rate_pct
        ));
    } else if savings_rate_pct > 0.0 {
        insights.push(format!(
            "Savings rate is {:.0}%. Consider reducing discretionary spending to boost savings.",
            savings_rate_pct
        ));
    } else {
        insights.push("Your savings rate is low. Track expenses to find areas to cut back.".into());
    }

    if cat_over > 0.0 {
        insights.push(format!(
            "{} budget {} over budget this month. Review category limits.",
            cat_over as u64,
            if cat_over as u64 == 1 {
                "category is"
            } else {
                "categories are"
            }
        ));
    } else if cat_count > 0.0 {
        insights.push("All categories are within budget — great discipline!".into());
    }

    if bill_rate < 100.0 {
        insights.push(format!(
            "{:.0}% of bills paid this month. Set up auto-pay to avoid late fees.",
            bill_rate
        ));
    } else if total_due > 0.0 {
        insights.push("All bills paid on time this month — perfect record!".into());
    }

    let savings_grade = if savings_rate_pct >= 20.0 {
        "Excellent"
    } else if savings_rate_pct >= 10.0 {
        "Good"
    } else if savings_rate_pct > 0.0 {
        "Needs Work"
    } else {
        "Critical"
    };
    let adherence_grade = if adherence_pct >= 90.0 {
        "Excellent"
    } else if adherence_pct >= 70.0 {
        "Good"
    } else {
        "Needs Work"
    };
    let bill_grade = if bill_rate >= 90.0 {
        "Excellent"
    } else if bill_rate >= 70.0 {
        "Good"
    } else {
        "Needs Work"
    };
    let debt_grade = "No tracked debt"; // Simplification

    Ok(FinancialHealthScore {
        score: score.min(100),
        savings_rate_grade: savings_grade.to_string(),
        budget_adherence: adherence_grade.to_string(),
        bill_payment_rate: bill_grade.to_string(),
        debt_income_ratio: debt_grade.to_string(),
        insights,
    })
}

#[tauri::command]
pub async fn budget_cash_flow_forecast(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    months: Option<i64>,
) -> Result<Vec<CashFlowProjection>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let num_months = months.unwrap_or(6).clamp(1, 24);

    // Average monthly income and expenses over last 3 months
    let three_months_ago = {
        let now = chrono::Utc::now();
        let past = now - chrono::Months::new(3);
        past.format("%Y-%m-%d").to_string()
    };

    let avg_monthly_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) / 3.0 FROM budget_transactions
                           WHERE tx_type = 'income' AND date_key >= ?",
    )
    .bind(&three_months_ago)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let avg_monthly_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) / 3.0 FROM budget_transactions
                           WHERE tx_type = 'expense' AND date_key >= ?",
    )
    .bind(&three_months_ago)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Current balance (this month's income - expenses so far)
    let current_pattern = format!("{}%", current_year_month());
    let current_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    )
    .bind(&current_pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let current_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key LIKE ?",
    )
    .bind(&current_pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut balance = current_income - current_expenses;

    let now = chrono::Utc::now();
    let mut projections = vec![];

    for i in 0..num_months {
        let proj_month = if i == 0 {
            now
        } else {
            now + chrono::Months::new(i as u32)
        };
        let ym = proj_month.format("%Y-%m").to_string();

        let income = if i == 0 {
            avg_monthly_income.max(current_income) // Use actual + avg
        } else {
            avg_monthly_income
        };
        let expenses = if i == 0 {
            avg_monthly_expenses.max(current_expenses)
        } else {
            avg_monthly_expenses
        };

        balance = balance + income - expenses;

        projections.push(CashFlowProjection {
            month: ym,
            projected_income: income,
            projected_expenses: expenses,
            projected_balance: balance,
        });
    }

    Ok(projections)
}

// ═════════════════════════════════════════════════════════════════════════════
// FORECAST CHART DATA
// ═════════════════════════════════════════════════════════════════════════════

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForecastChartMonth {
    pub month: String,
    pub income_actual: f64,
    pub expenses_actual: f64,
    pub income_forecast: f64,
    pub expenses_forecast: f64,
    pub is_forecast: bool,
}

#[tauri::command]
pub async fn budget_forecast_chart_data(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    months: Option<i64>,
) -> Result<Vec<ForecastChartMonth>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let num_months = months.unwrap_or(6).clamp(1, 24);
    let today = chrono::Utc::now();

    // ── 1. Gather historical monthly data (actual income & expenses by month) ─
    use sqlx::Row;
    let historical_rows = sqlx::query(
        r#"SELECT
            substr(date_key,1,7) AS ym,
            COALESCE(SUM(CASE WHEN tx_type = 'income' THEN amount ELSE 0.0 END), 0.0) AS income,
            COALESCE(SUM(CASE WHEN tx_type = 'expense' THEN amount ELSE 0.0 END), 0.0) AS expenses
         FROM budget_transactions
         WHERE date_key >= ?
         GROUP BY ym
         ORDER BY ym"#,
    )
    .bind(format!(
        "{}-01",
        (today - chrono::Months::new(num_months as u32)).format("%Y-%m")
    ))
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut historical_map: std::collections::BTreeMap<String, (f64, f64)> =
        std::collections::BTreeMap::new();
    for row in &historical_rows {
        let ym: String = row.try_get("ym").unwrap_or_default();
        let income: f64 = row.try_get("income").unwrap_or(0.0);
        let expenses: f64 = row.try_get("expenses").unwrap_or(0.0);
        historical_map.insert(ym, (income, expenses));
    }

    // ── 2. Calculate averages for projection ────────────────────────────────
    let three_months_ago = (today - chrono::Months::new(3))
        .format("%Y-%m-%d")
        .to_string();
    let avg_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) / 3.0 FROM budget_transactions WHERE tx_type = 'income' AND date_key >= ?",
    )
    .bind(&three_months_ago)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let avg_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) / 3.0 FROM budget_transactions WHERE tx_type = 'expense' AND date_key >= ?",
    )
    .bind(&three_months_ago)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // ── 3. Build the combined series ────────────────────────────────────────
    let current_ym = today.format("%Y-%m").to_string();
    let mut result: Vec<ForecastChartMonth> = vec![];

    // Start N months ago (past), go up to N months ahead
    let start = today - chrono::Months::new((num_months / 2) as u32);
    let total_window = num_months as usize;

    for i in 0..total_window {
        let month_date = start + chrono::Months::new(i as u32);
        let ym = month_date.format("%Y-%m").to_string();
        let is_forecast = ym > current_ym;

        let (hist_income, hist_expenses) = historical_map.get(&ym).copied().unwrap_or((0.0, 0.0));

        // For forecast months/projection, use averages
        // For historical months, use actuals; also set forecast = actual to have a smooth transition
        let (proj_income, proj_expenses) = if is_forecast {
            (avg_income, avg_expenses)
        } else {
            (hist_income, hist_expenses) // same as actual for past months
        };

        result.push(ForecastChartMonth {
            month: ym,
            income_actual: hist_income,
            expenses_actual: hist_expenses,
            income_forecast: proj_income,
            expenses_forecast: proj_expenses,
            is_forecast,
        });
    }

    Ok(result)
}

// ═════════════════════════════════════════════════════════════════════════════
// CROSS-MODULE INTELLIGENCE
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_cross_module_spending(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<CrossModuleSpending, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    // Grocery spending — from budget transactions categorized as Groceries
    let month_pattern = format!("{}%", current_year_month());
    let grocery_spending: f64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(t.amount), 0.0)
           FROM budget_transactions t
           JOIN budget_categories c ON c.id = t.category_id
           WHERE t.tx_type = 'expense' AND t.date_key LIKE ?
           AND LOWER(c.name) IN ('groceries', 'grocery')"#,
    )
    .bind(&month_pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // AI costs total this month
    let ai_total: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(cost), 0.0) FROM budget_ai_costs WHERE date_key LIKE ?",
    )
    .bind(&month_pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    // Reading spending — from budget transactions categorized as Reading/Education
    let reading_spending: f64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(t.amount), 0.0)
           FROM budget_transactions t
           JOIN budget_categories c ON c.id = t.category_id
           WHERE t.tx_type = 'expense' AND t.date_key LIKE ?
           AND (LOWER(c.name) IN ('education', 'reading') OR LOWER(c.group_name) = 'personal')"#,
    )
    .bind(&month_pattern)
    .fetch_one(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let total = grocery_spending + ai_total + reading_spending;

    Ok(CrossModuleSpending {
        grocery_spending,
        reading_spending,
        ai_cost_total: ai_total,
        total_cross_module: total,
    })
}

// ═════════════════════════════════════════════════════════════════════════════
// TEMPLATE COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_save_template(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    name: String,
    total_income: f64,
    items: Vec<TemplateItem>,
) -> Result<BudgetTemplate, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let id = Uuid::new_v4().to_string();
    let now = time::now_ms();

    sqlx::query(
        "INSERT INTO budget_templates (id, name, total_income, created_at) VALUES (?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(name.trim())
    .bind(total_income)
    .bind(now)
    .execute(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    for item in &items {
        let item_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO budget_template_items (id, template_id, category_name, amount) VALUES (?, ?, ?, ?)",
        )
        .bind(&item_id)
        .bind(&id)
        .bind(item.category_name.trim())
        .bind(item.amount)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(BudgetTemplate {
        id,
        name,
        total_income,
        created_at: now,
        items,
    })
}

#[tauri::command]
pub async fn budget_list_templates(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
) -> Result<Vec<BudgetTemplate>, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT t.id, t.name, t.total_income, t.created_at,
                  ti.id AS item_id, ti.category_name, ti.amount
           FROM budget_templates t
           LEFT JOIN budget_template_items ti ON ti.template_id = t.id
           ORDER BY t.created_at DESC, ti.id"#,
    )
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut templates_map: std::collections::BTreeMap<String, BudgetTemplate> =
        std::collections::BTreeMap::new();
    for r in rows {
        let tid: String = r.try_get("id").unwrap_or_default();
        let entry = templates_map.entry(tid.clone()).or_insert_with(|| BudgetTemplate {
            id: tid,
            name: r.try_get("name").unwrap_or_default(),
            total_income: r.try_get("total_income").unwrap_or(0.0),
            created_at: r.try_get("created_at").unwrap_or(0),
            items: vec![],
        });
        if let Ok(item_id) = r.try_get::<String, _>("item_id") {
            if !item_id.is_empty() {
                entry.items.push(TemplateItem {
                    id: item_id,
                    category_name: r.try_get("category_name").unwrap_or_default(),
                    amount: r.try_get("amount").unwrap_or(0.0),
                });
            }
        }
    }

    Ok(templates_map.into_values().collect())
}

#[tauri::command]
pub async fn budget_delete_template(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    id: String,
) -> Result<(), String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;
    sqlx::query("DELETE FROM budget_templates WHERE id = ?")
        .bind(&id)
        .execute(&state.db())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub mod pdf_report;

// ═════════════════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_export_pdf(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    path: String,
    month: Option<String>,
) -> Result<u32, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let ym = month.unwrap_or_else(current_year_month);

    let pool = &state.db();
    let (overview, categories, health, bills, ai_entries, ai_summary, cash_flow) = tokio::join!(
        budget_monthly_overview_inner(pool, &ym),
        budget_list_categories_inner(pool),
        budget_financial_health_inner(pool),
        budget_list_bills_inner(pool),
        budget_list_ai_costs_inner(pool, &ym),
        budget_ai_cost_summary_inner(pool),
        budget_cash_flow_forecast_inner(pool, 6),
    );

    let overview = overview?;
    let categories = categories?;
    let health = health?;
    let bills = bills?;
    let ai_entries = ai_entries?;
    let ai_summary = ai_summary?;
    let cash_flow = cash_flow?;

    pdf_report::generate_report(
        &path,
        &overview,
        &categories,
        &health,
        &bills,
        &ai_entries,
        &ai_summary,
        &cash_flow,
    )
}

// ── Inner helpers that don't register as commands (used by PDF export) ─

async fn budget_monthly_overview_inner(
    pool: &sqlx::SqlitePool,
    month: &str,
) -> Result<MonthlyOverview, String> {
    let pattern = format!("{}%", month);

    let total_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    )
    .bind(&pattern)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let total_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key LIKE ?",
    )
    .bind(&pattern)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let net = total_income - total_expenses;
    let savings_rate = if total_income > 0.0 {
        net / total_income * 100.0
    } else {
        0.0
    };

    // Previous month income (for trend indicator)
    let prev_ym = previous_year_month(month);
    let prev_pattern = format!("{}%", prev_ym);
    let previous_month_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    )
    .bind(&prev_pattern)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let tx_count: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM budget_transactions WHERE date_key LIKE ?",
    )
    .bind(&pattern)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Top spending categories
    use sqlx::Row;
    let cat_rows = sqlx::query(
        r#"SELECT c.id, c.name, c.icon, c.color,
                  COALESCE(SUM(t.amount), 0.0) AS spent, c.monthly_budget
           FROM budget_categories c
           LEFT JOIN budget_transactions t ON t.category_id = c.id AND t.tx_type = 'expense' AND t.date_key LIKE ?
           GROUP BY c.id
           HAVING spent > 0
           ORDER BY spent DESC
           LIMIT 10"#,
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let top_categories: Vec<CategorySpending> = cat_rows
        .into_iter()
        .map(|r| {
            let budget: f64 = r.try_get("monthly_budget").unwrap_or(0.0);
            let spent: f64 = r.try_get("spent").unwrap_or(0.0);
            let percent = if budget > 0.0 {
                spent / budget * 100.0
            } else {
                0.0
            };
            CategorySpending {
                category_id: r.try_get("id").unwrap_or_default(),
                category_name: r.try_get("name").unwrap_or_default(),
                icon: r.try_get("icon").unwrap_or_default(),
                color: r.try_get("color").unwrap_or_default(),
                spent,
                budget,
                percent_used: percent,
            }
        })
        .collect();

    Ok(MonthlyOverview {
        year_month: month.to_string(),
        total_income,
        total_expenses,
        previous_month_income,

        net_savings: net,
        savings_rate,
        top_categories,
        transaction_count: tx_count as u64,
    })
}

async fn budget_list_categories_inner(
    pool: &sqlx::SqlitePool,
) -> Result<Vec<BudgetCategoryWithSpending>, String> {
    let month_prefix = format!("{}%", current_year_month());

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT
            c.id, c.name, c.group_name, c.icon, c.monthly_budget, c.color, c.created_at,
            COALESCE(SUM(CASE WHEN t.tx_type = 'expense' AND t.date_key LIKE ? THEN t.amount ELSE 0.0 END), 0.0) AS spent
         FROM budget_categories c
         LEFT JOIN budget_transactions t ON t.category_id = c.id
         GROUP BY c.id
         ORDER BY spent DESC"#,
    )
    .bind(&month_prefix)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let budget: f64 = r.try_get("monthly_budget").unwrap_or(0.0);
            let spent: f64 = r.try_get("spent").unwrap_or(0.0);
            BudgetCategoryWithSpending {
                id: r.try_get("id").unwrap_or_default(),
                name: r.try_get("name").unwrap_or_default(),
                group_name: r.try_get("group_name").unwrap_or_default(),
                icon: r.try_get("icon").unwrap_or_default(),
                monthly_budget: budget,
                color: r.try_get("color").unwrap_or_default(),
                spent,
                remaining: budget - spent,
                percent_used: if budget > 0.0 {
                    spent / budget * 100.0
                } else {
                    0.0
                },
            }
        })
        .collect())
}

async fn budget_financial_health_inner(
    pool: &sqlx::SqlitePool,
) -> Result<FinancialHealthScore, String> {
    // Simplified version — just return a basic score
    let current_ym = current_year_month();
    let pattern = format!("{}%", current_ym);

    let income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    ).bind(&pattern).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key LIKE ?",
    ).bind(&pattern).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let savings_rate = if income > 0.0 {
        (income - expenses) / income * 100.0
    } else {
        0.0
    };
    let score = ((savings_rate / 20.0 * 50.0).min(50.0) + 40.0) as u8;

    let mut insights = vec![];
    if savings_rate >= 20.0 {
        insights.push("Excellent savings rate — you're building strong financial security.".into());
    } else if savings_rate >= 10.0 {
        insights.push(format!(
            "Good savings rate at {:.0}%. Try to push toward 20%.",
            savings_rate
        ));
    } else if savings_rate > 0.0 {
        insights.push(format!(
            "Savings rate is {:.0}%. Consider reducing discretionary spending.",
            savings_rate
        ));
    } else {
        insights.push("Your savings rate is low. Track expenses to find areas to cut back.".into());
    }

    Ok(FinancialHealthScore {
        score: score.min(100),
        savings_rate_grade: if savings_rate >= 20.0 {
            "Excellent".into()
        } else if savings_rate >= 10.0 {
            "Good".into()
        } else {
            "Needs Work".into()
        },
        budget_adherence: "—".into(),
        bill_payment_rate: "—".into(),
        debt_income_ratio: "No tracked debt".into(),
        insights,
    })
}

async fn budget_list_bills_inner(pool: &sqlx::SqlitePool) -> Result<Vec<Bill>, String> {
    let month_prefix = format!("{}%", current_year_month());

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT b.id, b.name, b.amount, b.due_day, b.category_id, c.name AS category_name,
                  b.auto_pay, b.active, b.created_at,
                  CASE WHEN bp.id IS NOT NULL THEN 1 ELSE 0 END AS paid_this_month
           FROM budget_bills b
           LEFT JOIN budget_categories c ON c.id = b.category_id
           LEFT JOIN budget_bill_payments bp ON bp.bill_id = b.id AND bp.date_key LIKE ?
           WHERE b.active = 1
           ORDER BY b.due_day"#,
    )
    .bind(&month_prefix)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| Bill {
            id: r.try_get("id").unwrap_or_default(),
            name: r.try_get("name").unwrap_or_default(),
            amount: r.try_get("amount").unwrap_or(0.0),
            due_day: r.try_get::<i64, _>("due_day").unwrap_or(1) as u8,
            category_id: r.try_get("category_id").unwrap_or(None),
            category_name: r.try_get("category_name").unwrap_or(None),
            auto_pay: r.try_get::<i64, _>("auto_pay").unwrap_or(0) != 0,
            active: r.try_get::<i64, _>("active").unwrap_or(1) != 0,
            created_at: r.try_get("created_at").unwrap_or(0),
            paid_this_month: r.try_get::<i64, _>("paid_this_month").unwrap_or(0) != 0,
        })
        .collect())
}

async fn budget_list_ai_costs_inner(
    pool: &sqlx::SqlitePool,
    month: &str,
) -> Result<Vec<AiCostEntry>, String> {
    let pattern = format!("{}%", month);

    use sqlx::Row;
    let rows = sqlx::query(
        "SELECT id, provider, model, cost, tokens_in, tokens_out, date_key, note, created_at
         FROM budget_ai_costs WHERE date_key LIKE ?
         ORDER BY date_key DESC LIMIT 50",
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| AiCostEntry {
            id: r.try_get("id").unwrap_or_default(),
            provider: r.try_get("provider").unwrap_or_default(),
            model: r.try_get("model").unwrap_or_default(),
            cost: r.try_get("cost").unwrap_or(0.0),
            tokens_in: r.try_get::<i64, _>("tokens_in").unwrap_or(0) as u64,
            tokens_out: r.try_get::<i64, _>("tokens_out").unwrap_or(0) as u64,
            date_key: r.try_get("date_key").unwrap_or_default(),
            note: r.try_get("note").unwrap_or(None),
            created_at: r.try_get("created_at").unwrap_or(0),
        })
        .collect())
}

async fn budget_ai_cost_summary_inner(
    pool: &sqlx::SqlitePool,
) -> Result<Vec<AiCostSummary>, String> {
    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT provider,
                  SUM(cost) AS total_cost,
                  SUM(tokens_in) AS total_tokens_in,
                  SUM(tokens_out) AS total_tokens_out,
                  COUNT(DISTINCT substr(date_key,1,7)) AS month_count
           FROM budget_ai_costs
           GROUP BY provider
           ORDER BY total_cost DESC"#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|r| AiCostSummary {
            provider: r.try_get("provider").unwrap_or_default(),
            total_cost: r.try_get("total_cost").unwrap_or(0.0),
            total_tokens_in: r.try_get::<i64, _>("total_tokens_in").unwrap_or(0) as u64,
            total_tokens_out: r.try_get::<i64, _>("total_tokens_out").unwrap_or(0) as u64,
            month_count: r.try_get::<i64, _>("month_count").unwrap_or(0) as u64,
        })
        .collect())
}

async fn budget_cash_flow_forecast_inner(
    pool: &sqlx::SqlitePool,
    months: i64,
) -> Result<Vec<CashFlowProjection>, String> {
    let three_months_ago = {
        let now = chrono::Utc::now();
        let past = now - chrono::Months::new(3);
        past.format("%Y-%m-%d").to_string()
    };

    let avg_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) / 3.0 FROM budget_transactions WHERE tx_type = 'income' AND date_key >= ?",
    ).bind(&three_months_ago).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let avg_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) / 3.0 FROM budget_transactions WHERE tx_type = 'expense' AND date_key >= ?",
    ).bind(&three_months_ago).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let current_pattern = format!("{}%", current_year_month());
    let current_income: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'income' AND date_key LIKE ?",
    ).bind(&current_pattern).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let current_expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0.0) FROM budget_transactions WHERE tx_type = 'expense' AND date_key LIKE ?",
    ).bind(&current_pattern).fetch_one(pool).await.map_err(|e| e.to_string())?;

    let mut balance = current_income - current_expenses;
    let now = chrono::Utc::now();
    let num_months = months.clamp(1, 24);
    let mut projections = vec![];

    for i in 0..num_months {
        let proj_month = if i == 0 {
            now
        } else {
            now + chrono::Months::new(i as u32)
        };
        let income = if i == 0 {
            avg_income.max(current_income)
        } else {
            avg_income
        };
        let expenses = if i == 0 {
            avg_expenses.max(current_expenses)
        } else {
            avg_expenses
        };
        balance = balance + income - expenses;
        projections.push(CashFlowProjection {
            month: proj_month.format("%Y-%m").to_string(),
            projected_income: income,
            projected_expenses: expenses,
            projected_balance: balance,
        });
    }

    Ok(projections)
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT
// ═════════════════════════════════════════════════════════════════════════════

#[tauri::command]
pub async fn budget_export_csv(
    auth: State<'_, crate::auth::AuthManager>,
    state: State<'_, BentoAppState>,
    month: Option<String>,
) -> Result<String, String> {
    crate::auth::require_billing_tier(&auth, "budget").await?;

    ensure_budget_tables(&state.db()).await?;

    let ym = month.unwrap_or_else(current_year_month);
    let pattern = format!("{}%", ym);

    use sqlx::Row;
    let rows = sqlx::query(
        r#"SELECT t.id, t.date_key, t.tx_type, t.amount, COALESCE(c.name, 'Uncategorized') AS category,
                  t.note, t.project, t.recurring
           FROM budget_transactions t
           LEFT JOIN budget_categories c ON c.id = t.category_id
           WHERE t.date_key LIKE ?
           ORDER BY t.date_key DESC, t.created_at DESC"#,
    )
    .bind(&pattern)
    .fetch_all(&state.db())
    .await
    .map_err(|e| e.to_string())?;

    let mut csv = String::from("ID,Date,Type,Amount,Category,Note,Project,Recurring\n");
    for r in rows {
        let id: String = r.try_get("id").unwrap_or_default();
        let date: String = r.try_get("date_key").unwrap_or_default();
        let tx_type: String = r.try_get("tx_type").unwrap_or_default();
        let amount: f64 = r.try_get("amount").unwrap_or(0.0);
        let category: String = r.try_get("category").unwrap_or_default();
        let note: Option<String> = r.try_get("note").unwrap_or(None);
        let project: Option<String> = r.try_get("project").unwrap_or(None);
        let recurring: i64 = r.try_get("recurring").unwrap_or(0);

        csv.push_str(&format!(
            "{},{},{},{:.2},{},{},{},{}\n",
            csv_escape(&id),
            date,
            tx_type,
            amount,
            csv_escape(&category),
            csv_escape(&note.unwrap_or_default()),
            csv_escape(&project.unwrap_or_default()),
            if recurring != 0 { "Yes" } else { "No" },
        ));
    }

    Ok(csv)
}

fn previous_year_month(ym: &str) -> String {
    chrono::NaiveDate::parse_from_str(&format!("{}-01", ym), "%Y-%m-%d")
        .map(|d| (d - chrono::Months::new(1)).format("%Y-%m").to_string())
        .unwrap_or_else(|_| {
            let now = chrono::Utc::now();
            (now - chrono::Months::new(1)).format("%Y-%m").to_string()
        })
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}
