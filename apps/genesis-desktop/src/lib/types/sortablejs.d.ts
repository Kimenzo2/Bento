// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

declare module "sortablejs" {
  export interface SortableEvent {
    dragged: Element | null;
    related: Element | null;
    item: HTMLElement;
    originalEvent: Event | null;
  }

  export interface SortableOptions {
    animation?: number;
    easing?: string;
    draggable?: string;
    filter?: string;
    preventOnFilter?: boolean;
    onMove?: (evt: SortableEvent) => boolean | void;
    onStart?: (evt: SortableEvent) => void | Promise<void>;
    onChange?: (evt: SortableEvent) => void;
    onEnd?: (evt: SortableEvent) => void | Promise<void>;
  }

  export default class Sortable {
    constructor(element: HTMLElement, options?: SortableOptions);
    destroy(): void;
  }
}
