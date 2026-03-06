/**
 * AppSkeleton — Single unified loading screen for Genesis.
 *
 * Colors are driven by the app's own CSS variables (set on
 * document.documentElement by ThemeContext), so this skeleton
 * automatically matches whatever theme + dark-mode the user has chosen.
 *
 * For the pre-React static skeleton in index.html, a tiny inline script
 * reads localStorage and applies the same variables before first paint.
 */

import type React from 'react';

// ─── Inject shimmer keyframe once ───────────────────────────────────────────
const SHIMMER_CSS = `
@keyframes gs-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.gs-skeleton-light{--gs-shimmer:rgba(255,255,255,0.55)}
.gs-skeleton-dark{--gs-shimmer:rgba(255,255,255,0.05)}
.gs-bone-shimmer{position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,var(--gs-shimmer,rgba(255,255,255,0.35)) 50%,transparent 100%);animation:gs-shimmer 1.6s ease-in-out infinite}
`;
let shimmerInjected = false;
function injectShimmer() {
  if (shimmerInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = SHIMMER_CSS;
  document.head.appendChild(s);
  shimmerInjected = true;
}

// ─── Bone ─────────────────────────────────────────────────────────────────────
// Background uses var(--color-border) — in every theme this sits between the
// surface and background tones, making it the perfect skeleton shade.
const Bone: React.FC<{
  className?: string;
}> = ({ className = '' }) => {
  injectShimmer();
  return (
    <div className={`relative overflow-hidden bg-(--color-border) shrink-0 ${className}`}>
      <div className="gs-bone-shimmer" />
    </div>
  );
};

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NavSkeleton: React.FC = () => (
  <div className="fixed top-0 left-0 right-0 h-16 bg-(--color-surface) border-b border-(--color-border) flex items-center px-4 sm:px-6 z-100">
    {/* Mobile Left */}
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <Bone className="w-8 h-8 rounded-lg" />
      <Bone className="w-20 h-4 rounded-md" />
      <div className="flex-1 sm:hidden" />
      <Bone className="w-8 h-8 rounded-full sm:hidden" />
    </div>

    {/* Desktop middle/right */}
    <div className="hidden sm:flex flex-1 items-center justify-center gap-2">
      <Bone className="w-16 h-7 rounded-full" />
      <Bone className="w-16 h-7 rounded-full" />
      <Bone className="w-16 h-7 rounded-full" />
      <Bone className="w-16 h-7 rounded-full" />
    </div>
    
    <div className="hidden sm:flex items-center">
      <Bone className="w-9 h-9 rounded-full" />
    </div>
  </div>
);

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC = () => (
  <div className="bg-(--color-surface) border border-(--color-border) rounded-2xl p-3.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3 min-w-[132px] sm:min-w-[140px] flex-1 snap-start">
    <div className="flex items-center gap-2 sm:gap-3">
      <Bone className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg" />
      <Bone className="w-16 sm:w-20 h-3 sm:h-4 rounded-sm" />
    </div>
    <Bone className="w-16 sm:w-24 h-6 sm:h-7 rounded-md" />
    <Bone className="w-12 sm:w-16 h-2 sm:h-3 rounded-sm" />
  </div>
);

// ─── Content card ─────────────────────────────────────────────────────────────
const ContentCard: React.FC<{ tall?: boolean }> = ({ tall }) => (
  <div className="bg-(--color-surface) border border-(--color-border) rounded-2xl overflow-hidden flex-1 min-w-0">
    <Bone className={`w-full ${tall ? 'h-32 sm:h-44' : 'h-24 sm:h-36'}`} />
    <div className="p-3 sm:p-4 flex flex-col gap-2.5">
      <Bone className="w-[80%] h-3.5 sm:h-4 rounded-sm" />
      <Bone className="w-[55%] h-2.5 sm:h-3 rounded-sm" />
      <div className="flex gap-2 mt-1 sm:mt-2">
        <Bone className="w-14 sm:w-16 h-6 sm:h-7 rounded-full" />
        <Bone className="w-10 sm:w-12 h-6 sm:h-7 rounded-full" />
      </div>
    </div>
  </div>
);

// ─── Side panel ───────────────────────────────────────────────────────────────
const SidePanel: React.FC = () => (
  <div className="hidden lg:flex bg-(--color-surface) border border-(--color-border) rounded-2xl p-5 w-[260px] flex-col gap-4 shrink-0">
    <Bone className="w-32 h-4 rounded-sm" />
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <Bone className="w-10 h-10 rounded-xl" />
        <div className="flex-1 flex flex-col gap-2">
          <Bone className="w-[70%] h-3 rounded-sm" />
          <Bone className="w-[45%] h-2 rounded-sm" />
        </div>
      </div>
    ))}
  </div>
);

// ─── Hero banner ─────────────────────────────────────────────────────────────
const HeroBanner: React.FC = () => (
  <div className="bg-linear-to-br from-(--color-surface) to-(--color-background) border border-(--color-border) rounded-[20px] sm:rounded-3xl p-4 sm:p-7 flex items-center justify-between gap-3 sm:gap-6">
    <div className="flex flex-col gap-3 flex-1">
      <Bone className="w-24 sm:w-40 h-3 sm:h-4 rounded-sm" />
      <Bone className="w-[80%] sm:w-[55%] h-6 sm:h-8 rounded-md" />
      <Bone className="w-[60%] sm:w-[40%] h-3 sm:h-4 rounded-sm" />
      <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-3">
        <Bone className="w-24 sm:w-32 h-8 sm:h-10 rounded-full" />
        <Bone className="w-20 sm:w-24 h-8 sm:h-10 rounded-full" />
      </div>
    </div>
    <Bone className="hidden sm:block w-[120px] h-[120px] rounded-2xl" />
  </div>
);

// ─── Main export ─────────────────────────────────────────────────────────────
const AppSkeleton: React.FC = () => {
  injectShimmer();
  // Detect dark mode — ThemeContext writes this class synchronously from
  // localStorage in its useState() initialiser, so it's available even on
  // the very first render before any effect runs.
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  return (
    <div
      className={`fixed inset-0 overflow-y-auto bg-(--color-background) font-sans ${
        isDark ? 'gs-skeleton-dark' : 'gs-skeleton-light'
      }`}
    >
      <NavSkeleton />
      <div className="pt-20 sm:pt-24 pb-10 sm:pb-12 px-3 sm:px-6 max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6 w-full">
        <HeroBanner />

        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 sm:pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <StatCard />
          <StatCard />
          <StatCard />
          <StatCard />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start w-full">
          <div className="flex-1 flex flex-col gap-4 sm:gap-5 min-w-0 w-full">
            <div className="flex items-center justify-between">
              <Bone className="w-32 sm:w-40 h-4 sm:h-5 rounded-sm" />
              <Bone className="w-16 sm:w-20 h-7 sm:h-8 rounded-full" />
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 w-full">
              <ContentCard tall />
              <ContentCard tall />
              <div className="hidden md:block">
                <ContentCard tall />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
              <ContentCard />
              <ContentCard />
            </div>
          </div>

          <SidePanel />
        </div>
      </div>
    </div>
  );
};

export default AppSkeleton;

