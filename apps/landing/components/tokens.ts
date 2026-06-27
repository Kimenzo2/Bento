// ──────────────────────────────────────────────────────────────────────────────
// LANDING PAGE DESIGN SYSTEM — Read before adding or modifying any element
// ──────────────────────────────────────────────────────────────────────────────
//
// BUTTON RULE (mandatory):
// ALL buttons, CTA links, pill badges, and interactive <a> elements on the
// Landing Page MUST use these exact attributes and style primitives:
//
//   data-slot="button"
//   className="btn-accent"  // only for primary/accent actions (e.g. Download)
//   style={{
//     display: 'inline-flex',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: '8px',
//     whiteSpace: 'nowrap',
//     fontSize: '0.875rem',
//     fontWeight: 500,
//     height: '36px',       // primary actions; secondary nav buttons use 28px
//     borderRadius: '0.75rem',
//     padding: '0 18px',    // secondary nav buttons use 12px
//     background: tokens.accent,  // primary OR 'rgba(255,255,255,0.06)' for ghost
//     color: tokens.bg,           // primary OR 'rgba(220,224,230,0.8)' for ghost
//     border: 'none',
//     cursor: 'pointer',
//     textDecoration: 'none',
//     transition: 'color 0.15s ease, box-shadow 0.15s ease',
//   }}
//
// Hover is handled globally via `[data-slot="button"]:hover` and
// `.btn-accent:hover` in globals.css — do NOT override manually.
//
// NO pill shapes (border-radius: 100px), NO shadows, NO borders.
// Beauty comes from layout, spacing, typography, and color.
//
//
// CARD RULE (mandatory):
// ALL card containers, feature panels, info boxes, and content tiles on
// the Landing Page MUST use these exact style primitives:
//
//   style={{
//     flex: '1',
//     borderRadius: '1.5rem',
//     background: tokens.elevated,
//     padding: '12px 16px',
//   }}
//
// Inner structure (icon, title, description):
//   <div aria-hidden="true">[icon/SVG]</div>
//   <h3 style={{ marginTop: '5rem', fontSize: '1.125rem', fontWeight: 500, ... }}>Title</h3>
//   <p style={{ maxWidth: '80%', fontSize: '0.875rem', lineHeight: 1.5, ... }}>Description</p>
//
// The large marginTop (5rem / 80px) on the title creates the premium editorial
// breathing room between the icon and text — this is intentional.
// Description text wraps at 80% of card width for asymmetric elegance.
//
// NO borders on cards. NO shadows on cards. NO glassmorphism.
// ──────────────────────────────────────────────────────────────────────────────

export const tokens = {
  accent: '#7a9bb5',
  accentHover: '#8fb0ca',
  accentGlow: 'rgba(122, 155, 181, 0.1)',
  accentLine: 'rgba(122, 155, 181, 0.2)',
  accentBg: 'rgba(122, 155, 181, 0.04)',

  bg: '#0c0b0a',
  surface: '#141315',
  elevated: '#1b1c1d',
  highlight: '#242527',

  ink: '#dce0e6',
  inkMuted: '#90959e',
  inkFaint: '#5e626a',

  fontFamily: '"universalSans", var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontFamilyDisplay: 'var(--font-dm-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',

  heroSize: 'clamp(2.4rem, 5vw, 4rem)',
  headingSize: 'clamp(1.5rem, 2.8vw, 2rem)',
  subheadSize: '1.05rem',
  bodySize: '1rem',
  smallSize: '0.875rem',
  labelSize: '0.75rem',

  sectionPad: 'clamp(5rem, 10vw, 8rem)',
  contentMax: '1040px',
  textMax: '620px',
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
