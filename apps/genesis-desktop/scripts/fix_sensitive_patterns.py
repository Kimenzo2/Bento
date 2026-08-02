# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

"""Apply sensitive content pattern fixes. Line-based for reliability."""
import os, sys

os.chdir(os.path.join(os.path.dirname(__file__) or '.', '..'))

with open('src-tauri/src/clipboard/mod.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Track if changes were made
changed = 0

# Fix 1: Replace pattern #4 (generic API keys) + add Slack/Webhook patterns
old1 = '// Generic API keys (bearer tokens, x-api-key, etc.)'
new1 = '''// Generic API keys - tightened: require 32+ chars and drop "password" (too many
        // false positives from code snippets with variable assignments). Real credentials
        // (Google, OpenAI, Supabase, SendGrid, etc.) are typically 32+ chars.
        Regex::new(&format!(
            r"(?i)(bearer|api[_-]?key|token|secret)\s*[:=]\s*['\x22]?[A-Za-z0-9_\-./+=]{32,}", q()
        ))
        .unwrap(),
        // Slack tokens (xoxb- bot, xoxp- user, xoxa- apps) and webhook signing secrets
        Regex::new(r"(?i)(xox[bprsa]-)[A-Za-z0-9-]{24,}").unwrap(),
        Regex::new(r"(?i)(whsec_|whs_)[A-Za-z0-9]{16,}").unwrap(),'''

if old1 in content:
    # Find the full old block (old1 + the 4 following lines)
    idx = content.index(old1)
    # Find the next .unwrap(), line after the block
    end_idx = content.index('        .unwrap(),\n', idx)
    # Move past .unwrap() and find the end of this block
    rest = content[end_idx:]
    nl_idx = rest.index('\n') + 1
    full_old = content[idx:end_idx + nl_idx]
    content = content.replace(full_old, new1, 1)
    changed += 1
    print(f"Fixed 1: Pattern #4 replaced ({len(full_old)} chars -> {len(new1)} chars)")
else:
    print("WARNING: Pattern #4 not found!")

# Fix 2: Replace credit card comment
old2 = '        // Credit card numbers (Luhn-validatable pattern)'
new2 = '''        // Credit card numbers - pre-filter with regex, then Luhn-validate
        // The regex eagerly catches potential digit sequences; Luhn check in
        // is_sensitive_content() filters out false positives like timestamps / OTP codes.'''
if old2 in content:
    content = content.replace(old2, new2, 1)
    changed += 1
    print("Fixed 2: Credit card comment updated")
else:
    print("WARNING: Credit card comment not found!")

# Fix 3: Replace export pattern (10 -> 32 chars)
old3 = r'Regex::new(r"export\s+[A-Z_]+=.{10,}").unwrap()'
new3 = r'Regex::new(r"export\s+[A-Z_]+=.{32,}").unwrap()'
if old3 in content:
    content = content.replace(old3, new3, 1)
    changed += 1
    print("Fixed 3: Export pattern tightened (10 -> 32 chars)")
else:
    print("WARNING: Export pattern not found!")

# Fix 4: Replace is_sensitive_content function
old4 = '''/// Check if content matches any sensitive data pattern.
fn is_sensitive_content(content: &str) -> bool {
    if content.len() < 15 {
        return false;
    }
    SENSITIVE_PATTERNS.iter().any(|re| re.is_match(content))
}'''

new4 = '''/// Check if content matches any sensitive data pattern.
fn is_sensitive_content(content: &str) -> bool {
    if content.len() < 15 {
        return false;
    }

    // First pass: check all regex patterns
    for (i, re) in SENSITIVE_PATTERNS.iter().enumerate() {
        if !re.is_match(content) {
            continue;
        }
        // Pattern at index 9 (0-indexed) is the credit-card Luhn pre-filter.
        // Apply Luhn validation to reject false positives (timestamps, OTP codes).
        if i == 9 {
            if let Some(digits) = extract_digit_run(content) {
                if luhn_check(&digits) {
                    return true;
                }
            }
            continue;
        }
        return true;
    }

    false
}

/// Extract all digits from content (for Luhn validation).
fn extract_digit_run(content: &str) -> Option<String> {
    let digits: String = content.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 13 && digits.len() <= 19 {
        Some(digits)
    } else {
        None
    }
}

/// Luhn checksum validation - real credit card numbers pass, random digit strings
/// (timestamps, OTP codes, serial numbers, code numbers) almost certainly don't.
fn luhn_check(digits: &str) -> bool {
    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }
    let mut sum = 0u64;
    let mut double = false;
    for ch in digits.chars().rev() {
        let d = match ch.to_digit(10) {
            Some(d) => d,
            None => return false,
        };
        if double {
            let doubled = d * 2;
            sum += if doubled > 9 { doubled - 9 } else { doubled } as u64;
        } else {
            sum += d as u64;
        }
        double = !double;
    }
    sum % 10 == 0
}'''

if old4 in content:
    content = content.replace(old4, new4, 1)
    changed += 1
    print("Fixed 4: is_sensitive_content function replaced")
else:
    print("WARNING: is_sensitive_content function not found!")

if changed == 4:
    with open('src-tauri/src/clipboard/mod.rs', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\nAll {changed} changes written successfully!")
else:
    print(f"\nOnly {changed}/4 changes applied. Check warnings above.")
