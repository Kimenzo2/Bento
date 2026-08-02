// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Static registry of native (locally-executed) integrations.
//!
//! These apps are not present in the Composio catalog, so Bento executes
//! them itself: credentials live in the OS keyring, OAuth runs through the
//! local loopback flow, and every HTTP call is made by the native client.
//! Each app is a plain data table — adding one is data, not code.

/// How the native connector authenticates an HTTP call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthInjection {
    /// `Authorization: Bearer <token>`
    Bearer,
    /// `X-Api-Key: <token>`
    HeaderApiKey,
    /// `?key=<token>` (Steam)
    QueryApiKey,
    /// `Authorization: Basic base64(username:password)`
    Basic,
    /// No header auth — credential is embedded in the URL path (Telegram).
    None,
}

/// User-facing auth flow the connect button runs.
#[derive(specta::Type, Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NativeFlow {
    /// Browser-based OAuth2 authorization-code flow (public client).
    OAuth2,
    /// Paste a static API key (Steam).
    ApiKey,
    /// Paste a local/device token (Obsidian).
    Token,
    /// Paste a username/password pair (Twilio account SID + auth token).
    Basic,
}

impl NativeFlow {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::OAuth2 => "oauth2",
            Self::ApiKey => "api_key",
            Self::Token => "token",
            Self::Basic => "basic",
        }
    }
}

/// OAuth client registration performed against the provider at connect time.
#[derive(Debug, Clone, Copy)]
pub struct DynamicRegistrationConfig {
    /// POST URL (form-encoded) that issues a client_id/client_secret.
    pub url: &'static str,
    /// Name of the form field carrying the requested scopes.
    pub scope_field: &'static str,
}

/// OAuth2 endpoints + client details for a native app.
#[derive(Debug, Clone, Copy)]
pub struct OAuth2Config {
    pub authorize_url: &'static str,
    pub token_url: &'static str,
    /// Embedded public client id (empty when dynamic registration is used).
    pub client_id: &'static str,
    /// Embedded client secret (usually empty for public clients).
    pub client_secret: &'static str,
    pub scopes: &'static str,
    /// Send a PKCE code_challenge on authorize + code_verifier on exchange.
    pub use_pkce: bool,
    /// If set, register the OAuth client at connect time instead of using an
    /// embedded client id (Hermes/OpenClaw DCR pattern).
    pub dynamic_registration: Option<DynamicRegistrationConfig>,
}

#[derive(Debug, Clone, Copy)]
pub enum NativeMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

impl NativeMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Get => "GET",
            Self::Post => "POST",
            Self::Put => "PUT",
            Self::Patch => "PATCH",
            Self::Delete => "DELETE",
        }
    }
}

/// A single callable action on a native app.
#[derive(Debug, Clone, Copy)]
pub struct NativeAction {
    pub slug: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub method: NativeMethod,
    /// Path template with `{param}` placeholders. Placeholders resolve from
    /// the action input first, then from stored credentials
    /// (`username` / `password` / `token`).
    pub path: &'static str,
    /// Input fields copied to the query string.
    pub query_params: &'static [&'static str],
    /// Input fields required before executing.
    pub required: &'static [&'static str],
    pub auth: AuthInjection,
    /// For POST/PUT/PATCH, send the input object as the JSON body.
    pub body: bool,
}

/// Static definition of a native (locally-executed) integration.
#[derive(Debug, Clone, Copy)]
pub struct NativeAppConfig {
    pub key: &'static str,
    pub flow: NativeFlow,
    pub base_url: &'static str,
    /// Domains this app may call (allowlist — token-vault pattern). A request
    /// to any other host is refused.
    pub allowed_domains: &'static [&'static str],
    pub oauth: Option<OAuth2Config>,
    pub actions: &'static [NativeAction],
}

pub fn native_config(key: &str) -> Option<&'static NativeAppConfig> {
    NATIVE_APPS.iter().find(|a| a.key == key)
}

pub fn native_apps() -> impl Iterator<Item = &'static NativeAppConfig> {
    NATIVE_APPS.iter()
}

// ── Pilot apps (Phase 0) ──────────────────────────────────────────────

const LOCAL_DOMAINS: &[&str] = &["127.0.0.1", "localhost"];

const OBSIDIAN_ACTIONS: &[NativeAction] = &[
    NativeAction {
        slug: "list_vault",
        name: "List Vault",
        description: "List files and folders at the root of the current Obsidian vault.",
        method: NativeMethod::Get,
        path: "/vault/",
        query_params: &[],
        required: &[],
        auth: AuthInjection::Bearer,
        body: false,
    },
    NativeAction {
        slug: "read_note",
        name: "Read Note",
        description: "Read the raw markdown content of a note by vault path (e.g. `Projects/roadmap.md`).",
        method: NativeMethod::Get,
        path: "/vault/{path}",
        query_params: &[],
        required: &["path"],
        auth: AuthInjection::Bearer,
        body: false,
    },
    NativeAction {
        slug: "search",
        name: "Search Vault",
        description: "Full-text search across the current Obsidian vault.",
        method: NativeMethod::Post,
        path: "/search/simple/",
        query_params: &["query"],
        required: &["query"],
        auth: AuthInjection::Bearer,
        body: false,
    },
];

