/**
 * Bento Landing — Design Tokens
 *
 * Warm earthy palette — muted terracotta, cream, sage.
 * No orange. No cold whites. Everything intentional.
 */

export const tokens = {
  // Brand accent — muted terracotta, warm and grounded
  accent: '#b85c3a',
  accentLight: '#efe0d4',
  accentMid: '#d47a55',

  // Secondary accent — soft sage for balance and variety
  accentSecondary: '#7c8e6e',
  accentSecondaryLight: '#e2e8db',

  // Tertiary accent — dusty violet, used sparingly for highlights
  accentViolet: '#8c7cc7',
  accentVioletLight: '#ece7f7',
  heroHighlight: 'linear-gradient(135deg, #b85c3a 0%, #8c7cc7 100%)',

  // Neutrals — warm ivory/cream family
  ink: '#2c2418',
  inkMuted: '#6b5e53',
  inkFaint: '#9c8e80',
  surface: '#fefcf8',
  surfaceAlt: '#fcf7f0',
  surfaceWarm: '#f7efe4',

  // Font
  fontFamily: "'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  // Type scale (rem)
  heroSize: 'clamp(2.6rem, 5.5vw, 4.2rem)',
  headingSize: 'clamp(1.6rem, 3vw, 2.2rem)',
  subheadSize: '1.1rem',
  bodySize: '1rem',
  smallSize: '0.875rem',
  labelSize: '0.75rem',

  // Spacing rhythm
  sectionPad: 'clamp(4rem, 8vw, 7rem)',
  contentMax: '1100px',
  textMax: '640px',

  // Gradients — visible warmth for section backgrounds
  heroGradient: 'linear-gradient(180deg, #f7efe4 0%, #fcf7f0 30%, #fefcf8 70%, #fefcf8 100%)',
  warmGradient: 'linear-gradient(180deg, #fefcf8 0%, #fcf7f0 100%)',
  sandGradient: 'linear-gradient(180deg, #fcf7f0 0%, #f7efe4 100%)',
} as const;

/**
 * The 12 apps inside Bento.
 */
export const bentoApps = [
  { name: 'Mood', emoji: '😌', desc: 'Check in with how you feel. Spot the patterns.' },
  { name: 'Focus', emoji: '⏱️', desc: 'Pomodoro timer with session history.' },
  { name: 'Habits', emoji: '🔁', desc: 'Build streaks, one day at a time.' },
  { name: 'Sleep', emoji: '🌙', desc: 'Log your sleep and see what changes it.' },
  { name: 'Nutrition', emoji: '🥗', desc: 'Track meals without the obsession.' },
  { name: 'Budget', emoji: '💰', desc: 'Know where your money actually goes.' },
  { name: 'Tasks', emoji: '✅', desc: 'Capture, prioritise, and finish things.' },
  { name: 'Recipes', emoji: '🍳', desc: 'Cook from a library that remembers what you liked.' },
  { name: 'Countdown', emoji: '📅', desc: 'Count down to — and since — the things that matter.' },
  { name: 'Password Vault', emoji: '🔐', desc: 'One place for all your credentials. Offline.' },
  { name: 'Notes', emoji: '📝', desc: 'Quick thoughts, long ideas. All in one drawer.' },
  { name: 'AI Chat', emoji: '✨', desc: 'A calm, private AI companion — always on hand.' },
] as const;
