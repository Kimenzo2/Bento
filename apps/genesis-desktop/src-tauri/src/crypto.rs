// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Bento Encryption Service
//!
//! Architecture:
//!   Master Password ──► Argon2id (600k+ ops) ──► 32-byte raw key
//!   Raw key ──► hex-encoded ──► SQLCipher PRAGMA key (raw: prefix)
//!   Salt stored in OS keyring (not disk plaintext).
//!
//! Security properties:
//!   - Master password NEVER touches disk.
//!   - Derived key lives in SecretBox<[u8; 32]> — zeroed on drop.
//!   - Salt is 32 bytes of CSPRNG output, stored in keyring.
//!   - SQLCipher uses AES-256-CBC + HMAC-SHA512, page-size 4096, KDF iterations 256000.
//!   - Re-key uses sqlcipher_export() pattern for atomic re-encryption.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};

use argon2::{Algorithm::Argon2id, Argon2, Params, Version::V0x13};
use keyring::Entry;
use rand::{rngs::OsRng, RngCore};
use secrecy::{ExposeSecret, Secret};
use serde::{Deserialize, Serialize};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use tauri::Emitter;
use tokio::sync::RwLock;

// ── Constants ─────────────────────────────────────────────────────────────────

/// Argon2id parameters — exceeds OWASP 2024 minimums for desktop apps.
/// m=64 MiB, t=3 passes, p=4 threads → ~1-2s on modern hardware.
const ARGON2_MEMORY_KIB: u32 = 65_536; // 64 MiB
const ARGON2_TIME_COST: u32 = 3;
const ARGON2_PARALLELISM: u32 = 4;
const ARGON2_OUTPUT_LEN: usize = 32; // 256-bit key

/// SQLCipher page size. Must be set BEFORE any data is written.
const CIPHER_PAGE_SIZE: u32 = 4096;
/// SQLCipher KDF iterations applied to the raw key passthrough (we pre-derive).
/// Setting to 1 is correct when using PRAGMA key = "x'<hex>'"; — SQLCipher
/// skips its own PBKDF when you pass a raw 32-byte hex key.
const CIPHER_KDF_ITER: u32 = 1;

const MAIN_DB_MAX_CONNECTIONS: u32 = 16;
const MODULE_DB_MAX_CONNECTIONS: u32 = 2;
const DB_ACQUIRE_TIMEOUT: Duration = Duration::from_secs(3);
const DB_ACQUIRE_SLOW_THRESHOLD: Duration = Duration::from_millis(250);

const KEYRING_SERVICE: &str = "BentoDesktop";
const KEYRING_SALT_KEY: &str = "master-key-salt";
const KEYRING_SETUP_KEY: &str = "master-key-setup-complete";

/// All module database files managed by the encryption service.
pub const MODULE_DB_FILES: &[(&str, &str)] = &[
    ("main", "app.db"),
    ("notes", "notes.db"),
    ("tasks", "tasks.db"),
    ("journal", "journal.db"),
    ("passwords", "passwords.db"),
    ("budget", "budget.db"),
    ("health", "health.db"),
    ("habits", "habits.db"),
    ("focus", "focus.db"),

];

// ── Key material (zeroed on drop) ─────────────────────────────────────────────

/// A 32-byte derived key, automatically zeroed when dropped.
#[derive(Clone)]
pub struct DerivedKey(Arc<Secret<[u8; 32]>>);

impl DerivedKey {
    fn new(raw: [u8; 32]) -> Self {
        Self(Arc::new(Secret::new(raw)))
    }

    /// Return the hex string SQLCipher expects: PRAGMA key = "x'<64-hex-chars>'"
    pub fn as_sqlcipher_pragma(&self) -> String {
        format!("x'{}'", hex::encode(self.0.expose_secret()))
    }
}

// ── Encryption service ────────────────────────────────────────────────────────

#[derive(specta::Type, Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CryptoStatus {
    /// No master password has been configured yet.
    NotConfigured,
    /// Password configured, database is locked (no key in memory).
    Locked,
    /// Password configured, key in memory, pools open.
    Unlocked,
}

