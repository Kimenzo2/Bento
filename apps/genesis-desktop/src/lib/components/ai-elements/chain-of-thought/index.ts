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
