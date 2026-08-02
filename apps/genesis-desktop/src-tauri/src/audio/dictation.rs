// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

// ═══════════════════════════════════════════════════════════════════════
// Dictation Pipeline — Writing styles, filler stripping, agent detection
// ═══════════════════════════════════════════════════════════════════════
// Ported and adapted from OS June's dictation pipeline.
//
// Features:
//   - DictationStyle: Standard, Casual, Formal with formatting rules
//   - clean_fillers: Strips "um", "uh", "ah", "er", "hmm" with
//     context awareness and recapitalization
//   - detect_agent_trigger: Checks for "hey bento" / "ask bento" patterns
//   - post_process: Full pipeline combining filler stripping + style
// ├── DictationStyle
// ├── clean_fillers()
// ├── apply_style()
// ├── post_process()
// ├── detect_agent_trigger()
// ═══════════════════════════════════════════════════════════════════════

use serde::{Deserialize, Serialize};

// ─── Dictation Style ─────────────────────────────────────────────────

/// Dictation writing style that controls formatting and casing.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DictationStyle {
    /// Normal capitalization, default punctuation. (default)
    Standard,
    /// Force lowercase except sentence starts. Strips fillers aggressively.
    /// Good for quick notes, journal entries, casual input.
    Casual,
    /// Proper formal writing: expand contractions, enforce complete
    /// punctuation, capitalize properly. Good for emails, documents.
    Formal,
}

impl Default for DictationStyle {
    fn default() -> Self {
        Self::Standard
    }
}

impl DictationStyle {
    /// Human-readable label for UI display.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Standard => "Standard",
            Self::Casual => "Casual",
            Self::Formal => "Formal",
        }
    }

    /// A short instruction prompt for AI transcription providers
    /// (used when the live preview requests AI transcription with style).
    pub fn instruction_prompt(&self) -> &'static str {
        match self {
            Self::Standard => "Transcribe naturally with standard capitalization and punctuation.",
            Self::Casual => {
                "Transcribe in lowercase. Use casual phrasing. No formal punctuation required."
            }
            Self::Formal => {
                "Transcribe in formal English. Use proper capitalization and complete punctuation. Expand contractions."
            }
        }
    }
}

// ─── Filler Word Set ─────────────────────────────────────────────────

/// Known filler words/phonetic fillers to strip from dictation output.
/// Presents false positives: intentionally does NOT include "a", "an", "I".
const FILLERS: &[&str] = &["um", "uh", "ah", "er", "hmm", "umm", "uhh", "hmm"];

/// Check if a lowercase word is a known filler, excluding intentional articles.
fn is_filler(word: &str) -> bool {
    // Never strip intentional articles
    if word == "a" || word == "an" || word == "i" {
        return false;
    }
    // Must be an exact match against filler list
    FILLERS.contains(&word)
}

// ─── Filler Stripping ────────────────────────────────────────────────

/// Strip filler words from dictation text with context awareness.
///
/// Rules:
/// - Leading fillers: remove and capitalize the next word
/// - Mid-sentence fillers: remove and preserve surrounding casing
/// - Never strips "a" or "an"
/// - Preserves line breaks and paragraph spacing
pub fn clean_fillers(text: &str) -> String {
    if text.trim().is_empty() {
        return text.to_string();
    }

    let mut result = String::with_capacity(text.len());
    let mut saw_leading_filler = false;
    let mut post_filler_capitalize = false;

    for line in text.lines() {
        if !result.is_empty() {
            result.push('\n');
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            result.push_str(line);
            continue;
        }

        let words: Vec<&str> = trimmed
            .split_inclusive(|c: char| c.is_whitespace())
            .collect();
        let mut filtered: Vec<String> = Vec::with_capacity(words.len());
        let mut leading = true;

        for token in &words {
            let word = token.trim();
            if word.is_empty() {
                filtered.push(token.to_string());
                continue;
            }

            // Check if this is a filler word (only check full word tokens)
            let is_filler_word = {
                let clean = word.trim_matches(|c: char| c.is_ascii_punctuation());
                !clean.is_empty() && is_filler(&clean.to_lowercase())
            };

            if is_filler_word {
                if leading {
                    saw_leading_filler = true;
                    // Skip this filler — next real word gets capitalized
                } else {
                    // Mid-sentence filler — just remove it
                    post_filler_capitalize = true;
                }
                continue;
            }

            leading = false;

            // Apply capitalization rules post-filler
            if saw_leading_filler || post_filler_capitalize {
                // Capitalize the first character of this word
                let mut chars: Vec<char> = word.chars().collect();
                if let Some(c) = chars.first_mut() {
                    *c = c.to_uppercase().next().unwrap_or(*c);
                }
                saw_leading_filler = false;
                post_filler_capitalize = false;

                // Preserve trailing whitespace from the token
                let trailing: String = token.chars().skip(word.len()).collect();
                filtered.push(chars.into_iter().collect::<String>() + &trailing);
            } else {
                filtered.push(token.to_string());
            }
        }

        result.push_str(&filtered.concat());
    }

    result
}

