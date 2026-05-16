CREATE TABLE IF NOT EXISTS telemetry_ticks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ts           INTEGER NOT NULL,
    module_id    TEXT NOT NULL,
    heap_mb      REAL NOT NULL,
    state        TEXT NOT NULL,
    ipc_ms       REAL,
    db_ms        REAL,
    last_action  TEXT
);
CREATE INDEX IF NOT EXISTS idx_ticks_ts ON telemetry_ticks(ts);
CREATE INDEX IF NOT EXISTS idx_ticks_module_ts ON telemetry_ticks(module_id, ts);

CREATE TABLE IF NOT EXISTS anomaly_log (
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
CREATE INDEX IF NOT EXISTS idx_anomaly_ts ON anomaly_log(ts);
CREATE INDEX IF NOT EXISTS idx_anomaly_module_ts ON anomaly_log(module_id, ts);

CREATE TABLE IF NOT EXISTS backend_traces (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ts           INTEGER NOT NULL,
    source       TEXT NOT NULL,
    operation    TEXT NOT NULL,
    module_id    TEXT,
    status_code  INTEGER NOT NULL,
    severity     TEXT NOT NULL,
    message      TEXT NOT NULL,
    path         TEXT,
    details      TEXT
);
CREATE INDEX IF NOT EXISTS idx_backend_trace_ts ON backend_traces(ts);
CREATE INDEX IF NOT EXISTS idx_backend_trace_module_ts ON backend_traces(module_id, ts);

CREATE TABLE IF NOT EXISTS insights (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    discovered_at INTEGER NOT NULL,
    action        TEXT NOT NULL,
    metric        TEXT NOT NULL,
    pearson       REAL NOT NULL,
    n_samples     INTEGER NOT NULL,
    description   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_insights_discovered_at ON insights(discovered_at);

CREATE TABLE IF NOT EXISTS predictions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            INTEGER NOT NULL,
    module_id     TEXT NOT NULL,
    metric        TEXT NOT NULL,
    current_val   REAL NOT NULL,
    projected_5m  REAL NOT NULL,
    time_to_threshold_secs INTEGER,
    was_correct   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_predictions_ts ON predictions(ts);
CREATE INDEX IF NOT EXISTS idx_predictions_pending ON predictions(metric, was_correct, ts);
