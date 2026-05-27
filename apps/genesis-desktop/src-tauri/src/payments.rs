use std::env;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use url::Url;

use crate::auth::AuthManager;
use crate::settings;

// ── Product ID defaults ─────────────────────────────────────
// Dodo product IDs are public identifiers. These are the live values
// currently used by the desktop/web pricing flow, with env overrides
// available for future changes.

const DEFAULT_DODO_PRODUCT_CORE_MONTHLY: &str = "pdt_0Na8Ptv07nY2Oh9OmN9hO";
const DEFAULT_DODO_PRODUCT_CORE_YEARLY: &str = "pdt_0Na8Ptv07nY2Oh9OmN9hO";
const DEFAULT_DODO_PRODUCT_PRO_MONTHLY: &str = "pdt_0Na8QC90xJqlCqYQ3RfKI";
const DEFAULT_DODO_PRODUCT_PRO_YEARLY: &str = "pdt_0Na8QC90xJqlCqYQ3RfKI";
const DEFAULT_DODO_PRODUCT_POWER_MONTHLY: &str = "pdt_0Na8QNX7jb2BgSoYiHsmY";
const DEFAULT_DODO_PRODUCT_POWER_YEARLY: &str = "pdt_0Na8QNX7jb2BgSoYiHsmY";

fn env_or_default_many(keys: &[&str], fallback: &str) -> String {
    for key in keys {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    fallback.to_string()
}

/// Resolve a Dodo product ID from a plan code (e.g. "pro_monthly").
fn resolve_product_id(plan: &str) -> Option<String> {
    match plan.trim().to_lowercase().as_str() {
        "core" | "creator" | "core_monthly" => Some(env_or_default_many(
            &["DODO_PRODUCT_ID_CORE", "DODO_PRODUCT_ID_CORE_MONTHLY"],
            DEFAULT_DODO_PRODUCT_CORE_MONTHLY,
        )),
        "core_yearly" => Some(env_or_default_many(
            &["DODO_PRODUCT_ID_CORE_YEARLY", "DODO_PRODUCT_ID_CORE"],
            DEFAULT_DODO_PRODUCT_CORE_YEARLY,
        )),
        "pro" | "studio" | "pro_monthly" => Some(env_or_default_many(
            &["DODO_PRODUCT_ID_PRO", "DODO_PRODUCT_ID_PRO_MONTHLY"],
            DEFAULT_DODO_PRODUCT_PRO_MONTHLY,
        )),
        "pro_yearly" => Some(env_or_default_many(
            &["DODO_PRODUCT_ID_PRO_YEARLY", "DODO_PRODUCT_ID_PRO"],
            DEFAULT_DODO_PRODUCT_PRO_YEARLY,
        )),
        "power" | "empire" | "power_monthly" => Some(env_or_default_many(
            &["DODO_PRODUCT_ID_POWER", "DODO_PRODUCT_ID_POWER_MONTHLY"],
            DEFAULT_DODO_PRODUCT_POWER_MONTHLY,
        )),
        "power_yearly" => Some(env_or_default_many(
            &["DODO_PRODUCT_ID_POWER_YEARLY", "DODO_PRODUCT_ID_POWER"],
            DEFAULT_DODO_PRODUCT_POWER_YEARLY,
        )),
        _ => None,
    }
}

/// Tier label inferred from a plan code.
fn tier_from_plan(plan: &str) -> &'static str {
    match plan.trim().to_lowercase().as_str() {
        p if p.starts_with("core") || p.starts_with("creator") => "core",
        p if p.starts_with("pro") || p.starts_with("studio") => "pro",
        p if p.starts_with("power") || p.starts_with("empire") => "power",
        _ => "free",
    }
}

/// A record of a successful payment stored locally.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PaymentReceipt {
    /// Dodo product ID that was purchased
    pub product_id: String,
    /// Canonical tier name (core, pro, power)
    pub tier: String,
    /// ISO timestamp of the payment (from the deferral response)
    pub paid_at: Option<String>,
    /// The Dodo payment or subscription reference returned by checkout
    pub session_id: Option<String>,
}

