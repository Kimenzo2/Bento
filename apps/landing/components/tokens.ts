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
  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  accentLine: 'var(--color-accent-line)',
  accentBg: 'var(--color-accent-bg)',

  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  elevated: 'var(--color-elevated)',
  highlight: 'var(--color-highlight)',

  ink: 'var(--color-ink)',
  inkMuted: 'var(--color-ink-muted)',
  inkFaint: 'var(--color-ink-faint)',

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
  {
    name: 'Dashboard',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="4" rx="1.5"/><rect x="3" y="12" width="7" height="9" rx="1.5"/><rect x="14" y="9" width="7" height="12" rx="1.5"/></svg>',
    desc: 'Recent work, quick actions, and your day at a glance.',
  },
  {
    name: 'Notes',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M7 8h10"/><path d="M7 12h7"/><path d="M7 16h4"/></svg>',
    desc: 'Rich notes that live alongside everything else.',
  },
  {
    name: 'Journal',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M7 4v16"/><path d="M12 8l2 2-2 2"/></svg>',
    desc: 'Daily prompts, photo attachments, private recaps.',
  },
  {
    name: 'Tasks',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12l3 3 5-5"/></svg>',
    desc: 'Natural language capture. Recurring work. Done.',
  },
  {
    name: 'Voice Memos',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0014 0v-1"/><path d="M12 19v3"/><path d="M8 22h8"/></svg>',
    desc: 'One tap record. Transcribed and searchable.',
  },
  {
    name: 'Focus',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    desc: 'Pomodoro sessions with ambient modes and history.',
  },
  {
    name: 'Habits',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>',
    desc: 'Streaks, heatmaps, and review summaries.',
  },
  {
    name: 'Mood',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/></svg>',
    desc: 'One tap checkins. Patterns over time.',
  },
  {
    name: 'Goals',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
    desc: 'Long term milestones with accountability checkins.',
  },
  {
    name: 'Clipboard',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/></svg>',
    desc: 'History, snippets, images. Nothing lost.',
  },
  {
    name: 'Sleep',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 12a7 7 0 01-7-7 7 7 0 1014 0 7 7 0 01-7 7z"/><path d="M21 12v3"/><path d="M19 15h4"/></svg>',
    desc: 'Scores, smart alarms, and weekly trends.',
  },
  {
    name: 'Health',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-2.5 2-5 2-7a6 6 0 00-12 0c0 2 1 4.5 2 7"/><path d="M12 6v4"/><path d="M10 8h4"/><path d="M4 22l4-8h3l-2 6h3l-4 8"/></svg>',
    desc: 'Workouts, body metrics, and progress tracking.',
  },
  {
    name: 'Nutrition',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 9a4 4 0 008 0"/><circle cx="12" cy="15" r="6"/></svg>',
    desc: 'Meals, macros, hydration all in one log.',
  },
  {
    name: 'Budget',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>',
    desc: 'Transactions, categories, and forecasts.',
  },
  {
    name: 'Passwords',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>',
    desc: 'Local first vault with passkeys and breach alerts.',
  },
  {
    name: 'Countdown',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/><path d="M8 18h.01"/></svg>',
    desc: 'Events, milestones, birthdays, days since.',
  },
  {
    name: 'Settings',
    icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>',
    desc: 'Theme, preferences, and shell wide controls.',
  },
] as const;
