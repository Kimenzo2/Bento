**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Window Architecture

Genesis Desktop uses Tauri 2 window state persistence for the main window.
The Rust setup code restores saved position, size, and maximized state from the
`tauri-plugin-window-state` cache, then validates the restored rectangle against
the current monitor work areas before showing the window.

`visible` is set to `false` in `tauri.conf.json` so the window does not flash
at the default or restored position before validation runs. The window is shown
programmatically only after the restore step and the bounds check complete.

The monitor validation rejects restored positions that are fully off-screen or
more than 50 percent outside every available monitor. In those cases the
window is centered on the primary monitor before it is shown.

`shadow: true` is required on Windows when `decorations: false` is used. Without
the shadow, the OS resize affordance at the window edges can disappear and the
window becomes difficult or impossible to resize.
