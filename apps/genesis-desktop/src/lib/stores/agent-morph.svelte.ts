type MorphState = "closed" | "menu" | "extended";

const CLEANUP_MS = 450;

export type Attachment = {
  id: string;
  kind: "image" | "doc";
  uri?: string;
  name?: string;
};

class AgentMorphStore {
  mounted = $state(false);
  state = $state<MorphState>("closed");
  activeId = $state<string | null>(null);
  renderedId = $state<string | null>(null);
  inputBottom = $state(116);

  _closeTimer: ReturnType<typeof setTimeout> | null = null;
  _collapseTimer: ReturnType<typeof setTimeout> | null = null;

  _clear = () => {
    if (this._closeTimer) clearTimeout(this._closeTimer);
    if (this._collapseTimer) clearTimeout(this._collapseTimer);
  };

  toggleMenu = () => {
    if (this.state === "closed") {
      this.mounted = true;
      requestAnimationFrame(() => {
        this.state = "menu";
      });
    } else {
      this.close();
    }
  };

  close = () => {
    this._clear();
    this.state = "closed";
    this._closeTimer = setTimeout(() => {
      this.mounted = false;
      this.activeId = null;
      this.renderedId = null;
    }, CLEANUP_MS);
  };

  open = (id: string) => {
    this._clear();
    this.activeId = id;
    this.renderedId = id;
    this.state = "extended";
  };

  back = () => {
    this.activeId = null;
    this.state = "menu";
    this._collapseTimer = setTimeout(() => {
      this.renderedId = null;
    }, CLEANUP_MS);
  };

  destroy = () => {
    this._clear();
  };
}

export const agentMorph = new AgentMorphStore();
