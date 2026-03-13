import { ArtStyle, BookTone } from '../types';

const ART_STYLE_ALIASES: Array<[RegExp, ArtStyle]> = [
  [/watercolor/i, ArtStyle.WATERCOLOR],
  [/pixar|3d|render/i, ArtStyle.PIXAR_3D],
  [/manga|anime/i, ArtStyle.MANGA],
  [/corporate|minimal(ist)?/i, ArtStyle.CORPORATE],
  [/cyberpunk|neon/i, ArtStyle.CYBERPUNK],
  [/vintage|storybook|classic|traditional|oil|fantasy/i, ArtStyle.VINTAGE],
  [/paper|cutout|papercraft|collage/i, ArtStyle.PAPER_CUTOUT],
  [/flat|vector/i, ArtStyle.FLAT_DESIGN],
  [/infographic/i, ArtStyle.INFOGRAPHIC],
  [/blueprint|technical/i, ArtStyle.BLUEPRINT],
];

const BOOK_TONE_ALIASES: Array<[RegExp, BookTone]> = [
  [/playful|fun|whimsical|cheerful|lighthearted/i, BookTone.PLAYFUL],
  [/serious|formal|grave/i, BookTone.SERIOUS],
  [/inspir/i, BookTone.INSPIRATIONAL],
  [/educat|instruction|inform/i, BookTone.EDUCATIONAL],
  [/dram/i, BookTone.DRAMATIC],
  [/calm|soothing|gentle|relax/i, BookTone.CALM],
  [/advent|excite|action|epic/i, BookTone.ADVENTUROUS],
];

export function normalizeArtStyle(input?: string | ArtStyle | null): ArtStyle {
  if (!input) return ArtStyle.WATERCOLOR;
  if (Object.values(ArtStyle).includes(input as ArtStyle)) {
    return input as ArtStyle;
  }

  const normalized = String(input).trim();
  for (const [pattern, style] of ART_STYLE_ALIASES) {
    if (pattern.test(normalized)) return style;
  }

  return ArtStyle.WATERCOLOR;
}

export function normalizeBookTone(input?: string | BookTone | null): BookTone {
  if (!input) return BookTone.PLAYFUL;
  if (Object.values(BookTone).includes(input as BookTone)) {
    return input as BookTone;
  }

  const normalized = String(input).trim();
  for (const [pattern, tone] of BOOK_TONE_ALIASES) {
    if (pattern.test(normalized)) return tone;
  }

  return BookTone.PLAYFUL;
}

export function normalizePageCount(input?: number | string | null): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return Math.max(1, Math.floor(input));
  }

  if (typeof input === 'string') {
    const parsed = Number.parseInt(input, 10);
    if (!Number.isNaN(parsed)) {
      return Math.max(1, parsed);
    }
  }

  return undefined;
}

export function normalizeBoolean(input?: boolean | string | null): boolean | undefined {
  if (typeof input === 'boolean') return input;
  if (typeof input !== 'string') return undefined;

  const normalized = input.trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0'].includes(normalized)) return false;
  return undefined;
}