struct CryptoInner {
    status: CryptoStatus,
    key: Option<DerivedKey>,
    pools: std::collections::HashMap<String, SqlitePool>,
    data_dir: PathBuf,
}

/// Thread-safe encryption service managed as Tauri state.
#[derive(Clone)]
pub struct CryptoService(Arc<RwLock<CryptoInner>>);

impl CryptoService {
    pub fn new(data_dir: PathBuf) -> Self {
        Self(Arc::new(RwLock::new(CryptoInner {
            status: CryptoStatus::NotConfigured,
            key: None,
            pools: std::collections::HashMap::new(),
            data_dir,
        })))
    }

    // ── Public API ────────────────────────────────────────────────────────

    /// Returns the current lock status.
    pub async fn status(&self) -> CryptoStatus {
        self.0.read().await.status.clone()
    }

    /// Returns true if a master password has ever been configured (salt exists in keyring).
    pub async fn is_configured(&self) -> bool {
        load_salt().is_ok()
    }

    /// First-time setup: derive key from password, migrate all databases
    /// from plaintext → encrypted, store salt, open the main pool.
    ///
    /// Process is idempotent: already-encrypted databases are skipped.
    /// All file operations are async (tokio::fs) to avoid blocking the runtime.
    /// Emits `crypto:setup-progress` events for UI progress tracking.
    pub async fn setup_master_password(
        &self,
        password: &str,
        data_dir: &Path,
        app: Option<&tauri::AppHandle>,
    ) -> Result<(), String> {
        // Concurrency guard: only one setup can run at a time.
        // If a previous setup is in-flight, this call waits for it.
        {
            let inner = self.0.write().await;
            if inner.status == CryptoStatus::Unlocked {
                return Err("Encryption is already configured and unlocked.".to_string());
            }
        }

        let started = Instant::now();
        validate_password_strength(password)?;

        // Generate fresh 32-byte salt
        let mut salt_bytes = [0u8; 32];
        OsRng.fill_bytes(&mut salt_bytes);
        let salt_hex = hex::encode(salt_bytes);

        let key = derive_key(password, &salt_bytes)?;
        eprintln!(
            "[crypto] setup key derivation completed in {:?}",
            started.elapsed()
        );

        // Emit progress: backing up
        emit_progress(app, "backup", 0, "Backing up databases...");

        // Phase 1: Backup all plaintext databases. If any backup fails,
        // abort before touching the originals — no data is lost.
        let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
        let backup_dir = data_dir
            .join("backups")
            .join(format!("pre-sqlcipher-{timestamp}"));
        tokio::fs::create_dir_all(&backup_dir)
            .await
            .map_err(|e| e.to_string())?;

        let existing = MODULE_DB_FILES
            .iter()
            .filter_map(|(_, filename)| {
                let path = data_dir.join(filename);
                path.exists().then_some((filename, path))
            })
            .collect::<Vec<_>>();

        // Check available disk space (need ~2x DB size for migration)
        let total_db_size: u64 = futures::future::join_all(
            existing
                .iter()
                .map(|(_, path)| async move {
                    tokio::fs::metadata(path)
                        .await
                        .map(|m| m.len())
                        .unwrap_or(0)
                }),
        )
        .await
        .into_iter()
        .sum();
        // Require at least 2x the total DB size plus 10 MB headroom
        let required_bytes = total_db_size.saturating_mul(2).saturating_add(10 * 1024 * 1024);
        {
            use sysinfo::Disks;
            let disks = Disks::new_with_refreshed_list();
            if let Some(disk) = disks.iter().find(|d| {
                data_dir
                    .to_str()
                    .map(|p| p.starts_with(d.mount_point().to_str().unwrap_or("")))
                    .unwrap_or(false)
            }) {
                let available = disk.available_space();
                if available < required_bytes {
                    return Err(format!(
                        "Insufficient disk space for encryption. Need at least {} MB, {} MB available.",
                        required_bytes / (1024 * 1024),
                        available / (1024 * 1024)
                    ));
                }
            }
        }

        for (i, (filename, path)) in existing.iter().enumerate() {
            let progress = ((i as f64 / existing.len() as f64) * 30.0) as u32;
            emit_progress(app, "backup", progress, &format!("Backing up {filename}..."));

            tokio::fs::copy(path, backup_dir.join(filename))
                .await
                .map_err(|e| format!("Backup {filename}: {e}"))?;
            for suffix in ["-wal", "-shm"] {
                let sibling = PathBuf::from(format!("{}{}", path.display(), suffix));
                if sibling.exists() {
                    tokio::fs::copy(&sibling, backup_dir.join(format!("{filename}{suffix}")))
                        .await
                        .map_err(|e| format!("Backup {filename}{suffix}: {e}"))?;
                }
            }
        }

        // Phase 2: Migrate each database from plaintext → encrypted in-place.
        // Uses sqlcipher_export to copy all data into a new encrypted file,
        // then atomically renames it over the original. No data is deleted
        // before the encrypted version is verified.
        for (i, (filename, path)) in existing.iter().enumerate() {
            let module = filename.trim_end_matches(".db");

            // Skip if already encrypted (idempotent — handles crash recovery)
            if is_encrypted_database(path) {
                let progress = 30 + ((i as f64 / existing.len() as f64) * 60.0) as u32;
                emit_progress(
                    app,
                    "migrate",
                    progress,
                    &format!("Skipping {filename} (already encrypted)..."),
                );
                continue;
            }

            let progress = 30 + ((i as f64 / existing.len() as f64) * 60.0) as u32;
            emit_progress(app, "migrate", progress, &format!("Encrypting {filename}..."));

            let plain_opts = SqliteConnectOptions::new()
                .filename(path)
                .journal_mode(SqliteJournalMode::Wal);
            let plain_pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect_with(plain_opts)
                .await
                .map_err(|e| format!("Open {filename} for migration: {e}"))?;

            // Checkpoint WAL to ensure all data is in the main DB file
            sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
                .execute(&plain_pool)
                .await
                .map_err(|e| format!("Checkpoint {filename}: {e}"))?;

            // Count rows before migration for integrity verification
            let row_count_before = count_all_rows(&plain_pool)
                .await
                .map_err(|e| format!("Count rows in {filename}: {e}"))?;

            // Export to a temporary encrypted file
            let enc_path = data_dir.join(format!("{module}.enc_setup.db"));
            encrypt_via_export(&plain_pool, &enc_path, &key)
                .await
                .map_err(|e| format!("Encrypt {filename}: {e}"))?;

            plain_pool.close().await;

            // Verify encrypted database has the same row count
            let enc_pool = open_encrypted_pool(&enc_path, &key, 1)
                .await
                .map_err(|e| format!("Open encrypted {filename} for verification: {e}"))?;
            let row_count_after = count_all_rows(&enc_pool)
                .await
                .map_err(|e| format!("Verify {filename}: {e}"))?;
            enc_pool.close().await;

            if row_count_before != row_count_after {
                let _ = tokio::fs::remove_file(&enc_path).await;
                return Err(format!(
                    "Data integrity check failed for {filename}: \
                     source has {row_count_before} rows, encrypted has {row_count_after}. \
                     Migration aborted — original data is untouched."
                ));
            }

            // Atomically replace the plaintext file with the encrypted version
            tokio::fs::rename(&enc_path, path)
                .await
                .map_err(|e| format!("Replace {filename}: {e}"))?;

            // Clean up WAL/SHM from the old plaintext pool
            for suffix in ["-wal", "-shm"] {
                let _ = tokio::fs::remove_file(format!("{}{}", path.display(), suffix)).await;
            }
        }

        // Phase 3: Open the encrypted main pool and run migrations
        // (creates any new tables/columns that didn't exist in the plaintext version)
        emit_progress(app, "finalize", 95, "Finalizing encryption...");
        let main_pool = open_module_pool("main", data_dir, &key, MAIN_DB_MAX_CONNECTIONS).await?;
        crate::db::run_encrypted_migrations(&main_pool).await?;

        // Persist salt + setup flag only after encrypted DB setup succeeds.
        store_salt(&salt_hex)?;
        store_setup_flag()?;

        let mut inner = self.0.write().await;
        inner.status = CryptoStatus::Unlocked;
        inner.key = Some(key);
        inner.pools =
            std::collections::HashMap::from([(String::from("main"), main_pool.clone())]);
        inner.data_dir = data_dir.to_path_buf();

        emit_progress(app, "done", 100, "Encryption complete!");
        eprintln!(
            "[crypto] setup completed in {:?} — migrated {} databases",
            started.elapsed(),
            existing.len()
        );
        Ok(())
    }

