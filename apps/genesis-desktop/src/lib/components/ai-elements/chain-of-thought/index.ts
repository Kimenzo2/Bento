// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

/**
 * Re-export ChainOfThought components from their canonical location.
 *
 * The actual implementation lives under `$lib/components/agent/chain-of-thought/`
 * to keep all AI components in one organized place. This barrel provides
 * backwards compatibility for registry-based import paths.
 */
export {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  ChainOfThoughtContent,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  ChainOfThoughtImage,
  ChainOfThoughtContext,
  getChainOfThoughtContext,
  setChainOfThoughtContext,
  //
  Root,
  Header,
  Step,
  Content,
  SearchResults,
  SearchResult,
  Image,
} from "$lib/components/agent/chain-of-thought/index.js";
