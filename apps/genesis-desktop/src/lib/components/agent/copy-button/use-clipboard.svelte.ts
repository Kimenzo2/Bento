// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

type Options = {
  delay: number;
};

export class UseClipboard {
  #copiedStatus = $state<"success" | "failure">();
  private delay: number;
  private timeout: ReturnType<typeof setTimeout> | undefined = undefined;

  constructor({ delay = 800 }: Partial<Options> = {}) {
    this.delay = delay;
  }

  async copy(text: string) {
    if (this.timeout) {
      this.#copiedStatus = undefined;
      clearTimeout(this.timeout);
    }

    try {
      await navigator.clipboard.writeText(text);
      this.#copiedStatus = "success";
      this.timeout = setTimeout(() => {
        this.#copiedStatus = undefined;
      }, this.delay);
    } catch {
      this.#copiedStatus = "failure";
      this.timeout = setTimeout(() => {
        this.#copiedStatus = undefined;
      }, this.delay);
    }

    return this.#copiedStatus;
  }

  get copied() {
    return this.#copiedStatus === "success";
  }

  get status() {
    return this.#copiedStatus;
  }
}