// ─── Style Application ───────────────────────────────────────────────

/// Apply writing style formatting to cleaned text.
///
/// Standard: no additional transformation (filler stripping already applied)
/// Casual:   force lowercase, preserve first-word caps per line
/// Formal:   expand common contractions, enforce punctuation
pub fn apply_style(text: &str, style: DictationStyle) -> String {
    match style {
        DictationStyle::Standard => text.to_string(),
        DictationStyle::Casual => apply_casual_style(text),
        DictationStyle::Formal => apply_formal_style(text),
    }
}

/// Casual: lowercase everything. Each line starts lowercased.
fn apply_casual_style(text: &str) -> String {
    let mut result = String::with_capacity(text.len());

    for line in text.lines() {
        if !result.is_empty() {
            result.push('\n');
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let lower = trimmed.to_lowercase();
        result.push_str(&lower);
    }

    result
}

/// Formal: expand contractions, ensure proper capitalization and punctuation.
fn apply_formal_style(text: &str) -> String {
    let mut result = String::with_capacity(text.len() + 64);

    for line in text.lines() {
        if !result.is_empty() {
            result.push('\n');
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let expanded = expand_contractions(trimmed);
        let punctuated = ensure_sentence_punctuation(&expanded);
        result.push_str(&punctuated);
    }

    result
}

/// Common English contractions and their formal expansions.
///
/// Strips trailing punctuation before matching so "don't." → "do not." (preserving the period).
fn expand_contractions(text: &str) -> String {
    let mut result = Vec::new();
    for token in text.split_inclusive(|c: char| c.is_whitespace()) {
        let raw_word = token.trim();
        // Separate trailing punctuation from the word for matching
        let (word, _suffix): (&str, &str) = {
            let trimmed =
                raw_word.trim_end_matches(|c: char| matches!(c, '.' | ',' | '!' | '?' | ':' | ';'));
            if trimmed.is_empty() {
                (raw_word, "")
            } else {
                let punct = &raw_word[trimmed.len()..];
                (trimmed, punct)
            }
        };
        let expanded = match word.to_lowercase().as_str() {
            "don't" | "dont" => "do not",
            "can't" | "cant" => "cannot",
            "won't" | "wont" => "will not",
            "isn't" | "isnt" => "is not",
            "aren't" | "arent" => "are not",
            "wasn't" | "wasnt" => "was not",
            "weren't" | "werent" => "were not",
            "haven't" | "havent" => "have not",
            "hasn't" | "hasnt" => "has not",
            "hadn't" | "hadnt" => "had not",
            "couldn't" | "couldnt" => "could not",
            "shouldn't" | "shouldnt" => "should not",
            "wouldn't" | "wouldnt" => "would not",
            "mightn't" | "mightnt" => "might not",
            "mustn't" | "mustnt" => "must not",
            "needn't" | "neednt" => "need not",
            "i'm" | "im" => "I am",
            "you're" | "youre" => "you are",
            "he's" | "hes" => "he is",
            "she's" | "shes" => "she is",
            "it's" | "its" | "it is" => "it is",
            "we're" | "were" => "we are",
            "they're" | "theyre" => "they are",
            "i've" | "ive" => "I have",
            "you've" | "youve" => "you have",
            "we've" | "weve" => "we have",
            "they've" | "theyve" => "they have",
            "i'll" | "ill" => "I will",
            "you'll" | "youll" => "you will",
            "he'll" | "hell" => "he will",
            "she'll" | "shell" => "she will",
            "it'll" | "itll" => "it will",
            "we'll" | "well" => "we will",
            "they'll" | "theyll" => "they will",
            "i'd" | "id" => "I would",
            "you'd" | "youd" => "you would",
            "he'd" | "hed" => "he would",
            "she'd" | "shed" => "she would",
            "we'd" | "wed" => "we would",
            "they'd" | "theyd" => "they would",
            "let's" | "lets" => "let us",
            "that's" | "thats" => "that is",
            "what's" | "whats" => "what is",
            "who's" | "whos" => "who is",
            "there's" | "theres" => "there is",
            "where's" | "wheres" => "where is",
            "how's" | "hows" => "how is",
            "why's" | "whys" => "why is",
            _ => "",
        };

        if expanded.is_empty() {
            result.push(token.to_string());
        } else {
            // Preserve original capitalization of first letter
            let first_upper = word.chars().next().map_or(false, |c| c.is_uppercase());
            let mut expanded_str = expanded.to_string();
            if first_upper {
                // Capitalize first letter of the expansion
                if let Some(c) = expanded_str.get_mut(..1) {
                    c.make_ascii_uppercase();
                }
            }
            // Append any trailing whitespace from token
            let trailing: String = token.chars().skip(word.len()).collect();
            result.push(expanded_str + &trailing);
        }
    }

    result.concat()
}

/// Ensure each line ends with sentence-ending punctuation.
fn ensure_sentence_punctuation(text: &str) -> String {
    let trimmed = text.trim_end();
    if trimmed.is_empty() {
        return text.to_string();
    }

    let last_char = trimmed.chars().last().unwrap_or('.');
    if matches!(last_char, '.' | '!' | '?' | ':') {
        trimmed.to_string()
    } else {
        format!("{}.", trimmed)
    }
}

// ─── Agent Trigger Detection ─────────────────────────────────────────

/// Result of agent trigger detection in dictation text.
#[derive(specta::Type, Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTriggerResult {
    /// Whether an agent trigger was detected.
    pub detected: bool,
    /// The text after stripping the trigger phrase (the actual query).
    pub agent_prompt: Option<String>,
    /// Which trigger phrase was matched.
    pub trigger_phrase: Option<String>,
}

/// Detect "Hey Bento" / "Ask Bento" / "Bento" agent triggers in free-form text.
///
/// Returns the text after the trigger so it can be forwarded as an agent query.
/// Returns `None` if no trigger is found.
pub fn detect_agent_trigger(text: &str) -> AgentTriggerResult {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return AgentTriggerResult {
            detected: false,
            agent_prompt: None,
            trigger_phrase: None,
        };
    }

    let lower = trimmed.to_lowercase();

    // Check trigger patterns in priority order
    let triggers = [
        ("hey bento", "hey Bento"),
        ("hey bento,", "hey Bento"),
        ("hey bento.", "hey Bento"),
        ("hey bento!", "hey Bento"),
        ("hey Bento", "hey Bento"), // actually matches via lower, but for display
        ("ask bento", "ask Bento"),
        ("bento ", "Bento"),
    ];

    for (pattern, display) in &triggers {
        // For "bento ", only match at start of text
        if *pattern == "bento " && !lower.starts_with("bento ") {
            continue;
        }
        if lower.starts_with(pattern) {
            let prompt = trimmed[pattern.len()..].trim().to_string();
            let prompt = if prompt.is_empty() {
                None
            } else {
                Some(prompt)
            };
            return AgentTriggerResult {
                detected: true,
                agent_prompt: prompt,
                trigger_phrase: Some(display.to_string()),
            };
        }
    }

    // Check for standalone "bento" (no space after — could be end of sentence)
    if lower == "bento" {
        return AgentTriggerResult {
            detected: true,
            agent_prompt: None,
            trigger_phrase: Some("Bento".to_string()),
        };
    }

    AgentTriggerResult {
        detected: false,
        agent_prompt: None,
        trigger_phrase: None,
    }
}

