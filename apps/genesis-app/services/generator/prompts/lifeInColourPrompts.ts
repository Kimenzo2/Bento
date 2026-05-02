import type { ColoringOutlineMode } from '../../../types';

export interface ColoringOutlineModeConfig {
  label: string;
  description: string;
  summary: string;
  prompt: string;
  recommended?: boolean;
}

export const COLORING_OUTLINE_MODES: Record<ColoringOutlineMode, ColoringOutlineModeConfig> = {
  simple: {
    label: 'Simple',
    description: 'Bold, open contours with generous white space.',
    summary: 'Best for clean pages with large shapes and easy colouring areas.',
    prompt:
      'Use bold black outlines, broad open shapes, minimal interior detail, and large clean blank areas that are easy to colour.',
  },
  detailed: {
    label: 'Detailed',
    description: 'Balanced line density with more texture and scene depth.',
    summary: 'Best for premium family pages that stay readable and printable.',
    prompt:
      'Use confident black outlines, medium detail density, light texture cues, clear scene depth, and readable contours without clutter.',
    recommended: true,
  },
  mandala: {
    label: 'Mandala',
    description: 'Radial ornament and decorative symmetry.',
    summary: 'Best for turning a photo into a shareable, circular colouring plate.',
    prompt:
      'Transform the photo into circular symmetry, radial ornament, layered loops, floral geometry, and elegant balanced linework built for colouring.',
  },
};

export function getColoringOutlineModeConfig(
  mode: ColoringOutlineMode | string | null | undefined
): ColoringOutlineModeConfig {
  if (mode === 'simple' || mode === 'detailed' || mode === 'mandala') {
    return COLORING_OUTLINE_MODES[mode];
  }

  return COLORING_OUTLINE_MODES.detailed;
}

export function buildLifeInColourPagePrompt(params: {
  photoCount: number;
  photoName?: string;
}): string {
  const photoLabel = params.photoCount === 1 ? '1 photo' : `${params.photoCount} photos`;

  const parts = [
    `Create a single printable colouring page from ${photoLabel}.`,
    'Focus on the uploaded camera-roll image, simplify the scene into clean line art, and keep the page book-ready without turning it into a full book yet.',
    'Use bold black outlines, open shapes, minimal noise, generous white space, and a polished printable composition.',
  ];

  if (params.photoName) {
    parts.push(`Primary source reference: ${params.photoName}.`);
  }

  parts.push('Return a finished colouring page concept that feels complete on its own.');

  return parts.join('\n\n');
}

export function buildLifeInColourPrompt(params: {
  title: string;
  brief: string;
  photoCount: number;
  outlineMode: ColoringOutlineMode | string | null | undefined;
  audience: string;
  presetLabel?: string;
}): string {
  const mode = getColoringOutlineModeConfig(params.outlineMode);
  const photoLabel = params.photoCount === 1 ? '1 photo' : `${params.photoCount} photos`;

  const parts = [
    `Create a printable colouring book called "${params.title}" from ${photoLabel}.`,
    'Focus on the selected camera-roll moments, simplify the scene into clean line art, and keep the page book-ready.',
    `Outline mode: ${mode.label}. ${mode.summary}`,
    `Mode rules: ${mode.prompt}`,
    `Audience: ${params.audience}`,
  ];

  if (params.presetLabel) {
    parts.push(`Preset: ${params.presetLabel}`);
  }

  parts.push(`Brief: ${params.brief}`);

  return parts.join('\n\n');
}
