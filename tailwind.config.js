/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./contexts/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    // Tailwind v4 uses CSS-first configuration
    // Most theme customizations should be in index.css using @theme
    theme: {
        screens: {
            'xs': '475px',
            'sm': '640px',
            'md': '768px',
            'lg': '1024px',
            'xl': '1280px',
            '2xl': '1536px',
        },
        extend: {
            fontFamily: {
                heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
                body: ['var(--font-body)', 'system-ui', 'sans-serif'],
            },
            colors: {
                cream: {
                    base: 'var(--color-background)',
                    soft: 'var(--color-background)'
                },
                peach: {
                    soft: 'var(--color-border)',
                    light: 'var(--color-border)'
                },
                yellow: {
                    butter: '#FFF4A3'
                },
                mint: {
                    breeze: '#D4F4DD'
                },
                coral: {
                    burst: 'var(--color-primary-start)',
                    hover: 'var(--color-primary-end)'
                },
                gold: {
                    sunshine: 'var(--color-primary-end)'
                },
                charcoal: {
                    soft: 'var(--color-text)'
                },
                cocoa: {
                    light: 'var(--color-text-light)',
                    dark: 'var(--color-text)'
                }
            },
            boxShadow: {
                'soft-sm': '0 2px 10px rgba(0, 0, 0, 0.06)',
                'soft-md': '0 4px 20px rgba(0, 0, 0, 0.08)',
                'soft-lg': '0 8px 32px rgba(0, 0, 0, 0.12)',
                'glow': '0 0 15px rgba(255, 217, 61, 0.5)'
            },
            borderRadius: {
                'xl': '1rem',
                '2xl': '1.25rem',
                '3xl': '1.5rem',
                'pill': '9999px',
            },
            animation: {
                'float': 'float 8s ease-in-out infinite',
                'fadeIn': 'fadeIn 0.5s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'bounce-subtle': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-3px)' },
                }
            },
            // Modern backdrop blur values
            backdropBlur: {
                xs: '2px',
            },
            // Container queries support
            containers: {
                'xs': '20rem',
                'sm': '24rem',
                'md': '28rem',
                'lg': '32rem',
                'xl': '36rem',
            }
        }
    },
    // Enable future CSS features
    future: {
        hoverOnlyWhenSupported: true,
    },
    plugins: [],
}