    /// Unlock an existing encrypted database with the master password.
    pub async fn unlock(&self, password: &str) -> Result<(), String> {
        let started = Instant::now();
        let salt_hex = load_salt()?;
        let salt_bytes = hex::decode(&salt_hex).map_err(|e| e.to_string())?;
        let salt_arr: [u8; 32] = salt_bytes
            .try_into()
            .map_err(|_| "Corrupt salt in keyring".to_string())?;

        let key = derive_key(password, &salt_arr)?;
        eprintln!(
            "[crypto] unlock key derivation completed in {:?}",
            started.elapsed()
        );

        // Validate by actually opening the main pool and executing a query.
        let data_dir = self.0.read().await.data_dir.clone();
        let main_pool = open_module_pool("main", &data_dir, &key, MAIN_DB_MAX_CONNECTIONS)
            .await
            .map_err(|error| {
                if is_sqlcipher_key_error(&error) {
                    "Incorrect master password or corrupted database.".to_string()
                } else {
                    error
                }
            })?;

        // Run any pending migrations
        crate::db::run_encrypted_migrations(&main_pool).await?;

        let mut inner = self.0.write().await;
        inner.status = CryptoStatus::Unlocked;
        inner.key = Some(key);
        inner.pools = std::collections::HashMap::from([(String::from("main"), main_pool.clone())]);

        eprintln!("[crypto] unlock completed in {:?}", started.elapsed());
        Ok(())
    }

