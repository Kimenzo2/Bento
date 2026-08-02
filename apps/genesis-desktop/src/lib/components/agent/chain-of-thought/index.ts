// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import ChainOfThought from "./chain-of-thought.svelte";
import ChainOfThoughtHeader from "./chain-of-thought-header.svelte";
import ChainOfThoughtStep from "./chain-of-thought-step.svelte";
import ChainOfThoughtContent from "./chain-of-thought-content.svelte";
import ChainOfThoughtSearchResults from "./chain-of-thought-search-results.svelte";
import ChainOfThoughtSearchResult from "./chain-of-thought-search-result.svelte";
import ChainOfThoughtImage from "./chain-of-thought-image.svelte";

export {
  ChainOfThoughtContext,
  getChainOfThoughtContext,
  setChainOfThoughtContext,
} from "./chain-of-thought-context.svelte.js";

export {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
  ChainOfThoughtContent,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
  ChainOfThoughtImage,
  //
  ChainOfThought as Root,
  ChainOfThoughtHeader as Header,
  ChainOfThoughtStep as Step,
  ChainOfThoughtContent as Content,
  ChainOfThoughtSearchResults as SearchResults,
  ChainOfThoughtSearchResult as SearchResult,
  ChainOfThoughtImage as Image,
};
