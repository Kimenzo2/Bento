// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Voice Intent Classifier — Heuristic-based classification
// ═══════════════════════════════════════════════════════════════════════
// Classifies voice input based on duration, content, and structure.
// No AI call needed — fast, offline, deterministic.
//
// Heuristic rules:
//   < 30s duration + no pause > 3s        → Dictation
//   30s–3min + single speaker               → VoiceNote
//   > 3min OR detected multiple turns       → Meeting
//   Ends with "?" or starts with "ask"/"hey"→ AgentQuery
// ═══════════════════════════════════════════════════════════════════════

use serde::Serialize;

/// The classified intent of a voice input.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum VoiceIntent {
    Dictation,
    VoiceNote,
    Meeting,
    AgentQuery,
}

/// Parameters used by the classifier.
pub struct ClassifierInput {
    /// Duration of recording in seconds.
    pub duration_secs: f64,
    /// The transcribed text (if available).
    pub transcript: Option<String>,
    /// Estimated number of speaker turns (from VAD), if available.
    pub speaker_turns: Option<u32>,
    /// Longest pause detected in seconds, if available.
    pub max_pause_secs: Option<f64>,
}

/// Classify the intent of a voice input.
///
/// Rules are evaluated in priority order:
/// 1. Agent query (text-based markers)
/// 2. Meeting (long duration or multiple speakers)
/// 3. Voice note (medium duration)
/// 4. Dictation (short, natural)
/// 5. Default to dictation
pub fn classify_intent(input: &ClassifierInput) -> VoiceIntent {
    // ── Agent query markers ──────────────────────────────────────
    if let Some(ref text) = input.transcript {
        let trimmed = text.trim().to_lowercase();
        if trimmed.ends_with('?')
            || trimmed.starts_with("hey bento")
            || trimmed.starts_with("ask bento")
            || trimmed.starts_with("bento ")
        {
            // Note: deliberately NOT matching bare "hey " — that's too broad
            // for non-agent queries like "hey what's up" or "hey that's cool"
            return VoiceIntent::AgentQuery;
        }
    }

    // ── Meeting detection ────────────────────────────────────────
    if input.duration_secs > 180.0 {
        // > 3 minutes
        return VoiceIntent::Meeting;
    }
    if let Some(turns) = input.speaker_turns {
        if turns > 2 {
            return VoiceIntent::Meeting;
        }
    }

    // ── Voice note ───────────────────────────────────────────────
    if input.duration_secs > 30.0 {
        return VoiceIntent::VoiceNote;
    }

    // ── Dictation (default for short recordings) ─────────────────
    VoiceIntent::Dictation
}

/// Check if a transcription is suitable for auto-paste dictation.
/// Dictation is best suited for clean, single-sentence text under ~200 chars.
pub fn is_dictation_candidate(transcript: &str) -> bool {
    let t = transcript.trim();
    !t.is_empty() && t.len() < 500 && !t.contains('\n')
}

/// Generate a title for a voice note from its transcript.
/// Uses the first sentence or line, truncated to 60 chars.
pub fn generate_note_title(transcript: &str) -> String {
    let t = transcript.trim();

    // First line
    if let Some(line) = t.lines().next() {
        let cleaned = line.trim();
        if !cleaned.is_empty() {
            return truncate_title(cleaned);
        }
    }

    // First sentence
    if let Some(end) = t.find(|c: char| c == '.' || c == '!' || c == '?') {
        let sentence = t[..=end].trim();
        if !sentence.is_empty() {
            return truncate_title(sentence);
        }
    }

    // First 60 chars
    truncate_title(t)
}

fn truncate_title(s: &str) -> String {
    if s.len() <= 60 {
        s.to_string()
    } else {
        format!("{}…", &s[..57])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_short_duration_is_dictation() {
        let input = ClassifierInput {
            duration_secs: 15.0,
            transcript: Some("buy milk and eggs".to_string()),
            speaker_turns: None,
            max_pause_secs: None,
        };
        assert_eq!(classify_intent(&input), VoiceIntent::Dictation);
    }

    #[test]
    fn test_classify_medium_duration_is_voice_note() {
        let input = ClassifierInput {
            duration_secs: 90.0,
            transcript: Some("I had an idea for a new feature".to_string()),
            speaker_turns: Some(1),
            max_pause_secs: None,
        };
        assert_eq!(classify_intent(&input), VoiceIntent::VoiceNote);
    }

    #[test]
    fn test_classify_long_duration_is_meeting() {
        let input = ClassifierInput {
            duration_secs: 600.0,
            transcript: None,
            speaker_turns: None,
            max_pause_secs: None,
        };
        assert_eq!(classify_intent(&input), VoiceIntent::Meeting);
    }

    #[test]
    fn test_classify_question_is_agent_query() {
        let input = ClassifierInput {
            duration_secs: 8.0,
            transcript: Some("what tasks are due today?".to_string()),
            speaker_turns: None,
            max_pause_secs: None,
        };
        assert_eq!(classify_intent(&input), VoiceIntent::AgentQuery);
    }

    #[test]
    fn test_classify_hey_bento_is_agent_query() {
        let input = ClassifierInput {
            duration_secs: 5.0,
            transcript: Some("hey bento remind me to call John".to_string()),
            speaker_turns: None,
            max_pause_secs: None,
        };
        assert_eq!(classify_intent(&input), VoiceIntent::AgentQuery);
    }

    #[test]
    fn test_classify_multiple_turns_is_meeting() {
        let input = ClassifierInput {
            duration_secs: 60.0,
            transcript: None,
            speaker_turns: Some(3),
            max_pause_secs: None,
        };
        assert_eq!(classify_intent(&input), VoiceIntent::Meeting);
    }

    #[test]
    fn test_generate_note_title_from_first_line() {
        let title = generate_note_title("Weekly planning\nBuy groceries\nCall dentist");
        assert_eq!(title, "Weekly planning");
    }

    #[test]
    fn test_generate_note_title_from_first_sentence() {
        let title = generate_note_title(
            "I think we should redesign the dashboard. The current layout is cluttered.",
        );
        assert_eq!(title, "I think we should redesign the dashboard.");
    }

    #[test]
    fn test_generate_note_title_truncates_long_text() {
        let long = "a".repeat(100);
        let title = generate_note_title(&long);
        assert_eq!(title.len(), 60);
        assert!(title.ends_with('…'));
    }
}
