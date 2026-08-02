# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

"""Remove the duplicated is_sensitive_content/extract_digit_run/luhn_check block."""
import os
os.chdir(os.path.join(os.path.dirname(__file__) or '.', '..'))

with open('src-tauri/src/clipboard/mod.rs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the marker for the start of the duplicate and the actual next section
dup_start = None
dup_end = None

for i, line in enumerate(lines):
    stripped = line.strip()
    # The duplicate starts with the for loop body after luhn_check's closing brace
    if stripped == '// First pass: check all regex patterns':
        if dup_start is None:
            dup_start = i  # First occurrence (correct code)
        elif dup_end is None:
            # Second occurrence (start of duplicate)
            dup_start = i
            dup_end = i

# Now find where the duplicate ends - look for "make_preview" after dup_start
if dup_end is not None:
    for i in range(dup_start + 1, len(lines)):
        if 'fn make_preview' in lines[i]:
            dup_end = i
            break
    
    if dup_end:
        print(f"Removing lines {dup_start+1} to {dup_end} ({dup_end - dup_start} lines)")
        # Keep lines before dup_start, and from dup_end onward
        new_lines = lines[:dup_start] + lines[dup_end:]
        with open('src-tauri/src/clipboard/mod.rs', 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        print(f"File now has {len(new_lines)} lines (was {len(lines)})")
    else:
        print("Could not find end of duplicate")
else:
    print("Could not find duplicate start")

# Verify no duplicate
with open('src-tauri/src/clipboard/mod.rs', 'r', encoding='utf-8') as f:
    content = f.read()

# Count occurrences
for pattern in ['fn luhn_check', 'fn extract_digit_run', '// First pass']:
    count = content.count(pattern)
    print(f"  '{pattern}' appears {count} time(s) (should be 1)")