/// Create a Dodo Payments hosted checkout URL.
///
/// Uses Dodo's public hosted-checkout page (`checkout.dodopayments.com/buy/{product_id}`)
/// with the user's email and session metadata as query parameters.
/// No secret keys are needed — product IDs are public identifiers.
///
/// Accepts either a direct `product_id` or a `plan` code (e.g. "pro_monthly")
/// which is resolved via the hardcoded constant map.
///
/// Returns the full checkout URL that the frontend should open in the system browser.
///
/// # Errors
/// - Returns an error if the user is not signed in.
/// - Returns an error if the plan code is unknown.
#[tauri::command]
pub async fn create_checkout(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    product_id: Option<String>,
    plan: Option<String>,
) -> Result<String, String> {
    let plan_code = plan.as_deref().unwrap_or("pro");
    let resolved_id = match (product_id.as_deref(), plan.as_deref()) {
        (Some(pid), _) if !pid.trim().is_empty() => pid.trim().to_string(),
        (_, Some(plan_code)) if !plan_code.trim().is_empty() => resolve_product_id(plan_code)
            .ok_or_else(|| format!("Unknown plan code: {plan_code}"))?,
        _ => return Err("Provide a product_id or plan code.".to_string()),
    };

    if resolved_id.trim().is_empty() {
        return Err("Could not resolve a product ID for the given plan.".to_string());
    }

    let session = auth
        .current_session()
        .await
        .ok_or_else(|| "Sign in to start a checkout.".to_string())?;

    // Dodo hosted-checkout: https://checkout.dodopayments.com/buy/{product_id}
    // No API call needed — product IDs are public.
    let mut url = Url::parse(&format!(
        "https://checkout.dodopayments.com/buy/{}",
        resolved_id
    ))
    .map_err(|e| format!("Invalid checkout URL: {e}"))?;

    // Hosted checkout returns to the web callback page first.
    // That page can complete verification and then deep-link back into Bento.
    let mut return_url = Url::parse("https://iamazeyou.me/payment-callback")
        .map_err(|e| format!("Invalid return URL: {e}"))?;
    let mut cancel_url = Url::parse("https://iamazeyou.me/pricing")
        .map_err(|e| format!("Invalid cancel URL: {e}"))?;

    let desktop_return_url = "bento://payment-callback";
    let desktop_cancel_url = "bento://pricing?status=cancelled";

    return_url
        .query_pairs_mut()
        .append_pair("plan", tier_from_plan(plan_code))
        .append_pair("desktop_return_url", desktop_return_url);
    cancel_url
        .query_pairs_mut()
        .append_pair("status", "cancelled")
        .append_pair("desktop_cancel_url", desktop_cancel_url);

    url.query_pairs_mut()
        .append_pair("quantity", "1")
        .append_pair("return_url", return_url.as_str())
        .append_pair("cancel_url", cancel_url.as_str())
        .append_pair("email", &session.user.email)
        .append_pair("metadata[supabase_user_id]", &session.user.id)
        .append_pair("metadata[supabase_email]", &session.user.email);

    if let Some(ref plan_code) = plan {
        url.query_pairs_mut()
            .append_pair("metadata[plan]", plan_code);
    }

    // Trigger aggressive billing refresh after checkout (Anytype ForceRefresh pattern)
    auth.invalidate_billing_cache().await;
    auth.start_billing_refresh(app, true).await;

    Ok(url.to_string())
}

/// Handle a payment callback from the deep link.
///
/// This is called when the user is redirected back to the app after paying on Dodo.
///
/// 1. Reads the returned Dodo payment/subscription identifier and status
/// 2. Stores a local receipt for offline-first Pro unlocking
/// 3. Triggers aggressive billing refresh to sync with Supabase
///
/// No Vercel backend required — the desktop app handles the full flow.
#[tauri::command]
pub async fn handle_payment_callback(
    app: AppHandle,
    auth: State<'_, AuthManager>,
    payment_id: Option<String>,
    subscription_id: Option<String>,
    status: Option<String>,
    plan: Option<String>,
) -> Result<PaymentReceipt, String> {
    let payment_reference = payment_id
        .or(subscription_id)
        .ok_or_else(|| "Missing payment_id or subscription_id in payment callback.".to_string())?;

    let payment_status = status.as_deref().unwrap_or("").trim().to_lowercase();

    if matches!(payment_status.as_str(), "failed" | "cancelled" | "canceled") {
        return Err(format!(
            "Payment for reference {} was not completed (status: {}).",
            payment_reference, payment_status
        ));
    }

    let plan_code = plan.as_deref().unwrap_or("pro");
    let tier = tier_from_plan(plan_code).to_string();
    let product_id = resolve_product_id(plan_code).unwrap_or_else(|| payment_reference.clone());

    let receipt = PaymentReceipt {
        product_id,
        tier,
        paid_at: Some(chrono::Utc::now().to_rfc3339()),
        session_id: Some(payment_reference),
    };

    // Store receipt locally for offline-first Pro unlocking
    settings::update_desktop_settings(&app, |next| {
        next.payment.receipt = Some(receipt.clone());
    })?;

    // Trigger aggressive billing refresh to sync with Supabase
    auth.invalidate_billing_cache().await;
    auth.start_billing_refresh(app, true).await;

    Ok(receipt)
}

/// Save a payment receipt locally (offline-first: unlocks Pro features without Supabase).
#[tauri::command]
pub async fn save_payment_receipt(app: AppHandle, receipt: PaymentReceipt) -> Result<(), String> {
    if receipt.product_id.trim().is_empty() {
        return Err("product_id is required".to_string());
    }
    if receipt.tier.trim().is_empty() {
        return Err("tier is required".to_string());
    }

    settings::update_desktop_settings(&app, |next| {
        next.payment.receipt = Some(receipt);
    })?;

    Ok(())
}

/// Retrieve the locally-stored payment receipt (if any).
#[tauri::command]
pub async fn get_payment_receipt(app: AppHandle) -> Result<Option<PaymentReceipt>, String> {
    let settings = settings::current_settings(&app);
    Ok(settings.payment.receipt.clone())
}
