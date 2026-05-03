export type LifeInColourDisplaySize = 'small' | 'medium' | 'large';

export const LIFE_IN_COLOUR_DISPLAY_SIZE_OPTIONS: Array<{
  value: LifeInColourDisplaySize;
  label: string;
}> = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

export const LIFE_IN_COLOUR_DISPLAY_SIZE_CONFIG: Record<
  LifeInColourDisplaySize,
  {
    label: string;
    maxStageHeight: number;
    galleryTileHeight: string;
    galleryGridClassName: string;
    previewMaxWidthClassName: string;
    description: string;
  }
> = {
  small: {
    label: 'Compact',
    maxStageHeight: 520,
    galleryTileHeight: 'h-[220px]',
    galleryGridClassName: 'grid-cols-1 sm:grid-cols-2',
    previewMaxWidthClassName: 'max-w-[46rem]',
    description: 'Keeps the preview tight and the gallery dense.',
  },
  medium: {
    label: 'Balanced',
    maxStageHeight: 640,
    galleryTileHeight: 'h-[260px]',
    galleryGridClassName: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    previewMaxWidthClassName: 'max-w-[56rem]',
    description: 'A stable default with enough breathing room.',
  },
  large: {
    label: 'Expanded',
    maxStageHeight: 760,
    galleryTileHeight: 'h-[320px]',
    galleryGridClassName: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    previewMaxWidthClassName: 'max-w-[64rem]',
    description: 'A larger work surface for detailed pages.',
  },
};
