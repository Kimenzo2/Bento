// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

//! Agent-facing tools for external app integrations (communication apps).
//!
//! A curated subset of the app's integration catalog is exposed to the AI
//! agent so it can act on real connected accounts (WhatsApp, Gmail, Slack, …).
//! Each tool's LLM function name IS the Composio tool slug, so execution
//! routes straight to `integrations::commands::execute_integration`.
//!
//! Tools are only injected into the request when their owning app is connected
//! — this keeps the tool list small and avoids the agent attempting doomed
//! calls. Connection failures still surface as tool-result errors, which the
//! model reports to the user (the enterprise "errors are feedback" pattern).

use std::collections::HashSet;

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use tauri::AppHandle;

use super::super::chat::ToolDefinition;

/// App keys whose curated tools are exposed to the agent (communication category).
pub const COMMUNICATION_APPS: &[&str] = &[
    "gmail",
    "outlook",
    "slack",
    "discord",
    "telegram",
    "whatsapp",
    "googlechat",
    "zoom",
    "sendgrid",
    "mailchimp",
    "teams",
];

/// Agent tool spec: maps an LLM function name (the tool `slug`) to its owning
/// app, guidance description, and JSON input schema.
struct AgentTool {
    app: &'static str,
    slug: &'static str,
    description: &'static str,
    schema: Value,
}

const fn s(app: &'static str, slug: &'static str, description: &'static str, schema: Value) -> AgentTool {
    AgentTool { app, slug, description, schema }
}

/// Built once — the table is large (dozens of JSON schemas) and every lookup
/// (definitions / resolve_app / execute_tool) would otherwise rebuild it.
static AGENT_TOOLS: Lazy<Vec<AgentTool>> = Lazy::new(agent_tools);