    /// Lock: drop all pools and key from memory.
    pub async fn lock(&self) {
        let mut inner = self.0.write().await;
        // Close all connection pools — this flushes WAL and closes file handles
        for (_, pool) in inner.pools.drain() {
            pool.close().await;
        }
        inner.key = None;
        inner.status = CryptoStatus::Locked;
    }

    /// Re-encrypt the entire database suite with a new master password.
    /// Uses sqlcipher_export() for atomic re-encryption — no data loss on failure.
    pub async fn change_master_password(
        &self,
        current_password: &str,
        new_password: &str,
        data_dir: &Path,
        backup_dir: &Path,
    ) -> Result<PathBuf, String> {
        validate_password_strength(new_password)?;

        // Verify current password first
        let salt_hex = load_salt()?;
        let salt_bytes = hex::decode(&salt_hex).map_err(|e| e.to_string())?;
        let salt_arr: [u8; 32] = salt_bytes
            .try_into()
            .map_err(|_| "Corrupt salt".to_string())?;
        let current_key = derive_key(current_password, &salt_arr)?;

        // Ensure we can actually open with current key before touching anything
        let _ = open_all_pools(&current_key, data_dir)
            .await
            .map_err(|_| "Current master password is incorrect.".to_string())?;

        // Create timestamped backup of all DB files first
        let backup_path = create_backup(data_dir, backup_dir)?;

        // Derive new key with a fresh salt
        let mut new_salt = [0u8; 32];
        OsRng.fill_bytes(&mut new_salt);
        let new_key = derive_key(new_password, &new_salt)?;

        // Re-encrypt each database file atomically using sqlcipher_export
        for (module, filename) in MODULE_DB_FILES {
            let db_path = data_dir.join(filename);
            if !db_path.exists() {
                continue;
            }
            rekey_database(&db_path, &current_key, &new_key, data_dir, module).await?;
        }

        // Only after all files are re-encrypted do we update the keyring
        store_salt(&hex::encode(new_salt))?;

        // Re-open pools with new key
        let new_pools = open_all_pools(&new_key, data_dir).await?;

        let mut inner = self.0.write().await;
        // Close old pools cleanly
        for (_, pool) in inner.pools.drain() {
            pool.close().await;
        }
        inner.key = Some(new_key);
        inner.pools = new_pools;
        inner.status = CryptoStatus::Unlocked;

        Ok(backup_path)
    }

