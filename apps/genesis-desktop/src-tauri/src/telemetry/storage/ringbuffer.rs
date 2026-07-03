use sqlx::{Row, SqlitePool};

use crate::telemetry::{
    now_ms, InsightRecord, PredictionRecord, StoredAnomaly, TickRecord, RETENTION_WINDOW_MS,
};

#[derive(Clone)]
pub struct RingBufferStore {
    db: SqlitePool,
}

impl RingBufferStore {
    pub fn new(db: SqlitePool) -> Result<Self, String> {
        tauri::async_runtime::block_on(async {
            ensure_telemetry_schema_compatibility(&db).await?;

            sqlx::raw_sql(include_str!("schema.sql"))
                .execute(&db)
                .await
                .map_err(|error| error.to_string())
        })?;
        Ok(Self { db })
    }

    pub fn db(&self) -> &SqlitePool {
        &self.db
    }

    pub async fn insert_tick(&self, tick: &TickRecord) -> Result<i64, String> {
        let result = sqlx::query(
            r#"
            INSERT INTO telemetry_ticks (ts, module_id, heap_mb, state, ipc_ms, db_ms, last_action)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(tick.ts)
        .bind(&tick.module_id)
        .bind(tick.heap_mb)
        .bind(tick.state.as_str())
        .bind(tick.ipc_ms)
        .bind(tick.db_ms)
        .bind(&tick.last_action)
        .execute(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(result.last_insert_rowid())
    }

    pub async fn insert_anomaly(&self, anomaly: &StoredAnomaly) -> Result<i64, String> {
        let result = sqlx::query(
            r#"
            INSERT INTO anomaly_log (ts, module_id, type, severity, message, healed, heal_action, heal_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(anomaly.ts)
        .bind(&anomaly.module_id)
        .bind(anomaly.kind.as_str())
        .bind(anomaly.severity.as_str())
        .bind(&anomaly.message)
        .bind(if anomaly.healed { 1 } else { 0 })
        .bind(anomaly.heal_action.as_ref().map(|value| value.as_str()))
        .bind(anomaly.heal_ms)
        .execute(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(result.last_insert_rowid())
    }

    pub async fn mark_anomaly_healed(
        &self,
        anomaly_id: i64,
        heal_action: &str,
        heal_ms: i64,
    ) -> Result<(), String> {
        sqlx::query("UPDATE anomaly_log SET healed = 1, heal_action = ?, heal_ms = ? WHERE id = ?")
            .bind(heal_action)
            .bind(heal_ms)
            .bind(anomaly_id)
            .execute(&self.db)
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub async fn insert_insight(&self, insight: &InsightRecord) -> Result<i64, String> {
        let result = sqlx::query(
            r#"
            INSERT INTO insights (discovered_at, action, metric, pearson, n_samples, description)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(insight.discovered_at)
        .bind(&insight.action)
        .bind(&insight.metric)
        .bind(insight.pearson)
        .bind(insight.n_samples)
        .bind(&insight.description)
        .execute(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(result.last_insert_rowid())
    }

    pub async fn insert_prediction(&self, prediction: &PredictionRecord) -> Result<i64, String> {
        let result = sqlx::query(
            r#"
            INSERT INTO predictions (ts, module_id, metric, current_val, projected_5m, was_correct)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(prediction.ts)
        .bind(&prediction.module_id)
        .bind(&prediction.metric)
        .bind(prediction.current_val)
        .bind(prediction.projected_5m)
        .bind(
            prediction
                .was_correct
                .map(|value| if value { 1 } else { 0 }),
        )
        .execute(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(result.last_insert_rowid())
    }

    pub async fn prune_old_ticks(&self, cutoff_ms: i64) -> Result<(), String> {
        sqlx::query("DELETE FROM telemetry_ticks WHERE ts < ?")
            .bind(cutoff_ms)
            .execute(&self.db)
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }

    pub async fn count_anomalies_today(
        &self,
        module_id: &str,
        anomaly_type: &str,
    ) -> Result<i64, String> {
        let day_start = now_ms() - (24 * 60 * 60 * 1000);
        let row = sqlx::query(
            "SELECT COUNT(*) AS count FROM anomaly_log WHERE module_id = ? AND type = ? AND ts >= ?",
        )
        .bind(module_id)
        .bind(anomaly_type)
        .bind(day_start)
        .fetch_one(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(row.try_get::<i64, _>("count").unwrap_or(0))
    }

    pub async fn recent_ticks(
        &self,
        module_id: Option<&str>,
        since_ms: i64,
    ) -> Result<Vec<TickRecord>, String> {
        let rows = if let Some(module_id) = module_id {
            sqlx::query(
                "SELECT id, ts, module_id, heap_mb, state, ipc_ms, db_ms, last_action FROM telemetry_ticks WHERE module_id = ? AND ts >= ? ORDER BY ts ASC",
            )
            .bind(module_id)
            .bind(since_ms)
            .fetch_all(&self.db)
            .await
            .map_err(|error| error.to_string())?
        } else {
            sqlx::query(
                "SELECT id, ts, module_id, heap_mb, state, ipc_ms, db_ms, last_action FROM telemetry_ticks WHERE ts >= ? ORDER BY ts ASC",
            )
            .bind(since_ms)
            .fetch_all(&self.db)
            .await
            .map_err(|error| error.to_string())?
        };

        Ok(rows
            .into_iter()
            .map(|row| TickRecord {
                id: row.try_get("id").unwrap_or_default(),
                ts: row.try_get("ts").unwrap_or_default(),
                module_id: row.try_get("module_id").unwrap_or_default(),
                heap_mb: row.try_get("heap_mb").unwrap_or_default(),
                state: parse_module_state(
                    row.try_get::<String, _>("state")
                        .unwrap_or_else(|_| "OFFLINE".to_string())
                        .as_str(),
                ),
                ipc_ms: row.try_get("ipc_ms").ok(),
                db_ms: row.try_get("db_ms").ok(),
                last_action: row.try_get("last_action").ok(),
            })
            .collect())
    }

    pub async fn recent_anomalies(
        &self,
        module_id: Option<&str>,
        since_ms: i64,
    ) -> Result<Vec<StoredAnomaly>, String> {
        let rows = if let Some(module_id) = module_id {
            sqlx::query(
                "SELECT id, ts, module_id, type, severity, message, healed, heal_action, heal_ms FROM anomaly_log WHERE module_id = ? AND ts >= ? ORDER BY ts DESC",
            )
            .bind(module_id)
            .bind(since_ms)
            .fetch_all(&self.db)
            .await
            .map_err(|error| error.to_string())?
        } else {
            sqlx::query(
                "SELECT id, ts, module_id, type, severity, message, healed, heal_action, heal_ms FROM anomaly_log WHERE ts >= ? ORDER BY ts DESC",
            )
            .bind(since_ms)
            .fetch_all(&self.db)
            .await
            .map_err(|error| error.to_string())?
        };

        Ok(rows
            .into_iter()
            .map(|row| StoredAnomaly {
                id: row.try_get("id").unwrap_or_default(),
                ts: row.try_get("ts").unwrap_or_default(),
                module_id: row.try_get("module_id").unwrap_or_default(),
                kind: parse_anomaly_type(
                    row.try_get::<String, _>("type")
                        .unwrap_or_else(|_| "memory_spike".to_string())
                        .as_str(),
                ),
                severity: parse_severity(
                    row.try_get::<String, _>("severity")
                        .unwrap_or_else(|_| "INFO".to_string())
                        .as_str(),
                ),
                message: row.try_get("message").unwrap_or_default(),
                healed: row.try_get::<i64, _>("healed").unwrap_or(0) == 1,
                heal_action: row
                    .try_get::<Option<String>, _>("heal_action")
                    .ok()
                    .flatten()
                    .map(|value| parse_heal_action(&value)),
                heal_ms: row.try_get("heal_ms").ok(),
            })
            .collect())
    }

    pub async fn recent_insights(&self, since_ms: i64) -> Result<Vec<InsightRecord>, String> {
        let rows = sqlx::query(
            "SELECT id, discovered_at, action, metric, pearson, n_samples, description FROM insights WHERE discovered_at >= ? ORDER BY discovered_at DESC",
        )
        .bind(since_ms)
        .fetch_all(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(rows
            .into_iter()
            .map(|row| InsightRecord {
                id: row.try_get("id").unwrap_or_default(),
                discovered_at: row.try_get("discovered_at").unwrap_or_default(),
                action: row.try_get("action").unwrap_or_default(),
                metric: row.try_get("metric").unwrap_or_default(),
                pearson: row.try_get("pearson").unwrap_or_default(),
                n_samples: row.try_get("n_samples").unwrap_or_default(),
                description: row.try_get("description").unwrap_or_default(),
            })
            .collect())
    }

    pub async fn recent_predictions(&self, since_ms: i64) -> Result<Vec<PredictionRecord>, String> {
        let rows = sqlx::query(
            "SELECT id, ts, module_id, metric, current_val, projected_5m, was_correct FROM predictions WHERE ts >= ? ORDER BY ts DESC",
        )
        .bind(since_ms)
        .fetch_all(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        Ok(rows
            .into_iter()
            .map(|row| PredictionRecord {
                id: row.try_get("id").unwrap_or_default(),
                ts: row.try_get("ts").unwrap_or_default(),
                module_id: row.try_get("module_id").unwrap_or_default(),
                metric: row.try_get("metric").unwrap_or_default(),
                current_val: row.try_get("current_val").unwrap_or_default(),
                projected_5m: row.try_get("projected_5m").unwrap_or_default(),
                was_correct: row
                    .try_get::<Option<i64>, _>("was_correct")
                    .ok()
                    .flatten()
                    .map(|value| value == 1),
            })
            .collect())
    }

    pub async fn validate_due_predictions(&self, now_ms: i64) -> Result<(), String> {
        let due_rows = sqlx::query(
            "SELECT id, ts, module_id, metric, projected_5m FROM predictions WHERE was_correct IS NULL AND ts <= ?",
        )
        .bind(now_ms - (5 * 60 * 1000))
        .fetch_all(&self.db)
        .await
        .map_err(|error| error.to_string())?;

        for row in due_rows {
            let prediction_id = row.try_get::<i64, _>("id").unwrap_or_default();
            let ts = row.try_get::<i64, _>("ts").unwrap_or_default();
            let module_id = row.try_get::<String, _>("module_id").unwrap_or_default();
            let projected_5m = row.try_get::<f32, _>("projected_5m").unwrap_or_default();

            let tick = sqlx::query(
                "SELECT MAX(heap_mb) AS max_heap FROM telemetry_ticks WHERE module_id = ? AND ts BETWEEN ? AND ?",
            )
            .bind(&module_id)
            .bind(ts)
            .bind(ts + (5 * 60 * 1000))
            .fetch_one(&self.db)
            .await
            .map_err(|error| error.to_string())?;

            let max_heap = tick
                .try_get::<Option<f32>, _>("max_heap")
                .ok()
                .flatten()
                .unwrap_or(0.0);
            let was_correct = if max_heap >= projected_5m { 1 } else { 0 };

            sqlx::query("UPDATE predictions SET was_correct = ? WHERE id = ?")
                .bind(was_correct)
                .bind(prediction_id)
                .execute(&self.db)
                .await
                .map_err(|error| error.to_string())?;
        }

        self.prune_old_ticks(now_ms - RETENTION_WINDOW_MS).await
    }
}

async fn ensure_telemetry_schema_compatibility(db: &SqlitePool) -> Result<(), String> {
    ensure_table_columns(
        db,
        "telemetry_ticks",
        &[
            "ts",
            "module_id",
            "heap_mb",
            "state",
            "ipc_ms",
            "db_ms",
            "last_action",
        ],
        r#"
        CREATE TABLE telemetry_ticks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            ts           INTEGER NOT NULL,
            module_id    TEXT NOT NULL,
            heap_mb      REAL NOT NULL,
            state        TEXT NOT NULL,
            ipc_ms       REAL,
            db_ms        REAL,
            last_action  TEXT
        );
        CREATE INDEX idx_ticks_ts ON telemetry_ticks(ts);
        CREATE INDEX idx_ticks_module_ts ON telemetry_ticks(module_id, ts);
        "#,
    )
    .await?;

    ensure_table_columns(
        db,
        "anomaly_log",
        &[
            "ts",
            "module_id",
            "type",
            "severity",
            "message",
            "healed",
            "heal_action",
            "heal_ms",
        ],
        r#"
        CREATE TABLE anomaly_log (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            ts           INTEGER NOT NULL,
            module_id    TEXT NOT NULL,
            type         TEXT NOT NULL,
            severity     TEXT NOT NULL,
            message      TEXT NOT NULL,
            healed       INTEGER DEFAULT 0,
            heal_action  TEXT,
            heal_ms      INTEGER
        );
        CREATE INDEX idx_anomaly_ts ON anomaly_log(ts);
        CREATE INDEX idx_anomaly_module_ts ON anomaly_log(module_id, ts);
        "#,
    )
    .await?;

    ensure_table_columns(
        db,
        "insights",
        &[
            "discovered_at",
            "action",
            "metric",
            "pearson",
            "n_samples",
            "description",
        ],
        r#"
        CREATE TABLE insights (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            discovered_at INTEGER NOT NULL,
            action        TEXT NOT NULL,
            metric        TEXT NOT NULL,
            pearson       REAL NOT NULL,
            n_samples     INTEGER NOT NULL,
            description   TEXT NOT NULL
        );
        CREATE INDEX idx_insights_discovered_at ON insights(discovered_at);
        "#,
    )
    .await?;

    ensure_table_columns(
        db,
        "predictions",
        &[
            "ts",
            "module_id",
            "metric",
            "current_val",
            "projected_5m",
            "was_correct",
        ],
        r#"
        CREATE TABLE predictions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            ts            INTEGER NOT NULL,
            module_id     TEXT NOT NULL,
            metric        TEXT NOT NULL,
            current_val   REAL NOT NULL,
            projected_5m  REAL NOT NULL,
            was_correct   INTEGER
        );
        CREATE INDEX idx_predictions_ts ON predictions(ts);
        CREATE INDEX idx_predictions_pending ON predictions(metric, was_correct, ts);
        "#,
    )
    .await?;

    Ok(())
}

async fn ensure_table_columns(
    db: &SqlitePool,
    table_name: &str,
    required_columns: &[&str],
    recreate_sql: &str,
) -> Result<(), String> {
    let exists_row =
        sqlx::query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
            .bind(table_name)
            .fetch_optional(db)
            .await
            .map_err(|error| error.to_string())?;

    if exists_row.is_none() {
        sqlx::raw_sql(recreate_sql)
            .execute(db)
            .await
            .map_err(|error| error.to_string())?;
        return Ok(());
    }

    let pragma = format!("PRAGMA table_info({table_name})");
    let rows = sqlx::query(&pragma)
        .fetch_all(db)
        .await
        .map_err(|error| error.to_string())?;

    let columns = rows
        .into_iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect::<Vec<_>>();

    let is_compatible = required_columns
        .iter()
        .all(|column| columns.iter().any(|existing| existing == column));

    if is_compatible {
        return Ok(());
    }

    let drop_indexes_sql = match table_name {
        "telemetry_ticks" => {
            "DROP INDEX IF EXISTS idx_ticks_ts; DROP INDEX IF EXISTS idx_ticks_module_ts;"
        }
        "anomaly_log" => {
            "DROP INDEX IF EXISTS idx_anomaly_ts; DROP INDEX IF EXISTS idx_anomaly_module_ts;"
        }
        "insights" => "DROP INDEX IF EXISTS idx_insights_discovered_at;",
        "predictions" => {
            "DROP INDEX IF EXISTS idx_predictions_ts; DROP INDEX IF EXISTS idx_predictions_pending;"
        }
        _ => "",
    };

    if !drop_indexes_sql.is_empty() {
        sqlx::raw_sql(drop_indexes_sql)
            .execute(db)
            .await
            .map_err(|error| error.to_string())?;
    }

    sqlx::query(&format!("DROP TABLE IF EXISTS {table_name}"))
        .execute(db)
        .await
        .map_err(|error| error.to_string())?;

    sqlx::raw_sql(recreate_sql)
        .execute(db)
        .await
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn parse_module_state(value: &str) -> crate::telemetry::ModuleState {
    match value {
        "IDLE" => crate::telemetry::ModuleState::Idle,
        "ACTIVE" => crate::telemetry::ModuleState::Active,
        "DEGRADED" => crate::telemetry::ModuleState::Degraded,
        "CRITICAL" => crate::telemetry::ModuleState::Critical,
        "RECOVERING" => crate::telemetry::ModuleState::Recovering,
        "FROZEN" => crate::telemetry::ModuleState::Frozen,
        _ => crate::telemetry::ModuleState::Offline,
    }
}

fn parse_anomaly_type(value: &str) -> crate::telemetry::AnomalyType {
    match value {
        "slow_ipc" => crate::telemetry::AnomalyType::SlowIpc,
        "slow_db" => crate::telemetry::AnomalyType::SlowDb,
        "rapid_growth" => crate::telemetry::AnomalyType::RapidGrowth,
        "frozen" => crate::telemetry::AnomalyType::Frozen,
        _ => crate::telemetry::AnomalyType::MemorySpike,
    }
}

fn parse_severity(value: &str) -> crate::telemetry::Severity {
    match value {
        "WARN" => crate::telemetry::Severity::Warn,
        "CRITICAL" => crate::telemetry::Severity::Critical,
        _ => crate::telemetry::Severity::Info,
    }
}

fn parse_heal_action(value: &str) -> crate::telemetry::HealAction {
    match value {
        "reload_module" => crate::telemetry::HealAction::ReloadModule,
        "vacuum_db" => crate::telemetry::HealAction::VacuumDb,
        "clear_module_cache" => crate::telemetry::HealAction::ClearModuleCache,
        "throttle_ipc_rate" => crate::telemetry::HealAction::ThrottleIpcRate,
        "log_only" => crate::telemetry::HealAction::LogOnly,
        _ => crate::telemetry::HealAction::SuggestGc,
    }
}
