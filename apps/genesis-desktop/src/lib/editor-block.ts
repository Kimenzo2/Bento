/** Offset-based text mark (AnyType-quality marks model) */
export interface TextMark {
  from: number;
  to: number;
  type: 'B' | 'I' | 'U' | 'S' | 'A';
  href?: string;
}

/** Block types supported by the editor */
export type BlockType =
  | 'p'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'toggle'
  | 'quote'
  | 'code'
  | 'checkbox'
  | 'divider';

/** A single editable block */
export interface Block {
  id: string;
  type: BlockType;
  text: string;
  marks: TextMark[];
  checked: boolean;
  level: number;
}

/** Generate a unique ID */
export function uid(): string {
  return crypto.randomUUID();
}

/** Create an empty block of the given type */
export function emptyBlock(type: BlockType = 'p'): Block {
  return { id: uid(), type, text: '', marks: [], checked: false, level: 0 };
}

/** Serialize blocks to a compact JSON string for persistence */
export function blocksToJSON(blocks: Block[]): string {
  const nonEmpty = blocks.filter((b) => b.type !== 'divider' || b.text);
  if (nonEmpty.length === 1 && nonEmpty[0].type === 'p' && !nonEmpty[0].text) return '';
  return JSON.stringify(
    blocks.map((b) => ({
      t: b.type,
      text: b.text,
      marks: b.marks,
      ck: b.checked,
      lv: b.level || 0,
    }))
  );
}

/** Deserialize blocks from a JSON string */
export function blocksFromJSON(json: string): Block[] {
  if (!json) return [emptyBlock()];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      const validTypes = new Set<BlockType>([
        'p',
        'h1',
        'h2',
        'h3',
        'bullet',
        'number',
        'toggle',
        'quote',
        'code',
        'checkbox',
        'divider',
      ]);
      return parsed.map((p: any) => ({
        id: uid(),
        type: validTypes.has(p.t) ? p.t : ('p' as BlockType),
        text: p.text || '',
        level: typeof p.lv === 'number' ? Math.max(0, Math.min(p.lv, 5)) : 0,
        marks: Array.isArray(p.marks)
          ? p.marks
              .filter(
                (m: any) =>
                  ['B', 'I', 'U', 'S', 'A'].includes(m.type) &&
                  typeof m.from === 'number' &&
                  typeof m.to === 'number'
              )
              .map((m: any) => ({
                from: m.from,
                to: m.to,
                type: m.type,
                ...(m.href ? { href: m.href } : {}),
              }))
          : [],
        checked: !!p.ck,
      }));
    }
  } catch {
    /* ignore parse errors */
  }
  return [emptyBlock()];
}