    /// Get a pool for a named module. Returns error if locked.
    /// When no master password is configured, falls back to a plaintext pool.
    pub async fn pool(&self, module: &str) -> Result<SqlitePool, String> {
        // First check: if unlocked and pool already exists, return it immediately
        {
            let inner = self.0.read().await;
            if inner.status == CryptoStatus::Locked {
                return Err("Database is locked. Unlock with your master password.".to_string());
            }
            if let Some(pool) = inner.pools.get(module).cloned() {
                return Ok(pool);
            }
        }

        let (data_dir, is_unlocked) = {
            let inner = self.0.read().await;
            (
                inner.data_dir.clone(),
                inner.status == CryptoStatus::Unlocked,
            )
        };

        if is_unlocked {
            let key = {
                let inner = self.0.read().await;
                inner
                    .key
                    .as_ref()
                    .ok_or_else(|| {
                        "Database is unlocked but the encryption key is missing.".to_string()
                    })?
                    .clone()
            };
            let pool =
                open_module_pool(module, &data_dir, &key, pool_size_for_module(module)).await?;

            let mut inner = self.0.write().await;
            if let Some(existing) = inner.pools.get(module).cloned() {
                return Ok(existing);
            }
            inner.pools.insert(module.to_string(), pool.clone());
            Ok(pool)
        } else {
            // Not configured — open a plaintext (unencrypted) pool
            let pool =
                open_plaintext_module_pool(module, &data_dir, pool_size_for_module(module)).await?;

            let mut inner = self.0.write().await;
            if let Some(existing) = inner.pools.get(module).cloned() {
                return Ok(existing);
            }
            inner.pools.insert(module.to_string(), pool.clone());
            Ok(pool)
        }
    }

    /// Convenience: get the main pool (used by BentoAppState).
    pub async fn main_pool(&self) -> Result<SqlitePool, String> {
        self.pool("main").await
    }

    /// Create a dedicated reader pool for the main database.
    ///
    /// Returns a **second**, independent pool pointing at the same encrypted
    /// main database but with `.max_connections(4)` and its own connection
    /// lifecycle. Read-heavy background workers (scheduler, dashboard,
    /// clipboard) use this pool so they never compete with user-facing IPC
    /// writes for the main pool's connections or its 3-second acquire_timeout.
    ///
    /// Falls back to `main_pool().clone()` if the reader-specific pool cannot
    /// be created (caller handles the fallback).
    pub async fn reader_main_pool(&self) -> Result<SqlitePool, String> {
        let inner = self.0.read().await;
        let key = inner
            .key
            .as_ref()
            .ok_or_else(|| "Database is locked — no reader pool available.".to_string())
            .cloned()?;
        let data_dir = inner.data_dir.clone();
        drop(inner);

        let path = module_db_path("main", &data_dir)?;
        open_encrypted_pool(&path, &key, 4).await
    }

    /// Migrate an existing unencrypted DB to encrypted.
    /// Only called once per file, guarded by the migration flag in settings.
    pub async fn migrate_unencrypted(
        &self,
        plain_path: &Path,
        module: &str,
        backup_dir: &Path,
    ) -> Result<(), String> {
        if !plain_path.exists() {
            return Ok(());
        }

        let inner = self.0.read().await;
        let key = inner.key.as_ref().ok_or("Database locked")?.clone();
        let data_dir = inner.data_dir.clone();
        drop(inner);

        // Backup the unencrypted file
        fs::create_dir_all(backup_dir).map_err(|e| e.to_string())?;
        let backup_path = backup_dir.join(format!(
            "{}.unencrypted.bak",
            plain_path.file_name().unwrap_or_default().to_string_lossy()
        ));
        fs::copy(plain_path, &backup_path).map_err(|e| e.to_string())?;

        // Open unencrypted source
        let plain_opts = SqliteConnectOptions::new()
            .filename(plain_path)
            .journal_mode(SqliteJournalMode::Wal);
        let plain_pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(plain_opts)
            .await
            .map_err(|e| e.to_string())?;

        // Target encrypted path (temp name to avoid clobbering)
        let enc_path = data_dir.join(format!("{module}.enc_new.db"));
        encrypt_via_export(&plain_pool, &enc_path, &key).await?;

        plain_pool.close().await;

        // Atomically replace the original
        let target = plain_path;
        fs::rename(&enc_path, target).map_err(|e| e.to_string())?;
        // Remove WAL/SHM siblings from unencrypted pool if present
        let _ = fs::remove_file(format!("{}-wal", plain_path.display()));
        let _ = fs::remove_file(format!("{}-shm", plain_path.display()));

        Ok(())
    }
}

