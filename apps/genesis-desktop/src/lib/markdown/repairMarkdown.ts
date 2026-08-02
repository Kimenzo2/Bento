// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

function isInOpenCodeFence(text: string) {
  const fenceMatches = text.match(/^```/gm) ?? [];
  return fenceMatches.length % 2 !== 0;
}

export function repairMarkdown(raw: string): string {
  let text = raw;

  if (isInOpenCodeFence(text)) {
    text += "\n```";
    return text;
  }

  const boldCount = (text.match(/\*\*/g) ?? []).length;
  if (boldCount % 2 !== 0) {
    text += "**";
  }

  const backtickCount = (text.match(/(?<!`)`(?!`)/g) ?? []).length;
  if (backtickCount % 2 !== 0) {
    text += "`";
  }

  return text;
}

export function escapeMarkdownHtml(raw: string): string {
  return raw.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
