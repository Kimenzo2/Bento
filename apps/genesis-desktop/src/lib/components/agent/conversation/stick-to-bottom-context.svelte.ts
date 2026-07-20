import { watch } from "runed";
import { setContext, getContext } from "svelte";

const STICK_TO_BOTTOM_CONTEXT_KEY = Symbol("stick-to-bottom-context");

class StickToBottomContext {
  #element: HTMLElement | null = $state(null);
  #isAtBottom = $state(true);
  #resizeObserver: ResizeObserver | null = null;
  #mutationObserver: MutationObserver | null = null;
  #sentinel: HTMLElement | null = null;

  isAtBottom = $derived(this.#isAtBottom);

  constructor() {
    watch(
      () => this.#element,
      () => {
        if (this.#element) {
          this.#setupObservers();
          return () => this.#cleanup();
        }
      },
    );
  }

  setElement(element: HTMLElement) {
    this.#element = element;
  }

  scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (!this.#element) return;
    this.#element.scrollTo({ top: this.#element.scrollHeight, behavior });
  };

  #handleScroll = () => {
    if (!this.#element) return;
    const { scrollTop, scrollHeight, clientHeight } = this.#element;
    const threshold = 200;
    this.#isAtBottom = scrollTop + clientHeight >= scrollHeight - threshold;
  };

  #setupObservers() {
    if (!this.#element) return;
    this.#createSentinel();
    this.#element.addEventListener("scroll", this.#handleScroll, { passive: true });
    this.#resizeObserver = new ResizeObserver(() => {
      if (this.#isAtBottom) this.scrollToBottom("auto");
    });
    this.#resizeObserver.observe(this.#element);
    this.#mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(() => {
        if (this.#isAtBottom) this.scrollToBottom("smooth");
      });
    });
    this.#mutationObserver.observe(this.#element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  #createSentinel() {
    if (!this.#element) return;
    this.#sentinel = document.createElement("div");
    this.#sentinel.style.height = "1px";
    this.#sentinel.style.pointerEvents = "none";
    this.#sentinel.style.opacity = "0";
    this.#element.appendChild(this.#sentinel);
  }

  #cleanup() {
    this.#resizeObserver?.disconnect();
    this.#mutationObserver?.disconnect();
    if (this.#element) this.#element.removeEventListener("scroll", this.#handleScroll);
    if (this.#sentinel && this.#element?.contains(this.#sentinel))
      this.#element.removeChild(this.#sentinel);
  }
}

export function setStickToBottomContext(): StickToBottomContext {
  const context = new StickToBottomContext();
  setContext(STICK_TO_BOTTOM_CONTEXT_KEY, context);
  return context;
}

export function getStickToBottomContext(): StickToBottomContext {
  const context = getContext<StickToBottomContext>(STICK_TO_BOTTOM_CONTEXT_KEY);
  if (!context)
    throw new Error("StickToBottomContext must be used within a Conversation component");
  return context;
}
