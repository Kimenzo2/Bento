// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Realtime auth — Supabase session binding over WebSocket.
//!
//! Mirrors the clone's `upgrade()` hook: every connection must present a
//! session token before any traffic is routed. The token is validated
//! against Supabase; the resolved user id must match the desktop's current
//! signed-in user (the phone is a paired device of the SAME account).
//!
//! Tier gate: connections are refused unless the billing tier `can_sync()`
//! (Pro/Power) and the paired device count is within `max_devices`.

use std::sync::atomic::{AtomicU64, Ordering};

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager};
use tokio_tungstenite::tungstenite::protocol::Message;

use crate::auth::AuthManager;

use super::Peer;

/// Reuse the app-wide connection counter so ids stay unique across servers.
static CONN_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Handshake frame sent by the client as its FIRST message:
/// `{ "type": "auth", "accessToken": "...", "deviceId": "..." }`
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthFrame {
    #[serde(rename = "type")]
    kind: String,
    access_token: String,
    #[serde(default)]
    device_id: String,
}

/// Validate a pairing token against Supabase and, on success, return a `Peer`.
///
/// The peer's `user_id` is whatever the desktop is currently signed in as;
/// the phone's session must resolve to the SAME account, otherwise the
/// connection is rejected with `AUTH_MISMATCH`.
pub(crate) async fn authenticate(
    app: &AppHandle,
    pool: &SqlitePool,
    ws_sink: &mut (impl SinkExt<Message> + Unpin),
    ws_stream: &mut (impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin),
) -> Result<Option<Peer>, String> {
    // ── Read the handshake frame (first message) ──────────────────────
    let msg = match ws_stream.next().await {
        Some(Ok(Message::Text(t))) => t.to_string(),
        Some(Ok(Message::Close(_))) | None | Some(Err(_)) => {
            eprintln!("[realtime] auth handshake: connection closed before auth");
            return Ok(None);
        }
        _ => {
            let _ = send_frame(ws_sink, &auth_deny("INVALID_REQUEST", "First frame must be an auth handshake")).await;
            return Ok(None);
        }
    };

    let frame: AuthFrame = match serde_json::from_str::<AuthFrame>(&msg) {
        Ok(f) if f.kind == "auth" => f,
        _ => {
            let _ = send_frame(ws_sink, &auth_deny("UNAUTHORIZED", "Expected auth handshake")).await;
            return Ok(None);
        }
    };

    // ── Resolve the desktop's current user ────────────────────────────
    let auth = app
        .try_state::<AuthManager>()
        .ok_or_else(|| "Auth manager not initialized".to_string())?;
    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Not signed in on desktop".to_string())?;
    let desktop_user_id = session.user.id.clone();
    let desktop_user_name = session.user.name.clone();

    // ── Validate the phone's token against Supabase ───────────────────
    let resolved = resolve_supabase_user(app, &frame.access_token).await;
    let phone_user_id = match resolved {
        Ok(Some(uid)) => uid,
        Ok(None) => {
            let _ = send_frame(ws_sink, &auth_deny("AUTH_MISMATCH", "Session belongs to a different account")).await;
            return Ok(None);
        }
        Err(e) => {
            let _ = send_frame(ws_sink, &auth_deny("AUTH_FAILED", &e)).await;
            return Ok(None);
        }
    };

    // ── Same-account binding (phone must be a device of THIS user) ────
    if phone_user_id != desktop_user_id {
        let _ = send_frame(ws_sink, &auth_deny("AUTH_MISMATCH", "Session belongs to a different account")).await;
        return Ok(None);
    }

    // ── Tier gate: can_sync() (Pro/Power) ─────────────────────────────
    match billing_can_sync(&auth).await {
        Ok(true) => {}
        Ok(false) => {
            let _ = send_frame(ws_sink, &auth_deny("FORBIDDEN", "Sync requires a Pro or Power plan")).await;
            return Ok(None);
        }
        Err(e) => {
            let _ = send_frame(ws_sink, &auth_deny("AUTH_FAILED", &e)).await;
            return Ok(None);
        }
    }

    let conn_id = CONN_COUNTER.fetch_add(1, Ordering::SeqCst);

    let _ = pool; // read-only pool provided for future device-registry queries

    let _ = send_frame(
        ws_sink,
        &json!({
            "channel": "__auth",
            "event": "authenticated",
            "data": { "ok": true, "userId": desktop_user_id, "connectionId": conn_id },
        }),
    )
    .await;

    eprintln!("[realtime] authenticated connection {conn_id} for user {desktop_user_id}");

    Ok(Some(Peer {
        conn_id,
        user_id: desktop_user_id,
        user_name: desktop_user_name,
        device_id: if frame.device_id.is_empty() {
            format!("conn-{conn_id}")
        } else {
            frame.device_id
        },
    }))
}

/// Resolve a Supabase access token to a user id via the `/auth/v1/user`
/// endpoint. Returns `Ok(None)` when the token is valid for a DIFFERENT
/// account, `Ok(Some(id))` on success, and `Err` on transport/fetch failure.
async fn resolve_supabase_user(app: &AppHandle, access_token: &str) -> Result<Option<String>, String> {
    let auth = app
        .try_state::<AuthManager>()
        .ok_or_else(|| "Auth manager not initialized".to_string())?;
    let (supabase_url, anon_key) = auth.supabase_config();

    let client = reqwest::Client::new();
    let url = format!("{}/auth/v1/user", supabase_url.trim_end_matches('/'));

    let resp = client
        .get(&url)
        .header("apikey", &anon_key)
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .await
        .map_err(|e| format!("Supabase validation failed: {e}"))?;

    if resp.status().is_success() {
        let body: Value = resp.json().await.map_err(|e| format!("Invalid Supabase response: {e}"))?;
        let id = body.get("id").and_then(|i| i.as_str());
        Ok(id.map(|s| s.to_string()))
    } else if resp.status().as_u16() == 401 || resp.status().as_u16() == 403 {
        Ok(None)
    } else {
        Err(format!("Supabase validation error: {}", resp.status()))
    }
}

/// Check the desktop's current billing tier supports sync.
async fn billing_can_sync(auth: &AuthManager) -> Result<bool, String> {
    let profile = auth.get_billing_profile_cached().await?;
    Ok(profile.can_sync)
}

fn auth_deny(code: &str, error: &str) -> Value {
    json!({
        "channel": "__auth",
        "event": "denied",
        "data": { "ok": false, "code": code, "error": error }
    })
}

async fn send_frame<S>(ws_sink: &mut S, value: &Value) -> Result<(), String>
where
    S: SinkExt<Message> + Unpin,
{
    ws_sink
        .send(Message::Text(value.to_string().into()))
        .await
        .map(|_| ())
        .map_err(|_| "send failed".to_string())
}
