export const tokens = {
  accent: '#c49a6c',
  accentHover: '#d4aa7a',
  accentGlow: 'rgba(196, 154, 108, 0.12)',
  accentLine: 'rgba(196, 154, 108, 0.25)',

  accentSecondary: '#7c8f72',
  accentSecondaryGlow: 'rgba(124, 143, 114, 0.12)',

  accentTertiary: '#937b9e',
  accentTertiaryGlow: 'rgba(147, 123, 158, 0.12)',

  bg: '#131211',
  surface: '#1c1917',
  elevated: '#242120',
  highlight: '#2d2926',

  ink: '#e6e0d6',
  inkMuted: '#9e9589',
  inkFaint: '#6b645b',

  fontFamily: "'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  heroSize: 'clamp(2.6rem, 5.5vw, 4.2rem)',
  headingSize: 'clamp(1.6rem, 3vw, 2.2rem)',
  subheadSize: '1.1rem',
  bodySize: '1rem',
  smallSize: '0.875rem',
  labelSize: '0.75rem',

  sectionPad: 'clamp(4rem, 8vw, 7rem)',
  contentMax: '1100px',
  textMax: '640px',

  heroGradient: 'linear-gradient(180deg, #131211 0%, #1c1917 50%, #131211 100%)',
  sectionGradient: 'linear-gradient(180deg, #1c1917 0%, #131211 100%)',
} as const;

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
