// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { createHighlighterCore } from "shiki/core";

const bundledLanguages = {
  bash: () => import("@shikijs/langs/bash"),
  diff: () => import("@shikijs/langs/diff"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  svelte: () => import("@shikijs/langs/svelte"),
  typescript: () => import("@shikijs/langs/typescript"),
  python: () => import("@shikijs/langs/python"),
  tsx: () => import("@shikijs/langs/tsx"),
  jsx: () => import("@shikijs/langs/jsx"),
  css: () => import("@shikijs/langs/css"),
  text: () => import("@shikijs/langs/markdown"),
};

export type SupportedLanguage = keyof typeof bundledLanguages;

export const highlighter = createHighlighterCore({
  themes: [
    import("@shikijs/themes/github-light-default"),
    import("@shikijs/themes/github-dark-default"),
    import("@shikijs/themes/vesper"),
  ],
  langs: Object.entries(bundledLanguages).map(([_, lang]) => lang),
  engine: createJavaScriptRegexEngine(),
});