const STEAM_ACTIONS: &[NativeAction] = &[
    NativeAction {
        slug: "get_player_summaries",
        name: "Get Player Summaries",
        description: "Fetch a Steam profile summary by comma-separated SteamID64 list.",
        method: NativeMethod::Get,
        path: "/ISteamUser/GetPlayerSummaries/v2/",
        query_params: &["steamids"],
        required: &["steamids"],
        auth: AuthInjection::QueryApiKey,
        body: false,
    },
    NativeAction {
        slug: "get_owned_games",
        name: "Get Owned Games",
        description: "List games owned by a Steam account (SteamID64).",
        method: NativeMethod::Get,
        path: "/IPlayerService/GetOwnedGames/v1/",
        query_params: &["steamid"],
        required: &["steamid"],
        auth: AuthInjection::QueryApiKey,
        body: false,
    },
];

const TWILIO_ACTIONS: &[NativeAction] = &[
    NativeAction {
        slug: "get_account",
        name: "Get Account",
        description: "Fetch the Twilio account resource for the connected account SID.",
        method: NativeMethod::Get,
        path: "/Accounts/{account_sid}.json",
        query_params: &[],
        required: &[],
        auth: AuthInjection::Basic,
        body: false,
    },
    NativeAction {
        slug: "list_messages",
        name: "List Messages",
        description: "List recent SMS messages on the account.",
        method: NativeMethod::Get,
        path: "/Accounts/{account_sid}/Messages.json",
        query_params: &["page_size", "to", "from"],
        required: &[],
        auth: AuthInjection::Basic,
        body: false,
    },
];

const MASTODON_ACTIONS: &[NativeAction] = &[
    NativeAction {
        slug: "verify_credentials",
        name: "Verify Credentials",
        description: "Fetch the authenticated Mastodon account.",
        method: NativeMethod::Get,
        path: "/accounts/verify_credentials",
        query_params: &[],
        required: &[],
        auth: AuthInjection::Bearer,
        body: false,
    },
    NativeAction {
        slug: "get_home_timeline",
        name: "Home Timeline",
        description: "Fetch the authenticated user's home timeline.",
        method: NativeMethod::Get,
        path: "/timelines/home",
        query_params: &["limit"],
        required: &[],
        auth: AuthInjection::Bearer,
        body: false,
    },
];

