// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use keyring::Entry;
use tokio::task::spawn_blocking;

const KEYRING_SERVICE: &str = "Bento Desktop";

/// Keyring account suffix per native app. Kept distinct from the Composio
/// per-app accounts so the two credential namespaces never collide.
fn account(app_key: &str) -> String {
    format!("integrations-native-{app_key}")
}

/// Credentials for a native (locally-executed) integration. The whole struct
/// is serialized as one keyring secret so a single entry holds whatever the
/// app needs (OAuth tokens, API key, basic creds, or a pasted token).
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct NativeCredentials {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at_ms: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Serialized OAuth token response from the provider (kept verbatim so
    /// provider-specific fields survive a round-trip through the keyring).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw_oauth: Option<serde_json::Value>,
}

impl NativeCredentials {
    pub fn is_oauth(&self) -> bool {
        self.access_token.is_some()
    }

    /// True when the stored OAuth access token has expired and needs a refresh.
    pub fn oauth_expired(&self) -> bool {
        match self.expires_at_ms {
            Some(exp) => {
                crate::util::time::now_ms() >= exp.saturating_sub(60_000)
            }
            None => false,
        }
    }

    pub fn oauth_access_token(&self) -> Option<&str> {
        self.access_token.as_deref()
    }
}

pub async fn save(app_key: &str, creds: &NativeCredentials) -> Result<(), String> {
    let account = account(app_key);
    let payload = serde_json::to_string(creds).map_err(|e| format!("Serialize failed: {e}"))?;
    spawn_blocking(move || -> Result<(), String> {
        let entry = Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Keyring error: {e}"))?;
        entry
            .set_password(&payload)
            .map_err(|e| format!("Failed to save native credentials: {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}

pub async fn get(app_key: &str) -> Result<Option<NativeCredentials>, String> {
    let account = account(app_key);
    let result = spawn_blocking(move || {
        let entry = match Entry::new(KEYRING_SERVICE, &account) {
            Ok(e) => e,
            Err(_) => return Ok(None),
        };
        match entry.get_password() {
            Ok(raw) if !raw.is_empty() => {
                let creds: NativeCredentials =
                    serde_json::from_str(&raw).map_err(|e| format!("Parse failed: {e}"))?;
                Ok(Some(creds))
            }
            Ok(_) => Ok(None),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to read native credentials: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))??;

    // Auto-migration: if native keyring has no entry, check the Composio
    // per-app keyring (used by old ApiKey connections) and migrate forward.
    if result.is_none() {
        let composio_account = format!("integrations-key-{app_key}");
        let migrated: Option<String> = spawn_blocking(move || {
            let entry = match Entry::new(KEYRING_SERVICE, &composio_account) {
                Ok(e) => e,
                Err(_) => return None,
            };
            match entry.get_password() {
                Ok(raw) if !raw.is_empty() => Some(raw),
                _ => None,
            }
        })
        .await
        .unwrap_or(None);

        if let Some(raw_key) = migrated {
            // Auto-discover chat_id for Telegram bots during migration
            let chat_id = if app_key == "telegram" {
                discover_telegram_chat_id(&raw_key).await
            } else {
                None
            };
            let creds = NativeCredentials {
                api_key: Some(raw_key),
                username: chat_id,
                ..Default::default()
            };
            let _ = save(app_key, &creds).await;
            return Ok(Some(creds));
        }
    }

    Ok(result)
}

/// Auto-discover the user's chat ID by calling Telegram's getUpdates.
pub async fn discover_telegram_chat_id(bot_token: &str) -> Option<String> {
    let url = format!("https://api.telegram.org/bot{bot_token}/getUpdates?limit=10");
    let resp = reqwest::get(&url).await.ok()?;
    let body: serde_json::Value = resp.json().await.ok()?;
    let updates = body.get("result")?.as_array()?;
    for update in updates {
        let msg = update.get("message")?;
        let chat = msg.get("chat")?;
        let chat_type = chat.get("type")?.as_str()?;
        if chat_type == "private" {
            let id = chat.get("id")?.as_i64()?;
            return Some(id.to_string());
        }
    }
    None
}

pub async fn delete(app_key: &str) -> Result<(), String> {
    let account = account(app_key);
    spawn_blocking(move || {
        let entry = Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Keyring error: {e}"))?;
        match entry.delete_credential() {
            Ok(_) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("Failed to delete native credentials: {e}")),
        }
    })
    .await
    .map_err(|e| format!("Task join failed: {e}"))?
}
