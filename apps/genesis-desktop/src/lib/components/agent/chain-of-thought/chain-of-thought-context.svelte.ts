// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import { getContext, setContext } from "svelte";

const CHAIN_OF_THOUGHT_CONTEXT_KEY = "chain-of-thought-context";

export class ChainOfThoughtContext {
  #isOpen = $state(false);
  #onOpenChange: ((open: boolean) => void) | undefined;

  constructor(
    options: {
      isOpen?: boolean;
      onOpenChange?: (open: boolean) => void;
    } = {},
  ) {
    this.#isOpen = options.isOpen ?? false;
    this.#onOpenChange = options.onOpenChange;
  }

  get isOpen() {
    return this.#isOpen;
  }

  set isOpen(value: boolean) {
    this.#isOpen = value;
    this.#onOpenChange?.(value);
  }

  setIsOpen = (open: boolean) => {
    this.isOpen = open;
  };

  toggle() {
    this.isOpen = !this.isOpen;
  }
}

export function setChainOfThoughtContext(context: ChainOfThoughtContext) {
  setContext(CHAIN_OF_THOUGHT_CONTEXT_KEY, context);
}

export function getChainOfThoughtContext(): ChainOfThoughtContext {
  const context = getContext<ChainOfThoughtContext | undefined>(CHAIN_OF_THOUGHT_CONTEXT_KEY);
  if (!context) {
    throw new Error("ChainOfThought components must be used within ChainOfThought");
  }
  return context;
}
