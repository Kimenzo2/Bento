function isInOpenCodeFence(text: string) {
  const fenceMatches = text.match(/^```/gm) ?? [];
  return fenceMatches.length % 2 !== 0;
}

export function repairMarkdown(raw: string): string {
  let text = raw;

  if (isInOpenCodeFence(text)) {
    text += '\n```';
    return text;
  }

  const boldCount = (text.match(/\*\*/g) ?? []).length;
  if (boldCount % 2 !== 0) {
    text += '**';
  }

  const backtickCount = (text.match(/(?<!`)`(?!`)/g) ?? []).length;
  if (backtickCount % 2 !== 0) {
    text += '`';
  }

  return text;
}

export function escapeMarkdownHtml(raw: string): string {
  return raw.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