// ── Key derivation ────────────────────────────────────────────────────────────

fn derive_key(password: &str, salt: &[u8; 32]) -> Result<DerivedKey, String> {
    let params = Params::new(
        ARGON2_MEMORY_KIB,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(ARGON2_OUTPUT_LEN),
    )
    .map_err(|e| format!("Argon2 params: {e}"))?;

    let argon2 = Argon2::new(Argon2id, V0x13, params);
    let mut output = [0u8; ARGON2_OUTPUT_LEN];

    argon2
        .hash_password_into(password.as_bytes(), salt, &mut output)
        .map_err(|e| format!("Argon2 KDF: {e}"))?;

    Ok(DerivedKey::new(output))
}

fn validate_password_strength(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Master password must be at least 8 characters.".to_string());
    }
    if password.len() > 512 {
        return Err("Master password must be 512 characters or fewer.".to_string());
    }
    Ok(())
}

// ── Keyring helpers ───────────────────────────────────────────────────────────

fn load_salt() -> Result<String, String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_SALT_KEY).map_err(|e| e.to_string())?;
    entry
        .get_password()
        .map_err(|_| "No master password configured. Please set up encryption first.".to_string())
}

fn store_salt(salt_hex: &str) -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_SALT_KEY).map_err(|e| e.to_string())?;
    entry.set_password(salt_hex).map_err(|e| e.to_string())
}

fn store_setup_flag() -> Result<(), String> {
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_SETUP_KEY).map_err(|e| e.to_string())?;
    entry.set_password("1").map_err(|e| e.to_string())
}

pub fn encryption_is_configured() -> bool {
    Entry::new(KEYRING_SERVICE, KEYRING_SETUP_KEY)
        .ok()
        .and_then(|e| e.get_password().ok())
        .as_deref()
        == Some("1")
}

// ── Pool construction ─────────────────────────────────────────────────────────

async fn open_all_pools(
    key: &DerivedKey,
    data_dir: &Path,
) -> Result<std::collections::HashMap<String, SqlitePool>, String> {
    let mut pools = std::collections::HashMap::new();
    for (module, filename) in MODULE_DB_FILES {
        let path = data_dir.join(filename);
        let pool = open_encrypted_pool(&path, key, pool_size_for_module(module)).await?;
        pools.insert(module.to_string(), pool);
    }
    Ok(pools)
}

fn pool_size_for_module(module: &str) -> u32 {
    if module == "main" {
        MAIN_DB_MAX_CONNECTIONS
    } else {
        MODULE_DB_MAX_CONNECTIONS
    }
}

async fn open_module_pool(
    module: &str,
    data_dir: &Path,
    key: &DerivedKey,
    max_connections: u32,
) -> Result<SqlitePool, String> {
    let path = module_db_path(module, data_dir)?;
    open_encrypted_pool(&path, key, max_connections).await
}

async fn open_plaintext_module_pool(
    module: &str,
    data_dir: &Path,
    max_connections: u32,
) -> Result<SqlitePool, String> {
    let path = module_db_path(module, data_dir)?;
    let options = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        .pragma("journal_size_limit", "67108864")
        .pragma("busy_timeout", "5000");

    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .min_connections(1)
        .acquire_timeout(DB_ACQUIRE_TIMEOUT)
        .acquire_slow_threshold(DB_ACQUIRE_SLOW_THRESHOLD)
        .test_before_acquire(false)
        .connect_with(options)
        .await
        .map_err(|error| error.to_string())?;

    Ok(pool)
}

