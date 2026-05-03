import { useTheme } from '../../hooks/useTheme';

const FEATURE_ITEMS = [
  {
    title: 'Bold outlines',
    description: 'Clean contours with generous coloring space.',
  },
  {
    title: 'Photo-aware detail',
    description: 'Readable subjects without photographic clutter.',
  },
  {
    title: 'Book-ready flow',
    description: 'Single pages now, full books when you want them.',
  },
] as const;

type HeroPalette = {
  backgroundGradient: string;
  border: string;
  shadow: string;
  gridColor: string;
  paperFill: string;
  paperSoftFill: string;
  paperStroke: string;
  accentFill: string;
  accentStroke: string;
  badgeColor: string;
};

function buildHeroPalette(
  currentTheme: ReturnType<typeof useTheme>['currentTheme'],
  isDarkMode: boolean
): HeroPalette {
  const source =
    isDarkMode && currentTheme.darkColors ? currentTheme.darkColors : currentTheme.colors;
  const primaryStart = source.primary[0];
  const primaryEnd = source.primary[1];
  const accentStart = source.accent[0];
  const accentEnd = source.accent[1];

  return {
    backgroundGradient: `linear-gradient(135deg, ${primaryStart} 0%, ${primaryEnd} 38%, ${accentStart} 72%, ${accentEnd} 100%)`,
    border: 'rgba(255,255,255,0.14)',
    shadow: isDarkMode
      ? '0 24px 60px -42px rgba(0,0,0,0.72)'
      : '0 24px 60px -42px rgba(26,20,18,0.38)',
    gridColor: 'rgba(255,255,255,0.16)',
    paperFill: 'rgba(255,255,255,0.28)',
    paperSoftFill: 'rgba(255,255,255,0.18)',
    paperStroke: 'rgba(255,255,255,0.38)',
    accentFill: 'rgba(255,238,198,0.42)',
    accentStroke: 'rgba(255,232,186,0.56)',
    badgeColor: isDarkMode ? 'rgba(12,10,9,0.74)' : 'rgba(33,25,20,0.68)',
  };
}

