**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Deep Systematic Bug Hunting

## Core Principles

- Always maintain 100% confidence before proposing any fix. If uncertain, iterate more.
- Work cross-platform: test on Windows and macOS equivalents.
- Systematic from Rust backend → integration points → Svelte frontend.
- Use multiple deep iterative loops with web research in every major cycle.
- Add extensive logging and isolate minimal reproducible cases.

## Step-by-Step Protocol

1. **Initial Assessment**
   - Reproduce the bug reliably on both Windows and macOS.
   - Gather all error logs, stack traces, reproduction steps.
   - Identify entry points in Rust backend and Svelte frontend.

2. **Iterative Deep Loops (Repeat 3-5 times minimum)**
   - **Loop Structure**:
     a. Isolate the smallest code segment reproducing the issue.
     b. Add comprehensive logging (use tracing in Rust, console + devtools in Svelte).
     c. Run targeted tests on isolated code.
     d. Research web extensively: search for similar errors, GitHub issues, Stack Overflow, Rust/Svelte docs, forums.
     e. Analyze findings, hypothesize root causes.
     f. Implement minimal patch or experiment.
     g. Verify fix across platforms and re-integrate.
   - Escalate depth: examine memory, threads, async, dependencies, build configs.

3. **Tool Usage**
   - Use web_search, open_page for research in every loop.
   - Use bash, read_file, edit_file for code inspection and modification.
   - For Rust: cargo test, clippy, gdb/lldb equivalents.
   - For Svelte: svelte-check, browser devtools, network inspection.

4. **Documentation and Reporting**
   - Maintain a detailed reasoning log of each loop iteration.
   - End with full confidence assessment and exact reproduction/fix steps.

## Success Criteria

- Bug eliminated in all tested environments.
- Detailed explanation of root cause and why the fix works.
- No regressions introduced.
