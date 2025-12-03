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
                heading: ['var(--font-heading)', 'sans-serif'],
                body: ['var(--font-body)', 'sans-serif'],
            },
            colors: {
                cream: {
                    base: '#FFF8E7',
                    soft: '#FFFCF5'
                },
                peach: {
                    soft: '#FFE4CC',
                    light: '#FFF0E0'
                },
                yellow: {
                    butter: '#FFF4A3'
                },
                mint: {
                    breeze: '#D4F4DD'
                },
                coral: {
                    burst: '#FF9B71',
                    hover: '#E88A60'
                },
                gold: {
                    sunshine: '#FFD93D'
                },
                charcoal: {
                    soft: '#5A5A5A'
                },
                cocoa: {
                    light: '#8B7E74',
                    dark: '#6B5E54'
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
                'float': 'float 6s ease-in-out infinite',
                'fadeIn': 'fadeIn 0.5s ease-out',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        }
    },
    plugins: [],
}
