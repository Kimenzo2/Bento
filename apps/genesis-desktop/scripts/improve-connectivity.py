import pathlib

path = pathlib.Path("src-tauri/src/auth.rs")
content = path.read_text(encoding="utf-8")

changes = 0

# 1. Add check_connectivity function before subscription_is_access_active
old = "fn subscription_is_access_active("
new = """/// Check internet connectivity by probing multiple fallback endpoints.
/// Returns `true` if ANY of the configured URLs returns a success (2xx).
/// Uses short 5s timeout per probe and stops at the first success.
async fn check_connectivity(client: &reqwest::Client) -> bool {
    const TIMEOUT: Duration = Duration::from_secs(4);
    for url in CONNECTIVITY_CHECK_URLS {
        let resp = tokio::time::timeout(TIMEOUT, client.get(*url).send()).await;
        if let Ok(Ok(response)) = resp {
            if response.status().is_success() {
                return true;
            }
        }
    }
    false
}

fn subscription_is_access_active("
count = content.count(old)
if count == 1:
    content = content.replace(old, new)
    changes += 1
    print(f"Added check_connectivity function")
elif count > 1:
    print(f"ERROR: Found {count} occurrences of '{old[:40]}...' — cannot safely replace")
    exit(1)
else:
    print(f"WARNING: Could not find '{old[:40]}...' — skipping check_connectivity")

# 2. Fix saturating_pow -> manual loop since saturating_pow doesn't exist on u64
old = "let base_s = CONNECTIVITY_MIN_INTERVAL_S.saturating_mul(2u64.saturating_pow(\n                        backoff_steps as u32,\n                    ));\n                    base_s.min(CONNECTIVITY_MAX_INTERVAL_S)"
new = "let base_s = CONNECTIVITY_MIN_INTERVAL_S * (2u64.pow(backoff_steps as u32).min(128));\n                    base_s.min(CONNECTIVITY_MAX_INTERVAL_S)"
count = content.count(old)
if count == 1:
    content = content.replace(old, new)
    changes += 1
    print(f"Fixed backoff calculation (removed saturating_pow)")
elif count > 1:
    print(f"ERROR: Found {count} occurrences")
    exit(1)
else:
    print(f"WARNING: Could not find backoff pattern — skipping")

# 3. Remove emit_session_expired method
old = "\n    async fn emit_session_expired(&self, app: &AppHandle, message: String) {\n        let _ = app.emit(\"auth:session_expired\", AuthErrorPayload { message });\n    }\n\n    fn spawn_profile_sync"
new = "\n\n    fn spawn_profile_sync"
count = content.count(old)
if count == 1:
    content = content.replace(old, new)
    changes += 1
    print(f"Removed emit_session_expired method")
elif count > 1:
    print(f"ERROR: Found {count} occurrences")
    exit(1)
else:
    print(f"WARNING: Could not find emit_session_expired — may already be removed")

# Save
path.write_text(content, encoding="utf-8")
print(f"\nTotal changes applied: {changes}")
