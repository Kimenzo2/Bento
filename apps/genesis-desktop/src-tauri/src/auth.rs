use std::{
    env,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use chrono::{DateTime, Utc};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use keyring::Entry;
use rand::{RngCore, thread_rng};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_oauth::{OauthConfig, start_with_config};
use tokio::{
    sync::Mutex,
    time::{Duration, sleep},
};
use url::Url;

use crate::window_bounds::restore_main_window;

const AUTH_KEYRING_SERVICE: &str = "Genesis Desktop";
const AUTH_KEYRING_ACCOUNT: &str = "supabase-session";
const SUPABASE_REDIRECT_STATE_TTL_MS: i64 = 5 * 60 * 1000;
const SUPABASE_REFRESH_CHECK_INTERVAL_MS: u64 = 5 * 60 * 1000;
const SUPABASE_REFRESH_WINDOW_MS: i64 = 10 * 60 * 1000;
const SUPABASE_OAUTH_PORT: u16 = 47831;
const LOGIN_WINDOW_WIDTH: f64 = 400.0;
const LOGIN_WINDOW_HEIGHT: f64 = 480.0;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AuthUser {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub email: String,
    pub avatar_url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StoredAuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at_ms: i64,
    pub user: AuthUser,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum AuthBootstrapState {
    LoginRequired,
    Restored { user: AuthUser },
}

impl AuthBootstrapState {
    pub fn login_required() -> Self {
        Self::LoginRequired
    }

    pub fn restored(user: AuthUser) -> Self {
        Self::Restored { user }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSuccessPayload {
    pub user: AuthUser,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingProfilePayload {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub avatar_url: String,
    pub user_tier: String,
    pub payment_provider: Option<String>,
    pub subscription_status: Option<String>,
    pub subscription_plan_code: Option<String>,
    pub billing_tier: String,
    pub max_devices: i32,
    pub ai_access_level: String,
    pub can_sync: bool,
    pub active_plan_code: Option<String>,
    pub has_active_subscription: bool,
    pub subscription_end_date: Option<String>,
    pub cancel_at_period_end: Option<bool>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum BillingTier {
    Free,
    Core,
    Pro,
    Power,
}

impl BillingTier {
    fn display_label(self) -> &'static str {
        match self {
            BillingTier::Free => "Free",
            BillingTier::Core => "Core",
            BillingTier::Pro => "Pro",
            BillingTier::Power => "Power",
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            BillingTier::Free => "free",
            BillingTier::Core => "core",
            BillingTier::Pro => "pro",
            BillingTier::Power => "power",
        }
    }

    fn max_devices(self) -> i32 {
        match self {
            BillingTier::Free | BillingTier::Core => 1,
            BillingTier::Pro => 3,
            BillingTier::Power => 99,
        }
    }

    fn ai_access_level(self) -> &'static str {
        match self {
            BillingTier::Free | BillingTier::Core => "none",
            BillingTier::Pro => "basic",
            BillingTier::Power => "advanced",
        }
    }

    fn can_sync(self) -> bool {
        matches!(self, BillingTier::Pro | BillingTier::Power)
    }

    fn from_subscription(
        payment_provider: Option<&str>,
        subscription_status: Option<&str>,
        subscription_plan_code: Option<&str>,
        subscription_end_date: Option<&str>,
        cancel_at_period_end: Option<bool>,
    ) -> Self {
        if !subscription_is_access_active(
            payment_provider,
            subscription_status,
            subscription_end_date,
            cancel_at_period_end,
        ) {
            return BillingTier::Free;
        }

        match subscription_plan_code
            .map(str::trim)
            .map(str::to_lowercase)
            .as_deref()
        {
            Some("creator") => BillingTier::Core,
            Some("studio") => BillingTier::Pro,
            Some("empire") => BillingTier::Power,
            _ => BillingTier::Free,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthErrorPayload {
    pub message: String,
}

#[derive(Clone, Debug)]
struct AuthConfig {
    supabase_url: String,
    supabase_anon_key: String,
    service_role_key: Option<String>,
}

#[derive(Clone, Debug)]
struct ActiveAuthFlow {
    state: String,
    code_verifier: String,
    port: u16,
    started_at_ms: i64,
}

struct AuthRuntimeState {
    bootstrap: AuthBootstrapState,
    session: Option<StoredAuthSession>,
    active_flow: Option<ActiveAuthFlow>,
    refresh_task_started: bool,
}

impl Default for AuthRuntimeState {
    fn default() -> Self {
        Self {
            bootstrap: AuthBootstrapState::login_required(),
            session: None,
            active_flow: None,
            refresh_task_started: false,
        }
    }
}

struct AuthInner {
    config: AuthConfig,
    state: Mutex<AuthRuntimeState>,
}

#[derive(Clone)]
pub struct AuthManager {
    inner: Arc<AuthInner>,
}

impl AuthManager {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            inner: Arc::new(AuthInner {
                config: AuthConfig::from_env()?,
                state: Mutex::new(AuthRuntimeState::default()),
            }),
        })
    }

    pub async fn bootstrap(&self, app: AppHandle) -> Result<AuthBootstrapState, String> {
        let cached_bootstrap = {
            let state = self.inner.state.lock().await;
            match state.bootstrap {
                AuthBootstrapState::LoginRequired => None,
                AuthBootstrapState::Restored { ref user } => Some(AuthBootstrapState::Restored {
                    user: user.clone(),
                }),
            }
        };

        if let Some(bootstrap) = cached_bootstrap {
            return Ok(bootstrap);
        }

        let loaded_session = self.load_session_from_keyring()?;
        let next_state = match loaded_session {
            Some(session) => {
                if session.expires_at_ms <= unix_ms() {
                    match self.refresh_session(&session.refresh_token).await {
                        Ok(refreshed) => {
                            self.persist_session(&refreshed)?;
                            self.set_session(refreshed.clone()).await;
                            self.ensure_refresh_loop(app.clone());
                            self.spawn_profile_sync(refreshed.clone());
                            AuthBootstrapState::restored(refreshed.user)
                        }
                        Err(_) => {
                            self.clear_session().await;
                            self.delete_session_from_keyring();
                            AuthBootstrapState::login_required()
                        }
                    }
                } else {
                    self.set_session(session.clone()).await;
                    self.ensure_refresh_loop(app.clone());
                    self.spawn_profile_sync(session.clone());
                    AuthBootstrapState::restored(session.user)
                }
            }
            None => AuthBootstrapState::login_required(),
        };

        self.set_bootstrap(next_state.clone()).await;
        Ok(next_state)
    }

    pub async fn snapshot(&self) -> AuthBootstrapState {
        let state = self.inner.state.lock().await;
        match &state.bootstrap {
            AuthBootstrapState::LoginRequired => AuthBootstrapState::LoginRequired,
            AuthBootstrapState::Restored { user } => AuthBootstrapState::Restored {
                user: user.clone(),
            },
        }
    }

    pub async fn start_google_login(&self, app: AppHandle) -> Result<(), String> {
        let flow = self.new_flow();

        {
            let mut state = self.inner.state.lock().await;
            if state.active_flow.is_some() {
                return Err("An auth flow is already active.".to_string());
            }
            state.active_flow = Some(flow.clone());
        }

        let manager = self.clone();
        let app_for_callback = app.clone();
        let port = start_with_config(
            OauthConfig {
                ports: Some(vec![SUPABASE_OAUTH_PORT]),
                response: None,
            },
            move |redirect_url| {
                let manager = manager.clone();
                let app = app_for_callback.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = manager.handle_redirect(app.clone(), redirect_url).await {
                        manager.emit_error(&app, error).await;
                    }
                });
            },
        )
        .map_err(|error| error.to_string())?;

        {
            let mut state = self.inner.state.lock().await;
            if let Some(active_flow) = state.active_flow.as_mut() {
                active_flow.port = port;
            }
        }

        let auth_url = self.build_authorize_url(&flow)?;
        app.opener()
            .open_url(auth_url.as_str(), None::<&str>)
            .map_err(|error| error.to_string())?;

        self.spawn_timeout_watchdog(app, port, flow.started_at_ms);
        Ok(())
    }

    pub async fn prepare_login_window(window: WebviewWindow) -> Result<(), String> {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize::new(
                LOGIN_WINDOW_WIDTH,
                LOGIN_WINDOW_HEIGHT,
            )))
            .map_err(|error| error.to_string())?;
        window.center().map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        window.set_focus().map_err(|error| error.to_string())?;
        Ok(())
    }

    pub async fn prepare_shell_window(window: WebviewWindow) -> Result<(), String> {
        restore_main_window(&window).map_err(|error| error.to_string())?;
        Ok(())
    }

    pub async fn sign_out(&self) -> Result<(), String> {
        self.clear_session().await;
        self.delete_session_from_keyring();
        self.set_bootstrap(AuthBootstrapState::login_required()).await;
        Ok(())
    }

    pub async fn begin_dodo_checkout(&self, app: AppHandle, plan: String) -> Result<(), String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in before starting checkout.".to_string())?;

        let checkout_url = self.create_dodo_checkout(&session, &plan).await?;
        app.opener()
            .open_url(checkout_url.as_str(), None::<&str>)
            .map_err(|error| error.to_string())
    }

    pub async fn begin_dodo_portal(&self, app: AppHandle) -> Result<(), String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in before opening billing management.".to_string())?;

        let portal_url = self.create_dodo_portal(&session).await?;
        app.opener()
            .open_url(portal_url.as_str(), None::<&str>)
            .map_err(|error| error.to_string())
    }

    pub async fn get_billing_profile(&self) -> Result<BillingProfilePayload, String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to view billing.".to_string())?;
        self.fetch_billing_profile(&session).await
    }

    pub async fn update_display_name(&self, display_name: String) -> Result<AuthUser, String> {
        let trimmed = display_name.trim();
        if trimmed.is_empty() {
            return Err("Display name cannot be empty.".to_string());
        }
        if trimmed.len() > 100 {
            return Err("Display name must be 100 characters or fewer.".to_string());
        }

        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to update your display name.".to_string())?;
        if session.user.id.trim().is_empty() {
            return Err("Authenticated session is missing a user id.".to_string());
        }

        self.patch_profile_display_name(&session, trimmed).await?;

        let mut updated_session = session.clone();
        updated_session.user.name = trimmed.to_string();
        self.persist_session(&updated_session)?;
        self.set_session(updated_session.clone()).await;
        self.set_bootstrap(AuthBootstrapState::restored(updated_session.user.clone()))
            .await;

        Ok(updated_session.user)
    }

    pub async fn sync_profile_now(&self) -> Result<(), String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to sync your profile.".to_string())?;
        self.sync_profile_to_supabase(&session).await
    }

    pub async fn delete_account(&self) -> Result<(), String> {
        let session = self
            .current_session()
            .await
            .ok_or_else(|| "Sign in to delete your account.".to_string())?;

        let service_role_key = self
            .inner
            .config
            .service_role_key
            .as_ref()
            .ok_or_else(|| {
                "Deleting an account requires SUPABASE_SERVICE_ROLE_KEY to be configured."
                    .to_string()
            })?;

        if session.user.id.trim().is_empty() {
            return Err("Authenticated session is missing a user id.".to_string());
        }

        let client = Client::new();
        let url = format!(
            "{}/auth/v1/admin/users/{}",
            self.inner.config.supabase_url.trim_end_matches('/'),
            session.user.id
        );

        let response = client
            .delete(url)
            .header("apikey", service_role_key)
            .header("Authorization", format!("Bearer {service_role_key}"))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase account deletion failed: {text}"));
        }

        self.clear_session().await;
        self.delete_session_from_keyring();
        self.set_bootstrap(AuthBootstrapState::login_required()).await;
        Ok(())
    }

    async fn set_session(&self, session: StoredAuthSession) {
        let mut state = self.inner.state.lock().await;
        state.session = Some(session);
    }

    pub async fn current_session(&self) -> Option<StoredAuthSession> {
        let state = self.inner.state.lock().await;
        state.session.clone()
    }

    async fn clear_session(&self) {
        let mut state = self.inner.state.lock().await;
        state.session = None;
        state.active_flow = None;
        state.refresh_task_started = false;
    }

    fn delete_session_from_keyring(&self) {
        if let Ok(entry) = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_ACCOUNT) {
            let _ = entry.delete_credential();
        }
    }

    async fn set_bootstrap(&self, bootstrap: AuthBootstrapState) {
        let mut state = self.inner.state.lock().await;
        state.bootstrap = bootstrap;
    }

    fn ensure_refresh_loop(&self, app: AppHandle) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            let should_start = {
                let mut state = manager.inner.state.lock().await;
                if state.refresh_task_started {
                    false
                } else {
                    state.refresh_task_started = true;
                    true
                }
            };

            if !should_start {
                return;
            }

            loop {
                sleep(Duration::from_millis(SUPABASE_REFRESH_CHECK_INTERVAL_MS)).await;

                let session = {
                    let state = manager.inner.state.lock().await;
                    state.session.clone()
                };

                let Some(session) = session else {
                    break;
                };

                if session.expires_at_ms - unix_ms() > SUPABASE_REFRESH_WINDOW_MS {
                    continue;
                }

                match manager.refresh_session(&session.refresh_token).await {
                    Ok(refreshed) => {
                        if manager.persist_session(&refreshed).is_ok() {
                            manager.set_session(refreshed.clone()).await;
                            manager
                                .set_bootstrap(AuthBootstrapState::restored(refreshed.user.clone()))
                                .await;
                            manager.spawn_profile_sync(refreshed.clone());
                        }
                    }
                    Err(error) => {
                        manager.clear_session().await;
                        manager.delete_session_from_keyring();
                        manager.emit_session_expired(&app, error).await;
                        break;
                    }
                }
            }
        });
    }

    fn spawn_timeout_watchdog(&self, app: AppHandle, port: u16, started_at_ms: i64) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            sleep(Duration::from_millis(SUPABASE_REDIRECT_STATE_TTL_MS as u64)).await;

            let is_still_active = {
                let state = manager.inner.state.lock().await;
                state
                    .active_flow
                    .as_ref()
                    .map(|flow| flow.port == port && flow.started_at_ms == started_at_ms)
                    .unwrap_or(false)
            };

            if !is_still_active {
                return;
            }

            let _ = tauri_plugin_oauth::cancel(port);
            manager.clear_flow().await;
            manager
                .emit_error(&app, "OAuth login timed out after 5 minutes.".to_string())
                .await;
        });
    }

    async fn clear_flow(&self) {
        let mut state = self.inner.state.lock().await;
        state.active_flow = None;
    }

    fn new_flow(&self) -> ActiveAuthFlow {
        ActiveAuthFlow {
            state: random_urlsafe_token(32),
            code_verifier: random_urlsafe_token(96),
            port: 0,
            started_at_ms: unix_ms(),
        }
    }

    fn build_authorize_url(&self, flow: &ActiveAuthFlow) -> Result<Url, String> {
        let mut url = Url::parse(&format!(
            "{}/auth/v1/authorize",
            self.inner.config.supabase_url.trim_end_matches('/')
        ))
        .map_err(|error| error.to_string())?;

        let redirect_to = callback_url_with_state(&flow.state)?;
        let challenge = pkce_challenge(&flow.code_verifier);
        url.query_pairs_mut()
            .append_pair("provider", "google")
            .append_pair("redirect_to", redirect_to.as_str())
            .append_pair("code_challenge", &challenge)
            .append_pair("code_challenge_method", "S256");
        Ok(url)
    }

    async fn handle_redirect(&self, app: AppHandle, redirect_url: String) -> Result<(), String> {
        let flow = {
            let mut state = self.inner.state.lock().await;
            state.active_flow.take()
        }
        .ok_or_else(|| "No active auth flow is waiting for a callback.".to_string())?;

        let parsed = Url::parse(&redirect_url).map_err(|error| error.to_string())?;
        if let Some(error) = parsed
            .query_pairs()
            .find(|(key, _)| key == "error")
            .map(|(_, value)| value.to_string())
        {
            let _ = tauri_plugin_oauth::cancel(flow.port);
            let description = parsed
                .query_pairs()
                .find(|(key, _)| key == "error_description")
                .map(|(_, value)| value.to_string())
                .unwrap_or_else(|| "OAuth sign-in failed.".to_string());
            return Err(format!("{error}: {description}"));
        }

        let callback_state = parsed
            .query_pairs()
            .find(|(key, _)| key == "flow_state")
            .map(|(_, value)| value.to_string());
        if callback_state.as_deref() != Some(flow.state.as_str()) {
            let _ = tauri_plugin_oauth::cancel(flow.port);
            return Err("OAuth callback nonce mismatch.".to_string());
        }

        let code = parsed
            .query_pairs()
            .find(|(key, _)| key == "code")
            .map(|(_, value)| value.to_string())
            .ok_or_else(|| "OAuth callback did not include an authorization code.".to_string())?;

        let redirect_uri = callback_url_with_state(&flow.state)?.to_string();

        let session = self
            .exchange_code_for_session(&code, &flow.code_verifier, &redirect_uri)
            .await?;
        self.persist_session(&session)?;
        self.set_session(session.clone()).await;
        self.set_bootstrap(AuthBootstrapState::restored(session.user.clone()))
            .await;
        self.ensure_refresh_loop(app.clone());
        self.spawn_profile_sync(session.clone());
        let _ = tauri_plugin_oauth::cancel(flow.port);

        app.emit(
            "auth:success",
            AuthSuccessPayload {
                user: session.user.clone(),
            },
        )
        .map_err(|error| error.to_string())?;

        Ok(())
    }

    async fn emit_error(&self, app: &AppHandle, message: String) {
        let _ = app.emit("auth:error", AuthErrorPayload { message });
    }

    async fn emit_session_expired(&self, app: &AppHandle, message: String) {
        let _ = app.emit("auth:session_expired", AuthErrorPayload { message });
    }

    fn spawn_profile_sync(&self, session: StoredAuthSession) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = manager.sync_profile_to_supabase(&session).await {
                eprintln!("[Auth] Failed to sync profile to Supabase: {error}");
            }
        });
    }

    fn load_session_from_keyring(&self) -> Result<Option<StoredAuthSession>, String> {
        let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_ACCOUNT)
            .map_err(|error| error.to_string())?;

        match entry.get_password() {
            Ok(raw) => {
                let session: StoredAuthSession =
                    serde_json::from_str(&raw).map_err(|error| error.to_string())?;
                Ok(Some(session))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    fn persist_session(&self, session: &StoredAuthSession) -> Result<(), String> {
        let entry = Entry::new(AUTH_KEYRING_SERVICE, AUTH_KEYRING_ACCOUNT)
            .map_err(|error| error.to_string())?;
        let raw = serde_json::to_string(session).map_err(|error| error.to_string())?;
        entry.set_password(&raw).map_err(|error| error.to_string())
    }

    async fn exchange_code_for_session(
        &self,
        code: &str,
        code_verifier: &str,
        redirect_uri: &str,
    ) -> Result<StoredAuthSession, String> {
        let client = Client::new();
        let url = format!(
            "{}/auth/v1/token?grant_type=pkce",
            self.inner.config.supabase_url.trim_end_matches('/')
        );

        let response = client
            .post(url)
            .header("apikey", &self.inner.config.supabase_anon_key)
            .header(
                "Authorization",
                format!("Bearer {}", self.inner.config.supabase_anon_key),
            )
            .header("Content-Type", "application/json")
            .json(&json!({
                "auth_code": code,
                "code_verifier": code_verifier,
                "redirect_uri": redirect_uri,
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase auth exchange failed: {text}"));
        }

        let token: SupabaseTokenResponse = response.json().await.map_err(|error| error.to_string())?;
        Ok(StoredAuthSession {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_at_ms: token
                .expires_at
                .map(|seconds| seconds.saturating_mul(1000))
                .unwrap_or_else(|| unix_ms() + (token.expires_in.saturating_mul(1000))),
            user: map_supabase_user(token.user),
        })
    }

    async fn sync_profile_to_supabase(&self, session: &StoredAuthSession) -> Result<(), String> {
        if session.user.id.trim().is_empty() {
            return Ok(());
        }

        let client = Client::new();
        let url = format!(
            "{}/rest/v1/profiles?on_conflict=id",
            self.inner.config.supabase_url.trim_end_matches('/')
        );

        let payload = json!({
            "id": session.user.id,
            "email": session.user.email,
            "full_name": session.user.name,
            "display_name": session.user.name,
            "avatar_url": if session.user.avatar_url.is_empty() {
                Value::Null
            } else {
                Value::String(session.user.avatar_url.clone())
            },
            "gamification_data": default_gamification_data(),
        });

        let response = client
            .post(url)
            .header("apikey", &self.inner.config.supabase_anon_key)
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates,return=representation")
            .json(&payload)
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase profile sync failed: {text}"));
        }

        Ok(())
    }

    async fn patch_profile_display_name(
        &self,
        session: &StoredAuthSession,
        display_name: &str,
    ) -> Result<(), String> {
        let client = Client::new();
        let url = format!(
            "{}/rest/v1/profiles?id=eq.{}",
            self.inner.config.supabase_url.trim_end_matches('/'),
            session.user.id
        );

        let response = client
            .patch(url)
            .header("apikey", &self.inner.config.supabase_anon_key)
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Content-Type", "application/json")
            .header("Prefer", "return=representation")
            .json(&json!({
                "display_name": display_name,
                "full_name": display_name,
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase profile update failed: {text}"));
        }

        Ok(())
    }

    async fn refresh_session(&self, refresh_token: &str) -> Result<StoredAuthSession, String> {
        let client = Client::new();
        let url = format!(
            "{}/auth/v1/token?grant_type=refresh_token",
            self.inner.config.supabase_url.trim_end_matches('/')
        );

        let response = client
            .post(url)
            .header("apikey", &self.inner.config.supabase_anon_key)
            .header(
                "Authorization",
                format!("Bearer {}", self.inner.config.supabase_anon_key),
            )
            .header("Content-Type", "application/json")
            .json(&json!({
                "refresh_token": refresh_token,
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Supabase refresh failed: {text}"));
        }

        let token: SupabaseTokenResponse = response.json().await.map_err(|error| error.to_string())?;
        Ok(StoredAuthSession {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            expires_at_ms: token
                .expires_at
                .map(|seconds| seconds.saturating_mul(1000))
                .unwrap_or_else(|| unix_ms() + (token.expires_in.saturating_mul(1000))),
            user: map_supabase_user(token.user),
        })
    }

    async fn create_dodo_checkout(
        &self,
        session: &StoredAuthSession,
        plan: &str,
    ) -> Result<String, String> {
        let base_url = app_base_url();
        let plan_tier = plan
            .split('_')
            .next()
            .map(str::to_lowercase)
            .unwrap_or_else(|| "creator".to_string());
        let response = Client::new()
            .post(format!("{base_url}/api/dodo-checkout"))
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Content-Type", "application/json")
            .header("Origin", base_url.as_str())
            .json(&json!({
                "plan": plan,
                "return_url": format!("genesis://payment-callback?plan={plan_tier}"),
                "cancel_url": "genesis://pricing?status=cancelled",
            }))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Desktop checkout failed: {text}"));
        }

        let payload: Value = response.json().await.map_err(|error| error.to_string())?;
        payload
            .get("checkout_url")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .ok_or_else(|| "Desktop checkout did not return a checkout URL.".to_string())
    }

    async fn create_dodo_portal(&self, session: &StoredAuthSession) -> Result<String, String> {
        let base_url = app_base_url();
        let response = Client::new()
            .post(format!("{base_url}/api/dodo-portal"))
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Content-Type", "application/json")
            .header("Origin", base_url.as_str())
            .json(&json!({}))
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Desktop billing portal failed: {text}"));
        }

        let payload: Value = response.json().await.map_err(|error| error.to_string())?;
        payload
            .get("portal_url")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .ok_or_else(|| "Desktop billing portal did not return a portal URL.".to_string())
    }

    async fn fetch_billing_profile(
        &self,
        session: &StoredAuthSession,
    ) -> Result<BillingProfilePayload, String> {
        if session.user.id.trim().is_empty() {
            let billing_tier = BillingTier::Free;
            return Ok(BillingProfilePayload {
                id: String::new(),
                email: session.user.email.clone(),
                display_name: session.user.name.clone(),
                avatar_url: session.user.avatar_url.clone(),
                user_tier: billing_tier.display_label().to_string(),
                payment_provider: None,
                subscription_status: None,
                subscription_plan_code: None,
                billing_tier: billing_tier.as_str().to_string(),
                max_devices: billing_tier.max_devices(),
                ai_access_level: billing_tier.ai_access_level().to_string(),
                can_sync: billing_tier.can_sync(),
                active_plan_code: None,
                has_active_subscription: false,
                subscription_end_date: None,
                cancel_at_period_end: None,
            });
        }

        let url = format!(
            "{}/rest/v1/profiles?id=eq.{}&select=id,email,display_name,full_name,avatar_url,user_tier,payment_provider,subscription_status,subscription_plan_code,subscription_end_date,cancel_at_period_end",
            self.inner.config.supabase_url.trim_end_matches('/'),
            session.user.id
        );

        let response = Client::new()
            .get(url)
            .header("apikey", &self.inner.config.supabase_anon_key)
            .header("Authorization", format!("Bearer {}", session.access_token))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|error| error.to_string())?;

        if !response.status().is_success() {
            let text = response.text().await.unwrap_or_default();
            return Err(format!("Billing profile lookup failed: {text}"));
        }

        let profiles: Vec<SupabaseProfileRecord> =
            response.json().await.map_err(|error| error.to_string())?;
        let profile = profiles.into_iter().next();
        let payment_provider = profile.as_ref().and_then(|value| value.payment_provider.clone());
        let subscription_status = profile
            .as_ref()
            .and_then(|value| value.subscription_status.clone());
        let subscription_plan_code = profile
            .as_ref()
            .and_then(|value| value.subscription_plan_code.clone());
        let billing_tier = effective_billing_tier(
            payment_provider.as_deref(),
            subscription_status.as_deref(),
            subscription_plan_code.as_deref(),
            profile
                .as_ref()
                .and_then(|value| value.subscription_end_date.as_deref()),
            profile
                .as_ref()
                .and_then(|value| value.cancel_at_period_end),
        );
        let active_plan_code = resolve_active_plan_code(
            payment_provider.as_deref(),
            subscription_status.as_deref(),
            subscription_plan_code.as_deref(),
            profile
                .as_ref()
                .and_then(|value| value.subscription_end_date.as_deref()),
            profile
                .as_ref()
                .and_then(|value| value.cancel_at_period_end),
        );

        Ok(BillingProfilePayload {
            id: profile
                .as_ref()
                .map(|value| value.id.clone())
                .unwrap_or_else(|| session.user.id.clone()),
            email: profile
                .as_ref()
                .and_then(|value| value.email.clone())
                .unwrap_or_else(|| session.user.email.clone()),
            display_name: profile
                .as_ref()
                .and_then(|value| {
                    value
                        .display_name
                        .clone()
                        .or_else(|| value.full_name.clone())
                })
                .unwrap_or_else(|| session.user.name.clone()),
            avatar_url: profile
                .as_ref()
                .and_then(|value| value.avatar_url.clone())
                .unwrap_or_else(|| session.user.avatar_url.clone()),
            user_tier: profile
                .as_ref()
                .and_then(|value| value.user_tier.clone())
                .map(|value| match value.trim().to_uppercase().as_str() {
                    "SPARK" => "Free".to_string(),
                    "CREATOR" => "Core".to_string(),
                    "STUDIO" => "Pro".to_string(),
                    "EMPIRE" => "Power".to_string(),
                    "FREE" => "Free".to_string(),
                    "CORE" => "Core".to_string(),
                    "PRO" => "Pro".to_string(),
                    "POWER" => "Power".to_string(),
                    other => other.to_string(),
                })
                .unwrap_or_else(|| billing_tier.display_label().to_string()),
            payment_provider,
            subscription_status,
            subscription_plan_code,
            billing_tier: billing_tier.as_str().to_string(),
            max_devices: billing_tier.max_devices(),
            ai_access_level: billing_tier.ai_access_level().to_string(),
            can_sync: billing_tier.can_sync(),
            active_plan_code: active_plan_code.clone(),
            has_active_subscription: active_plan_code.is_some(),
            subscription_end_date: profile
                .as_ref()
                .and_then(|value| value.subscription_end_date.clone()),
            cancel_at_period_end: profile
                .as_ref()
                .and_then(|value| value.cancel_at_period_end),
        })
    }
}

fn resolve_active_plan_code(
    payment_provider: Option<&str>,
    subscription_status: Option<&str>,
    subscription_plan_code: Option<&str>,
    subscription_end_date: Option<&str>,
    cancel_at_period_end: Option<bool>,
) -> Option<String> {
    if !subscription_is_access_active(
        payment_provider,
        subscription_status,
        subscription_end_date,
        cancel_at_period_end,
    ) {
        return None;
    }

    let plan_code = subscription_plan_code?.trim().to_lowercase();
    match plan_code.as_str() {
        "creator" | "studio" | "empire" => Some(plan_code),
        _ => None,
    }
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseTokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: i64,
    #[serde(default)]
    expires_at: Option<i64>,
    user: SupabaseUser,
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseUser {
    id: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    user_metadata: Value,
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseProfileRecord {
    id: String,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    full_name: Option<String>,
    #[serde(default)]
    avatar_url: Option<String>,
    #[serde(default)]
    user_tier: Option<String>,
    #[serde(default)]
    payment_provider: Option<String>,
    #[serde(default)]
    subscription_status: Option<String>,
    #[serde(default)]
    subscription_plan_code: Option<String>,
    #[serde(default)]
    subscription_end_date: Option<String>,
    #[serde(default)]
    cancel_at_period_end: Option<bool>,
}

fn map_supabase_user(user: SupabaseUser) -> AuthUser {
    let display_name = user
        .user_metadata
        .get("full_name")
        .and_then(Value::as_str)
        .or_else(|| user.user_metadata.get("name").and_then(Value::as_str))
        .or_else(|| user.user_metadata.get("display_name").and_then(Value::as_str))
        .or_else(|| user.email.as_deref())
        .unwrap_or(&user.id)
        .to_string();

    let email = user.email.unwrap_or_default();
    let avatar_url = user
        .user_metadata
        .get("avatar_url")
        .and_then(Value::as_str)
        .or_else(|| user.user_metadata.get("picture").and_then(Value::as_str))
        .unwrap_or("")
        .to_string();

    AuthUser {
        id: user.id,
        name: display_name,
        email,
        avatar_url,
    }
}

fn default_gamification_data() -> Value {
    json!({
        "level": 1,
        "levelTitle": "Aspiring Author",
        "currentXP": 0,
        "nextLevelXP": 100,
        "booksCreatedCount": 0,
        "currentStreak": 0,
        "badges": [],
        "dailyChallenges": [],
    })
}

#[allow(dead_code)]
pub(crate) fn module_required_tier(module_id: &str) -> BillingTier {
    match module_id {
        "dashboard" | "settings" => BillingTier::Free,
        "notes" | "journal" | "tasks" | "passwords" | "budget" => BillingTier::Core,
        "ai" => BillingTier::Pro,
        "telemetry" | "habits" | "focus" | "health" | "sleep" | "nutrition" | "mood"
        | "flashcards" | "reading" | "grocery" | "recipes" | "time" | "goals"
        | "clipboard" | "breathing" | "voice-memos" | "countdown" => BillingTier::Pro,
        _ => BillingTier::Pro,
    }
}

pub(crate) fn effective_billing_tier(
    payment_provider: Option<&str>,
    subscription_status: Option<&str>,
    subscription_plan_code: Option<&str>,
    subscription_end_date: Option<&str>,
    cancel_at_period_end: Option<bool>,
) -> BillingTier {
    BillingTier::from_subscription(
        payment_provider,
        subscription_status,
        subscription_plan_code,
        subscription_end_date,
        cancel_at_period_end,
    )
}

fn subscription_is_access_active(
    payment_provider: Option<&str>,
    subscription_status: Option<&str>,
    subscription_end_date: Option<&str>,
    cancel_at_period_end: Option<bool>,
) -> bool {
    if !matches!(payment_provider.map(str::trim), Some("dodo")) {
        return false;
    }

    match subscription_status.map(|value| value.trim()) {
        Some("active") => true,
        Some("cancelled") if cancel_at_period_end.unwrap_or(false) => {
            subscription_end_date
                .and_then(parse_rfc3339_to_utc)
                .map(|end_date| end_date > Utc::now())
                .unwrap_or(true)
        }
        _ => false,
    }
}

fn parse_rfc3339_to_utc(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date_time| date_time.with_timezone(&Utc))
}

#[allow(dead_code)]
pub(crate) fn module_allowed_by_tier(module_id: &str, tier: BillingTier) -> bool {
    tier_rank(tier) >= tier_rank(module_required_tier(module_id))
}

pub(crate) fn tier_rank(tier: BillingTier) -> u8 {
    match tier {
        BillingTier::Free => 0,
        BillingTier::Core => 1,
        BillingTier::Pro => 2,
        BillingTier::Power => 3,
    }
}

fn callback_url() -> String {
    format!("http://127.0.0.1:{SUPABASE_OAUTH_PORT}/auth/callback")
}

fn app_base_url() -> String {
    env::var("APP_URL")
        .or_else(|_| env::var("VITE_APP_URL"))
        .unwrap_or_else(|_| "https://iamazeyou.me".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn callback_url_with_state(flow_state: &str) -> Result<Url, String> {
    let mut redirect_to = Url::parse(&callback_url()).map_err(|error| error.to_string())?;
    redirect_to
        .query_pairs_mut()
        .append_pair("flow_state", flow_state);
    Ok(redirect_to)
}

fn random_urlsafe_token(bytes: usize) -> String {
    let mut data = vec![0_u8; bytes];
    thread_rng().fill_bytes(&mut data);
    URL_SAFE_NO_PAD.encode(data)
}

fn pkce_challenge(code_verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn unix_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
fn should_refresh_soon(expires_at_ms: i64) -> bool {
    expires_at_ms - unix_ms() <= SUPABASE_REFRESH_WINDOW_MS
}

impl AuthConfig {
    fn from_env() -> Result<Self, String> {
        let supabase_url = env::var("VITE_SUPABASE_URL")
            .or_else(|_| env::var("SUPABASE_URL"))
            .map_err(|_| "Missing SUPABASE_URL / VITE_SUPABASE_URL.".to_string())?;
        let supabase_anon_key = env::var("VITE_SUPABASE_ANON_KEY")
            .or_else(|_| env::var("SUPABASE_ANON_KEY"))
            .map_err(|_| "Missing SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY.".to_string())?;

        Ok(Self {
            supabase_url,
            supabase_anon_key,
            service_role_key: env::var("SUPABASE_SERVICE_ROLE_KEY").ok(),
        })
    }
}

#[tauri::command]
pub async fn bootstrap_auth_state(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<AuthBootstrapState, String> {
    manager.bootstrap(app).await
}

#[tauri::command]
pub async fn get_auth_bootstrap_state(
    manager: State<'_, AuthManager>,
) -> Result<AuthBootstrapState, String> {
    Ok(manager.snapshot().await)
}

#[tauri::command]
pub async fn begin_google_auth(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<(), String> {
    manager.start_google_login(app).await
}

#[tauri::command]
pub async fn prepare_login_window(window: WebviewWindow) -> Result<(), String> {
    AuthManager::prepare_login_window(window).await
}

#[tauri::command]
pub async fn prepare_shell_window(window: WebviewWindow) -> Result<(), String> {
    AuthManager::prepare_shell_window(window).await
}

#[tauri::command]
pub async fn sign_out(app: AppHandle, manager: State<'_, AuthManager>) -> Result<(), String> {
    let _ = app;
    manager.sign_out().await
}

#[tauri::command]
pub async fn begin_dodo_checkout(
    app: AppHandle,
    manager: State<'_, AuthManager>,
    plan: String,
) -> Result<(), String> {
    manager.begin_dodo_checkout(app, plan).await
}

#[tauri::command]
pub async fn begin_dodo_portal(
    app: AppHandle,
    manager: State<'_, AuthManager>,
) -> Result<(), String> {
    manager.begin_dodo_portal(app).await
}

#[tauri::command]
pub async fn get_billing_profile(
    manager: State<'_, AuthManager>,
) -> Result<BillingProfilePayload, String> {
    manager.get_billing_profile().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn login_required_is_the_default_bootstrap_state() {
        assert_eq!(AuthBootstrapState::login_required(), AuthBootstrapState::LoginRequired);
    }

    #[test]
    fn refresh_window_detection_triggers_within_ten_minutes() {
        assert!(should_refresh_soon(unix_ms() + 9 * 60 * 1000));
    }

    #[test]
    fn refresh_window_detection_stays_off_after_ten_minutes() {
        assert!(!should_refresh_soon(unix_ms() + 11 * 60 * 1000));
    }
}