const TELEGRAM_ACTIONS: &[NativeAction] = &[
    NativeAction {
        slug: "get_me",
        name: "Get Bot Info",
        description: "Get the connected Telegram bot's own info. Use to validate the connection.",
        method: NativeMethod::Get,
        path: "/bot{token}/getMe",
        query_params: &[],
        required: &[],
        auth: AuthInjection::None,
        body: false,
    },
    NativeAction {
        slug: "send_message",
        name: "Send Message",
        description: "Send a text message to a Telegram chat. chat_id can be a numeric ID or @username.",
        method: NativeMethod::Post,
        path: "/bot{token}/sendMessage",
        query_params: &[],
        required: &["chat_id", "text"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "send_photo",
        name: "Send Photo",
        description: "Send a photo to a Telegram chat by URL or file path.",
        method: NativeMethod::Post,
        path: "/bot{token}/sendPhoto",
        query_params: &[],
        required: &["chat_id", "photo"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "send_document",
        name: "Send Document",
        description: "Send a file or document to a Telegram chat.",
        method: NativeMethod::Post,
        path: "/bot{token}/sendDocument",
        query_params: &[],
        required: &["chat_id", "document"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "send_poll",
        name: "Send Poll",
        description: "Send a native poll to a Telegram chat. Provide question and array of options.",
        method: NativeMethod::Post,
        path: "/bot{token}/sendPoll",
        query_params: &[],
        required: &["chat_id", "question", "options"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "send_location",
        name: "Send Location",
        description: "Send a map location to a Telegram chat.",
        method: NativeMethod::Post,
        path: "/bot{token}/sendLocation",
        query_params: &[],
        required: &["chat_id", "latitude", "longitude"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "forward_message",
        name: "Forward Message",
        description: "Forward a message from one chat to another.",
        method: NativeMethod::Post,
        path: "/bot{token}/forwardMessage",
        query_params: &[],
        required: &["chat_id", "from_chat_id", "message_id"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "edit_message",
        name: "Edit Message",
        description: "Edit a text message sent by the bot.",
        method: NativeMethod::Post,
        path: "/bot{token}/editMessageText",
        query_params: &[],
        required: &["chat_id", "message_id", "text"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "delete_message",
        name: "Delete Message",
        description: "Delete a message from a chat.",
        method: NativeMethod::Post,
        path: "/bot{token}/deleteMessage",
        query_params: &[],
        required: &["chat_id", "message_id"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "get_chat",
        name: "Get Chat",
        description: "Get information about a Telegram chat (name, type, members, etc).",
        method: NativeMethod::Get,
        path: "/bot{token}/getChat",
        query_params: &["chat_id"],
        required: &["chat_id"],
        auth: AuthInjection::None,
        body: false,
    },
    NativeAction {
        slug: "get_chat_history",
        name: "Get Chat History",
        description: "Get recent updates/messages from Telegram. Returns chat IDs from recent conversations.",
        method: NativeMethod::Get,
        path: "/bot{token}/getUpdates",
        query_params: &["offset", "limit"],
        required: &[],
        auth: AuthInjection::None,
        body: false,
    },
    NativeAction {
        slug: "get_chat_administrators",
        name: "Get Chat Administrators",
        description: "List administrators in a Telegram chat.",
        method: NativeMethod::Get,
        path: "/bot{token}/getChatAdministrators",
        query_params: &["chat_id"],
        required: &["chat_id"],
        auth: AuthInjection::None,
        body: false,
    },
    NativeAction {
        slug: "get_chat_member",
        name: "Get Chat Member",
        description: "Get info about a specific member in a Telegram chat.",
        method: NativeMethod::Get,
        path: "/bot{token}/getChatMember",
        query_params: &["chat_id", "user_id"],
        required: &["chat_id", "user_id"],
        auth: AuthInjection::None,
        body: false,
    },
    NativeAction {
        slug: "get_chat_members_count",
        name: "Get Chat Members Count",
        description: "Get the number of members in a Telegram chat.",
        method: NativeMethod::Get,
        path: "/bot{token}/getChatMemberCount",
        query_params: &["chat_id"],
        required: &["chat_id"],
        auth: AuthInjection::None,
        body: false,
    },
    NativeAction {
        slug: "create_chat_invite_link",
        name: "Create Chat Invite Link",
        description: "Generate a new invite link for a Telegram chat.",
        method: NativeMethod::Post,
        path: "/bot{token}/createChatInviteLink",
        query_params: &[],
        required: &["chat_id"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "answer_callback_query",
        name: "Answer Callback Query",
        description: "Answer an inline keyboard callback query.",
        method: NativeMethod::Post,
        path: "/bot{token}/answerCallbackQuery",
        query_params: &[],
        required: &["callback_query_id"],
        auth: AuthInjection::None,
        body: true,
    },
    NativeAction {
        slug: "set_my_commands",
        name: "Set Bot Commands",
        description: "Change the list of commands the bot offers.",
        method: NativeMethod::Post,
        path: "/bot{token}/setMyCommands",
        query_params: &[],
        required: &["commands"],
        auth: AuthInjection::None,
        body: true,
    },
];

const NATIVE_APPS: &[NativeAppConfig] = &[
    NativeAppConfig {
        key: "obsidian",
        flow: NativeFlow::Token,
        base_url: "http://127.0.0.1:27123",
        allowed_domains: LOCAL_DOMAINS,
        oauth: None,
        actions: OBSIDIAN_ACTIONS,
    },
    NativeAppConfig {
        key: "steam",
        flow: NativeFlow::ApiKey,
        base_url: "https://api.steampowered.com",
        allowed_domains: &["api.steampowered.com"],
        oauth: None,
        actions: STEAM_ACTIONS,
    },
    NativeAppConfig {
        key: "twilio",
        flow: NativeFlow::Basic,
        base_url: "https://api.twilio.com/2010-04-01",
        allowed_domains: &["api.twilio.com"],
        oauth: None,
        actions: TWILIO_ACTIONS,
    },
    NativeAppConfig {
        key: "mastodon",
        flow: NativeFlow::OAuth2,
        base_url: "https://mastodon.social/api/v1",
        allowed_domains: &["mastodon.social"],
        oauth: Some(OAuth2Config {
            authorize_url: "https://mastodon.social/oauth/authorize",
            token_url: "https://mastodon.social/oauth/token",
            client_id: "",
            client_secret: "",
            scopes: "read write",
            use_pkce: false,
            dynamic_registration: Some(DynamicRegistrationConfig {
                url: "https://mastodon.social/api/v1/apps",
                scope_field: "scopes",
            }),
        }),
        actions: MASTODON_ACTIONS,
    },
    NativeAppConfig {
        key: "telegram",
        flow: NativeFlow::ApiKey,
        base_url: "https://api.telegram.org",
        allowed_domains: &["api.telegram.org"],
        oauth: None,
        actions: TELEGRAM_ACTIONS,
    },
];