use serde::{Deserialize, Serialize};

/// A single task draft emitted by the agent via generative UI.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDraft {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub priority: Option<String>,
    pub due_at: Option<i64>,
    pub project: Option<String>,
    pub tags: Option<Vec<String>>,
}

/// An action button definition for confirmation cards.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionDef {
    pub label: String,
    pub variant: Option<String>,
}

/// Structured UI vocabulary the agent can emit.
///
/// This is a **closed set** — the agent can only compose from Bento's
/// actual existing components.  Every type matches a Svelte component
/// on the frontend side.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UiVocabulary {
    /// Short observation card (same visual language as the app's card system).
    #[serde(rename = "summary_card")]
    SummaryCard {
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        description: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        icon: Option<String>,
    },

    /// A list of task items rendered using the existing task card component.
    #[serde(rename = "task_list")]
    TaskList { items: Vec<TaskDraft> },

    /// A confirmation gate for consequential actions (Layer 3).
    #[serde(rename = "confirmation_card")]
    ConfirmationCard {
        id: String,
        title: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        description: Option<String>,
        actions: Vec<ActionDef>,
    },

    /// A note draft rendered in the existing editor surface.
    #[serde(rename = "note_draft")]
    NoteDraft {
        #[serde(skip_serializing_if = "Option::is_none")]
        title: Option<String>,
        blocks: Vec<serde_json::Value>,
    },

    /// A chart rendered using existing chart components.
    #[serde(rename = "chart")]
    Chart {
        variant: String,
        config: serde_json::Value,
        data: Vec<serde_json::Value>,
    },
}
