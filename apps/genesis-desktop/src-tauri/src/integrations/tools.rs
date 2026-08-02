// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use std::collections::HashMap;
use once_cell::sync::Lazy;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CuratedTool {
    pub slug: &'static str,
    pub name: &'static str,
    pub description: &'static str,
}

static CURATED_TOOLS: Lazy<HashMap<&'static str, Vec<CuratedTool>>> = Lazy::new(|| {
    let mut m: HashMap<&str, Vec<CuratedTool>> = HashMap::new();

    // ── Gmail ──────────────────────────────────────────────
    m.insert("gmail", vec![
        CuratedTool { slug: "GMAIL_SEND_EMAIL", name: "Send Email", description: "Send an email to recipients" },
        CuratedTool { slug: "GMAIL_CREATE_EMAIL_DRAFT", name: "Create Draft", description: "Create an email draft" },
        CuratedTool { slug: "GMAIL_UPDATE_DRAFT", name: "Update Draft", description: "Update an existing email draft" },
        CuratedTool { slug: "GMAIL_SEND_DRAFT", name: "Send Draft", description: "Send a saved draft" },
        CuratedTool { slug: "GMAIL_DELETE_DRAFT", name: "Delete Draft", description: "Delete an email draft" },
        CuratedTool { slug: "GMAIL_FETCH_EMAILS", name: "Fetch Emails", description: "Fetch emails matching a query" },
        CuratedTool { slug: "GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID", name: "Get Message", description: "Get a specific email by message ID" },
        CuratedTool { slug: "GMAIL_FETCH_MESSAGE_BY_THREAD_ID", name: "Get Thread Messages", description: "Get all messages in a thread" },
        CuratedTool { slug: "GMAIL_LIST_THREADS", name: "List Threads", description: "List email threads" },
        CuratedTool { slug: "GMAIL_LIST_DRAFTS", name: "List Drafts", description: "List all email drafts" },
        CuratedTool { slug: "GMAIL_LIST_LABELS", name: "List Labels", description: "List all email labels" },
        CuratedTool { slug: "GMAIL_REPLY_TO_THREAD", name: "Reply to Thread", description: "Reply to an email thread" },
        CuratedTool { slug: "GMAIL_FORWARD_MESSAGE", name: "Forward Message", description: "Forward an email" },
        CuratedTool { slug: "GMAIL_GET_CONTACTS", name: "Get Contacts", description: "Get contacts from Gmail" },
        CuratedTool { slug: "GMAIL_SEARCH_PEOPLE", name: "Search People", description: "Search people in contacts" },
        CuratedTool { slug: "GMAIL_GET_PROFILE", name: "Get Profile", description: "Get Gmail profile info" },
        CuratedTool { slug: "GMAIL_MOVE_TO_TRASH", name: "Trash Message", description: "Move a message to trash" },
        CuratedTool { slug: "GMAIL_UNTRASH_MESSAGE", name: "Untrash Message", description: "Restore a message from trash" },
        CuratedTool { slug: "GMAIL_DELETE_MESSAGE", name: "Delete Message", description: "Permanently delete a message" },
        CuratedTool { slug: "GMAIL_MODIFY_THREAD_LABELS", name: "Modify Thread Labels", description: "Add or remove labels from a thread" },
        CuratedTool { slug: "GMAIL_CREATE_LABEL", name: "Create Label", description: "Create a new email label" },
        CuratedTool { slug: "GMAIL_GET_ATTACHMENT", name: "Get Attachment", description: "Download an email attachment" },
        CuratedTool { slug: "GMAIL_ADD_LABEL_TO_EMAIL", name: "Add Label to Email", description: "Add a label to a specific email" },
        CuratedTool { slug: "GMAIL_BATCH_MODIFY_MESSAGES", name: "Batch Modify Messages", description: "Modify labels on multiple messages" },
        CuratedTool { slug: "GMAIL_BATCH_DELETE_MESSAGES", name: "Batch Delete Messages", description: "Delete multiple messages at once" },
    ]);

    // ── Outlook ────────────────────────────────────────────
    m.insert("outlook", vec![
        CuratedTool { slug: "OUTLOOK_SEND_EMAIL", name: "Send Email", description: "Send an email message" },
        CuratedTool { slug: "OUTLOOK_CREATE_DRAFT", name: "Create Draft", description: "Create an email draft" },
        CuratedTool { slug: "OUTLOOK_CREATE_DRAFT_REPLY", name: "Create Reply Draft", description: "Create a reply draft" },
        CuratedTool { slug: "OUTLOOK_CREATE_FORWARD_DRAFT", name: "Create Forward Draft", description: "Create a forward draft" },
        CuratedTool { slug: "OUTLOOK_CREATE_ME_EVENT", name: "Create Calendar Event", description: "Create a calendar event" },
        CuratedTool { slug: "OUTLOOK_CALENDAR_CREATE_EVENT", name: "Create Event", description: "Create a calendar event (alternative)" },
        CuratedTool { slug: "OUTLOOK_DELETE_CALENDAR_EVENT", name: "Delete Event", description: "Delete a calendar event" },
        CuratedTool { slug: "OUTLOOK_CANCEL_CALENDAR_EVENT", name: "Cancel Event", description: "Cancel a calendar event" },
        CuratedTool { slug: "OUTLOOK_GET_MESSAGE", name: "Get Message", description: "Get a specific email message" },
        CuratedTool { slug: "OUTLOOK_LIST_MESSAGES", name: "List Messages", description: "List email messages in a folder" },
        CuratedTool { slug: "OUTLOOK_LIST_MAIL_FOLDERS", name: "List Folders", description: "List mail folders" },
        CuratedTool { slug: "OUTLOOK_CREATE_CONTACT", name: "Create Contact", description: "Create a new contact" },
        CuratedTool { slug: "OUTLOOK_LIST_CONTACTS", name: "Get Contacts", description: "Get contacts" },
        CuratedTool { slug: "OUTLOOK_CREATE_TASK", name: "Create Task", description: "Create a To Do task" },
        CuratedTool { slug: "OUTLOOK_LIST_CALENDARS", name: "List Calendars", description: "List calendars" },
        CuratedTool { slug: "OUTLOOK_LIST_EVENTS", name: "List Events", description: "List calendar events" },
        CuratedTool { slug: "OUTLOOK_UPDATE_CALENDAR_EVENT", name: "Update Event", description: "Update a calendar event" },
        CuratedTool { slug: "OUTLOOK_ADD_MAIL_ATTACHMENT", name: "Add Attachment", description: "Add attachment to email" },
        CuratedTool { slug: "OUTLOOK_MOVE_MESSAGE", name: "Move Message", description: "Move a message to a folder" },
        CuratedTool { slug: "OUTLOOK_DELETE_MESSAGE", name: "Delete Message", description: "Delete an email message" },
    ]);

    // ── Slack ──────────────────────────────────────────────
    m.insert("slack", vec![
        CuratedTool { slug: "SLACK_SEND_MESSAGE", name: "Send Message", description: "Send a message to a channel or DM" },
        CuratedTool { slug: "SLACK_SCHEDULE_MESSAGE", name: "Schedule Message", description: "Schedule a message for later" },
        CuratedTool { slug: "SLACK_UPDATES_A_SLACK_MESSAGE", name: "Update Message", description: "Edit a previously sent message" },
        CuratedTool { slug: "SLACK_DELETES_A_MESSAGE_FROM_A_CHAT", name: "Delete Message", description: "Delete a message" },
        CuratedTool { slug: "SLACK_OPEN_DM", name: "Open DM", description: "Open a direct message channel" },
        CuratedTool { slug: "SLACK_CREATE_CHANNEL", name: "Create Channel", description: "Create a new channel" },
        CuratedTool { slug: "SLACK_LIST_CONVERSATIONS", name: "List Channels", description: "List channels the bot is in" },
        CuratedTool { slug: "SLACK_LIST_ALL_CHANNELS", name: "List All Channels", description: "List all channels in workspace" },
        CuratedTool { slug: "SLACK_FIND_CHANNELS", name: "Find Channels", description: "Search for channels" },
        CuratedTool { slug: "SLACK_FETCH_CONVERSATION_HISTORY", name: "Get Channel History", description: "Fetch message history from a channel" },
        CuratedTool { slug: "SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION", name: "Get Thread Replies", description: "Get replies in a message thread" },
        CuratedTool { slug: "SLACK_SEARCH_MESSAGES", name: "Search Messages", description: "Search messages by keyword" },
        CuratedTool { slug: "SLACK_SEARCH_ALL", name: "Search All", description: "Search all Slack content" },
        CuratedTool { slug: "SLACK_INVITE_USERS_TO_A_SLACK_CHANNEL", name: "Invite to Channel", description: "Invite users to a channel" },
        CuratedTool { slug: "SLACK_ADD_REACTION_TO_AN_ITEM", name: "Add Reaction", description: "Add an emoji reaction to a message" },
        CuratedTool { slug: "SLACK_REMOVE_REACTION_FROM_ITEM", name: "Remove Reaction", description: "Remove an emoji reaction" },
        CuratedTool { slug: "SLACK_SET_STATUS", name: "Set Status", description: "Set your Slack status" },
        CuratedTool { slug: "SLACK_MANUALLY_SET_USER_PRESENCE", name: "Set Presence", description: "Set your online presence" },
        CuratedTool { slug: "SLACK_FIND_USER_BY_EMAIL_ADDRESS", name: "Find User by Email", description: "Look up a user by email" },
        CuratedTool { slug: "SLACK_LIST_ALL_USERS", name: "List Users", description: "List all users in workspace" },
        CuratedTool { slug: "SLACK_RETRIEVE_DETAILED_USER_INFORMATION", name: "Get User Info", description: "Get detailed info about a user" },
        CuratedTool { slug: "SLACK_CREATE_A_REMINDER", name: "Create Reminder", description: "Create a reminder for yourself or channel" },
        CuratedTool { slug: "SLACK_LIST_REMINDERS", name: "List Reminders", description: "List your active reminders" },
        CuratedTool { slug: "SLACK_PIN_ITEM", name: "Pin Message", description: "Pin a message to a channel" },
        CuratedTool { slug: "SLACK_UNPIN_ITEM", name: "Unpin Message", description: "Unpin a message from a channel" },
        CuratedTool { slug: "SLACK_LIST_PINNED_ITEMS", name: "List Pinned Items", description: "List pinned items in a channel" },
        CuratedTool { slug: "SLACK_FETCH_TEAM_INFO", name: "Get Team Info", description: "Get workspace info" },
        CuratedTool { slug: "SLACK_SET_THE_TOPIC_OF_A_CONVERSATION", name: "Set Channel Topic", description: "Set the topic of a channel" },
        CuratedTool { slug: "SLACK_SET_CONVERSATION_PURPOSE", name: "Set Channel Purpose", description: "Set the purpose of a channel" },
    ]);

    // ── Discord ────────────────────────────────────────────
    m.insert("discord", vec![
        CuratedTool { slug: "DISCORD_GET_MY_USER", name: "Get My User", description: "Get your Discord profile info" },
        CuratedTool { slug: "DISCORD_GET_USER", name: "Get User", description: "Get info about a Discord user" },
        CuratedTool { slug: "DISCORD_LIST_MY_GUILDS", name: "List My Servers", description: "List servers you belong to" },
        CuratedTool { slug: "DISCORD_LIST_MY_CONNECTIONS", name: "List Connections", description: "List your connected accounts" },
        CuratedTool { slug: "DISCORD_GET_MY_GUILD_MEMBER", name: "Get Guild Member", description: "Get your membership info for a server" },
        CuratedTool { slug: "DISCORD_INVITE_RESOLVE", name: "Resolve Invite", description: "Get info about an invite code" },
        CuratedTool { slug: "DISCORD_LIST_STICKER_PACKS", name: "List Sticker Packs", description: "List available Nitro sticker packs" },
    ]);

    // ── Telegram ───────────────────────────────────────────
    m.insert("telegram", vec![
        CuratedTool { slug: "TELEGRAM_SEND_MESSAGE", name: "Send Message", description: "Send a text message to a chat" },
        CuratedTool { slug: "TELEGRAM_SEND_PHOTO", name: "Send Photo", description: "Send a photo to a chat" },
        CuratedTool { slug: "TELEGRAM_SEND_DOCUMENT", name: "Send Document", description: "Send a file/document to a chat" },
        CuratedTool { slug: "TELEGRAM_SEND_POLL", name: "Send Poll", description: "Create a poll in a chat" },
        CuratedTool { slug: "TELEGRAM_SEND_LOCATION", name: "Send Location", description: "Send a map location to a chat" },
        CuratedTool { slug: "TELEGRAM_EDIT_MESSAGE", name: "Edit Message", description: "Edit a sent message" },
        CuratedTool { slug: "TELEGRAM_DELETE_MESSAGE", name: "Delete Message", description: "Delete a message" },
        CuratedTool { slug: "TELEGRAM_FORWARD_MESSAGE", name: "Forward Message", description: "Forward a message to another chat" },
        CuratedTool { slug: "TELEGRAM_GET_CHAT", name: "Get Chat", description: "Get info about a chat" },
        CuratedTool { slug: "TELEGRAM_GET_CHAT_HISTORY", name: "Get Chat History", description: "Get recent messages from a chat" },
        CuratedTool { slug: "TELEGRAM_GET_CHAT_ADMINISTRATORS", name: "Get Admins", description: "List administrators in a chat" },
        CuratedTool { slug: "TELEGRAM_GET_CHAT_MEMBERS_COUNT", name: "Get Member Count", description: "Get the number of members in a chat" },
        CuratedTool { slug: "TELEGRAM_CREATE_CHAT_INVITE_LINK", name: "Create Invite Link", description: "Generate a chat invite link" },
        CuratedTool { slug: "TELEGRAM_GET_ME", name: "Get Bot Info", description: "Get the bot's own info" },
    ]);

    // ── Google Calendar ────────────────────────────────────
    m.insert("googlecalendar", vec![
        CuratedTool { slug: "GOOGLECALENDAR_CREATE_EVENT", name: "Create Event", description: "Create a calendar event" },
        CuratedTool { slug: "GOOGLECALENDAR_QUICK_ADD", name: "Quick Add Event", description: "Create event from natural language" },
        CuratedTool { slug: "GOOGLECALENDAR_DELETE_EVENT", name: "Delete Event", description: "Delete a calendar event" },
        CuratedTool { slug: "GOOGLECALENDAR_UPDATE_EVENT", name: "Update Event", description: "Update an existing event" },
        CuratedTool { slug: "GOOGLECALENDAR_PATCH_EVENT", name: "Patch Event", description: "Partially update an event" },
        CuratedTool { slug: "GOOGLECALENDAR_EVENTS_LIST", name: "List Events", description: "List events on a calendar" },
        CuratedTool { slug: "GOOGLECALENDAR_FIND_EVENT", name: "Find Events", description: "Search events by text or time range" },
        CuratedTool { slug: "GOOGLECALENDAR_EVENTS_GET", name: "Get Event", description: "Get a specific event by ID" },
        CuratedTool { slug: "GOOGLECALENDAR_LIST_CALENDARS", name: "List Calendars", description: "List all your calendars" },
        CuratedTool { slug: "GOOGLECALENDAR_GET_CALENDAR", name: "Get Calendar", description: "Get calendar details" },
        CuratedTool { slug: "GOOGLECALENDAR_CREATE_CALENDAR", name: "Create Calendar", description: "Create a new calendar" },
        CuratedTool { slug: "GOOGLECALENDAR_FIND_FREE_SLOTS", name: "Find Free Slots", description: "Find available time slots" },
        CuratedTool { slug: "GOOGLECALENDAR_REMOVE_ATTENDEE", name: "Remove Attendee", description: "Remove an attendee from an event" },
        CuratedTool { slug: "GOOGLECALENDAR_BATCH_EVENTS", name: "Batch Events", description: "Create/update multiple events at once" },
        CuratedTool { slug: "GOOGLECALENDAR_EVENTS_INSTANCES", name: "Get Recurring Instances", description: "Get instances of a recurring event" },
    ]);

    // ── Todoist ────────────────────────────────────────────
    m.insert("todoist", vec![
        CuratedTool { slug: "TODOIST_CREATE_TASK", name: "Create Task", description: "Create a new task" },
        CuratedTool { slug: "TODOIST_QUICK_ADD_TASK", name: "Quick Add Task", description: "Quick add a task with natural language" },
        CuratedTool { slug: "TODOIST_GET_ALL_TASKS", name: "List Tasks", description: "Get all active tasks" },
        CuratedTool { slug: "TODOIST_GET_TASK2", name: "Get Task", description: "Get a specific task by ID" },
        CuratedTool { slug: "TODOIST_UPDATE_TASK", name: "Update Task", description: "Update a task's properties" },
        CuratedTool { slug: "TODOIST_DELETE_TASK", name: "Delete Task", description: "Delete a task" },
        CuratedTool { slug: "TODOIST_CLOSE_TASK_V1", name: "Complete Task", description: "Mark a task as complete" },
        CuratedTool { slug: "TODOIST_REOPEN_TASK2", name: "Reopen Task", description: "Reopen a completed task" },
        CuratedTool { slug: "TODOIST_BULK_CREATE_TASKS", name: "Bulk Create Tasks", description: "Create multiple tasks at once" },
        CuratedTool { slug: "TODOIST_FILTER_TASKS", name: "Filter Tasks", description: "Filter tasks by query" },
        CuratedTool { slug: "TODOIST_GET_ALL_PROJECTS", name: "List Projects", description: "Get all projects" },
        CuratedTool { slug: "TODOIST_GET_PROJECT", name: "Get Project", description: "Get a specific project" },
        CuratedTool { slug: "TODOIST_CREATE_PROJECT2", name: "Create Project", description: "Create a new project" },
        CuratedTool { slug: "TODOIST_UPDATE_PROJECT2", name: "Update Project", description: "Update a project" },
        CuratedTool { slug: "TODOIST_DELETE_PROJECT2", name: "Delete Project", description: "Delete a project" },
        CuratedTool { slug: "TODOIST_LIST_SECTIONS", name: "List Sections", description: "List sections in a project" },
        CuratedTool { slug: "TODOIST_CREATE_SECTION_V1", name: "Create Section", description: "Create a section in a project" },
        CuratedTool { slug: "TODOIST_LIST_LABELS", name: "List Labels", description: "List all labels" },
        CuratedTool { slug: "TODOIST_CREATE_LABEL_V1", name: "Create Label", description: "Create a new label" },
        CuratedTool { slug: "TODOIST_GET_ALL_COMMENTS", name: "List Comments", description: "Get all comments on a task" },
        CuratedTool { slug: "TODOIST_CREATE_COMMENT_V1", name: "Add Comment", description: "Add a comment to a task" },
        CuratedTool { slug: "TODOIST_LIST_COMPLETED_TASKS", name: "List Completed", description: "List completed tasks" },
        CuratedTool { slug: "TODOIST_GET_PRODUCTIVITY_STATS", name: "Productivity Stats", description: "Get productivity statistics" },
        CuratedTool { slug: "TODOIST_MOVE_TASK", name: "Move Task", description: "Move a task to another project" },
    ]);

    // ── Asana ──────────────────────────────────────────────
    m.insert("asana", vec![
        CuratedTool { slug: "ASANA_CREATE_A_TASK", name: "Create Task", description: "Create a new task" },
        CuratedTool { slug: "ASANA_GET_A_TASK", name: "Get Task", description: "Get a specific task" },
        CuratedTool { slug: "ASANA_UPDATE_A_TASK", name: "Update Task", description: "Update a task" },
        CuratedTool { slug: "ASANA_DELETE_TASK", name: "Delete Task", description: "Delete a task" },
        CuratedTool { slug: "ASANA_GET_TASKS_FROM_A_PROJECT", name: "List Tasks in Project", description: "Get tasks from a project" },
        CuratedTool { slug: "ASANA_GET_TASKS_FROM_SECTION", name: "List Tasks in Section", description: "Get tasks from a section" },
        CuratedTool { slug: "ASANA_SEARCH_TASKS_IN_WORKSPACE", name: "Search Tasks", description: "Search tasks across workspace" },
        CuratedTool { slug: "ASANA_CREATE_SUBTASK", name: "Create Subtask", description: "Create a subtask" },
        CuratedTool { slug: "ASANA_GET_TASK_SUBTASKS", name: "Get Subtasks", description: "Get subtasks of a task" },
        CuratedTool { slug: "ASANA_CREATE_TASK_COMMENT", name: "Add Comment", description: "Add a comment to a task" },
        CuratedTool { slug: "ASANA_GET_STORIES_FOR_TASK", name: "Get Task Activity", description: "Get activity history for a task" },
        CuratedTool { slug: "ASANA_ADD_FOLLOWERS_TO_TASK", name: "Add Followers", description: "Add followers to a task" },
        CuratedTool { slug: "ASANA_ADD_PROJECT_FOR_TASK", name: "Add to Project", description: "Add task to a project" },
        CuratedTool { slug: "ASANA_ADD_TAG_TO_TASK", name: "Add Tag", description: "Add a tag to a task" },
        CuratedTool { slug: "ASANA_CREATE_A_PROJECT", name: "Create Project", description: "Create a new project" },
        CuratedTool { slug: "ASANA_GET_A_PROJECT", name: "Get Project", description: "Get project details" },
        CuratedTool { slug: "ASANA_UPDATE_PROJECT", name: "Update Project", description: "Update a project" },
        CuratedTool { slug: "ASANA_DELETE_PROJECT", name: "Delete Project", description: "Delete a project" },
        CuratedTool { slug: "ASANA_GET_WORKSPACE_PROJECTS", name: "List Projects", description: "List projects in workspace" },
        CuratedTool { slug: "ASANA_CREATE_SECTION_IN_PROJECT", name: "Create Section", description: "Create a section in a project" },
        CuratedTool { slug: "ASANA_GET_SECTIONS_IN_PROJECT", name: "List Sections", description: "List sections in a project" },
        CuratedTool { slug: "ASANA_ADD_TASK_TO_SECTION", name: "Move to Section", description: "Move a task to a section" },
        CuratedTool { slug: "ASANA_GET_MULTIPLE_WORKSPACES", name: "List Workspaces", description: "List workspaces" },
        CuratedTool { slug: "ASANA_GET_CURRENT_USER", name: "Get Me", description: "Get current user info" },
        CuratedTool { slug: "ASANA_DUPLICATE_TASK", name: "Duplicate Task", description: "Duplicate a task" },
    ]);

    // ── Linear ─────────────────────────────────────────────
    m.insert("linear", vec![
        CuratedTool { slug: "LINEAR_CREATE_LINEAR_ISSUE", name: "Create Issue", description: "Create a new issue" },
        CuratedTool { slug: "LINEAR_GET_LINEAR_ISSUE", name: "Get Issue", description: "Get a specific issue" },
        CuratedTool { slug: "LINEAR_UPDATE_ISSUE", name: "Update Issue", description: "Update an issue" },
        CuratedTool { slug: "LINEAR_DELETE_LINEAR_ISSUE", name: "Delete Issue", description: "Delete an issue" },
        CuratedTool { slug: "LINEAR_LIST_LINEAR_ISSUES", name: "List Issues", description: "List issues with filters" },
        CuratedTool { slug: "LINEAR_SEARCH_ISSUES", name: "Search Issues", description: "Search issues by text" },
        CuratedTool { slug: "LINEAR_LIST_ISSUES_BY_TEAM_ID", name: "List Team Issues", description: "List issues for a team" },
        CuratedTool { slug: "LINEAR_CREATE_LINEAR_COMMENT", name: "Add Comment", description: "Add a comment to an issue" },
        CuratedTool { slug: "LINEAR_LIST_COMMENTS", name: "List Comments", description: "List comments on an issue" },
        CuratedTool { slug: "LINEAR_ARCHIVE_ISSUE", name: "Archive Issue", description: "Archive an issue" },
        CuratedTool { slug: "LINEAR_CREATE_LINEAR_PROJECT", name: "Create Project", description: "Create a new project" },
        CuratedTool { slug: "LINEAR_GET_LINEAR_PROJECT", name: "Get Project", description: "Get project details" },
        CuratedTool { slug: "LINEAR_UPDATE_LINEAR_PROJECT", name: "Update Project", description: "Update a project" },
        CuratedTool { slug: "LINEAR_LIST_LINEAR_PROJECTS", name: "List Projects", description: "List all projects" },
        CuratedTool { slug: "LINEAR_LIST_LINEAR_TEAMS", name: "List Teams", description: "List all teams" },
        CuratedTool { slug: "LINEAR_LIST_LINEAR_STATES", name: "List States", description: "List workflow states" },
        CuratedTool { slug: "LINEAR_LIST_LINEAR_LABELS", name: "List Labels", description: "List all labels" },
        CuratedTool { slug: "LINEAR_CREATE_LINEAR_LABEL", name: "Create Label", description: "Create a new label" },
        CuratedTool { slug: "LINEAR_GET_CURRENT_USER", name: "Get Me", description: "Get current user info" },
        CuratedTool { slug: "LINEAR_LIST_LINEAR_USERS", name: "List Users", description: "List workspace users" },
        CuratedTool { slug: "LINEAR_VALIDATE_CREDENTIAL", name: "Validate Auth", description: "Test Linear connection" },
    ]);

    // ── Trello ─────────────────────────────────────────────
    m.insert("trello", vec![
        CuratedTool { slug: "TRELLO_ADD_BOARDS", name: "Create Board", description: "Create a new board" },
        CuratedTool { slug: "TRELLO_GET_BOARDS_BY_ID_BOARD", name: "Get Board", description: "Get board details" },
        CuratedTool { slug: "TRELLO_UPDATE_BOARDS_BY_ID_BOARD", name: "Update Board", description: "Update board settings" },
        CuratedTool { slug: "TRELLO_DELETE_BOARD", name: "Delete Board", description: "Delete a board" },
        CuratedTool { slug: "TRELLO_GET_BOARDS_LISTS_BY_ID_BOARD", name: "Get Board Lists", description: "Get all lists on a board" },
        CuratedTool { slug: "TRELLO_ADD_LISTS", name: "Create List", description: "Create a new list on a board" },
        CuratedTool { slug: "TRELLO_ADD_CARDS", name: "Create Card", description: "Create a new card" },
        CuratedTool { slug: "TRELLO_GET_CARDS_BY_ID_CARD", name: "Get Card", description: "Get card details" },
        CuratedTool { slug: "TRELLO_UPDATE_CARDS_BY_ID_CARD", name: "Update Card", description: "Update a card" },
        CuratedTool { slug: "TRELLO_DELETE_CARDS_BY_ID_CARD", name: "Delete Card", description: "Delete a card" },
        CuratedTool { slug: "TRELLO_GET_LISTS_CARDS_BY_ID_LIST", name: "Get List Cards", description: "Get all cards in a list" },
        CuratedTool { slug: "TRELLO_MOVE_ALL_LIST_CARDS", name: "Move All Cards", description: "Move all cards to another list" },
        CuratedTool { slug: "TRELLO_ADD_CARDS_ACTIONS_COMMENTS_BY_ID_CARD", name: "Add Comment", description: "Add a comment to a card" },
        CuratedTool { slug: "TRELLO_ADD_CARDS_ATTACHMENTS_BY_ID_CARD", name: "Add Attachment", description: "Attach a file to a card" },
        CuratedTool { slug: "TRELLO_ADD_CARDS_CHECKLISTS_BY_ID_CARD", name: "Add Checklist", description: "Add a checklist to a card" },
        CuratedTool { slug: "TRELLO_ADD_CHECKLISTS_CHECK_ITEMS_BY_ID_CHECKLIST", name: "Add Check Item", description: "Add an item to a checklist" },
        CuratedTool { slug: "TRELLO_ADD_CARDS_ID_LABELS_BY_ID_CARD", name: "Add Label", description: "Add a label to a card" },
        CuratedTool { slug: "TRELLO_ADD_MEMBER_TO_CARD", name: "Add Member", description: "Add a member to a card" },
        CuratedTool { slug: "TRELLO_GET_BOARDS_MEMBERS_BY_ID_BOARD", name: "Get Board Members", description: "List board members" },
        CuratedTool { slug: "TRELLO_GET_BOARDS_LABELS_BY_ID_BOARD", name: "Get Board Labels", description: "List board labels" },
        CuratedTool { slug: "TRELLO_ADD_LABELS", name: "Create Label", description: "Create a label on a board" },
        CuratedTool { slug: "TRELLO_GET_MEMBERS_ME", name: "Get Me", description: "Get authenticated member info" },
        CuratedTool { slug: "TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER", name: "My Boards", description: "List your boards" },
        CuratedTool { slug: "TRELLO_MARK_ALL_NOTIFICATIONS_READ", name: "Mark All Read", description: "Mark all notifications as read" },
    ]);

    // ── Stripe ─────────────────────────────────────────────
    m.insert("stripe", vec![
        CuratedTool { slug: "STRIPE_CREATE_CUSTOMER", name: "Create Customer", description: "Create a new customer" },
        CuratedTool { slug: "STRIPE_RETRIEVE_CUSTOMER", name: "Get Customer", description: "Get customer details" },
        CuratedTool { slug: "STRIPE_UPDATE_CUSTOMER", name: "Update Customer", description: "Update customer info" },
        CuratedTool { slug: "STRIPE_LIST_CUSTOMERS", name: "List Customers", description: "List all customers" },
        CuratedTool { slug: "STRIPE_SEARCH_CUSTOMERS", name: "Search Customers", description: "Search customers" },
        CuratedTool { slug: "STRIPE_CREATE_PAYMENT_INTENT", name: "Create Payment", description: "Create a payment intent" },
        CuratedTool { slug: "STRIPE_RETRIEVE_PAYMENT_INTENT", name: "Get Payment", description: "Get payment intent details" },
        CuratedTool { slug: "STRIPE_LIST_PAYMENT_INTENTS", name: "List Payments", description: "List payment intents" },
        CuratedTool { slug: "STRIPE_CREATE_PRODUCT", name: "Create Product", description: "Create a product" },
        CuratedTool { slug: "STRIPE_GET_PRODUCTS_ID", name: "Get Product", description: "Get product details" },
        CuratedTool { slug: "STRIPE_LIST_PRODUCTS", name: "List Products", description: "List all products" },
        CuratedTool { slug: "STRIPE_CREATE_PRICE", name: "Create Price", description: "Create a price for a product" },
        CuratedTool { slug: "STRIPE_LIST_PRICES", name: "List Prices", description: "List all prices" },
        CuratedTool { slug: "STRIPE_CREATE_INVOICE", name: "Create Invoice", description: "Create a draft invoice" },
        CuratedTool { slug: "STRIPE_GET_INVOICES_INVOICE", name: "Get Invoice", description: "Get invoice details" },
        CuratedTool { slug: "STRIPE_LIST_INVOICES", name: "List Invoices", description: "List all invoices" },
        CuratedTool { slug: "STRIPE_FINALIZE_INVOICE", name: "Finalize Invoice", description: "Finalize a draft invoice" },
        CuratedTool { slug: "STRIPE_SEND_INVOICE", name: "Send Invoice", description: "Send invoice for payment" },
        CuratedTool { slug: "STRIPE_PAY_INVOICE", name: "Pay Invoice", description: "Pay an invoice manually" },
        CuratedTool { slug: "STRIPE_CREATE_SUBSCRIPTION", name: "Create Subscription", description: "Create a subscription" },
        CuratedTool { slug: "STRIPE_GET_SUBSCRIPTION", name: "Get Subscription", description: "Get subscription details" },
        CuratedTool { slug: "STRIPE_LIST_SUBSCRIPTIONS", name: "List Subscriptions", description: "List all subscriptions" },
        CuratedTool { slug: "STRIPE_CANCEL_SUBSCRIPTION", name: "Cancel Subscription", description: "Cancel a subscription" },
        CuratedTool { slug: "STRIPE_CREATE_COUPON", name: "Create Coupon", description: "Create a discount coupon" },
        CuratedTool { slug: "STRIPE_CREATE_PROMOTION_CODE", name: "Create Promo Code", description: "Create a promotion code" },
        CuratedTool { slug: "STRIPE_LIST_CHARGES", name: "List Charges", description: "List all charges" },
        CuratedTool { slug: "STRIPE_RETRIEVE_CHARGE", name: "Get Charge", description: "Get charge details" },
        CuratedTool { slug: "STRIPE_CREATE_REFUND", name: "Create Refund", description: "Create a full or partial refund" },
        CuratedTool { slug: "STRIPE_LIST_REFUNDS", name: "List Refunds", description: "List all refunds" },
        CuratedTool { slug: "STRIPE_RETRIEVE_BALANCE", name: "Get Balance", description: "Get account balance" },
        CuratedTool { slug: "STRIPE_LIST_BALANCE_TRANSACTIONS", name: "List Balance Transactions", description: "List balance transactions" },
        CuratedTool { slug: "STRIPE_CREATE_PAYMENT_LINK", name: "Create Payment Link", description: "Create a shareable payment link" },
        CuratedTool { slug: "STRIPE_LIST_DISPUTES", name: "List Disputes", description: "List payment disputes" },
        CuratedTool { slug: "STRIPE_CREATE_CHECKOUT_SESSION", name: "Create Checkout", description: "Create a Stripe Checkout session" },
    ]);

    // ── Spotify ────────────────────────────────────────────
    m.insert("spotify", vec![
        CuratedTool { slug: "SPOTIFY_GET_CURRENTLY_PLAYING_TRACK", name: "Now Playing", description: "Get the currently playing track" },
        CuratedTool { slug: "SPOTIFY_GET_PLAYBACK_STATE", name: "Playback State", description: "Get current playback state" },
        CuratedTool { slug: "SPOTIFY_START_RESUME_PLAYBACK", name: "Play", description: "Start or resume playback" },
        CuratedTool { slug: "SPOTIFY_PAUSE_PLAYBACK", name: "Pause", description: "Pause playback" },
        CuratedTool { slug: "SPOTIFY_SKIP_TO_NEXT", name: "Next Track", description: "Skip to next track" },
        CuratedTool { slug: "SPOTIFY_SKIP_TO_PREVIOUS", name: "Previous Track", description: "Skip to previous track" },
        CuratedTool { slug: "SPOTIFY_SEEK_TO_POSITION", name: "Seek", description: "Seek to position in track" },
        CuratedTool { slug: "SPOTIFY_SET_PLAYBACK_VOLUME", name: "Set Volume", description: "Set playback volume" },
        CuratedTool { slug: "SPOTIFY_TOGGLE_PLAYBACK_SHUFFLE", name: "Toggle Shuffle", description: "Toggle shuffle mode" },
        CuratedTool { slug: "SPOTIFY_SET_REPEAT_MODE", name: "Set Repeat", description: "Set repeat mode" },
        CuratedTool { slug: "SPOTIFY_TRANSFER_PLAYBACK", name: "Transfer Playback", description: "Transfer playback to another device" },
        CuratedTool { slug: "SPOTIFY_GET_AVAILABLE_DEVICES", name: "List Devices", description: "Get available playback devices" },
        CuratedTool { slug: "SPOTIFY_GET_THE_USER_S_QUEUE", name: "Get Queue", description: "Get the playback queue" },
        CuratedTool { slug: "SPOTIFY_ADD_ITEM_TO_PLAYBACK_QUEUE", name: "Add to Queue", description: "Add item to playback queue" },
        CuratedTool { slug: "SPOTIFY_SEARCH_FOR_ITEM", name: "Search", description: "Search tracks, artists, albums" },
        CuratedTool { slug: "SPOTIFY_GET_TRACK", name: "Get Track", description: "Get track details" },
        CuratedTool { slug: "SPOTIFY_GET_ARTIST", name: "Get Artist", description: "Get artist details" },
        CuratedTool { slug: "SPOTIFY_GET_ALBUM", name: "Get Album", description: "Get album details" },
        CuratedTool { slug: "SPOTIFY_GET_ARTIST_S_TOP_TRACKS", name: "Artist Top Tracks", description: "Get artist's top tracks" },
        CuratedTool { slug: "SPOTIFY_GET_ARTIST_S_ALBUMS", name: "Artist Albums", description: "Get artist's albums" },
        CuratedTool { slug: "SPOTIFY_GET_RECOMMENDATIONS", name: "Get Recommendations", description: "Get track recommendations" },
        CuratedTool { slug: "SPOTIFY_GET_CURRENT_USER_S_PLAYLISTS", name: "My Playlists", description: "Get your playlists" },
        CuratedTool { slug: "SPOTIFY_GET_PLAYLIST", name: "Get Playlist", description: "Get playlist details" },
        CuratedTool { slug: "SPOTIFY_GET_PLAYLIST_ITEMS", name: "Get Playlist Tracks", description: "Get tracks in a playlist" },
        CuratedTool { slug: "SPOTIFY_CREATE_PLAYLIST", name: "Create Playlist", description: "Create a new playlist" },
        CuratedTool { slug: "SPOTIFY_ADD_ITEMS_TO_PLAYLIST", name: "Add to Playlist", description: "Add tracks to a playlist" },
        CuratedTool { slug: "SPOTIFY_REMOVE_PLAYLIST_ITEMS", name: "Remove from Playlist", description: "Remove tracks from a playlist" },
        CuratedTool { slug: "SPOTIFY_UPDATE_PLAYLIST_ITEMS", name: "Update Playlist", description: "Reorder or replace playlist tracks" },
        CuratedTool { slug: "SPOTIFY_SAVE_TRACKS_FOR_CURRENT_USER", name: "Save Track", description: "Save a track to your library" },
        CuratedTool { slug: "SPOTIFY_REMOVE_USER_S_SAVED_TRACKS", name: "Unsave Track", description: "Remove track from library" },
        CuratedTool { slug: "SPOTIFY_GET_USER_S_SAVED_TRACKS", name: "Saved Tracks", description: "Get your saved tracks" },
        CuratedTool { slug: "SPOTIFY_GET_USER_S_TOP_ARTISTS", name: "Top Artists", description: "Get your top artists" },
        CuratedTool { slug: "SPOTIFY_GET_USER_S_TOP_TRACKS", name: "Top Tracks", description: "Get your top tracks" },
        CuratedTool { slug: "SPOTIFY_GET_RECENTLY_PLAYED_TRACKS", name: "Recently Played", description: "Get recently played tracks" },
        CuratedTool { slug: "SPOTIFY_FOLLOW_ARTISTS_OR_USERS", name: "Follow Artist", description: "Follow an artist" },
        CuratedTool { slug: "SPOTIFY_UNFOLLOW_ARTISTS_OR_USERS", name: "Unfollow Artist", description: "Unfollow an artist" },
        CuratedTool { slug: "SPOTIFY_GET_FOLLOWED_ARTISTS", name: "Followed Artists", description: "Get followed artists" },
        CuratedTool { slug: "SPOTIFY_SAVE_ALBUMS_FOR_CURRENT_USER", name: "Save Album", description: "Save an album to your library" },
        CuratedTool { slug: "SPOTIFY_GET_CURRENT_USER_S_PROFILE", name: "My Profile", description: "Get your Spotify profile" },
    ]);

    // ── Notion ─────────────────────────────────────────────
    m.insert("notion", vec![
        CuratedTool { slug: "NOTION_CREATE_NOTION_PAGE", name: "Create Page", description: "Create a new page" },
        CuratedTool { slug: "NOTION_RETRIEVE_PAGE", name: "Get Page", description: "Get page properties" },
        CuratedTool { slug: "NOTION_UPDATE_PAGE", name: "Update Page", description: "Update page properties or icon" },
        CuratedTool { slug: "NOTION_ARCHIVE_NOTION_PAGE", name: "Archive Page", description: "Archive or unarchive a page" },
        CuratedTool { slug: "NOTION_DUPLICATE_PAGE", name: "Duplicate Page", description: "Duplicate a page with content" },
        CuratedTool { slug: "NOTION_MOVE_PAGE", name: "Move Page", description: "Move page to new parent" },
        CuratedTool { slug: "NOTION_GET_PAGE_MARKDOWN", name: "Get Page as Markdown", description: "Get page content as markdown" },
        CuratedTool { slug: "NOTION_SEARCH_NOTION_PAGE", name: "Search", description: "Search pages and databases" },
        CuratedTool { slug: "NOTION_FETCH_DATA", name: "Search/List", description: "Search or list pages and databases" },
        CuratedTool { slug: "NOTION_CREATE_DATABASE", name: "Create Database", description: "Create a database" },
        CuratedTool { slug: "NOTION_FETCH_DATABASE", name: "Get Database", description: "Get database structure" },
        CuratedTool { slug: "NOTION_QUERY_DATABASE", name: "Query Database", description: "Query a database" },
        CuratedTool { slug: "NOTION_QUERY_DATABASE_WITH_FILTER", name: "Query with Filter", description: "Query database with filters" },
        CuratedTool { slug: "NOTION_INSERT_ROW_DATABASE", name: "Add Row", description: "Insert a row in a database" },
        CuratedTool { slug: "NOTION_INSERT_ROW_FROM_NL", name: "Add Row (Natural Language)", description: "Insert row from natural language" },
        CuratedTool { slug: "NOTION_UPDATE_ROW_DATABASE", name: "Update Row", description: "Update a database row" },
        CuratedTool { slug: "NOTION_UPSERT_ROW_DATABASE", name: "Upsert Row", description: "Insert or update database rows" },
        CuratedTool { slug: "NOTION_FETCH_ROW", name: "Get Row", description: "Get database row properties" },
        CuratedTool { slug: "NOTION_APPEND_TEXT_BLOCKS", name: "Add Text Blocks", description: "Append paragraphs, headings, lists" },
        CuratedTool { slug: "NOTION_APPEND_TASK_BLOCKS", name: "Add Task Blocks", description: "Append to-do, toggle, callout blocks" },
        CuratedTool { slug: "NOTION_APPEND_CODE_BLOCKS", name: "Add Code Blocks", description: "Append code, quote, equation blocks" },
        CuratedTool { slug: "NOTION_APPEND_MEDIA_BLOCKS", name: "Add Media Blocks", description: "Append image, video, file, embed blocks" },
        CuratedTool { slug: "NOTION_ADD_MULTIPLE_PAGE_CONTENT", name: "Add Content (Bulk)", description: "Bulk-add content blocks" },
        CuratedTool { slug: "NOTION_REPLACE_PAGE_CONTENT", name: "Replace Content", description: "Replace page content entirely" },
        CuratedTool { slug: "NOTION_FETCH_ALL_BLOCK_CONTENTS", name: "Get All Blocks", description: "Fetch all child blocks recursively" },
        CuratedTool { slug: "NOTION_UPDATE_BLOCK", name: "Update Block", description: "Update block text" },
        CuratedTool { slug: "NOTION_DELETE_BLOCK", name: "Delete Block", description: "Archive a block" },
        CuratedTool { slug: "NOTION_CREATE_COMMENT", name: "Add Comment", description: "Add comment to a page" },
        CuratedTool { slug: "NOTION_FETCH_COMMENTS", name: "List Comments", description: "Fetch unresolved comments" },
        CuratedTool { slug: "NOTION_LIST_USERS", name: "List Users", description: "List workspace users" },
        CuratedTool { slug: "NOTION_GET_ABOUT_USER", name: "Get User", description: "Get user details" },
    ]);

    // ── Google Drive ───────────────────────────────────────
    m.insert("googledrive", vec![
        CuratedTool { slug: "GOOGLEDRIVE_FIND_FILE", name: "Find File", description: "Search for files by name or query" },
        CuratedTool { slug: "GOOGLEDRIVE_FIND_FOLDER", name: "Find Folder", description: "Find a folder by name" },
        CuratedTool { slug: "GOOGLEDRIVE_GET_FILE_METADATA", name: "Get File Info", description: "Get file metadata" },
        CuratedTool { slug: "GOOGLEDRIVE_CREATE_FILE", name: "Create File", description: "Create a file or folder" },
        CuratedTool { slug: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", name: "Create from Text", description: "Create a file from text content" },
        CuratedTool { slug: "GOOGLEDRIVE_CREATE_FOLDER", name: "Create Folder", description: "Create a new folder" },
        CuratedTool { slug: "GOOGLEDRIVE_UPLOAD_FILE", name: "Upload File", description: "Upload a file (max 5MB)" },
        CuratedTool { slug: "GOOGLEDRIVE_UPLOAD_FROM_URL", name: "Upload from URL", description: "Upload a file from a URL" },
        CuratedTool { slug: "GOOGLEDRIVE_DOWNLOAD_FILE", name: "Download File", description: "Download a file" },
        CuratedTool { slug: "GOOGLEDRIVE_EDIT_FILE", name: "Edit File", description: "Overwrite file content" },
        CuratedTool { slug: "GOOGLEDRIVE_COPY_FILE_ADVANCED", name: "Copy File", description: "Copy a file" },
        CuratedTool { slug: "GOOGLEDRIVE_MOVE_FILE", name: "Move File", description: "Move file between folders" },
        CuratedTool { slug: "GOOGLEDRIVE_TRASH_FILE", name: "Trash File", description: "Move file to trash" },
        CuratedTool { slug: "GOOGLEDRIVE_UNTRASH_FILE", name: "Restore File", description: "Restore file from trash" },
        CuratedTool { slug: "GOOGLEDRIVE_GOOGLE_DRIVE_DELETE_FOLDER_OR_FILE_ACTION", name: "Delete File", description: "Permanently delete a file" },
        CuratedTool { slug: "GOOGLEDRIVE_CREATE_PERMISSION", name: "Share File", description: "Share a file with someone" },
        CuratedTool { slug: "GOOGLEDRIVE_LIST_PERMISSIONS", name: "List Permissions", description: "List who has access" },
        CuratedTool { slug: "GOOGLEDRIVE_DELETE_PERMISSION", name: "Remove Access", description: "Remove someone's access" },
        CuratedTool { slug: "GOOGLEDRIVE_EXPORT_GOOGLE_WORKSPACE_FILE", name: "Export File", description: "Export Workspace file to format" },
        CuratedTool { slug: "GOOGLEDRIVE_CREATE_SHORTCUT_TO_FILE", name: "Create Shortcut", description: "Create a shortcut to a file" },
        CuratedTool { slug: "GOOGLEDRIVE_GET_ABOUT", name: "Get Storage Info", description: "Get storage usage info" },
    ]);

    // ── Google Sheets ──────────────────────────────────────
    m.insert("googlesheets", vec![
        CuratedTool { slug: "GOOGLESHEETS_CREATE_GOOGLE_SHEET1", name: "Create Spreadsheet", description: "Create a new spreadsheet" },
        CuratedTool { slug: "GOOGLESHEETS_GET_SPREADSHEET_INFO", name: "Get Spreadsheet", description: "Get spreadsheet metadata" },
        CuratedTool { slug: "GOOGLESHEETS_GET_SHEET_NAMES", name: "List Sheets", description: "List sheet names in a spreadsheet" },
        CuratedTool { slug: "GOOGLESHEETS_ADD_SHEET", name: "Add Sheet", description: "Add a new sheet tab" },
        CuratedTool { slug: "GOOGLESHEETS_DELETE_SHEET", name: "Delete Sheet", description: "Delete a sheet tab" },
        CuratedTool { slug: "GOOGLESHEETS_VALUES_GET", name: "Read Range", description: "Read values from a range" },
        CuratedTool { slug: "GOOGLESHEETS_BATCH_GET", name: "Read Ranges", description: "Read values from multiple ranges" },
        CuratedTool { slug: "GOOGLESHEETS_VALUES_UPDATE", name: "Write Range", description: "Write values to a range" },
        CuratedTool { slug: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", name: "Append Rows", description: "Append values to a spreadsheet" },
        CuratedTool { slug: "GOOGLESHEETS_CLEAR_VALUES", name: "Clear Range", description: "Clear values in a range" },
        CuratedTool { slug: "GOOGLESHEETS_FIND_REPLACE", name: "Find & Replace", description: "Find and replace text in a spreadsheet" },
        CuratedTool { slug: "GOOGLESHEETS_UPDATE_SHEET_PROPERTIES", name: "Update Sheet", description: "Update sheet properties" },
        CuratedTool { slug: "GOOGLESHEETS_CREATE_CHART", name: "Add Chart", description: "Create a chart in a spreadsheet" },
        CuratedTool { slug: "GOOGLESHEETS_LIST_CHARTS", name: "List Charts", description: "List charts in a spreadsheet" },
        CuratedTool { slug: "GOOGLESHEETS_GET_SPREADSHEET_BY_DATA_FILTER", name: "Get by Data Filter", description: "Get spreadsheet filtered by ranges" },
    ]);

    // ── Dropbox ────────────────────────────────────────────
    m.insert("dropbox", vec![
        CuratedTool { slug: "DROPBOX_LIST_FILES_IN_FOLDER", name: "List Folder", description: "List files and folders in a directory" },
        CuratedTool { slug: "DROPBOX_GET_METADATA", name: "Get File Info", description: "Get file/folder metadata by path" },
        CuratedTool { slug: "DROPBOX_CREATE_FOLDER", name: "Create Folder", description: "Create a new folder" },
        CuratedTool { slug: "DROPBOX_UPLOAD_FILE", name: "Upload File", description: "Upload a file (up to ~150 MB)" },
        CuratedTool { slug: "DROPBOX_DOWNLOAD_ZIP", name: "Download Folder", description: "Download a folder as a zip file" },
        CuratedTool { slug: "DROPBOX_MOVE_FILE_OR_FOLDER", name: "Move File", description: "Move or rename a file or folder" },
        CuratedTool { slug: "DROPBOX_COPY_FILE_OR_FOLDER", name: "Copy File", description: "Copy a file or folder" },
        CuratedTool { slug: "DROPBOX_DELETE_FILE", name: "Delete File", description: "Delete a file or folder" },
        CuratedTool { slug: "DROPBOX_FILES_SEARCH", name: "Search", description: "Search files and folders by name" },
        CuratedTool { slug: "DROPBOX_CREATE_SHARED_LINK", name: "Create Shared Link", description: "Create a shared link for a file or folder" },
        CuratedTool { slug: "DROPBOX_LIST_SHARED_LINKS", name: "List Shared Links", description: "List existing shared links" },
        CuratedTool { slug: "DROPBOX_GET_SPACE_USAGE", name: "Get Storage", description: "Get storage space usage" },
    ]);

    // ── OneDrive ───────────────────────────────────────────
    m.insert("onedrive", vec![
        CuratedTool { slug: "ONE_DRIVE_ONEDRIVE_LIST_ITEMS", name: "List Files", description: "List files and folders in OneDrive" },
        CuratedTool { slug: "ONE_DRIVE_GET_ITEM", name: "Get File", description: "Get file/folder metadata by ID" },
        CuratedTool { slug: "ONE_DRIVE_ONEDRIVE_UPLOAD_FILE", name: "Upload File", description: "Upload a file to a folder" },
        CuratedTool { slug: "ONE_DRIVE_ONEDRIVE_CREATE_TEXT_FILE", name: "Create Text File", description: "Create a new plain-text file" },
        CuratedTool { slug: "ONE_DRIVE_ONEDRIVE_CREATE_FOLDER", name: "Create Folder", description: "Create a new folder" },
        CuratedTool { slug: "ONE_DRIVE_DOWNLOAD_FILE", name: "Download File", description: "Download a file by item ID" },
        CuratedTool { slug: "ONE_DRIVE_MOVE_ITEM", name: "Move File", description: "Move a file or folder" },
        CuratedTool { slug: "ONE_DRIVE_COPY_ITEM", name: "Copy File", description: "Copy a file or folder" },
        CuratedTool { slug: "ONE_DRIVE_DELETE_ITEM", name: "Delete File", description: "Delete a file or folder" },
        CuratedTool { slug: "ONE_DRIVE_SEARCH_DRIVE_ITEMS", name: "Search", description: "Search OneDrive and SharePoint files" },
        CuratedTool { slug: "ONE_DRIVE_ONEDRIVE_FIND_FILE", name: "Find File", description: "Find a file by name in a folder" },
        CuratedTool { slug: "ONE_DRIVE_ONEDRIVE_FIND_FOLDER", name: "Find Folder", description: "Find a folder by name" },
        CuratedTool { slug: "ONE_DRIVE_GET_ITEM_THUMBNAILS", name: "Get Thumbnails", description: "Get item thumbnail images" },
        CuratedTool { slug: "ONE_DRIVE_GET_ITEM_VERSIONS", name: "Get Versions", description: "Get version history of an item" },
    ]);

    // ── Twitter / X ────────────────────────────────────────
    m.insert("twitter", vec![
        CuratedTool { slug: "TWITTER_CREATION_OF_A_POST", name: "Post Tweet", description: "Create a new tweet" },
        CuratedTool { slug: "TWITTER_POST_DELETE_BY_POST_ID", name: "Delete Tweet", description: "Delete a tweet" },
        CuratedTool { slug: "TWITTER_POST_LOOKUP_BY_POST_ID", name: "Get Tweet", description: "Get a tweet by ID" },
        CuratedTool { slug: "TWITTER_RECENT_SEARCH", name: "Search Tweets", description: "Search recent tweets" },
        CuratedTool { slug: "TWITTER_USER_LOOKUP_BY_USERNAME", name: "Get User", description: "Get user profile by username" },
        CuratedTool { slug: "TWITTER_FOLLOWERS_BY_USER_ID", name: "Get Followers", description: "Get user's followers" },
        CuratedTool { slug: "TWITTER_FOLLOWING_BY_USER_ID", name: "Get Following", description: "Get who user follows" },
        CuratedTool { slug: "TWITTER_FOLLOW_USER", name: "Follow User", description: "Follow a user" },
        CuratedTool { slug: "TWITTER_UNFOLLOW_USER", name: "Unfollow User", description: "Unfollow a user" },
        CuratedTool { slug: "TWITTER_USER_LIKE_POST", name: "Like Tweet", description: "Like a tweet" },
        CuratedTool { slug: "TWITTER_UNLIKE_POST", name: "Unlike Tweet", description: "Unlike a tweet" },
        CuratedTool { slug: "TWITTER_RETWEET_POST", name: "Retweet", description: "Retweet a tweet" },
        CuratedTool { slug: "TWITTER_RETURNS_POST_OBJECTS_LIKED_BY_THE_PROVIDED_USER_ID", name: "Liked Tweets", description: "Get liked tweets" },
        CuratedTool { slug: "TWITTER_USER_HOME_TIMELINE_BY_USER_ID", name: "User Tweets", description: "Get tweets by a user" },
    ]);

    // ── LinkedIn ───────────────────────────────────────────
    m.insert("linkedin", vec![
        CuratedTool { slug: "LINKEDIN_CREATE_LINKED_IN_POST", name: "Create Post", description: "Create a LinkedIn post" },
        CuratedTool { slug: "LINKEDIN_GET_MY_INFO", name: "Get Profile", description: "Get your LinkedIn profile" },
        CuratedTool { slug: "LINKEDIN_GET_COMPANY_INFO", name: "Get Company", description: "Get company details" },
        CuratedTool { slug: "LINKEDIN_GET_POST_CONTENT", name: "Get Post", description: "Get post content" },
    ]);

    // ── Instagram ──────────────────────────────────────────
    m.insert("instagram", vec![
        CuratedTool { slug: "INSTAGRAM_GET_USER_INFO", name: "Get Profile", description: "Get Instagram profile" },
        CuratedTool { slug: "INSTAGRAM_GET_IG_USER_MEDIA", name: "Get Media", description: "Get user's media posts" },
        CuratedTool { slug: "INSTAGRAM_GET_IG_MEDIA_COMMENTS", name: "Get Comments", description: "Get comments on a post" },
    ]);

    // ── Facebook ───────────────────────────────────────────
    m.insert("facebook", vec![
        CuratedTool { slug: "FACEBOOK_CREATE_POST", name: "Create Post", description: "Create a Facebook post" },
        CuratedTool { slug: "FACEBOOK_GET_CURRENT_USER", name: "Get Profile", description: "Get your Facebook profile" },
        CuratedTool { slug: "FACEBOOK_GET_PAGE_POSTS", name: "Get Page Posts", description: "Get posts from a page" },
        CuratedTool { slug: "FACEBOOK_DELETE_POST", name: "Delete Post", description: "Delete a post" },
    ]);

    // ── Reddit ─────────────────────────────────────────────
    m.insert("reddit", vec![
        CuratedTool { slug: "REDDIT_CREATE_REDDIT_POST", name: "Create Post", description: "Create a Reddit post" },
        CuratedTool { slug: "REDDIT_RETRIEVE_REDDIT_POST", name: "Subreddit Posts", description: "Retrieve posts from a subreddit" },
        CuratedTool { slug: "REDDIT_RETRIEVE_SPECIFIC_COMMENT", name: "Get Post/Comment", description: "Get a specific post or comment by ID" },
        CuratedTool { slug: "REDDIT_POST_REDDIT_COMMENT", name: "Comment", description: "Post a comment" },
        CuratedTool { slug: "REDDIT_RETRIEVE_POST_COMMENTS", name: "Get Post Comments", description: "Retrieve comments for a post" },
        CuratedTool { slug: "REDDIT_SEARCH_ACROSS_SUBREDDITS", name: "Search", description: "Search across subreddits" },
        CuratedTool { slug: "REDDIT_GET_SUBREDDITS_SEARCH", name: "Search Subreddits", description: "Search for subreddits" },
        CuratedTool { slug: "REDDIT_GET", name: "Top/New Posts", description: "Get Reddit listing by sort" },
    ]);

    // ── YouTube ────────────────────────────────────────────
    m.insert("youtube", vec![
        CuratedTool { slug: "YOUTUBE_SEARCH_YOU_TUBE", name: "Search Videos", description: "Search YouTube videos" },
        CuratedTool { slug: "YOUTUBE_GET_VIDEO_DETAILS_BATCH", name: "Get Video", description: "Get video details" },
        CuratedTool { slug: "YOUTUBE_LIST_CHANNELS", name: "Get Channel", description: "Get channel details" },
        CuratedTool { slug: "YOUTUBE_LIST_CHANNEL_VIDEOS", name: "Channel Videos", description: "List videos from a channel" },
        CuratedTool { slug: "YOUTUBE_LIST_PLAYLIST_ITEMS", name: "Get Playlist", description: "Get playlist items" },
        CuratedTool { slug: "YOUTUBE_RATE_VIDEO", name: "Rate Video", description: "Like or dislike a video" },
    ]);

    // ── Google Chat ────────────────────────────────────────
    m.insert("googlechat", vec![
        CuratedTool { slug: "GOOGLE_CHAT_CREATE_MESSAGE", name: "Send Message", description: "Create a message in a space" },
        CuratedTool { slug: "GOOGLE_CHAT_GET_MESSAGE", name: "Get Message", description: "Get details about a specific message" },
        CuratedTool { slug: "GOOGLE_CHAT_UPDATE_MESSAGE", name: "Update Message", description: "Update a message in a space" },
        CuratedTool { slug: "GOOGLE_CHAT_DELETE_MESSAGE", name: "Delete Message", description: "Delete a message from a space" },
        CuratedTool { slug: "GOOGLE_CHAT_LIST_MESSAGES", name: "List Messages", description: "List messages in a space" },
        CuratedTool { slug: "GOOGLE_CHAT_LIST_SPACES", name: "List Spaces", description: "List spaces you are a member of" },
        CuratedTool { slug: "GOOGLE_CHAT_FIND_DIRECT_MESSAGE", name: "Find DM", description: "Find existing direct message space" },
        CuratedTool { slug: "GOOGLE_CHAT_CREATE_SPACE", name: "Create Space", description: "Create a new chat space" },
        CuratedTool { slug: "GOOGLE_CHAT_GET_SPACE", name: "Get Space", description: "Get space details" },
        CuratedTool { slug: "GOOGLE_CHAT_LIST_MEMBERS", name: "List Members", description: "List members in a space" },
        CuratedTool { slug: "GOOGLE_CHAT_CREATE_REACTION", name: "Add Reaction", description: "Add an emoji reaction to a message" },
        CuratedTool { slug: "GOOGLE_CHAT_LIST_REACTIONS", name: "List Reactions", description: "List reactions on a message" },
        CuratedTool { slug: "GOOGLE_CHAT_UPLOAD_MEDIA", name: "Upload Media", description: "Upload a file as a message attachment" },
        CuratedTool { slug: "GOOGLE_CHAT_DOWNLOAD_MEDIA", name: "Download Media", description: "Download a message attachment" },
    ]);

    // ── Zoom ───────────────────────────────────────────────
    m.insert("zoom", vec![
        CuratedTool { slug: "ZOOM_CREATE_A_MEETING", name: "Create Meeting", description: "Schedule a new meeting" },
        CuratedTool { slug: "ZOOM_GET_A_MEETING", name: "Get Meeting", description: "Get meeting details by ID" },
        CuratedTool { slug: "ZOOM_UPDATE_A_MEETING", name: "Update Meeting", description: "Update meeting details" },
        CuratedTool { slug: "ZOOM_DELETE_A_MEETING", name: "Delete Meeting", description: "Delete or cancel a scheduled meeting" },
        CuratedTool { slug: "ZOOM_LIST_MEETINGS", name: "List Meetings", description: "List a user's scheduled meetings" },
        CuratedTool { slug: "ZOOM_ADD_A_MEETING_REGISTRANT", name: "Add Registrant", description: "Register a participant for a meeting" },
        CuratedTool { slug: "ZOOM_GET_MEETING_RECORDINGS", name: "Get Recordings", description: "Get meeting cloud recordings" },
        CuratedTool { slug: "ZOOM_LIST_ALL_RECORDINGS", name: "List Recordings", description: "List cloud recordings for a user" },
        CuratedTool { slug: "ZOOM_GET_PAST_MEETING_PARTICIPANTS", name: "Past Participants", description: "Get participants of a past meeting" },
        CuratedTool { slug: "ZOOM_LIST_PAST_MEETING_INSTANCES", name: "Past Instances", description: "List UUIDs for past meeting instances" },
        CuratedTool { slug: "ZOOM_GET_USER", name: "Get User", description: "Get user details by ID, email, or 'me'" },
        CuratedTool { slug: "ZOOM_LIST_USERS_SETTINGS", name: "Get User Settings", description: "Get a user's meeting settings" },
        CuratedTool { slug: "ZOOM_LIST_WEBINARS", name: "List Webinars", description: "List scheduled webinars" },
        CuratedTool { slug: "ZOOM_GET_A_WEBINAR", name: "Get Webinar", description: "Get webinar details" },
    ]);

    // ── WhatsApp Business ──────────────────────────────────
    m.insert("whatsapp", vec![
        CuratedTool { slug: "WHATSAPP_SEND_MESSAGE", name: "Send Message", description: "Send a text message to a WhatsApp user" },
        CuratedTool { slug: "WHATSAPP_SEND_TEMPLATE_MESSAGE", name: "Send Template", description: "Send a message template to a number" },
        CuratedTool { slug: "WHATSAPP_SEND_MEDIA", name: "Send Media", description: "Send a media message" },
        CuratedTool { slug: "WHATSAPP_SEND_MEDIA_BY_ID", name: "Send Media by ID", description: "Send media using a previously uploaded ID" },
        CuratedTool { slug: "WHATSAPP_SEND_CONTACTS", name: "Send Contacts", description: "Send a contact card" },
        CuratedTool { slug: "WHATSAPP_SEND_LOCATION", name: "Send Location", description: "Send a location message" },
        CuratedTool { slug: "WHATSAPP_UPLOAD_MEDIA", name: "Upload Media", description: "Upload media to send later" },
        CuratedTool { slug: "WHATSAPP_GET_MEDIA_INFO", name: "Get Media Info", description: "Get metadata and download URL for media" },
        CuratedTool { slug: "WHATSAPP_GET_PHONE_NUMBER", name: "Get Phone Number", description: "Get details about a phone number" },
        CuratedTool { slug: "WHATSAPP_GET_PHONE_NUMBERS", name: "Get Phone Numbers", description: "Get all registered phone numbers" },
        CuratedTool { slug: "WHATSAPP_GET_BUSINESS_PROFILE", name: "Get Business Profile", description: "Get the business profile info" },
        CuratedTool { slug: "WHATSAPP_GET_MESSAGE_HISTORY", name: "Get Message History", description: "Retrieve message history" },
        CuratedTool { slug: "WHATSAPP_GET_MESSAGE_TEMPLATES", name: "Get Templates", description: "Get message templates" },
        CuratedTool { slug: "WHATSAPP_LIST_GROUPS", name: "List Groups", description: "List WhatsApp groups" },
    ]);

    // ── Calendly ───────────────────────────────────────────
    m.insert("calendly", vec![
        CuratedTool { slug: "CALENDLY_LIST_EVENT_TYPES", name: "List Event Types", description: "List your event types" },
        CuratedTool { slug: "CALENDLY_LIST_SCHEDULED_EVENTS", name: "List Events", description: "List scheduled events" },
        CuratedTool { slug: "CALENDLY_GET_EVENT", name: "Get Event", description: "Get event details" },
        CuratedTool { slug: "CALENDLY_CANCEL_SCHEDULED_EVENT", name: "Cancel Event", description: "Cancel a scheduled event" },
        CuratedTool { slug: "CALENDLY_GET_USER", name: "Get Me", description: "Get current user info" },
    ]);

    // ── TickTick ───────────────────────────────────────────
    m.insert("ticktick", vec![
        CuratedTool { slug: "TICKTICK_CREATE_TASK", name: "Create Task", description: "Create a new task" },
        CuratedTool { slug: "TICKTICK_LIST_ALL_TASKS", name: "List Tasks", description: "List all open tasks" },
        CuratedTool { slug: "TICKTICK_COMPLETE_TASK", name: "Complete Task", description: "Mark task as complete" },
        CuratedTool { slug: "TICKTICK_DELETE_TASK", name: "Delete Task", description: "Delete a task" },
        CuratedTool { slug: "TICKTICK_GET_USER_PROJECT", name: "List Projects", description: "Get user's projects" },
    ]);

    // ── PayPal ─────────────────────────────────────────────
    m.insert("paypal", vec![
        CuratedTool { slug: "PAYPAL_CREATE_PRODUCT", name: "Create Product", description: "Create a product" },
        CuratedTool { slug: "PAYPAL_CREATE_PLAN", name: "Create Plan", description: "Create a billing plan" },
        CuratedTool { slug: "PAYPAL_CREATE_SUBSCRIPTION", name: "Create Subscription", description: "Create a subscription" },
        CuratedTool { slug: "PAYPAL_GET_SUBSCRIPTION", name: "Get Subscription", description: "Get subscription details" },
        CuratedTool { slug: "PAYPAL_LIST_PAYMENTS", name: "List Transactions", description: "List transactions" },
    ]);

    // ── QuickBooks ─────────────────────────────────────────
    m.insert("quickbooks", vec![
        CuratedTool { slug: "QUICKBOOKS_CREATE_INVOICE", name: "Create Invoice", description: "Create an invoice" },
        CuratedTool { slug: "QUICKBOOKS_LIST_INVOICES", name: "List Invoices", description: "List invoices" },
        CuratedTool { slug: "QUICKBOOKS_CREATE_CUSTOMER", name: "Create Customer", description: "Create a customer" },
        CuratedTool { slug: "QUICKBOOKS_QUERY_CUSTOMERS", name: "List Customers", description: "List customers" },
        CuratedTool { slug: "QUICKBOOKS_CREATE_ITEM", name: "Create Item", description: "Create a product/service item" },
        CuratedTool { slug: "QUICKBOOKS_GET_REPORTS", name: "Get Report", description: "Get a financial report" },
    ]);

    // ── Xero ───────────────────────────────────────────────
    m.insert("xero", vec![
        CuratedTool { slug: "XERO_CREATE_INVOICE", name: "Create Invoice", description: "Create an invoice" },
        CuratedTool { slug: "XERO_LIST_INVOICES", name: "List Invoices", description: "List invoices" },
        CuratedTool { slug: "XERO_CREATE_CONTACT", name: "Create Contact", description: "Create a contact" },
        CuratedTool { slug: "XERO_GET_CONTACTS", name: "List Contacts", description: "List contacts" },
        CuratedTool { slug: "XERO_LIST_ACCOUNTS", name: "List Accounts", description: "List chart of accounts" },
    ]);

    // ── Strava ─────────────────────────────────────────────
    m.insert("strava", vec![
        CuratedTool { slug: "STRAVA_GET_AUTHENTICATED_ATHLETE", name: "Get Me", description: "Get current athlete" },
        CuratedTool { slug: "STRAVA_LIST_ATHLETE_ACTIVITIES", name: "List Activities", description: "List recent activities" },
        CuratedTool { slug: "STRAVA_GET_ACTIVITY", name: "Get Activity", description: "Get activity details" },
        CuratedTool { slug: "STRAVA_GET_ACTIVITY_STREAMS", name: "Get Streams", description: "Get activity data streams" },
        CuratedTool { slug: "STRAVA_LIST_ATHLETE_CLUBS", name: "List Clubs", description: "List joined clubs" },
        CuratedTool { slug: "STRAVA_GET_EQUIPMENT", name: "Get Gear", description: "Get gear details" },
    ]);

    // ── Instacart ──────────────────────────────────────────
    m.insert("instacart", vec![
        CuratedTool { slug: "INSTACART_GET_NEARBY_RETAILERS", name: "Nearby Retailers", description: "Get nearby Instacart retailers" },
        CuratedTool { slug: "INSTACART_CREATE_SHOPPING_LIST_PAGE", name: "Shopping List", description: "Create a shopping list page" },
        CuratedTool { slug: "INSTACART_CREATE_INSTACART_RECIPE_LINK", name: "Recipe Link", description: "Create an Instacart recipe link" },
    ]);

    // ── Hacker News ────────────────────────────────────────
    m.insert("hackernews", vec![
        CuratedTool { slug: "HACKERNEWS_GET_TOP_STORIES", name: "Top Stories", description: "Get Hacker News top stories" },
        CuratedTool { slug: "HACKERNEWS_GET_LATEST_POSTS", name: "Latest", description: "Get latest stories" },
        CuratedTool { slug: "HACKERNEWS_GET_ITEM_WITH_ID", name: "Get Story", description: "Get story details and comments" },
        CuratedTool { slug: "HACKERNEWS_GET_USER", name: "Get User", description: "Get user profile" },
        CuratedTool { slug: "HACKERNEWS_SEARCH_POSTS", name: "Search", description: "Search stories" },
    ]);

    // ── Microsoft Teams ────────────────────────────────────
    m.insert("teams", vec![
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_POST_CHAT_MESSAGE", name: "Send Message to Chat", description: "Send a message to a Teams chat" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_POST_CHANNEL_MESSAGE", name: "Send Channel Message", description: "Post a message to a team channel" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_POST_MESSAGE_REPLY", name: "Reply to Channel Message", description: "Reply to a message in a Teams channel" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_CREATE_CHAT", name: "Create Chat", description: "Start a new 1:1 or group chat" },
        CuratedTool { slug: "MICROSOFT_TEAMS_CHATS_GET_ALL_CHATS", name: "List All Chats", description: "List the user's chats with pagination" },
        CuratedTool { slug: "MICROSOFT_TEAMS_LIST_USER_CHAT_MESSAGES", name: "List Chat Messages", description: "List messages in a user's chat" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_LIST", name: "List Teams", description: "List teams the user belongs to" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_LIST_CHANNELS", name: "List Team Channels", description: "List channels in a team" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_LIST_CHANNEL_MESSAGES", name: "List Channel Messages", description: "List messages in a channel" },
        CuratedTool { slug: "MICROSOFT_TEAMS_TEAMS_CREATE_CHANNEL", name: "Create Channel", description: "Create a new channel in a team" },
        CuratedTool { slug: "MICROSOFT_TEAMS_SEARCH_MESSAGES", name: "Search Messages", description: "Search Teams messages across chats and channels" },
        CuratedTool { slug: "MICROSOFT_TEAMS_SEARCH_FILES", name: "Search Files", description: "Search for files shared in Teams" },
        CuratedTool { slug: "MICROSOFT_TEAMS_GET_FILES_FOLDER", name: "Get Channel Files Folder", description: "Get the file folder of a channel" },
        CuratedTool { slug: "MICROSOFT_TEAMS_CREATE_MEETING", name: "Create Online Meeting", description: "Schedule a standalone Teams online meeting" },
        CuratedTool { slug: "MICROSOFT_TEAMS_GET_ONLINE_MEETING", name: "Get Online Meeting", description: "Get details of an online meeting" },
        CuratedTool { slug: "MICROSOFT_TEAMS_LIST_ONLINE_MEETINGS", name: "List Online Meetings", description: "List the user's online meetings" },
        CuratedTool { slug: "MICROSOFT_TEAMS_UPDATE_ONLINE_MEETING", name: "Update Online Meeting", description: "Update details of an online meeting" },
        CuratedTool { slug: "MICROSOFT_TEAMS_LIST_MEETING_TRANSCRIPTS", name: "List Meeting Transcripts", description: "List transcripts of the user's meetings" },
        CuratedTool { slug: "MICROSOFT_TEAMS_GET_MEETING_TRANSCRIPT_CONTENT", name: "Get Meeting Transcript Content", description: "Fetch the content of a meeting transcript" },
        CuratedTool { slug: "MICROSOFT_TEAMS_GET_MY_PROFILE", name: "Get My Profile", description: "Get the authenticated user's profile" },
        CuratedTool { slug: "MICROSOFT_TEAMS_GET_PRESENCE", name: "Get User Presence", description: "Get a user's presence/availability status" },
        CuratedTool { slug: "MICROSOFT_TEAMS_SET_PRESENCE", name: "Set Presence", description: "Set the user's presence status" },
        CuratedTool { slug: "MICROSOFT_TEAMS_PIN_MESSAGE", name: "Pin Message", description: "Pin a message in a chat" },
        CuratedTool { slug: "MICROSOFT_TEAMS_LIST_PINNED_MESSAGES", name: "List Pinned Messages", description: "List pinned messages in a chat" },
    ]);

    // ── SendGrid ───────────────────────────────────────────
    m.insert("sendgrid", vec![
        CuratedTool { slug: "SENDGRID_SEND_EMAIL_WITH_TWILIO_SEND_GRID", name: "Send Email", description: "Send a single transactional email via SendGrid" },
        CuratedTool { slug: "SENDGRID_CREATE_A_TRANSACTIONAL_TEMPLATE", name: "Create Transactional Template", description: "Create a new transactional email template" },
        CuratedTool { slug: "SENDGRID_RETRIEVE_PAGED_TRANSACTIONAL_TEMPLATES", name: "List Transactional Templates", description: "Retrieve all transactional templates on your account" },
        CuratedTool { slug: "SENDGRID_CREATE_A_NEW_TRANSACTIONAL_TEMPLATE_VERSION", name: "Create Template Version", description: "Add a new version to a transactional template" },
        CuratedTool { slug: "SENDGRID_ACTIVATE_TEMPLATE_VERSION", name: "Activate Template Version", description: "Set a template version as the active default" },
        CuratedTool { slug: "SENDGRID_CREATE_A_CAMPAIGN", name: "Create Campaign", description: "Create a marketing email campaign" },
        CuratedTool { slug: "SENDGRID_RETRIEVE_ALL_CAMPAIGNS", name: "List Campaigns", description: "Retrieve all marketing campaigns" },
        CuratedTool { slug: "SENDGRID_SEND_A_CAMPAIGN", name: "Send Campaign", description: "Send a marketing campaign to its list/segment" },
        CuratedTool { slug: "SENDGRID_SCHEDULE_A_CAMPAIGN", name: "Schedule Campaign", description: "Schedule a campaign to send at a future time" },
        CuratedTool { slug: "SENDGRID_CREATE_A_SENDER_IDENTITY", name: "Create Sender Identity", description: "Create a verified sender identity for outbound mail" },
        CuratedTool { slug: "SENDGRID_GET_ALL_SENDER_IDENTITIES", name: "List Sender Identities", description: "Retrieve all sender identities on your account" },
        CuratedTool { slug: "SENDGRID_ADD_OR_UPDATE_A_CONTACT", name: "Add or Update Contact", description: "Upsert one or more marketing contacts" },
        CuratedTool { slug: "SENDGRID_CREATE_A_LIST", name: "Create List", description: "Create a new contact list" },
        CuratedTool { slug: "SENDGRID_RETRIEVE_ALL_LISTS", name: "List Contact Lists", description: "Retrieve all contact lists" },
        CuratedTool { slug: "SENDGRID_SEARCH_CONTACTS", name: "Search Contacts", description: "Search contacts by email or query criteria" },
        CuratedTool { slug: "SENDGRID_RETRIEVE_GLOBAL_EMAIL_STATISTICS", name: "Global Email Statistics", description: "View overall delivery statistics for your account" },
        CuratedTool { slug: "SENDGRID_GET_ALL_SINGLE_SENDS_STATS", name: "Single Send Stats", description: "View statistics for your single send campaigns" },
        CuratedTool { slug: "SENDGRID_ADD_TO_GLOBAL_SUPPRESSIONS_GROUP", name: "Add to Global Suppression", description: "Stop emails from being sent to given addresses" },
        CuratedTool { slug: "SENDGRID_RETRIEVE_ALL_GLOBAL_SUPPRESSIONS", name: "List Global Suppressions", description: "Retrieve all globally suppressed email addresses" },
        CuratedTool { slug: "SENDGRID_RETRIEVE_ALL_BOUNCES", name: "List Bounces", description: "Retrieve bounced email addresses and reasons" },
        CuratedTool { slug: "SENDGRID_DELETE_A_BOUNCE", name: "Delete Bounce", description: "Remove a bounced email address from suppression" },
    ]);

    // ── Mailchimp ──────────────────────────────────────────
    m.insert("mailchimp", vec![
        CuratedTool { slug: "MAILCHIMP_GET_LISTS_INFO", name: "List Audiences", description: "List all audiences/lists in your Mailchimp account" },
        CuratedTool { slug: "MAILCHIMP_ADD_LIST", name: "Create Audience", description: "Create a new audience/list with contact and campaign defaults" },
        CuratedTool { slug: "MAILCHIMP_LIST_MEMBERS_INFO", name: "List Audience Members", description: "List members (subscribers) of an audience/list" },
        CuratedTool { slug: "MAILCHIMP_ADD_OR_UPDATE_LIST_MEMBER", name: "Add or Update Member", description: "Upsert a subscriber into an audience (create or update)" },
        CuratedTool { slug: "MAILCHIMP_DELETE_LIST_MEMBER", name: "Delete Member", description: "Permanently remove a member from an audience" },
        CuratedTool { slug: "MAILCHIMP_SEARCH_MEMBERS", name: "Search Members", description: "Search for members across your audiences by query" },
        CuratedTool { slug: "MAILCHIMP_ADD_OR_REMOVE_MEMBER_TAGS", name: "Manage Member Tags", description: "Add or remove tags on a list member" },
        CuratedTool { slug: "MAILCHIMP_LIST_MEMBER_TAGS", name: "List Member Tags", description: "List all tags applied to a specific member" },
        CuratedTool { slug: "MAILCHIMP_ADD_CAMPAIGN", name: "Create Campaign", description: "Create a new email campaign" },
        CuratedTool { slug: "MAILCHIMP_LIST_CAMPAIGNS", name: "List Campaigns", description: "List all campaigns in your account" },
        CuratedTool { slug: "MAILCHIMP_GET_CAMPAIGN_INFO", name: "Get Campaign Details", description: "Get details for a specific campaign" },
        CuratedTool { slug: "MAILCHIMP_SET_CAMPAIGN_CONTENT", name: "Set Campaign Content", description: "Set the HTML/plain-text content of a campaign" },
        CuratedTool { slug: "MAILCHIMP_SEND_CAMPAIGN", name: "Send Campaign", description: "Send a campaign immediately to its recipients" },
        CuratedTool { slug: "MAILCHIMP_SCHEDULE_CAMPAIGN", name: "Schedule Campaign", description: "Schedule a campaign to send at a specific time" },
        CuratedTool { slug: "MAILCHIMP_UPDATE_CAMPAIGN_SETTINGS", name: "Update Campaign Settings", description: "Update settings like subject line, from name, and tracking" },
        CuratedTool { slug: "MAILCHIMP_REPLICATE_CAMPAIGN", name: "Replicate Campaign", description: "Create a copy of an existing campaign" },
        CuratedTool { slug: "MAILCHIMP_ADD_TEMPLATE", name: "Create Template", description: "Create a new email template" },
        CuratedTool { slug: "MAILCHIMP_LIST_TEMPLATES", name: "List Templates", description: "List all email templates in your account" },
        CuratedTool { slug: "MAILCHIMP_LIST_AUTOMATIONS", name: "List Automations", description: "List all automations in your account" },
        CuratedTool { slug: "MAILCHIMP_GET_CAMPAIGN_REPORT", name: "Get Campaign Report", description: "Get performance report (opens, clicks) for a campaign" },
    ]);

    // ── Coda ───────────────────────────────────────────────
    m.insert("coda", vec![
        CuratedTool { slug: "CODA_LIST_AVAILABLE_DOCS", name: "List Docs", description: "List Coda docs accessible by the user" },
        CuratedTool { slug: "CODA_CREATE_DOC", name: "Create Doc", description: "Create a new Coda doc" },
        CuratedTool { slug: "CODA_GET_INFO_ABOUT_A_DOC", name: "Get Doc Info", description: "Get metadata for a doc" },
        CuratedTool { slug: "CODA_UPDATE_DOC", name: "Update Doc", description: "Update a doc's title, folder, or properties" },
        CuratedTool { slug: "CODA_DELETE_DOC", name: "Delete Doc", description: "Permanently delete a doc and its contents" },
        CuratedTool { slug: "CODA_COPY_DOC", name: "Copy Document", description: "Duplicate an existing doc" },
        CuratedTool { slug: "CODA_RESOLVE_BROWSER_LINK", name: "Resolve Browser Link", description: "Turn a coda.io URL into the object ID" },
        CuratedTool { slug: "CODA_LIST_PAGES", name: "List Pages", description: "List pages in a Coda doc" },
        CuratedTool { slug: "CODA_CREATE_A_PAGE", name: "Create Page", description: "Create a new page in a doc" },
        CuratedTool { slug: "CODA_GET_A_PAGE", name: "Get Page", description: "Get details about a specific page" },
        CuratedTool { slug: "CODA_UPDATE_A_PAGE", name: "Update Page", description: "Update a page's name, subtitle, icon, or content" },
        CuratedTool { slug: "CODA_DELETE_A_PAGE", name: "Delete Page", description: "Delete a specified page from a doc" },
        CuratedTool { slug: "CODA_LIST_PAGE_CONTENT", name: "List Page Content", description: "Read the content elements of a page" },
        CuratedTool { slug: "CODA_LIST_TABLES", name: "List Tables", description: "List tables and views in a doc" },
        CuratedTool { slug: "CODA_LIST_COLUMNS", name: "List Columns", description: "Return the columns of a table" },
        CuratedTool { slug: "CODA_LIST_TABLE_ROWS", name: "List Table Rows", description: "Read table rows with query filtering, sorting, and pagination" },
        CuratedTool { slug: "CODA_GET_A_ROW", name: "Get Row", description: "Return a single row's cell values" },
        CuratedTool { slug: "CODA_UPSERT_ROWS", name: "Insert/Update Rows", description: "Insert new rows or update existing ones by key columns" },
        CuratedTool { slug: "CODA_DELETE_ROW", name: "Delete Row", description: "Delete a single row from a table" },
        CuratedTool { slug: "CODA_DELETE_MULTIPLE_ROWS", name: "Delete Multiple Rows", description: "Delete multiple rows from a table at once" },
    ]);

    // ── Confluence ─────────────────────────────────────────
    m.insert("confluence", vec![
        CuratedTool { slug: "CONFLUENCE_SEARCH_PAGES", name: "Search Pages", description: "Search for pages by title and other criteria" },
        CuratedTool { slug: "CONFLUENCE_CQL_SEARCH", name: "CQL Search", description: "Advanced Confluence Query Language content search" },
        CuratedTool { slug: "CONFLUENCE_CREATE_PAGE", name: "Create Page", description: "Create a new page in a space" },
        CuratedTool { slug: "CONFLUENCE_GET_PAGE_BY_ID", name: "Get Page by ID", description: "Retrieve a page's content and metadata by ID" },
        CuratedTool { slug: "CONFLUENCE_UPDATE_PAGE", name: "Update Page", description: "Edit and update an existing page" },
        CuratedTool { slug: "CONFLUENCE_DELETE_PAGE", name: "Delete Page", description: "Delete a page by ID" },
        CuratedTool { slug: "CONFLUENCE_GET_PAGES", name: "Get Pages", description: "List pages with pagination" },
        CuratedTool { slug: "CONFLUENCE_GET_CHILD_PAGES", name: "Get Child Pages", description: "List direct child pages of a parent page" },
        CuratedTool { slug: "CONFLUENCE_LIST_SPACES", name: "List Spaces", description: "List all accessible spaces" },
        CuratedTool { slug: "CONFLUENCE_GET_SPACE_BY_ID", name: "Get Space", description: "Retrieve space details by ID" },
        CuratedTool { slug: "CONFLUENCE_CREATE_FOOTER_COMMENT", name: "Add Comment", description: "Add a footer comment to a page or blog post" },
        CuratedTool { slug: "CONFLUENCE_GET_PAGE_FOOTER_COMMENTS", name: "Get Page Comments", description: "Retrieve footer comments on a page" },
        CuratedTool { slug: "CONFLUENCE_CREATE_INLINE_COMMENT", name: "Add Inline Comment", description: "Comment on specific highlighted text in a page" },
        CuratedTool { slug: "CONFLUENCE_GET_PAGE_INLINE_COMMENTS", name: "Get Inline Comments", description: "Retrieve inline comments for a page" },
        CuratedTool { slug: "CONFLUENCE_GET_ATTACHMENTS", name: "Get Attachments", description: "List attachments on a page" },
        CuratedTool { slug: "CONFLUENCE_DOWNLOAD_ATTACHMENT", name: "Download Attachment", description: "Download an attachment file from a page" },
        CuratedTool { slug: "CONFLUENCE_CREATE_BLOGPOST", name: "Create Blog Post", description: "Publish a blog post in a space" },
        CuratedTool { slug: "CONFLUENCE_ADD_CONTENT_LABEL", name: "Add Content Label", description: "Tag a page or blog post with labels" },
    ]);

    // ── DocuSign ───────────────────────────────────────────
    m.insert("docusign", vec![
        CuratedTool { slug: "DOCUSIGN_CREATE_ENVELOPE_FROM_TEMPLATE", name: "Create Envelope From Template", description: "Create and send a signing envelope from a template" },
        CuratedTool { slug: "DOCUSIGN_SEND_ENVELOPE", name: "Send Envelope", description: "Send a draft envelope to its recipients for signature" },
        CuratedTool { slug: "DOCUSIGN_GET_ENVELOPE", name: "Get Envelope", description: "Get envelope status, recipient status, and document details" },
        CuratedTool { slug: "DOCUSIGN_RETRIEVE_ENVELOPE_DOCUMENTS", name: "Retrieve Envelope Documents", description: "Download envelope documents as PDF, ZIP, or PDF portfolio" },
        CuratedTool { slug: "DOCUSIGN_LIST_ALL_TEMPLATES", name: "List All Templates", description: "List account templates with filtering and sorting" },
        CuratedTool { slug: "DOCUSIGN_GET_TEMPLATE", name: "Get Template", description: "Get a template definition including tabs and documents" },
        CuratedTool { slug: "DOCUSIGN_GET_SIGNATURE_INFORMATION_FOR_RECIPIENT", name: "Get Signature Information For Recipient", description: "Check a recipient's signing status and details" },
        CuratedTool { slug: "DOCUSIGN_FETCH_RECIPIENT_NAMES_FOR_EMAIL", name: "Fetch Recipient Names For Email", description: "Find names and recipients associated with an email" },
        CuratedTool { slug: "DOCUSIGN_CREATE_RECIPIENT_VIEW_URL", name: "Create Recipient View URL", description: "Generate a signing URL for a recipient to sign" },
        CuratedTool { slug: "DOCUSIGN_CREATE_SENDER_VIEW_URL_FOR_ENVELOPE", name: "Create Sender View URL For Envelope", description: "Generate a sender view URL for an envelope" },
        CuratedTool { slug: "DOCUSIGN_GENERATE_ENVELOPE_CORRECTION_URL", name: "Generate Envelope Correction URL", description: "Get a URL to correct an in-progress envelope" },
        CuratedTool { slug: "DOCUSIGN_ADD_ENVELOPE_ATTACHMENTS", name: "Add Envelope Attachments", description: "Attach supporting files to a draft or in-process envelope" },
        CuratedTool { slug: "DOCUSIGN_GET_ENVELOPE_NOTIFICATION_DEFAULTS", name: "Get Envelope Notification Defaults", description: "Get account default reminder and expiration settings" },
        CuratedTool { slug: "DOCUSIGN_UPDATE_ENVELOPE_NOTIFICATION_SETTINGS", name: "Update Envelope Notification Settings", description: "Change reminders and expiration for an envelope" },
        CuratedTool { slug: "DOCUSIGN_GET_PAGE_IMAGE_FROM_ENVELOPE", name: "Get Page Image From Envelope", description: "Get a PNG preview of a document page" },
        CuratedTool { slug: "DOCUSIGN_RETRIEVE_ENVELOPE_AUDIT_EVENTS", name: "Retrieve Envelope Audit Events", description: "Get the full audit trail of an envelope" },
        CuratedTool { slug: "DOCUSIGN_RETRIEVE_ENVELOPE_EMAIL_OVERRIDES", name: "Retrieve Envelope Email Overrides", description: "Get envelope-specific reply-to and BCC email settings" },
        CuratedTool { slug: "DOCUSIGN_LOCK_AN_ENVELOPE_FOR_EDITING", name: "Lock An Envelope For Editing", description: "Lock an envelope to edit it safely without conflicts" },
    ]);

    // ── Google Maps ────────────────────────────────────────
    m.insert("googlemaps", vec![
        CuratedTool { slug: "GOOGLE_MAPS_AUTOCOMPLETE", name: "Autocomplete Place Predictions", description: "Return place predictions for as-you-type search text" },
        CuratedTool { slug: "GOOGLE_MAPS_COMPUTE_ROUTE_MATRIX", name: "Compute Route Matrix", description: "Calculate travel distance and duration between multiple origins and destinations" },
        CuratedTool { slug: "GOOGLE_MAPS_GEOCODE_ADDRESS_WITH_QUERY", name: "Geocode Address With Query", description: "Convert an unstructured text address into coordinates" },
        CuratedTool { slug: "GOOGLE_MAPS_GEOCODE_DESTINATIONS", name: "Geocode Destinations", description: "Destination lookup returning primary place, landmarks, and entrances" },
        CuratedTool { slug: "GOOGLE_MAPS_GEOCODE_LOCATION", name: "Reverse Geocode Location", description: "Convert latitude/longitude coordinates to a human-readable address" },
        CuratedTool { slug: "GOOGLE_MAPS_GEOCODE_PLACE", name: "Geocode Place by ID", description: "Return address and coordinates for a Google Place ID" },
        CuratedTool { slug: "GOOGLE_MAPS_GEOCODING_API", name: "Geocoding API", description: "Convert addresses to coordinates and coordinates to addresses" },
        CuratedTool { slug: "GOOGLE_MAPS_GET_DIRECTION", name: "Get Directions", description: "Fetch turn-by-turn directions with waypoints and travel modes" },
        CuratedTool { slug: "GOOGLE_MAPS_GET_PLACE_DETAILS", name: "Get Place Details", description: "Retrieve comprehensive details for a place by resource name" },
        CuratedTool { slug: "GOOGLE_MAPS_GET_ROUTE", name: "Get Route", description: "Calculate routes between two locations with avoidance options" },
        CuratedTool { slug: "GOOGLE_MAPS_GET_TIME_ZONE", name: "Get Time Zone", description: "Retrieve time zone info for a location and timestamp" },
        CuratedTool { slug: "GOOGLE_MAPS_MAPS_EMBED_API", name: "Embed Google Map", description: "Generate an embeddable Google Map URL and HTML iframe" },
        CuratedTool { slug: "GOOGLE_MAPS_NEARBY_SEARCH", name: "Nearby Search", description: "Search for places within a circular area filtered by place type" },
        CuratedTool { slug: "GOOGLE_MAPS_PLACE_PHOTO", name: "Get Place Photo", description: "Download a high-quality place photo using a photo reference" },
        CuratedTool { slug: "GOOGLE_MAPS_TEXT_SEARCH", name: "Text Search", description: "Search for places using a textual query" },
    ]);

    m
});

/// Get curated tools for an app. Returns None if no curated tools exist
/// (falls back to Composio API in that case).
pub fn get_curated_tools(app_key: &str) -> Option<&'static Vec<CuratedTool>> {
    CURATED_TOOLS.get(app_key)
}
