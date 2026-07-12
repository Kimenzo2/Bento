import pathlib
path = pathlib.Path('src/modules/habits/App.svelte')
c = path.read_text(encoding='utf-8')

# 1. Remove whyHabitId state and whyHabit derived
old1 = '\n  // ── Why modal ───────────────────────────────────────────────────\n  let whyHabitId: string | null = $state(null);\n  let whyHabit = $derived(activeHabits.find(h => h.id === whyHabitId));\n'
if old1 in c:
    c = c.replace(old1, '\n')
    print("1. Removed whyHabitId state")
else:
    print("1. Could not find whyHabitId state")

# 2. Remove Why modal template — from <!-- ══ WHY MODAL ═══ to the closing {/if}
start_marker = '<!-- ══ WHY MODAL ════════════════════════════════════════════════════ -->'
idx = c.find(start_marker)
if idx >= 0:
    # Find the end: look for {/if} that closes the outer {#if whyHabitId && whyHabit}
    # The template has one outer {#if and one inner {#if, so there are 2 {/if}s
    # We need to find the one after the entire modal content
    search_from = idx + len(start_marker)
    # After the outer {#if, there are nested blocks. We count {#if and {/if} to find the matching close
    depth = 0
    end_idx = search_from
    for i in range(search_from, len(c)):
        if c[i:i+4] == '{#if':
            depth += 1
        elif c[i:i+5] == '{/if}':
            if depth == 0:
                end_idx = i + 5
                break
            depth -= 1
    
    template = c[idx:end_idx]
    print(f"2. Found Why modal template: {len(template)} chars, depth ends at {depth}")
    c = c.replace(template, '')
    print("2. Removed Why modal template")
else:
    print("2. Could not find WHY MODAL start")
    # Try alternative
    idx2 = c.find('hb-why-modal')
    if idx2 >= 0:
        print(f"   Found hb-why-modal at {idx2}")
        print(repr(c[idx2-50:idx2+50]))

# 3. Remove Why modal CSS — from :global(.hb-why-modal) to the next non-why rule
css_start = c.find(':global(.hb-why-modal)')
if css_start >= 0:
    # Find the end of the why-stats span rule (last why- CSS rule)
    last_why = c.rfind(':global(.hb-why-stats span)', css_start, css_start + 2000)
    if last_why < 0:
        last_why = c.rfind(':global(.hb-why-stats)', css_start, css_start + 2000)
    if last_why >= 0:
        end_brace = c.find('}', last_why)
        if end_brace >= 0:
            css_block = c[css_start:end_brace + 1]
            print(f"3. Found Why modal CSS: {len(css_block)} chars")
            c = c.replace(css_block, '')
            print("3. Removed Why modal CSS")
        else:
            print("3. Could not find closing brace")
    else:
        print("3. Could not find last why- CSS rule")
else:
    print("3. Could not find :global(.hb-why-modal)")

# 4. Remove hb-identity:focus-visible CSS (now dead code since hb-identity is a <div>)
old_identity_focus = ':global(.hb-identity:focus-visible) {\n  outline: 2px solid var(--hb-accent);\n  border-radius: 6px;\n}\n'
if old_identity_focus in c:
    c = c.replace(old_identity_focus, '')
    print("4. Removed hb-identity:focus-visible dead CSS")
else:
    # Try with different spacing
    import re
    pattern = r'?:global\(\.hb-identity:focus-visible\)\s*\{[^}]+\}'
    match = re.search(pattern, c)
    if match:
        c = c.replace(match.group(0), '')
        print("4. Removed hb-identity:focus-visible dead CSS (regex)")
    else:
        print("4. Could not find hb-identity:focus-visible CSS")

path.write_text(c, encoding='utf-8')
print("Done")
