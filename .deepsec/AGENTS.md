**⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.**

# Agent setup

This is a deepsec scanning workspace. Each registered project has its
own setup prompt at `data/<id>/SETUP.md` — open the relevant one when
asked to set a project up.

## Common tasks

- **Set up a project for scanning**: read `data/<id>/SETUP.md` and
  follow it (read `node_modules/deepsec/SKILL.md`, then fill
  `data/<id>/INFO.md` from the target codebase).
- **Add a new project**: run `deepsec init-project <root>` — it
  scaffolds `data/<id>/` and prints/writes the setup prompt for the
  new project.
- **Write a custom matcher** (only after a real true-positive shows you
  a pattern worth keeping): read
  `node_modules/deepsec/dist/docs/writing-matchers.md`.

## Reference

The deepsec skill is at `node_modules/deepsec/SKILL.md` (after
`pnpm install`). The full docs ship at
`node_modules/deepsec/dist/docs/`.
