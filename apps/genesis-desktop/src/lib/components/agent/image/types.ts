// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { HTMLImgAttributes } from "svelte/elements";

export type Experimental_GeneratedImage = {
  base64: string;
  uint8Array?: Uint8Array;
  mediaType?: string;
};

export type ImageProps = Experimental_GeneratedImage &
  HTMLImgAttributes & {
    ref?: HTMLImageElement | null;
    class?: string;
  };
