import { Theme } from '../types/theme';

export const themes: Theme[] = [
    {
        id: 'genesis',
        name: 'Genesis Classic',
        description: 'Original warm & cozy theme',
        colors: {
            primary: ['#FF9B71', '#FFD93D'],
            accent: ['#FFD93D', '#FF9B71'],
            background: '#FFF8E7',
            text: '#5A5A5A',
            textLight: '#8B7E74',
            border: '#FFE4CC',
            shadow: '255, 155, 113, 0.15'
        },
        cssVariables: {
            '--color-primary-start': '#FF9B71',
            '--color-primary-end': '#FFD93D',
            '--color-accent-start': '#FFD93D',
            '--color-accent-end': '#FF9B71',
            '--color-background': '#FFF8E7',
            '--color-text': '#5A5A5A',
            '--color-text-light': '#8B7E74',
            '--color-border': '#FFE4CC',
            '--color-shadow': '255, 155, 113'
        }
    },
    {
        id: 'aurora',
        name: 'Aurora Scholar',
        description: 'Northern Lights Academic',
        colors: {
            primary: ['#4A148C', '#E91E63'],
            accent: ['#FFB74D', '#9C27B0'],
            background: '#F8F5FF',
            text: '#2D1B4E',
            textLight: '#6A4F8B',
            border: '#E1BEE7',
            shadow: '74, 20, 140, 0.1'
        },
        cssVariables: {
            '--color-primary-start': '#4A148C',
            '--color-primary-end': '#E91E63',
            '--color-accent-start': '#FFB74D',
            '--color-accent-end': '#9C27B0',
            '--color-background': '#F8F5FF',
            '--color-text': '#2D1B4E',
            '--color-text-light': '#6A4F8B',
            '--color-border': '#E1BEE7',
            '--color-shadow': '74, 20, 140'
        }
    },
    {
        id: 'ocean',
        name: 'Ocean Academy',
        description: 'Deep Learning Waters',
        colors: {
            primary: ['#006064', '#00ACC1'],
            accent: ['#4DD0E1', '#80DEEA'],
            background: '#E0F7FA',
            text: '#00363A',
            textLight: '#00838F',
            border: '#B2EBF2',
            shadow: '0, 96, 100, 0.1'
        },
        cssVariables: {
            '--color-primary-start': '#006064',
            '--color-primary-end': '#00ACC1',
            '--color-accent-start': '#4DD0E1',
            '--color-accent-end': '#80DEEA',
            '--color-background': '#E0F7FA',
            '--color-text': '#00363A',
            '--color-text-light': '#00838F',
            '--color-border': '#B2EBF2',
            '--color-shadow': '0, 96, 100'
        }
    },
    {
        id: 'forest',
        name: 'Forest Wisdom',
        description: 'Ancient Knowledge Grove',
        colors: {
            primary: ['#2E7D32', '#66BB6A'],
            accent: ['#AED581', '#FFE57F'],
            background: '#F1F8E9',
            text: '#1B5E20',
            textLight: '#558B2F',
            border: '#C5E1A5',
            shadow: '46, 125, 50, 0.1'
        },
        cssVariables: {
            '--color-primary-start': '#2E7D32',
            '--color-primary-end': '#66BB6A',
            '--color-accent-start': '#AED581',
            '--color-accent-end': '#FFE57F',
            '--color-background': '#F1F8E9',
            '--color-text': '#1B5E20',
            '--color-text-light': '#558B2F',
            '--color-border': '#C5E1A5',
            '--color-shadow': '46, 125, 50'
        }
    },
    {
        id: 'nebula',
        name: 'Nebula Mind',
        description: 'Cosmic Curiosity',
        colors: {
            primary: ['#1A237E', '#7B1FA2'],
            accent: ['#E91E63', '#FFD54F'],
            background: '#EDE7F6',
            text: '#12005E',
            textLight: '#5E35B1',
            border: '#D1C4E9',
            shadow: '26, 35, 126, 0.1'
        },
        cssVariables: {
            '--color-primary-start': '#1A237E',
            '--color-primary-end': '#7B1FA2',
            '--color-accent-start': '#E91E63',
            '--color-accent-end': '#FFD54F',
            '--color-background': '#EDE7F6',
            '--color-text': '#12005E',
            '--color-text-light': '#5E35B1',
            '--color-border': '#D1C4E9',
            '--color-shadow': '26, 35, 126'
        }
    },
    {
        id: 'sunset',
        name: 'Sunset Scholar',
        description: 'Golden Hour Learning',
        colors: {
            primary: ['#BF360C', '#FF6F00'],
            accent: ['#FFB74D', '#FFD54F'],
            background: '#FFF3E0',
            text: '#3E2723',
            textLight: '#8D6E63',
            border: '#FFCCBC',
            shadow: '191, 54, 12, 0.1'
        },
        cssVariables: {
            '--color-primary-start': '#BF360C',
            '--color-primary-end': '#FF6F00',
            '--color-accent-start': '#FFB74D',
            '--color-accent-end': '#FFD54F',
            '--color-background': '#FFF3E0',
            '--color-text': '#3E2723',
            '--color-text-light': '#8D6E63',
            '--color-border': '#FFCCBC',
            '--color-shadow': '191, 54, 12'
        }
    }
];

export const defaultTheme = themes[0];
