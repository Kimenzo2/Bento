#!/usr/bin/env python3
# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.
"""Add require_billing_tier() gates to ALL #[tauri::command] functions in gated module files.

For each #[tauri::command] block, this script:
1. Injects `auth: State<'_, crate::auth::AuthManager>,` as the first parameter
2. Adds `crate::auth::require_billing_tier(&auth, "module").await?;` as the first statement

Skips commands that already have a billing check.
"""

import re
import os

# Map module_id to file patterns
MODULE_MAP = {
    "habits": "src-tauri/src/habits/mod.rs",
    "goals": "src-tauri/src/goals/mod.rs",
    "health": "src-tauri/src/health/mod.rs",
    "sleep": "src-tauri/src/sleep/mod.rs",
    "mood": "src-tauri/src/mood/mod.rs",
    "flashcards": "src-tauri/src/flashcards.rs",
    "focus": "src-tauri/src/commands/focus.rs",
    "nutrition": "src-tauri/src/commands/nutrition.rs",
    "countdown": "src-tauri/src/commands/countdown.rs",
    "tasks": "src-tauri/src/commands/tasks.rs",
    "passwords": "src-tauri/src/commands/passwords.rs",
    "journal": "src-tauri/src/commands/journal.rs",
    "recipes": "src-tauri/src/recipes/mod.rs",
    "meal_db": "src-tauri/src/meal_db.rs",
    "budget": "src-tauri/src/budget/mod.rs",
    "clipboard": "src-tauri/src/clipboard/mod.rs",
    "notes": "src-tauri/src/notes/commands.rs",
    "reading": "src-tauri/src/reading/mod.rs",
}

# Commands that should NOT be gated (auth-adjacent, readings, etc.)
SKIP_MODULES = {
    "notes",   # Notes module — don't gate
    "reading",  # Doesn't exist yet
}

GATING_LINE_TEMPLATE = '    crate::auth::require_billing_tier(&auth, "{module}").await?;\n'

# Pattern to match a #[tauri::command] followed by a function definition
COMMAND_PATTERN = re.compile(
    r'(#[tauri::command]\s*\n)'
    r'(pub (async )?fn \w+\s*\()'
)

def has_gating(content: str) -> bool:
    """Check if the file already has require_billing_tier calls."""
    return "require_billing_tier" in content

def has_auth_param(content: str, func_start: int, func_end: int) -> bool:
    """Check if the function at position already has an auth: State<AuthManager> param."""
    snippet = content[func_start:func_end]
    return "AuthManager" in snippet or "auth:" in snippet

def add_gating_to_file(module_id: str, filepath: str) -> bool:
    """Add gating to all tauri commands in the file. Returns True if modified."""
    if not os.path.exists(filepath):
        print(f"  SKIP: File not found: {filepath}")
        return False

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if has_gating(content):
        print(f"  SKIP: Already has gating: {filepath}")
        return False

    # Find all #[tauri::command] positions
    lines = content.split('\n')
    modified_lines = list(lines)
    changes = 0

    # Process from bottom to top to preserve line numbers
    # Find each command block
    i = 0
    lines_to_modify = []
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped == '#[tauri::command]':
            # Check if this is followed by a function (not a doc comment or other attribute)
            j = i + 1
            # Skip over doc comments and other attributes
            while j < len(lines) and (lines[j].strip().startswith('///') or lines[j].strip().startswith('#[')):
                j += 1

            if j < len(lines) and ('pub ' in lines[j] and 'fn ' in lines[j]):
                func_line = j
                lines_to_modify.append((i, func_line))
                i = j  # Skip past the function start
                continue

        i += 1

    # Apply modifications from bottom to top
    for cmd_line, func_line in reversed(lines_to_modify):
        func_text = modified_lines[func_line]
        # Check if already has auth param  
        if 'AuthManager' in func_text or 'auth:' in func_text:
            print(f"  SKIP (already has auth param): line {func_line+1}")
            continue

        # Check the function's body for existing require_billing_tier
        # Look at a few lines after the function signature
        body_start = func_line + 1
        body_text = '\n'.join(modified_lines[body_start:body_start+5])
        if 'require_billing_tier' in body_text or 'billing_tier' in body_text.lower():
            print(f"  SKIP (already has billing check): line {func_line+1}")
            continue

        # Insert auth parameter after the opening paren
        old_sig = modified_lines[func_line]

        if module_id == "budget":
            gating_line = GATING_LINE_TEMPLATE.format(module="budget")
        else:
            gating_line = GATING_LINE_TEMPLATE.format(module=module_id)

        # Check if the function already has a `State<'_,` parameter
        has_state_param = "State<" in old_sig or "State '" in old_sig

        # Insert auth before any existing State parameters
        # Look for the pattern: `fn name(`
        # We need to insert `auth: State<'_, crate::auth::AuthManager>, ` after the opening paren
        paren_pos = old_sig.find('(')
        if paren_pos >= 0:
            new_sig = old_sig[:paren_pos+1] + 'auth: State<\'_, crate::auth::AuthManager>, ' + old_sig[paren_pos+1:]
            modified_lines[func_line] = new_sig

        # Find the first line of the function body (after -> and {)
        # Look for the opening brace
        brace_found = False
        for k in range(func_line, min(func_line + 20, len(modified_lines))):
            if '{' in modified_lines[k]:
                # Insert gating line after the opening brace
                brace_line = modified_lines[k]
                brace_idx = brace_line.index('{')
                # If there's code after {, add a newline
                rest = brace_line[brace_idx+1:].strip()
                if rest:
                    modified_lines[k] = brace_line[:brace_idx+1] + '\n' + gating_line + '    ' + rest
                else:
                    modified_lines[k] = brace_line[:brace_idx+1] + '\n' + gating_line
                brace_found = True
                break

        if not brace_found:
            print(f"  WARNING: Could not find function body for command at line {cmd_line+1}")
            continue

        changes += 1
        print(f"  GATED: {module_id} command at line {cmd_line+1}")

    if changes > 0:
        new_content = '\n'.join(modified_lines)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"  => {changes} commands gated in {filepath}")
        return True
    else:
        print(f"  No changes needed for {filepath}")
        return False


if __name__ == "__main__":
    for module_id, filepath in MODULE_MAP.items():
        if module_id in SKIP_MODULES:
            print(f"SKIP (excluded): {module_id}")
            continue
        print(f"\nProcessing {module_id} ({filepath}):")
        add_gating_to_file(module_id, filepath)
