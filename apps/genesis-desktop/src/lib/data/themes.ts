export type ThemeMode = 'light' | 'dark';

export type ThemeTokens = {
  '--background': string;
  '--surface': string;
  '--card': string;
  '--popover': string;
  '--foreground': string;
  '--muted': string;
  '--border': string;
  '--primary': string;
  '--primary-hover': string;
  '--accent': string;
  '--color-primary-start': string;
  '--color-primary-end': string;
  '--color-accent-start': string;
  '--color-accent-end': string;
  '--color-text': string;
  '--color-text-light': string;
  '--color-surface': string;
  '--color-background': string;
  '--color-border': string;
  '--color-shadow': string;
};

export type DesktopTheme = {
  id: ThemeId;
  name: string;
  description: string;
  preview: [string, string, string];
  modes: Record<ThemeMode, ThemeTokens>;
};

export type ThemeId = 'bento' | 'aurora' | 'ocean' | 'forest' | 'nebula' | 'sunset' | 'midnight';

const createThemeTokens = (tokens: {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  primaryStart: string;
  primaryEnd: string;
  accentStart: string;
  accentEnd: string;
  shadow: string;
  card?: string;
  popover?: string;
  primary?: string;
  primaryHover?: string;
  accent?: string;
}): ThemeTokens => ({
  '--background': tokens.background,
  '--surface': tokens.surface,
  '--card': tokens.card ?? tokens.surface,
  '--popover': tokens.popover ?? tokens.surface,
  '--foreground': tokens.foreground,
  '--muted': tokens.muted,
  '--border': tokens.border,
  '--primary': tokens.primary ?? tokens.primaryStart,
  '--primary-hover': tokens.primaryHover ?? tokens.primaryEnd,
  '--accent': tokens.accent ?? tokens.accentStart,
  '--color-primary-start': tokens.primaryStart,
  '--color-primary-end': tokens.primaryEnd,
  '--color-accent-start': tokens.accentStart,
  '--color-accent-end': tokens.accentEnd,
  '--color-text': tokens.foreground,
  '--color-text-light': tokens.muted,
  '--color-surface': tokens.surface,
  '--color-background': tokens.background,
  '--color-border': tokens.border,
  '--color-shadow': tokens.shadow,
});

