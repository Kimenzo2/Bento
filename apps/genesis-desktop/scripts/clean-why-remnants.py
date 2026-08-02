# ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import pathlib
path = pathlib.Path('src/modules/habits/App.svelte')
c = path.read_text(encoding='utf-8')

# Remove the corrupted Why modal template remnant
# It looks like: <!-- ══ \n        <div class="hb-why-stats">\n          <span>🔥 {whyHabit.streak}d streak</span>\n          <span>🏆 Best: {whyHabit.longestStreak}d</span>\n        </div>\n  </div>\n</div>\n{/if}
old_remnant = '<!-- ══ \n        <div class="hb-why-stats">\n          <span>🔥 {whyHabit.streak}d streak</span>\n          <span>🏆 Best: {whyHabit.longestStreak}d</span>\n        </div>\n  </div>\n</div>\n{/if}'
if old_remnant in c:
    c = c.replace(old_remnant, '')
    print("Removed corrupted Why modal remnant")
else:
    print("Could not find exact remnant, trying search...")
    idx = c.find('hb-why-stats')
    if idx >= 0:
        # Find the start and end of the corrupted block
        start = c.rfind('<!--', idx - 100, idx)
        if start < 0:
            start = idx - 200
        end = c.find('{/if}', idx)
        if end >= 0:
            end += 5
        else:
            end = idx + 200
        print(f"Found at {idx}, removing from {start} to {end}")
        print(repr(c[start:end]))
        c = c[:start] + c[end:]
        print("Removed found remnant")

# Remove the empty /* Why modal */ comment
old_comment = '/* Why modal */\n\n\n'
if old_comment in c:
    c = c.replace(old_comment, '')
    print("Removed empty Why modal CSS comment")
else:
    print("Could not find empty Why modal comment")

path.write_text(c, encoding='utf-8')
print("Done")
