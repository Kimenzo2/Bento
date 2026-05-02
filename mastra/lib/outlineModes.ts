export type AndrewOutlineMode = 'simple' | 'detailed' | 'mandala';
export type AndrewImageDetailLevel = 'low' | 'auto' | 'high';

export interface AndrewOutlineModeConfig {
  label: string;
  description: string;
  summary: string;
  prompt: string;
  detailLevel: AndrewImageDetailLevel;
}

export const ANDREW_OUTLINE_MODES: Record<AndrewOutlineMode, AndrewOutlineModeConfig> = {
  simple: {
    label: 'Simple',
    description: 'Bold, open contours with generous white space.',
    summary: 'Best for clean pages with large shapes and easy colouring areas.',
    prompt:
      'Use bold black outlines, broad open shapes, minimal interior detail, and large clean blank areas that are easy to colour.',
    detailLevel: 'low',
  },
  detailed: {
    label: 'Detailed',
    description: 'Balanced line density with more texture and scene depth.',
    summary: 'Best for premium family pages that stay readable and printable.',
    prompt:
      'Use confident black outlines, medium detail density, light texture cues, clear scene depth, and readable contours without clutter.',
    detailLevel: 'high',
  },
  mandala: {
    label: 'Mandala',
    description: 'Radial ornament and decorative symmetry.',
    summary: 'Best for turning a photo into a shareable, circular colouring plate.',
    prompt:
      'Transform the photo into circular symmetry, radial ornament, layered loops, floral geometry, and elegant balanced linework built for colouring.',
    detailLevel: 'high',
  },
};

export function getAndrewOutlineModeConfig(mode: AndrewOutlineMode): AndrewOutlineModeConfig {
  return ANDREW_OUTLINE_MODES[mode];
}