/// Check if a database file is already encrypted by reading its header.
/// SQLCipher databases start with the salt bytes in the first 16 bytes,
/// which differ from the SQLite header magic ("SQLite format 3\000").
fn is_encrypted_database(path: &Path) -> bool {
    let mut header = [0u8; 16];
    use std::io::Read;
    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };
    if file.read_exact(&mut header).is_err() {
        return false;
    }
    // SQLite header starts with "SQLite format 3\000" (16 bytes)
    // SQLCipher encrypted databases have random-looking bytes here
    let sqlite_magic = b"SQLite format 3\0";
    header != *sqlite_magic
}

/// Emit a progress event for the encryption setup UI.
fn emit_progress(app: Option<&tauri::AppHandle>, phase: &str, percent: u32, message: &str) {
    let Some(app) = app else { return };
    #[derive(Clone, serde::Serialize)]
    struct ProgressPayload {
        phase: String,
        percent: u32,
        message: String,
    }
    let _ = app.emit(
        "crypto:setup-progress",
        ProgressPayload {
            phase: phase.to_string(),
            percent,
            message: message.to_string(),
        },
    );
}

/// Count total rows across all tables in a database pool.
/// Used for data integrity verification after migration.
async fn count_all_rows(pool: &SqlitePool) -> Result<i64, String> {
    let tables: Vec<(String,)> = sqlx::query_as(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut total: i64 = 0;
    for (table,) in &tables {
        let escaped = table.replace('"', "\"\"");
        let count: (i64,) = sqlx::query_as(&format!("SELECT COUNT(*) FROM \"{escaped}\""))
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Count {table}: {e}"))?;
        total += count.0;
    }
    Ok(total)
}

fn module_db_path(module: &str, data_dir: &Path) -> Result<PathBuf, String> {
    let filename = MODULE_DB_FILES
        .iter()
        .find(|(name, _)| *name == module)
        .map(|(_, filename)| *filename)
        .ok_or_else(|| format!("Unknown module database: {module}"))?;

    Ok(data_dir.join(filename))
}

/// Open one encrypted SQLite pool. The PRAGMA key must be set before ANY
/// other statement — sqlx's AfterConnect hook is the correct place.
pub async fn open_encrypted_pool(
    path: &Path,
    key: &DerivedKey,
    max_connections: u32,
) -> Result<SqlitePool, String> {
    let pragma_key = key.as_sqlcipher_pragma();

    // SqliteConnectOptions does not have a cipher hook, so we set it
    // via the after_connect hook on the pool options.
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true)
        // sqlx 0.8 supports pragma() on connect options for SQLite
        .pragma("journal_size_limit", "67108864") // 64 MiB WAL limit
        .pragma("busy_timeout", "5000");

    let pool = SqlitePoolOptions::new()
        .max_connections(max_connections)
        .min_connections(1)
        .acquire_timeout(DB_ACQUIRE_TIMEOUT)
        .acquire_slow_threshold(DB_ACQUIRE_SLOW_THRESHOLD)
        .test_before_acquire(false)
        // after_connect: set the cipher key and tuning pragmas
        .after_connect(move |conn, _meta| {
            let key_str = pragma_key.clone();
            Box::pin(async move {
                // Set encryption key — MUST be the very first statement
                sqlx::query(&format!("PRAGMA key = \"{key_str}\""))
                    .execute(&mut *conn)
                    .await?;
                // Tune cipher parameters
                sqlx::query(&format!("PRAGMA cipher_page_size = {CIPHER_PAGE_SIZE}"))
                    .execute(&mut *conn)
                    .await?;
                // Use 1 KDF iteration since we pre-derive with Argon2id
                sqlx::query(&format!("PRAGMA kdf_iter = {CIPHER_KDF_ITER}"))
                    .execute(&mut *conn)
                    .await?;
                // SQLCipher 4 default — HMAC-SHA512
                sqlx::query("PRAGMA cipher_hmac_algorithm = HMAC_SHA512")
                    .execute(&mut *conn)
                    .await?;
                sqlx::query("PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512")
                    .execute(&mut *conn)
                    .await?;
                // Validate: this will fail if key is wrong
                sqlx::query("SELECT count(*) FROM sqlite_master")
                    .execute(&mut *conn)
                    .await?;
                Ok(())
            })
        })
        .connect_with(options)
        .await
        .map_err(|e| {
            let error = e.to_string();
            if is_sqlcipher_key_error(&error) {
                "Incorrect master password or corrupted database.".to_string()
            } else {
                error
            }
        })?;

    Ok(pool)
}