export const desktopThemes: DesktopTheme[] = [
  {
    id: 'bento',
    name: 'Bento Classic',
    description: 'Original warm and cozy theme.',
    preview: ['#FF9B71', '#FFD93D', '#FFF8E7'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#FF9B71',
        primaryEnd: '#FFD93D',
        accentStart: '#FFD93D',
        accentEnd: '#FF9B71',
        background: '#FFF8E7',
        surface: '#FFFFFF',
        foreground: '#5A5A5A',
        muted: '#8B7E74',
        border: '#FFE4CC',
        primary: '#FF9B71',
        primaryHover: '#E8845A',
        accent: '#FFE4CC',
        shadow: '255 155 113',
      }),
      dark: createThemeTokens({
        primaryStart: '#E87D56',
        primaryEnd: '#E5C02B',
        accentStart: '#E5C02B',
        accentEnd: '#E87D56',
        background: '#1A1412',
        surface: '#2A201D',
        foreground: '#EAE0D5',
        muted: '#A89F91',
        border: '#3D302B',
        primary: '#E87D56',
        primaryHover: '#D06A43',
        accent: '#3D302B',
        shadow: '255 155 113',
      }),
    },
  },
  {
    id: 'aurora',
    name: 'Aurora Scholar',
    description: 'Northern lights energy with academic clarity.',
    preview: ['#4A148C', '#E91E63', '#F8F5FF'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#4A148C',
        primaryEnd: '#E91E63',
        accentStart: '#FFB74D',
        accentEnd: '#9C27B0',
        background: '#F8F5FF',
        surface: '#FFFFFF',
        foreground: '#2D1B4E',
        muted: '#6A4F8B',
        border: '#E1BEE7',
        primary: '#6A1FA8',
        primaryHover: '#561890',
        accent: '#E1BEE7',
        shadow: '74 20 140',
      }),
      dark: createThemeTokens({
        primaryStart: '#7C4DFF',
        primaryEnd: '#F48FB1',
        accentStart: '#FFCC80',
        accentEnd: '#CE93D8',
        background: '#130C1C',
        surface: '#1E152D',
        foreground: '#E2D8F0',
        muted: '#A594BD',
        border: '#362554',
        primary: '#7C4DFF',
        primaryHover: '#6B3DE8',
        accent: '#362554',
        shadow: '74 20 140',
      }),
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Academy',
    description: 'Calm, focused, and deeply legible.',
    preview: ['#006064', '#00ACC1', '#E0F7FA'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#006064',
        primaryEnd: '#00ACC1',
        accentStart: '#4DD0E1',
        accentEnd: '#80DEEA',
        background: '#E0F7FA',
        surface: '#FFFFFF',
        foreground: '#00363A',
        muted: '#00838F',
        border: '#B2EBF2',
        primary: '#006064',
        primaryHover: '#004F52',
        accent: '#B2EBF2',
        shadow: '0 96 100',
      }),
      dark: createThemeTokens({
        primaryStart: '#26C6DA',
        primaryEnd: '#80DEEA',
        accentStart: '#B2EBF2',
        accentEnd: '#E0F7FA',
        background: '#0A191C',
        surface: '#12272B',
        foreground: '#D5EFEF',
        muted: '#85AFA8',
        border: '#1A424A',
        primary: '#26C6DA',
        primaryHover: '#1BAFC1',
        accent: '#1A424A',
        shadow: '0 96 100',
      }),
    },
  },
  {
    id: 'forest',
    name: 'Forest Wisdom',
    description: 'Gentle, grounded, and organic.',
    preview: ['#2E7D32', '#66BB6A', '#F1F8E9'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#2E7D32',
        primaryEnd: '#66BB6A',
        accentStart: '#AED581',
        accentEnd: '#FFE57F',
        background: '#F1F8E9',
        surface: '#FFFFFF',
        foreground: '#1B5E20',
        muted: '#558B2F',
        border: '#C5E1A5',
        primary: '#2E7D32',
        primaryHover: '#236228',
        accent: '#C5E1A5',
        shadow: '46 125 50',
      }),
      dark: createThemeTokens({
        primaryStart: '#66BB6A',
        primaryEnd: '#A5D6A7',
        accentStart: '#C5E1A5',
        accentEnd: '#FFF59D',
        background: '#0F1A12',
        surface: '#18291B',
        foreground: '#DBEFE0',
        muted: '#8EAB94',
        border: '#28462C',
        primary: '#66BB6A',
        primaryHover: '#52A356',
        accent: '#28462C',
        shadow: '46 125 50',
      }),
    },
  },
  {
    id: 'nebula',
    name: 'Nebula Mind',
    description: 'Cosmic contrast for immersive work.',
    preview: ['#1A237E', '#7B1FA2', '#EDE7F6'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#1A237E',
        primaryEnd: '#7B1FA2',
        accentStart: '#E91E63',
        accentEnd: '#FFD54F',
        background: '#EDE7F6',
        surface: '#FFFFFF',
        foreground: '#12005E',
        muted: '#5E35B1',
        border: '#D1C4E9',
        primary: '#4527A0',
        primaryHover: '#361F84',
        accent: '#D1C4E9',
        shadow: '26 35 126',
      }),
      dark: createThemeTokens({
        primaryStart: '#5C6BC0',
        primaryEnd: '#AB47BC',
        accentStart: '#EC407A',
        accentEnd: '#FFE082',
        background: '#100C1A',
        surface: '#1A152A',
        foreground: '#DED8EB',
        muted: '#938BA3',
        border: '#2A2244',
        primary: '#5C6BC0',
        primaryHover: '#4A58A8',
        accent: '#2A2244',
        shadow: '26 35 126',
      }),
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Scholar',
    description: 'Golden-hour warmth with editorial contrast.',
    preview: ['#BF360C', '#FF6F00', '#FFF3E0'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#BF360C',
        primaryEnd: '#FF6F00',
        accentStart: '#FFB74D',
        accentEnd: '#FFD54F',
        background: '#FFF3E0',
        surface: '#FFFFFF',
        foreground: '#3E2723',
        muted: '#8D6E63',
        border: '#FFCCBC',
        primary: '#BF360C',
        primaryHover: '#A32D09',
        accent: '#FFCCBC',
        shadow: '191 54 12',
      }),
      dark: createThemeTokens({
        primaryStart: '#FF7043',
        primaryEnd: '#FFCA28',
        accentStart: '#FFE082',
        accentEnd: '#FFF59D',
        background: '#1C120C',
        surface: '#2D1C12',
        foreground: '#EFE5DE',
        muted: '#AC9B8F',
        border: '#4A2E1F',
        primary: '#FF7043',
        primaryHover: '#E85C30',
        accent: '#4A2E1F',
        shadow: '191 54 12',
      }),
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Classic',
    description: 'Minimal monochrome for deep focus.',
    preview: ['#1A1A1A', '#E8E8E8', '#FAF7F4'],
    modes: {
      light: createThemeTokens({
        primaryStart: '#1A1A1A',
        primaryEnd: '#2D2D2D',
        accentStart: '#E8E8E8',
        accentEnd: '#EDE4D9',
        background: '#FAF7F4',
        surface: '#FDFAF7',
        card: '#FFFBF5',
        popover: '#FFF8F0',
        foreground: '#1F1C1A',
        muted: '#5A5248',
        border: '#EDE4D9',
        primary: '#1A1A1A',
        primaryHover: '#2D2D2D',
        accent: '#E8E8E8',
        shadow: '31 28 26',
      }),
      dark: createThemeTokens({
        primaryStart: '#F0F0F0',
        primaryEnd: '#DCDCDC',
        accentStart: '#252525',
        accentEnd: '#161616',
        background: '#0D0D0D',
        surface: '#161616',
        card: '#1C1C1C',
        popover: '#161616',
        foreground: '#F0F0F0',
        muted: '#999999',
        border: '#252525',
        primary: '#F0F0F0',
        primaryHover: '#DCDCDC',
        accent: '#252525',
        shadow: '240 240 240',
      }),
    },
  },
];

export const defaultThemeId: ThemeId = 'midnight';

export function resolveThemeById(themeId: string) {
  return (
    desktopThemes.find((theme) => theme.id === themeId) ??
    desktopThemes.find((theme) => theme.id === defaultThemeId) ??
    desktopThemes[0]
  );
}

export function getThemeTokensFor(themeId: string, mode: ThemeMode) {
  return resolveThemeById(themeId).modes[mode];
}