export function LifeInColourHeroBand() {
  const { currentTheme, isDarkMode } = useTheme();
  const palette = buildHeroPalette(currentTheme, isDarkMode);

  return (
    <section
      className="relative isolate overflow-hidden rounded-[30px] border px-4 py-6 md:px-5 md:py-7 lg:px-6 lg:py-8"
      style={{
        background: palette.backgroundGradient,
        borderColor: palette.border,
        boxShadow: palette.shadow,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,255,255,0.18),transparent_18%),radial-gradient(circle_at_84%_12%,rgba(255,244,220,0.12),transparent_20%),radial-gradient(circle_at_50%_108%,rgba(0,0,0,0.24),transparent_34%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `linear-gradient(${palette.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${palette.gridColor} 1px, transparent 1px)`,
          backgroundSize: '92px 92px',
        }}
      />

      <div className="pointer-events-none absolute inset-0 opacity-[0.62]">
        <svg
          aria-hidden="true"
          viewBox="0 0 1440 540"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="life-in-colour-hero-panel" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor={palette.paperFill} />
              <stop offset="100%" stopColor={palette.paperSoftFill} />
            </linearGradient>
            <linearGradient id="life-in-colour-hero-highlight" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor={palette.accentFill} />
              <stop offset="100%" stopColor={palette.paperFill} />
            </linearGradient>
            <filter
              id="life-in-colour-hero-soft-shadow"
              x="-12%"
              y="-12%"
              width="124%"
              height="124%"
            >
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="12"
                floodColor="rgba(0,0,0,0.36)"
                floodOpacity="0.16"
              />
            </filter>
          </defs>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M-10 104C78 48 160 38 252 66"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="22"
            />
            <path
              d="M-22 346C68 320 128 288 162 244C198 198 220 182 286 176"
              stroke="rgba(255,236,218,0.14)"
              strokeWidth="18"
            />
            <path
              d="M1132 54C1220 10 1310 6 1440 42"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="20"
            />
            <path
              d="M1128 368C1200 310 1278 282 1444 284"
              stroke="rgba(255,245,228,0.14)"
              strokeWidth="16"
            />
          </g>

          <g>
            <path
              d="M102 56h188c18 0 34 16 34 34v176c0 18-16 34-34 34H102c-18 0-34-16-34-34V90c0-18 16-34 34-34z"
              fill="rgba(255,255,255,0.07)"
              stroke="rgba(255,244,230,0.24)"
              strokeWidth="5"
              transform="rotate(-9 196 158)"
            />
            <path
              d="M108 74h144c14 0 26 12 26 26v132c0 14-12 26-26 26H108c-14 0-26-12-26-26V100c0-14 12-26 26-26z"
              fill="rgba(255,255,255,0.04)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="4"
              transform="rotate(-9 180 148)"
            />
            <path
              d="M136 176l16-36l16 36l36 16l-36 16l-16 36l-16-36l-36-16z"
              fill="url(#life-in-colour-hero-highlight)"
              opacity="0.96"
            />
          </g>

          <g>
            <path
              d="M1096 68h182c16 0 30 14 30 30v198c0 16-14 30-30 30h-182c-16 0-30-14-30-30V98c0-16 14-30 30-30z"
              fill="url(#life-in-colour-hero-panel)"
              stroke={palette.paperStroke}
              strokeWidth="6"
              transform="rotate(12 1187 167)"
              filter="url(#life-in-colour-hero-soft-shadow)"
            />
            <path
              d="M1110 88h150c12 0 22 10 22 22v150c0 12-10 22-22 22h-150c-12 0-22-10-22-22V110c0-12 10-22 22-22z"
              fill="none"
              stroke={palette.accentStroke}
              strokeWidth="4"
              transform="rotate(12 1185 167)"
            />
            <path
              d="M1144 166l14-34l14 34l34 14l-34 14l-14 34l-14-34l-34-14z"
              fill="rgba(255,236,181,0.42)"
            />
          </g>

          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M266 86c22-18 54-28 94-30" stroke="rgba(255,255,255,0.14)" strokeWidth="10" />
            <path d="M1140 78c52-8 102 0 150 22" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
            <path d="M180 382c30 26 52 50 66 74" stroke="rgba(255,244,214,0.08)" strokeWidth="10" />
            <path
              d="M1244 372c32 10 58 28 80 54"
              stroke="rgba(255,244,214,0.08)"
              strokeWidth="10"
            />
            <circle cx="308" cy="86" r="34" fill="rgba(255,255,255,0.06)" stroke="none" />
            <circle cx="328" cy="338" r="48" fill="rgba(255,255,255,0.045)" stroke="none" />
            <circle cx="1216" cy="326" r="50" fill="rgba(255,244,204,0.1)" stroke="none" />
            <circle cx="124" cy="330" r="56" fill="rgba(255,244,204,0.07)" stroke="none" />
          </g>
        </svg>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[220px] max-w-6xl flex-col items-center justify-center px-2 text-center md:min-h-[260px]">
        <div
          className="inline-flex items-center rounded-full border border-black/20 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.75)] md:text-xs"
          style={{ background: palette.badgeColor }}
        >
          Andrew-powered colouring
        </div>
        <h1 className="mt-4 font-heading text-3xl font-bold tracking-[0] text-white sm:text-4xl md:text-6xl lg:text-7xl">
          Life in Colour
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90 md:text-lg md:leading-8">
          Turn single photos or whole camera-roll sets into printable colouring pages.
        </p>

        <div className="mt-6 grid w-full max-w-4xl gap-px overflow-hidden rounded-[24px] border border-white/20 bg-white/[0.16] backdrop-blur-2xl shadow-[0_18px_48px_-36px_rgba(0,0,0,0.45)] md:grid-cols-3">
          {FEATURE_ITEMS.map((item) => (
            <div key={item.title} className="bg-white/[0.12] px-5 py-4 text-left md:px-6 md:py-5">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-6 text-white/80 md:text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
