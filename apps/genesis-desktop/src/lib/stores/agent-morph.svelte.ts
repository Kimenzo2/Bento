// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

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
  inputBottom = $state(0);

  _closeTimer: ReturnType<typeof setTimeout> | null = null;
  _collapseTimer: ReturnType<typeof setTimeout> | null = null;
  _clear = () => {
    if (this._closeTimer) { clearTimeout(this._closeTimer); this._closeTimer = null; }
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
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

  reset = () => {
    this._clear();
    this.mounted = false;
    this.state = "closed";
    this.activeId = null;
    this.renderedId = null;
  };
}

export const agentMorph = new AgentMorphStore();