fn is_sqlcipher_key_error(error: &str) -> bool {
    error.contains("file is not a database") || error.contains("not a database")
}

// ── Re-key (change password) ──────────────────────────────────────────────────

/// Re-encrypt a single database file from old_key → new_key using
/// sqlcipher_export(). This is the only safe atomic re-encryption method.
async fn rekey_database(
    db_path: &Path,
    old_key: &DerivedKey,
    new_key: &DerivedKey,
    data_dir: &Path,
    module: &str,
) -> Result<(), String> {
    let old_pool = open_encrypted_pool(db_path, old_key, 1).await?;
    let new_path = data_dir.join(format!("{module}.rekey_tmp.db"));
    encrypt_via_export(&old_pool, &new_path, new_key).await?;
    old_pool.close().await;

    fs::rename(&new_path, db_path).map_err(|e| e.to_string())?;
    // Remove WAL/SHM from old file
    let _ = fs::remove_file(format!("{}-wal", db_path.display()));
    let _ = fs::remove_file(format!("{}-shm", db_path.display()));

    Ok(())
}

/// Export source pool into a new encrypted database at `dest_path`.
/// sqlcipher_export() copies page-by-page — works even for in-use databases.
///
/// Security notes:
/// - `dest_key` is internally generated (Argon2id derivation), not user input.
/// - `key_pragma` format is always `x'<64-hex-chars>'` — hex charset is safe
///   for SQL interpolation. Path is SQL-escaped with single-quote doubling.
/// - WAL is checkpointed before export to ensure all data is in the main DB.
async fn encrypt_via_export(
    source_pool: &SqlitePool,
    dest_path: &Path,
    dest_key: &DerivedKey,
) -> Result<(), String> {
    // Checkpoint WAL to ensure all data is in the main database file
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(source_pool)
        .await
        .map_err(|e| format!("WAL checkpoint failed: {e}"))?;

    let dest_str = dest_path
        .to_str()
        .ok_or("Non-UTF8 destination path")?
        .replace('\'', "''"); // SQL-escape the path

    let key_pragma = dest_key.as_sqlcipher_pragma();

    // ATTACH the destination as an encrypted database
    sqlx::query(&format!(
        "ATTACH DATABASE '{dest_str}' AS encrypted KEY \"{key_pragma}\""
    ))
    .execute(source_pool)
    .await
    .map_err(|e| e.to_string())?;

    // Set cipher params on the attached database
    sqlx::query(&format!(
        "PRAGMA encrypted.cipher_page_size = {CIPHER_PAGE_SIZE}"
    ))
    .execute(source_pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(&format!("PRAGMA encrypted.kdf_iter = {CIPHER_KDF_ITER}"))
        .execute(source_pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("PRAGMA encrypted.cipher_hmac_algorithm = HMAC_SHA512")
        .execute(source_pool)
        .await
        .map_err(|e| e.to_string())?;

    // Export all pages
    sqlx::query("SELECT sqlcipher_export('encrypted')")
        .execute(source_pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("DETACH DATABASE encrypted")
        .execute(source_pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Backup ────────────────────────────────────────────────────────────────────

pub fn create_backup(data_dir: &Path, backup_dir: &Path) -> Result<PathBuf, String> {
    let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let backup_target = backup_dir.join(format!("bento-backup-{timestamp}"));
    fs::create_dir_all(&backup_target).map_err(|e| e.to_string())?;

    for (_, filename) in MODULE_DB_FILES {
        let src = data_dir.join(filename);
        if src.exists() {
            fs::copy(&src, backup_target.join(filename))
                .map_err(|e| format!("Backup {filename}: {e}"))?;
        }
    }

    Ok(backup_target)
}