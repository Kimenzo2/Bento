declare module 'sortablejs' {
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