/// Full agent tool table for communication apps.
fn agent_tools() -> Vec<AgentTool> {
    vec![
        // ── WhatsApp Business ──────────────────────────────────────────────
        s(
            "whatsapp",
            "WHATSAPP_GET_PHONE_NUMBERS",
            "Get all WhatsApp phone numbers registered to the connected business account. Call this FIRST to discover the phone_number_id required by every other WhatsApp tool — it also validates that WhatsApp is connected.",
            json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results (1-100), defaults to 25"},
                    "waba_id": {"type": "string", "description": "Optional WhatsApp Business Account ID filter"}
                }
            }),
        ),
        s(
            "whatsapp",
            "WHATSAPP_SEND_MESSAGE",
            "Send a text message to a WhatsApp user. Requires the sender's phone_number_id (from WHATSAPP_GET_PHONE_NUMBERS) and the recipient's number in international format without the '+' sign (e.g. '639116382188').",
            json!({
                "type": "object",
                "properties": {
                    "phone_number_id": {"type": "string", "description": "Numeric ID of the WhatsApp Business phone number to send from (the 'id' field from WHATSAPP_GET_PHONE_NUMBERS)"},
                    "to_number": {"type": "string", "description": "Recipient phone number in international format without '+' (e.g. '639116382188')"},
                    "text": {"type": "string", "description": "Message text, max 4096 characters, supports Unicode and emoji"},
                    "message_id": {"type": "string", "description": "Optional message ID to reply to (creates a quoted reply)"},
                    "preview_url": {"type": "boolean", "description": "Show a URL preview in the message, defaults to false"}
                },
                "required": ["phone_number_id", "to_number", "text"]
            }),
        ),
        s(
            "whatsapp",
            "WHATSAPP_SEND_TEMPLATE_MESSAGE",
            "Send an approved message template to a WhatsApp number. Use templates for first contact with users who haven't opted in (24h session window rules).",
            json!({
                "type": "object",
                "properties": {
                    "phone_number_id": {"type": "string", "description": "Numeric ID of the WhatsApp Business phone number to send from"},
                    "to_number": {"type": "string", "description": "Recipient phone number in international format without '+', e.g. '639116382188'"},
                    "template_name": {"type": "string", "description": "Name of the approved template"},
                    "language_code": {"type": "string", "description": "Template language code, e.g. 'en_US'"},
                    "components": {"type": "array", "items": {"type": "object"}, "description": "Optional template components (header, body, button parameters)"},
                    "reply_to_message_id": {"type": "string", "description": "Optional message ID to reply to"}
                },
                "required": ["phone_number_id", "to_number", "template_name"]
            }),
        ),
        s(
            "whatsapp",
            "WHATSAPP_GET_MESSAGE_HISTORY",
            "Retrieve WhatsApp message history for a phone number.",
            json!({
                "type": "object",
                "properties": {
                    "phone_number_id": {"type": "string", "description": "Numeric ID of the WhatsApp Business phone number"},
                    "limit": {"type": "integer", "description": "Max results"},
                    "before": {"type": "string", "description": "Cursor to fetch messages before a given message ID"},
                    "after": {"type": "string", "description": "Cursor to fetch messages after a given message ID"},
                    "message_id": {"type": "string", "description": "Fetch a single message by ID"},
                    "fields": {"type": "string", "description": "Comma-separated fields to return"}
                },
                "required": ["phone_number_id"]
            }),
        ),
        s(
            "whatsapp",
            "WHATSAPP_GET_BUSINESS_PROFILE",
            "Get the business profile (about, address, description, email, website) of a WhatsApp Business phone number.",
            json!({
                "type": "object",
                "properties": {
                    "phone_number_id": {"type": "string", "description": "Numeric ID of the WhatsApp Business phone number"},
                    "fields": {"type": "string", "description": "Comma-separated fields to return"}
                },
                "required": ["phone_number_id"]
            }),
        ),
        s(
            "whatsapp",
            "WHATSAPP_LIST_GROUPS",
            "List the WhatsApp groups the connected business phone number participates in.",
            json!({
                "type": "object",
                "properties": {
                    "phone_number_id": {"type": "string", "description": "Numeric ID of the WhatsApp Business phone number"},
                    "limit": {"type": "integer", "description": "Max results"},
                    "before": {"type": "string", "description": "Pagination cursor"},
                    "after": {"type": "string", "description": "Pagination cursor"}
                },
                "required": ["phone_number_id"]
            }),
        ),

        // ── Gmail ──────────────────────────────────────────────────────────
        s(
            "gmail",
            "GMAIL_SEND_EMAIL",
            "Send an email from the connected Gmail account. Requires a recipient email and subject; body is optional.",
            json!({
                "type": "object",
                "properties": {
                    "recipient_email": {"type": "string", "description": "Primary recipient email address"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body text"},
                    "cc": {"type": "array", "items": {"type": "string"}, "description": "CC recipients"},
                    "bcc": {"type": "array", "items": {"type": "string"}, "description": "BCC recipients"},
                    "extra_recipients": {"type": "array", "items": {"type": "string"}, "description": "Additional To recipients"},
                    "from_email": {"type": "string", "description": "Optional sender override"},
                    "is_html": {"type": "boolean", "description": "Whether the body is HTML, defaults to false"},
                    "user_id": {"type": "string", "description": "Gmail user ID, defaults to 'me'"}
                },
                "required": ["recipient_email", "subject"]
            }),
        ),
        s(
            "gmail",
            "GMAIL_CREATE_EMAIL_DRAFT",
            "Create a draft email without sending it.",
            json!({
                "type": "object",
                "properties": {
                    "recipient_email": {"type": "string", "description": "Primary recipient email address"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body text"},
                    "cc": {"type": "array", "items": {"type": "string"}},
                    "bcc": {"type": "array", "items": {"type": "string"}},
                    "thread_id": {"type": "string", "description": "Optional thread ID to draft in reply"},
                    "is_html": {"type": "boolean"},
                    "user_id": {"type": "string", "description": "Gmail user ID, defaults to 'me'"}
                },
                "required": ["recipient_email", "subject"]
            }),
        ),
        s(
            "gmail",
            "GMAIL_FETCH_EMAILS",
            "Fetch emails from the connected Gmail account, optionally filtered by a query string.",
            json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Gmail search query, e.g. 'from:someone@x.com is:unread'"},
                    "max_results": {"type": "integer", "description": "Max results to return, defaults to 20"},
                    "label_ids": {"type": "array", "items": {"type": "string"}, "description": "Filter by label IDs like 'INBOX', 'UNREAD'"},
                    "include_payload": {"type": "boolean", "description": "Include full message body"},
                    "verbose": {"type": "boolean"},
                    "page_token": {"type": "string"},
                    "user_id": {"type": "string", "description": "Gmail user ID, defaults to 'me'"}
                }
            }),
        ),
        s(
            "gmail",
            "GMAIL_LIST_THREADS",
            "List Gmail conversation threads, optionally filtered by query.",
            json!({
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Gmail search query"},
                    "max_results": {"type": "integer", "description": "Max results"},
                    "page_token": {"type": "string"},
                    "verbose": {"type": "boolean"},
                    "user_id": {"type": "string", "description": "Gmail user ID, defaults to 'me'"}
                }
            }),
        ),
        s(
            "gmail",
            "GMAIL_REPLY_TO_THREAD",
            "Reply to an existing Gmail conversation thread.",
            json!({
                "type": "object",
                "properties": {
                    "thread_id": {"type": "string", "description": "The thread ID to reply to"},
                    "message_body": {"type": "string", "description": "Reply body text"},
                    "recipient_email": {"type": "string", "description": "Optional recipient override"},
                    "cc": {"type": "array", "items": {"type": "string"}},
                    "bcc": {"type": "array", "items": {"type": "string"}},
                    "is_html": {"type": "boolean"},
                    "user_id": {"type": "string", "description": "Gmail user ID, defaults to 'me'"}
                },
                "required": ["thread_id", "message_body"]
            }),
        ),
        s(
            "gmail",
            "GMAIL_LIST_LABELS",
            "List all Gmail labels for the connected account.",
            json!({
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "Gmail user ID, defaults to 'me'"},
                    "include_details": {"type": "boolean"}
                }
            }),
        ),

        // ── Slack ──────────────────────────────────────────────────────────
        s(
            "slack",
            "SLACK_LIST_CONVERSATIONS",
            "List Slack channels the bot is a member of. Use this to find a channel ID before sending messages.",
            json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results, defaults to 100"},
                    "types": {"type": "string", "description": "Comma-separated types: public_channel, private_channel, mpim, im"},
                    "cursor": {"type": "string"},
                    "exclude_archived": {"type": "boolean"},
                    "user": {"type": "string", "description": "Optional user ID to scope results"}
                }
            }),
        ),
        s(
            "slack",
            "SLACK_SEND_MESSAGE",
            "Send a message to a Slack channel or direct message. Requires the channel ID (from SLACK_LIST_CONVERSATIONS or SLACK_OPEN_DM).",
            json!({
                "type": "object",
                "properties": {
                    "channel": {"type": "string", "description": "Channel or DM ID, e.g. 'C12345' or 'D12345'"},
                    "markdown_text": {"type": "string", "description": "The message text (markdown supported)"},
                    "thread_ts": {"type": "string", "description": "Optional timestamp of a message to reply in a thread"},
                    "blocks": {"type": "array", "items": {"type": "object"}, "description": "Optional Slack blocks (advanced formatting)"},
                    "fallback_text": {"type": "string"},
                    "unfurl_links": {"type": "boolean"},
                    "unfurl_media": {"type": "boolean"}
                },
                "required": ["channel"]
            }),
        ),
        s(
            "slack",
            "SLACK_OPEN_DM",
            "Open a direct message conversation with one or more Slack users and get the DM channel ID.",
            json!({
                "type": "object",
                "properties": {
                    "users": {"type": "string", "description": "Comma-separated user IDs (1-8) to open a DM with"},
                    "channel": {"type": "string", "description": "Optional existing channel ID to return"},
                    "return_im": {"type": "boolean"},
                    "prevent_creation": {"type": "boolean"}
                },
                "required": ["users"]
            }),
        ),
        s(
            "slack",
            "SLACK_FIND_USER_BY_EMAIL_ADDRESS",
            "Look up a Slack user by their email address and return their user ID.",
            json!({
                "type": "object",
                "properties": {
                    "email": {"type": "string", "description": "The user's email address"}
                },
                "required": ["email"]
            }),
        ),
        s(
            "slack",
            "SLACK_LIST_ALL_USERS",
            "List all users in the connected Slack workspace.",
            json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results"},
                    "cursor": {"type": "string"},
                    "team_id": {"type": "string"},
                    "include_locale": {"type": "boolean"}
                }
            }),
        ),
        s(
            "slack",
            "SLACK_FETCH_CONVERSATION_HISTORY",
            "Fetch recent message history from a Slack channel or DM.",
            json!({
                "type": "object",
                "properties": {
                    "channel": {"type": "string", "description": "Channel or DM ID"},
                    "limit": {"type": "integer", "description": "Max messages, defaults to 20"},
                    "cursor": {"type": "string"},
                    "latest": {"type": "string", "description": "End of time range (epoch ms)"},
                    "oldest": {"type": "string", "description": "Start of time range (epoch ms)"},
                    "inclusive": {"type": "boolean"}
                },
                "required": ["channel"]
            }),
        ),

        // ── Telegram (native — bot token in URL path) ─────────────────────
        s(
            "telegram",
            "get_me",
            "Get the connected Telegram bot's own info. Use to validate the Telegram connection.",
            json!({ "type": "object", "properties": {} }),
        ),
        s(
            "telegram",
            "send_message",
            "Send a text message to a Telegram chat. The chat_id is provided in the system prompt under Connected Integrations. You can also extract it from incoming Telegram messages (the 'chat_id' field). The bot cannot message itself.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID (e.g. '7577858054')"},
                    "text": {"type": "string", "description": "Message text"},
                    "parse_mode": {"type": "string", "enum": ["MarkdownV2", "HTML"], "description": "Optional formatting mode"},
                    "reply_to_message_id": {"type": "integer", "description": "Optional message ID to reply to"},
                    "disable_notification": {"type": "boolean"},
                    "disable_web_page_preview": {"type": "boolean"}
                },
                "required": ["chat_id", "text"]
            }),
        ),
        s(
            "telegram",
            "send_photo",
            "Send a photo to a Telegram chat by URL or file path.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "photo": {"type": "string", "description": "Photo URL or file path"},
                    "caption": {"type": "string", "description": "Optional caption"},
                    "parse_mode": {"type": "string", "enum": ["MarkdownV2", "HTML"]},
                    "reply_to_message_id": {"type": "integer"}
                },
                "required": ["chat_id", "photo"]
            }),
        ),
        s(
            "telegram",
            "send_document",
            "Send a file or document to a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "document": {"type": "string", "description": "File URL or path"},
                    "caption": {"type": "string", "description": "Optional caption"},
                    "parse_mode": {"type": "string", "enum": ["MarkdownV2", "HTML"]},
                    "reply_to_message_id": {"type": "integer"}
                },
                "required": ["chat_id", "document"]
            }),
        ),
        s(
            "telegram",
            "send_poll",
            "Send a native poll to a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "question": {"type": "string", "description": "Poll question"},
                    "options": {"type": "array", "items": {"type": "string"}, "description": "Array of option strings (2-10)"},
                    "is_anonymous": {"type": "boolean", "description": "Anonymous poll, defaults true"},
                    "type": {"type": "string", "enum": ["regular", "quiz"], "description": "Poll type"},
                    "allows_multiple_answers": {"type": "boolean"},
                    "correct_option_id": {"type": "integer", "description": "For quiz: correct answer index"}
                },
                "required": ["chat_id", "question", "options"]
            }),
        ),
        s(
            "telegram",
            "send_location",
            "Send a map location to a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "latitude": {"type": "number", "description": "Latitude"},
                    "longitude": {"type": "number", "description": "Longitude"},
                    "reply_to_message_id": {"type": "integer"}
                },
                "required": ["chat_id", "latitude", "longitude"]
            }),
        ),
        s(
            "telegram",
            "forward_message",
            "Forward a message from one chat to another.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Destination numeric chat ID"},
                    "from_chat_id": {"type": "string", "description": "Source chat ID"},
                    "message_id": {"type": "integer", "description": "Message ID to forward"},
                    "disable_notification": {"type": "boolean"}
                },
                "required": ["chat_id", "from_chat_id", "message_id"]
            }),
        ),
        s(
            "telegram",
            "edit_message",
            "Edit a text message sent by the bot.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "message_id": {"type": "integer", "description": "Message ID to edit"},
                    "text": {"type": "string", "description": "New message text"},
                    "parse_mode": {"type": "string", "enum": ["MarkdownV2", "HTML"]},
                    "disable_web_page_preview": {"type": "boolean"}
                },
                "required": ["chat_id", "message_id", "text"]
            }),
        ),
        s(
            "telegram",
            "delete_message",
            "Delete a message from a chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "message_id": {"type": "integer", "description": "Message ID to delete"}
                },
                "required": ["chat_id", "message_id"]
            }),
        ),
        s(
            "telegram",
            "get_chat",
            "Get information about a Telegram chat (name, type, members, etc).",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID or @username"}
                },
                "required": ["chat_id"]
            }),
        ),
        s(
            "telegram",
            "get_chat_administrators",
            "List administrators in a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"}
                },
                "required": ["chat_id"]
            }),
        ),
        s(
            "telegram",
            "get_chat_member",
            "Get info about a specific member in a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "user_id": {"type": "integer", "description": "Telegram user ID"}
                },
                "required": ["chat_id", "user_id"]
            }),
        ),
        s(
            "telegram",
            "get_chat_members_count",
            "Get the number of members in a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"}
                },
                "required": ["chat_id"]
            }),
        ),
        s(
            "telegram",
            "create_chat_invite_link",
            "Generate a new invite link for a Telegram chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "Numeric chat ID"},
                    "name": {"type": "string", "description": "Link name"},
                    "expire_date": {"type": "integer", "description": "Expiration timestamp"},
                    "member_limit": {"type": "integer", "description": "Max users"}
                },
                "required": ["chat_id"]
            }),
        ),
        s(
            "telegram",
            "answer_callback_query",
            "Answer an inline keyboard callback query.",
            json!({
                "type": "object",
                "properties": {
                    "callback_query_id": {"type": "string", "description": "Callback query ID"},
                    "text": {"type": "string", "description": "Text to show to user"},
                    "show_alert": {"type": "boolean", "description": "Show alert dialog"}
                },
                "required": ["callback_query_id"]
            }),
        ),
        s(
            "telegram",
            "set_my_commands",
            "Change the list of commands the bot offers.",
            json!({
                "type": "object",
                "properties": {
                    "commands": {"type": "array", "items": {"type": "object"}, "description": "Array of {command, description} objects"},
                    "language_code": {"type": "string", "description": "Optional language code (e.g. 'en')"}
                },
                "required": ["commands"]
            }),
        ),

        // ── Microsoft Teams ─────────────────────────────────────────────────
        s(
            "teams",
            "MICROSOFT_TEAMS_TEAMS_LIST",
            "List all Microsoft Teams the user belongs to. Use to find team IDs.",
            json!({
                "type": "object",
                "properties": {
                    "top": {"type": "integer", "description": "Max results"},
                    "filter": {"type": "string", "description": "OData filter"},
                    "select": {"type": "string", "description": "OData select"}
                }
            }),
        ),
        s(
            "teams",
            "MICROSOFT_TEAMS_TEAMS_LIST_CHANNELS",
            "List the channels of a Microsoft Team.",
            json!({
                "type": "object",
                "properties": {
                    "team_id": {"type": "string", "description": "The Team ID"},
                    "filter": {"type": "string", "description": "OData filter"},
                    "select": {"type": "string", "description": "OData select"}
                },
                "required": ["team_id"]
            }),
        ),
        s(
            "teams",
            "MICROSOFT_TEAMS_TEAMS_POST_CHAT_MESSAGE",
            "Send a message to a Microsoft Teams 1:1 or group chat.",
            json!({
                "type": "object",
                "properties": {
                    "chat_id": {"type": "string", "description": "The chat ID (from MS Graph)"},
                    "content": {"type": "string", "description": "Message content"},
                    "content_type": {"type": "string", "enum": ["text", "html"], "description": "Content type, defaults to text"},
                    "subject": {"type": "string", "description": "Optional subject"},
                    "importance": {"type": "string", "enum": ["normal", "high", "urgent"]},
                    "mentions": {"type": "array", "items": {"type": "object"}, "description": "Optional mention entities"}
                },
                "required": ["chat_id", "content"]
            }),
        ),
        s(
            "teams",
            "MICROSOFT_TEAMS_TEAMS_POST_CHANNEL_MESSAGE",
            "Send a message to a Microsoft Teams channel.",
            json!({
                "type": "object",
                "properties": {
                    "team_id": {"type": "string", "description": "The Team ID"},
                    "channel_id": {"type": "string", "description": "The channel ID"},
                    "content": {"type": "string", "description": "Message content"},
                    "content_type": {"type": "string", "enum": ["text", "html"]},
                    "subject": {"type": "string"},
                    "importance": {"type": "string", "enum": ["normal", "high", "urgent"]},
                    "mentions": {"type": "array", "items": {"type": "object"}}
                },
                "required": ["team_id", "channel_id", "content"]
            }),
        ),
        s(
            "teams",
            "MICROSOFT_TEAMS_LIST_USER_CHAT_MESSAGES",
            "List messages in a Microsoft Teams chat.",
            json!({
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "The user ID"},
                    "chat_id": {"type": "string", "description": "The chat ID"},
                    "top": {"type": "integer"},
                    "limit": {"type": "integer"},
                    "filter": {"type": "string"},
                    "orderby": {"type": "string"}
                },
                "required": ["user_id", "chat_id"]
            }),
        ),

        // ── Zoom ────────────────────────────────────────────────────────────
        s(
            "zoom",
            "ZOOM_LIST_MEETINGS",
            "List a Zoom user's scheduled meetings. userId 'me' refers to the connected user.",
            json!({
                "type": "object",
                "properties": {
                    "userId": {"type": "string", "description": "User ID or 'me'", "default": "me"},
                    "type": {"type": "string", "description": "Meeting type filter (scheduled, upcoming, previous)"},
                    "page_size": {"type": "integer", "description": "Max results (1-300)"},
                    "page_number": {"type": "integer"},
                    "next_page_token": {"type": "string"}
                },
                "required": ["userId"]
            }),
        ),
        s(
            "zoom",
            "ZOOM_GET_USER",
            "Get a Zoom user's details.",
            json!({
                "type": "object",
                "properties": {
                    "userId": {"type": "string", "description": "User ID or 'me'", "default": "me"},
                    "login_type": {"type": "integer"},
                    "encrypted_email": {"type": "boolean"},
                    "search_by_unique_id": {"type": "boolean"}
                },
                "required": ["userId"]
            }),
        ),
        s(
            "zoom",
            "ZOOM_GET_MEETING_RECORDINGS",
            "Get the cloud recordings for a Zoom meeting.",
            json!({
                "type": "object",
                "properties": {
                    "meetingId": {"type": "string", "description": "The meeting ID"},
                    "ttl": {"type": "integer", "description": "Recording download URL TTL in seconds"},
                    "include_fields": {"type": "string"}
                },
                "required": ["meetingId"]
            }),
        ),

        // ── SendGrid ────────────────────────────────────────────────────────
        s(
            "sendgrid",
            "SENDGRID_SEND_EMAIL_WITH_TWILIO_SEND_GRID",
            "Send a transactional email via Twilio SendGrid. personalizations is a required array of objects each with a 'to' array (e.g. [{\"to\":[{\"email\":\"x@y.com\"}]}]). Use from__email and from__name for the sender.",
            json!({
                "type": "object",
                "properties": {
                    "personalizations": {"type": "array", "items": {"type": "object"}, "description": "Array of recipient objects, e.g. [{\"to\":[{\"email\":\"x@y.com\"}]}]"},
                    "from__email": {"type": "string", "description": "Sender email address"},
                    "from__name": {"type": "string", "description": "Optional sender name"},
                    "subject": {"type": "string", "description": "Email subject"},
                    "content": {"type": "array", "items": {"type": "object"}, "description": "Array of content objects, e.g. [{\"type\":\"text/plain\",\"value\":\"Hello\"}]"},
                    "template_id": {"type": "string", "description": "Optional template ID"},
                    "categories": {"type": "array", "items": {"type": "string"}},
                    "attachments": {"type": "array", "items": {"type": "object"}},
                    "send_at": {"type": "integer", "description": "Optional scheduled send timestamp"}
                },
                "required": ["personalizations", "from__email", "subject"]
            }),
        ),

        // ── Mailchimp ───────────────────────────────────────────────────────
        s(
            "mailchimp",
            "MAILCHIMP_LIST_MEMBERS_INFO",
            "List the members (subscribers) of a Mailchimp audience/list.",
            json!({
                "type": "object",
                "properties": {
                    "list_id": {"type": "string", "description": "The audience/list ID"},
                    "count": {"type": "integer", "description": "Max results (1-1000), defaults to 10"},
                    "offset": {"type": "integer"},
                    "status": {"type": "string", "enum": ["subscribed", "unsubscribed", "cleaned", "pending", "transactional", "archived"]},
                    "sort_field": {"type": "string", "enum": ["timestamp_opt", "timestamp_signup", "last_changed"]},
                    "sort_dir": {"type": "string", "enum": ["ASC", "DESC"]}
                },
                "required": ["list_id"]
            }),
        ),
        s(
            "mailchimp",
            "MAILCHIMP_ADD_OR_UPDATE_LIST_MEMBER",
            "Add or update a subscriber in a Mailchimp audience/list.",
            json!({
                "type": "object",
                "properties": {
                    "list_id": {"type": "string", "description": "The audience/list ID"},
                    "email_address": {"type": "string", "description": "Subscriber email"},
                    "status_if_new": {"type": "string", "enum": ["subscribed", "unsubscribed", "pending", "transactional"], "description": "Status when creating a new member"},
                    "status": {"type": "string", "description": "Optional status override"},
                    "merge_fields": {"type": "object", "description": "Optional merge fields (FNAME, LNAME, etc.)"},
                    "interests": {"type": "object"},
                    "language": {"type": "string"},
                    "vip": {"type": "boolean"}
                },
                "required": ["list_id", "email_address", "status_if_new"]
            }),
        ),
        s(
            "mailchimp",
            "MAILCHIMP_LIST_CAMPAIGNS",
            "List email campaigns in the connected Mailchimp account.",
            json!({
                "type": "object",
                "properties": {
                    "count": {"type": "integer", "description": "Max results"},
                    "offset": {"type": "integer"},
                    "status": {"type": "string", "enum": ["save", "paused", "schedule", "sending", "sent", "canceled", "canceling"]},
                    "list_id": {"type": "string"},
                    "sort_field": {"type": "string"},
                    "sort_dir": {"type": "string", "enum": ["ASC", "DESC"]}
                }
            }),
        ),

        // ── Discord ─────────────────────────────────────────────────────────
        s(
            "discord",
            "DISCORD_GET_MY_USER",
            "Get the connected Discord user's own profile.",
            json!({ "type": "object", "properties": {} }),
        ),
        s(
            "discord",
            "DISCORD_LIST_MY_GUILDS",
            "List the Discord servers (guilds) the connected user belongs to.",
            json!({
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "Max results, defaults to 200"},
                    "before": {"type": "string"},
                    "after": {"type": "string"},
                    "with_counts": {"type": "boolean"}
                }
            }),
        ),

        // ── Outlook ─────────────────────────────────────────────────────────
        s(
            "outlook",
            "OUTLOOK_SEND_EMAIL",
            "Send an email from the connected Microsoft Outlook account.",
            json!({
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Primary recipient email address"},
                    "subject": {"type": "string", "description": "Email subject"},
                    "body": {"type": "string", "description": "Email body"},
                    "is_html": {"type": "boolean"},
                    "to_name": {"type": "string"},
                    "cc_emails": {"type": "array", "items": {"type": "string"}},
                    "bcc_emails": {"type": "array", "items": {"type": "string"}},
                    "from_address": {"type": "string"},
                    "save_to_sent_items": {"type": "boolean"}
                },
                "required": ["to", "subject", "body"]
            }),
        ),
        s(
            "outlook",
            "OUTLOOK_LIST_MESSAGES",
            "List email messages in the connected Outlook mailbox, optionally filtered.",
            json!({
                "type": "object",
                "properties": {
                    "folder": {"type": "string", "description": "Folder to list, e.g. 'inbox'"},
                    "search": {"type": "string", "description": "Free-text search"},
                    "top": {"type": "integer", "description": "Max results"},
                    "is_read": {"type": "boolean"},
                    "importance": {"type": "string", "enum": ["low", "normal", "high"]},
                    "subject_contains": {"type": "string"},
                    "from_address": {"type": "string"}
                }
            }),
        ),

        // ── Google Chat ─────────────────────────────────────────────────────
        s(
            "googlechat",
            "GOOGLE_CHAT_LIST_SPACES",
            "List the Google Chat spaces the user is a member of.",
            json!({
                "type": "object",
                "properties": {
                    "filter": {"type": "string", "description": "Query filter"},
                    "page_size": {"type": "integer"},
                    "page_token": {"type": "string"}
                }
            }),
        ),
        s(
            "googlechat",
            "GOOGLE_CHAT_CREATE_MESSAGE",
            "Create/send a message in a Google Chat space. parent is the space resource name like 'spaces/AAAA'.",
            json!({
                "type": "object",
                "properties": {
                    "parent": {"type": "string", "description": "Space resource name, e.g. 'spaces/AAAA'" },
                    "text": {"type": "string", "description": "Message text"},
                    "thread_key": {"type": "string", "description": "Optional thread key to reply in a thread"},
                    "message_reply_option": {"type": "string"},
                    "request_id": {"type": "string"}
                },
                "required": ["parent", "text"]
            }),
        ),
        s(
            "googlechat",
            "GOOGLE_CHAT_LIST_MESSAGES",
            "List messages in a Google Chat space.",
            json!({
                "type": "object",
                "properties": {
                    "parent": {"type": "string", "description": "Space resource name, e.g. 'spaces/AAAA'"},
                    "filter": {"type": "string"},
                    "orderBy": {"type": "string"},
                    "page_size": {"type": "integer"},
                    "page_token": {"type": "string"},
                    "showDeleted": {"type": "boolean"}
                },
                "required": ["parent"]
            }),
        ),
    ]
}

