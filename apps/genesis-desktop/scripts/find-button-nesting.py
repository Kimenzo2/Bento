# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

"""Find button-in-button nesting in all .svelte files."""
import re, os

this_dir = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(this_dir, '..')
src_dir = os.path.join(root, 'src')

found_any = False

for dirpath, dirnames, filenames in os.walk(src_dir):
    if 'node_modules' in dirpath:
        continue
    
    for fname in filenames:
        if not fname.endswith('.svelte'):
            continue
        
        fpath = os.path.join(dirpath, fname)
        relpath = os.path.relpath(fpath, root)
        
        with open(fpath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        # Remove style block
        style_match = re.search(r'<style[^>]*>', content)
        if style_match:
            content = content[:style_match.start()]
        
        # Remove script block
        script_match = re.search(r'<script[^>]*>', content)
        if script_match:
            script_end = content.find('</script>', script_match.end())
            if script_end != -1:
                content = content[script_end + 9:]
        
        # Find all button/Button tags
        button_opens = [(m.start(), m.group()) for m in re.finditer(r'<(?:button|Button)\b[^>]*>', content, re.IGNORECASE)]
        button_closes = [(m.start(), m.group()) for m in re.finditer(r'</(?:button|Button)\s*>', content, re.IGNORECASE)]
        
        if len(button_opens) < 2:
            continue
        
        # Build ordered event list
        events = []
        for pos, tag in button_opens:
            events.append((pos, 'open', tag))
        for pos, tag in button_closes:
            events.append((pos, 'close', tag))
        
        events.sort(key=lambda x: x[0])
        
        stack = []
        for pos, typ, tag in events:
            if typ == 'open':
                if stack:
                    found_any = True
                    line_num = content[:pos].count('\n') + 1
                    print(f"\n*** NESTING at {relpath}:{line_num}")
                    lines = content.split('\n')
                    start_line = max(0, line_num - 3)
                    end_line = min(len(lines), line_num + 2)
                    for i in range(start_line, end_line):
                        marker = ">>>" if i == line_num - 1 else "   "
                        print(f"  {marker} {i+1}: {lines[i]}")
                    print(f"  \\-- Open buttons: {[t.strip() for t in stack]}")
                    print(f"  \\-- Nested: {tag.strip()}")
                stack.append(tag)
            elif typ == 'close':
                if stack:
                    stack.pop()

if not found_any:
    print("No button-in-button nesting found.")
else:
    print(f"\nDone. {found_any} file(s) have nesting issues.")
