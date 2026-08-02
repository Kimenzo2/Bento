// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

use crate::integrations::{AppDefinition, AuthType, IntegrationCategory};
use crate::integrations::native::NativeFlow;

fn def(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::ManagedOAuth,
        native_flow: None,
    }
}

fn def_api(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::ApiKey,
        native_flow: None,
    }
}

fn def_custom_oauth(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::CustomOAuth,
        native_flow: None,
    }
}

fn def_mixed(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::Mixed,
        native_flow: None,
    }
}

fn def_noauth(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::NoAuth,
        native_flow: None,
    }
}

fn def_unavailable(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::Unavailable,
        native_flow: None,
    }
}

/// Locally-executed native integration (not in the Composio catalog). Bento
/// handles the auth + HTTP itself; the flow tells the UI how to connect.
fn def_native(
    key: &str,
    name: &str,
    description: &str,
    category: IntegrationCategory,
    icon_key: &str,
    flow: NativeFlow,
) -> AppDefinition {
    AppDefinition {
        key: key.to_string(),
        name: name.to_string(),
        description: description.to_string(),
        category,
        icon_key: icon_key.to_string(),
        auth_type: AuthType::Native,
        native_flow: Some(flow),
    }
}

pub fn curated_apps() -> Vec<AppDefinition> {
    vec![
        // Communication
        def("gmail", "Gmail", "Email by Google", IntegrationCategory::Communication, "gmail"),
        def("outlook", "Outlook", "Email & calendar by Microsoft", IntegrationCategory::Communication, "microsoftoutlook"),
        def("slack", "Slack", "Team messaging & collaboration", IntegrationCategory::Communication, "slack"),
        def("discord", "Discord", "Voice, video & text chat", IntegrationCategory::Communication, "discord"),
        def_native("telegram", "Telegram", "Secure messaging app", IntegrationCategory::Communication, "telegram", NativeFlow::ApiKey),
        def_mixed("whatsapp", "WhatsApp Business", "Business messaging platform", IntegrationCategory::Communication, "whatsapp"),
        def_custom_oauth("googlechat", "Google Chat", "Team messaging by Google", IntegrationCategory::Communication, "googlechat"),
        def("zoom", "Zoom", "Video conferencing", IntegrationCategory::Communication, "zoom"),
        def_unavailable("googlevoice", "Google Voice", "Virtual phone system", IntegrationCategory::Communication, "googlevoice"),
        def_native("twilio", "Twilio", "SMS & communication API", IntegrationCategory::Communication, "twilio", NativeFlow::Basic),
        def_api("sendgrid", "SendGrid", "Transactional email service", IntegrationCategory::Communication, "sendgrid"),
        def("mailchimp", "Mailchimp", "Email marketing platform", IntegrationCategory::Communication, "mailchimp"),
        def("teams", "Microsoft Teams", "Team collaboration hub", IntegrationCategory::Communication, "microsoftteams"),
        def_unavailable("signal", "Signal", "Encrypted messaging", IntegrationCategory::Communication, "signal"),

        // Calendar
        def("googlecalendar", "Google Calendar", "Calendar by Google", IntegrationCategory::Calendar, "googlecalendar"),
        def("outlookcalendar", "Outlook Calendar", "Calendar by Microsoft", IntegrationCategory::Calendar, "microsoftoutlook"),
        def("calendly", "Calendly", "Scheduling automation", IntegrationCategory::Calendar, "calendly"),
        def_mixed("calcom", "Cal.com", "Open source scheduling", IntegrationCategory::Calendar, "caldotcom"),
        def("todoist", "Todoist", "Task management", IntegrationCategory::Calendar, "todoist"),
        def("asana", "Asana", "Project management", IntegrationCategory::Calendar, "asana"),
        def_mixed("linear", "Linear", "Issue tracking", IntegrationCategory::Calendar, "linear"),
        def("trello", "Trello", "Kanban boards", IntegrationCategory::Calendar, "trello"),
        def("notioncalendar", "Notion Calendar", "Calendar by Notion", IntegrationCategory::Calendar, "notion"),
        def("ticktick", "TickTick", "To-do & task manager", IntegrationCategory::Calendar, "ticktick"),

        // Finance
        def_mixed("stripe", "Stripe", "Payment processing", IntegrationCategory::Finance, "stripe"),
        def_custom_oauth("paypal", "PayPal", "Online payments", IntegrationCategory::Finance, "paypal"),
        def_unavailable("plaid", "Plaid", "Banking API", IntegrationCategory::Finance, "plaid"),
        def("quickbooks", "QuickBooks", "Accounting software", IntegrationCategory::Finance, "quickbooks"),
        def_custom_oauth("xero", "Xero", "Cloud accounting", IntegrationCategory::Finance, "xero"),
        def_api("coinbase", "Coinbase", "Cryptocurrency exchange", IntegrationCategory::Finance, "coinbase"),
        def_unavailable("wise", "Wise", "International transfers", IntegrationCategory::Finance, "wise"),
        def_unavailable("revolut", "Revolut", "Digital banking", IntegrationCategory::Finance, "revolut"),
        def_unavailable("venmo", "Venmo", "Social payments", IntegrationCategory::Finance, "venmo"),
        def("ynab", "YNAB", "Budgeting app", IntegrationCategory::Finance, "youneedabudget"),
        def_unavailable("expensify", "Expensify", "Expense management", IntegrationCategory::Finance, "expensify"),
        def("freshbooks", "FreshBooks", "Small business accounting", IntegrationCategory::Finance, "freshbooks"),

        // Health
        def_unavailable("googlefit", "Google Fit", "Health tracking by Google", IntegrationCategory::Health, "googlefit"),
        def_unavailable("applehealth", "Apple Health", "Health data by Apple", IntegrationCategory::Health, "applehealth"),
        def("strava", "Strava", "Running & cycling tracking", IntegrationCategory::Health, "strava"),
        def_unavailable("myfitnesspal", "MyFitnessPal", "Calorie & diet tracking", IntegrationCategory::Health, "myfitnesspal"),
        def_unavailable("whoop", "Whoop", "Fitness & recovery band", IntegrationCategory::Health, "whoop"),
        def_unavailable("oura", "Oura", "Sleep & readiness ring", IntegrationCategory::Health, "oura"),
        def_unavailable("garmin", "Garmin", "GPS fitness tracking", IntegrationCategory::Health, "garmin"),
        def_unavailable("cronometer", "Cronometer", "Nutrition tracking", IntegrationCategory::Health, "cronometer"),

        // Documents
        def("googledrive", "Google Drive", "Cloud storage by Google", IntegrationCategory::Documents, "googledrive"),
        def("dropbox", "Dropbox", "Cloud file storage", IntegrationCategory::Documents, "dropbox"),
        def("onedrive", "OneDrive", "Cloud storage by Microsoft", IntegrationCategory::Documents, "microsoftonedrive"),
        def("notion", "Notion", "All-in-one workspace", IntegrationCategory::Documents, "notion"),
        def_unavailable("evernote", "Evernote", "Note taking app", IntegrationCategory::Documents, "evernote"),
        def("googledocs", "Google Docs", "Document editor by Google", IntegrationCategory::Documents, "googledocs"),
        def("googlesheets", "Google Sheets", "Spreadsheet editor", IntegrationCategory::Documents, "googlesheets"),
        def("airtable", "Airtable", "Database-spreadsheet hybrid", IntegrationCategory::Documents, "airtable"),
        def("confluence", "Confluence", "Team wiki & docs", IntegrationCategory::Documents, "confluence"),
        def_custom_oauth("docusign", "DocuSign", "Electronic signatures", IntegrationCategory::Documents, "docusign"),
        def_native("obsidian", "Obsidian", "Knowledge base & notes", IntegrationCategory::Documents, "obsidian", NativeFlow::Token),
        def("githubgist", "GitHub Gist", "Code snippets", IntegrationCategory::Documents, "github"),
        def_api("coda", "Coda", "Document & spreadsheet hybrid", IntegrationCategory::Documents, "coda"),

        // Maps & Travel
        def("googlemaps", "Google Maps", "Maps & navigation", IntegrationCategory::Maps, "googlemaps"),
        def_unavailable("airbnb", "Airbnb", "Short-term rentals", IntegrationCategory::Maps, "airbnb"),
        def_unavailable("tripit", "TripIt", "Travel itinerary organizer", IntegrationCategory::Maps, "tripit"),
        def_unavailable("expedia", "Expedia", "Travel booking", IntegrationCategory::Maps, "expedia"),
        
        // Shopping
        def_unavailable("amazon", "Amazon", "Online shopping", IntegrationCategory::Shopping, "amazon"),
        def_mixed("shopify", "Shopify", "E-commerce platform", IntegrationCategory::Shopping, "shopify"),
        def_unavailable("ebay", "eBay", "Online marketplace", IntegrationCategory::Shopping, "ebay"),
        def_unavailable("walmart", "Walmart", "Retail & groceries", IntegrationCategory::Shopping, "walmart"),
        def_noauth("instacart", "Instacart", "Grocery delivery", IntegrationCategory::Shopping, "instacart"),
        def_unavailable("ikea", "IKEA", "Furniture retailer", IntegrationCategory::Shopping, "ikea"),
        def_api("bestbuy", "Best Buy", "Electronics retailer", IntegrationCategory::Shopping, "bestbuy"),
        def_unavailable("woocommerce", "WooCommerce", "WordPress e-commerce", IntegrationCategory::Shopping, "woocommerce"),

        // Social
        def_custom_oauth("twitter", "X / Twitter", "Social networking", IntegrationCategory::Social, "x"),
        def("linkedin", "LinkedIn", "Professional network", IntegrationCategory::Social, "linkedin"),
        def("instagram", "Instagram", "Photo sharing", IntegrationCategory::Social, "instagram"),
        def("facebook", "Facebook", "Social network", IntegrationCategory::Social, "facebook"),
        def("reddit", "Reddit", "Community forums", IntegrationCategory::Social, "reddit"),
        def("youtube", "YouTube", "Video platform", IntegrationCategory::Social, "youtube"),
        def_custom_oauth("tiktok", "TikTok", "Short video platform", IntegrationCategory::Social, "tiktok"),
        def_unavailable("pinterest", "Pinterest", "Visual discovery", IntegrationCategory::Social, "pinterest"),
        def_unavailable("bluesky", "Bluesky", "Decentralized social", IntegrationCategory::Social, "bluesky"),
        def_native("mastodon", "Mastodon", "Federated social network", IntegrationCategory::Social, "mastodon", NativeFlow::OAuth2),
        def_unavailable("producthunt", "Product Hunt", "Product discovery", IntegrationCategory::Social, "producthunt"),
        def_noauth("hackernews", "Hacker News", "Tech news & discussion", IntegrationCategory::Social, "ycombinator"),

        // Entertainment
        def_custom_oauth("spotify", "Spotify", "Music streaming", IntegrationCategory::Entertainment, "spotify"),
        def_unavailable("applemusic", "Apple Music", "Music by Apple", IntegrationCategory::Entertainment, "applemusic"),
        def("youtubemusic", "YouTube Music", "Music streaming by Google", IntegrationCategory::Entertainment, "youtubemusic"),
        def_unavailable("appletv", "Apple TV", "Streaming by Apple", IntegrationCategory::Entertainment, "appletv"),
        def_unavailable("letterboxd", "Letterboxd", "Film catalog & reviews", IntegrationCategory::Entertainment, "letterboxd"),
        def_unavailable("plex", "Plex", "Media server", IntegrationCategory::Entertainment, "plex"),
        def_native("steam", "Steam", "Game distribution", IntegrationCategory::Entertainment, "steam", NativeFlow::ApiKey),
        def_unavailable("trakt", "Trakt", "TV & movie tracking", IntegrationCategory::Entertainment, "trakt"),
        def_unavailable("imdb", "IMDb", "Movie database", IntegrationCategory::Entertainment, "imdb"),

        // Learning
        def_unavailable("wikipedia", "Wikipedia", "Free encyclopedia", IntegrationCategory::Learning, "wikipedia"),
        def_unavailable("duolingo", "Duolingo", "Language learning", IntegrationCategory::Learning, "duolingo"),
        def_unavailable("khanacademy", "Khan Academy", "Free education", IntegrationCategory::Learning, "khanacademy"),
        def_unavailable("quizlet", "Quizlet", "Flashcard learning", IntegrationCategory::Learning, "quizlet"),
        def_unavailable("readwise", "Readwise", "Reading highlights", IntegrationCategory::Learning, "readwise"),
        def_unavailable("pocket", "Pocket", "Save articles to read later", IntegrationCategory::Learning, "pocket"),
        def_unavailable("audible", "Audible", "Audiobooks by Amazon", IntegrationCategory::Learning, "audible"),
                        
        // Proactive Intelligence
        def_api("make", "Make", "Visual automation platform", IntegrationCategory::Proactive, "integrately"),
        def_unavailable("homeassistant", "Home Assistant", "Home automation OS", IntegrationCategory::Proactive, "homeassistant"),
        def_unavailable("n8n", "n8n", "Workflow automation (self-hosted)", IntegrationCategory::Proactive, "n8n"),
        def_unavailable("googlehome", "Google Home", "Smart home by Google", IntegrationCategory::Proactive, "googlehome"),
        def_unavailable("alexa", "Amazon Alexa", "Voice assistant", IntegrationCategory::Proactive, "amazonalexa"),
        def_api("algolia", "Algolia", "Search API", IntegrationCategory::Proactive, "algolia"),
        
        // Home
        def_unavailable("philipshue", "Philips Hue", "Smart lighting", IntegrationCategory::Home, "philipshue"),
        def_unavailable("nest", "Nest", "Smart thermostat", IntegrationCategory::Home, "nest"),
        def_unavailable("ecobee", "Ecobee", "Smart thermostat", IntegrationCategory::Home, "ecobee"),
        def_unavailable("ring", "Ring", "Video doorbell", IntegrationCategory::Home, "ring"),
        def_unavailable("arlo", "Arlo", "Security cameras", IntegrationCategory::Home, "arlo"),
        def_unavailable("august", "August", "Smart locks", IntegrationCategory::Home, "august"),
        def_unavailable("lifx", "LIFX", "WiFi smart lighting", IntegrationCategory::Home, "lifx"),
        def_unavailable("smartthings", "Samsung SmartThings", "Smart home hub", IntegrationCategory::Home, "samsung"),
        def_unavailable("roborock", "Roborock", "Robot vacuum", IntegrationCategory::Home, "roborock"),
        def_unavailable("roomba", "Roomba", "Robot vacuum by iRobot", IntegrationCategory::Home, "irobot"),
        def_unavailable("rachio", "Rachio", "Smart sprinkler controller", IntegrationCategory::Home, "rachio"),
        def_unavailable("myq", "MyQ", "Smart garage opener", IntegrationCategory::Home, "chamberlain"),
        def_unavailable("tplinkkasa", "TP-Link Kasa", "Smart plugs & switches", IntegrationCategory::Home, "tplink"),
        def_unavailable("lutron", "Lutron", "Smart lighting controls", IntegrationCategory::Home, "lutron"),
        def_unavailable("switchbot", "SwitchBot", "Smart home robots", IntegrationCategory::Home, "switchbot"),
    ]
}