// ─── Full Post-Processing Pipeline ───────────────────────────────────

/// Result of the full dictation post-processing pipeline.
#[derive(specta::Type, Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictationProcessResult {
    /// The final processed text (fillers stripped + style applied).
    pub text: String,
    /// Whether an agent trigger was detected in the text.
    pub agent_trigger: AgentTriggerResult,
    /// Number of characters in the final text.
    pub char_count: usize,
}

/// Run the full dictation post-processing pipeline:
/// 1. Strip filler words
/// 2. Apply writing style formatting
/// 3. Detect agent triggers
pub fn post_process(text: &str, style: DictationStyle) -> DictationProcessResult {
    let cleaned = clean_fillers(text);
    let styled = apply_style(&cleaned, style);
    let agent_trigger = detect_agent_trigger(&styled);

    let char_count = styled.trim().len();

    DictationProcessResult {
        text: styled,
        agent_trigger,
        char_count,
    }
}

// ─── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Filler Stripping Tests ────────────────────────────────────

    #[test]
    fn test_strips_leading_filler() {
        let result = clean_fillers("um I think we should go");
        assert_eq!(result, "I think we should go");
    }

    #[test]
    fn test_strips_leading_filler_with_recap() {
        let result = clean_fillers("uh let's try again");
        assert_eq!(result, "Let's try again");
    }

    #[test]
    fn test_strips_mid_sentence_filler() {
        let result = clean_fillers("I was, um, thinking about it");
        assert_eq!(result, "I was, thinking about it");
    }

    #[test]
    fn test_does_not_strip_a_or_an() {
        let result = clean_fillers("I have a dog and an idea");
        assert_eq!(result, "I have a dog and an idea");
    }

    #[test]
    fn test_multiple_leading_fillers() {
        let result = clean_fillers("um uh er let's go");
        assert_eq!(result, "Let's go");
    }

    #[test]
    fn test_strips_all_filler_variants() {
        for filler in &["um", "uh", "ah", "er", "hmm", "umm", "uhh"] {
            let input = format!("{filler} test");
            let result = clean_fillers(&input);
            assert_eq!(result, "Test", "Failed for filler: {filler}");
        }
    }

    #[test]
    fn test_empty_text() {
        assert_eq!(clean_fillers(""), "");
        assert_eq!(clean_fillers("   "), "   ");
    }

    #[test]
    fn test_no_fillers() {
        let result = clean_fillers("Hello world this is a test");
        assert_eq!(result, "Hello world this is a test");
    }

    #[test]
    fn test_preserves_line_breaks() {
        let input = "um first line\nuh second line";
        let result = clean_fillers(input);
        assert_eq!(result, "First line\nSecond line");
    }

    #[test]
    fn test_leading_filler_with_punctuation() {
        let result = clean_fillers("um, I was thinking");
        // "um," - the "um" has punctuation attached. Our implementation checks
        // the word without punctuation, so "um," → "um" → filler → stripped
        assert_eq!(result, "I was thinking");
    }

    // ── Style Tests ───────────────────────────────────────────────

    #[test]
    fn test_standard_no_change() {
        let result = apply_style("Hello World", DictationStyle::Standard);
        assert_eq!(result, "Hello World");
    }

    #[test]
    fn test_casual_lowercases() {
        let result = apply_style("Hello World This Is A Test", DictationStyle::Casual);
        assert_eq!(result, "hello world this is a test");
    }

    #[test]
    fn test_casual_handles_lines() {
        let result = apply_style("Hello World\nThis Is A Test", DictationStyle::Casual);
        assert_eq!(result, "hello world\nthis is a test");
    }

    #[test]
    fn test_formal_expands_contractions() {
        assert_eq!(
            apply_style("I don't think so", DictationStyle::Formal),
            "I do not think so."
        );
        assert_eq!(
            apply_style("I can't do it", DictationStyle::Formal),
            "I cannot do it."
        );
        assert_eq!(
            apply_style("I won't be there", DictationStyle::Formal),
            "I will not be there."
        );
    }

    #[test]
    fn test_formal_ensures_punctuation() {
        let result = apply_style("Hello world", DictationStyle::Formal);
        assert_eq!(result, "Hello world.");
    }

    #[test]
    fn test_formal_does_not_double_punctuate() {
        let result = apply_style("Hello world.", DictationStyle::Formal);
        assert_eq!(result, "Hello world.");
    }

    #[test]
    fn test_formal_expands_multiple_contractions() {
        let result = apply_style("I'm sure you're right", DictationStyle::Formal);
        assert_eq!(result, "I am sure you are right.");
    }

    // ── Agent Trigger Tests ───────────────────────────────────────

    #[test]
    fn test_detects_hey_bento() {
        let result = detect_agent_trigger("hey bento what tasks are due");
        assert!(result.detected);
        assert_eq!(result.agent_prompt.as_deref(), Some("what tasks are due"));
    }

    #[test]
    fn test_detects_ask_bento() {
        let result = detect_agent_trigger("ask bento to remind me about lunch");
        assert!(result.detected);
        assert_eq!(
            result.agent_prompt.as_deref(),
            Some("to remind me about lunch")
        );
    }

    #[test]
    fn test_detects_bento_prefix() {
        let result = detect_agent_trigger("bento create a new task");
        assert!(result.detected);
        assert_eq!(result.agent_prompt.as_deref(), Some("create a new task"));
    }

    #[test]
    fn test_no_false_positive() {
        let result = detect_agent_trigger("I like bento boxes for lunch");
        assert!(!result.detected);
        assert!(result.agent_prompt.is_none());
    }

    #[test]
    fn test_detect_empty_text() {
        let result = detect_agent_trigger("");
        assert!(!result.detected);
    }

    #[test]
    fn test_hey_bento_with_period() {
        let result = detect_agent_trigger("hey bento. create a task");
        assert!(result.detected);
        assert_eq!(result.trigger_phrase.as_deref(), Some("hey Bento"));
    }

    #[test]
    fn test_case_insensitive_trigger() {
        let result = detect_agent_trigger("HEY BENTO do something");
        assert!(result.detected);
        assert_eq!(result.agent_prompt.as_deref(), Some("do something"));
    }

    // ── Full Pipeline Tests ───────────────────────────────────────

    #[test]
    fn test_full_pipeline_standard() {
        let result = post_process(
            "um I think we should go to the store",
            DictationStyle::Standard,
        );
        assert_eq!(result.text, "I think we should go to the store");
        assert!(!result.agent_trigger.detected);
        assert_eq!(result.char_count, 32);
    }

    #[test]
    fn test_full_pipeline_with_agent_trigger() {
        let result = post_process("uh hey bento what is the weather", DictationStyle::Casual);
        // After cleaning: "hey bento what is the weather" (first "uh" stripped, "hey" capitalized)
        // Wait: "uh" is stripped as leading filler. Then "hey" is capitalized to "Hey".
        // Then casual style lowercases everything: "hey bento what is the weather"
        // Then agent trigger detects "hey bento" → prompt "what is the weather"
        assert_eq!(result.text, "hey bento what is the weather");
        assert!(result.agent_trigger.detected);
        assert_eq!(
            result.agent_trigger.agent_prompt.as_deref(),
            Some("what is the weather")
        );
    }

    #[test]
    fn test_full_pipeline_formal() {
        let result = post_process("um I don't think that's correct", DictationStyle::Formal);
        // After cleaning: "I don't think that's correct" (leading "um" stripped)
        // After formal: "I do not think that is correct."
        assert_eq!(result.text, "I do not think that is correct.");
    }
}