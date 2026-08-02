#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

fn main() {
    bento_desktop_lib::install_panic_bootstrap();
    // Regenerate TypeScript bindings when BENTO_GEN_BINDINGS=1 (dev workflow).
    let _ = bento_desktop_lib::typed::export_bindings();
    bento_desktop_lib::run();
}