/// Tool definitions for the agent, filtered to apps that are both connected AND
/// on the curated communication-app allowlist (the `COMMUNICATION_APPS` gate).
pub fn definitions(connected: &HashSet<String>) -> Vec<ToolDefinition> {
    let allowed: HashSet<&str> = COMMUNICATION_APPS.iter().copied().collect();
    AGENT_TOOLS
        .iter()
        .filter(|t| allowed.contains(t.app) && connected.contains(t.app))
        .map(|t| ToolDefinition {
            name: t.slug.to_string(),
            description: t.description.to_string(),
            input_schema: t.schema.clone(),
            auto_execute: true,
        })
        .collect()
}

/// Resolve an agent tool name (LLM slug) to its owning app key.
pub fn resolve_app(name: &str) -> Option<&'static str> {
    AGENT_TOOLS.iter().find(|t| t.slug == name).map(|t| t.app)
}

/// Whether `name` is one of the agent's integration tools.
pub fn is_integration_tool(name: &str) -> bool {
    resolve_app(name).is_some()
}

/// Execute an integration tool by name. Routes through the shared integration
/// executor so native / API-key / Composio backends all work.
pub async fn execute_tool(
    app: &AppHandle,
    name: &str,
    args: &Value,
) -> Result<Value, String> {
    let tool = AGENT_TOOLS
        .iter()
        .find(|t| t.slug == name)
        .ok_or_else(|| format!("Unknown integration tool: {name}"))?;
    // The LLM-facing slug is the backend action name — route it through the
    // shared integration executor so native / API-key / Composio backends work.
    crate::integrations::commands::execute_integration(app, tool.app, tool.slug, args.clone())
        .await
}
