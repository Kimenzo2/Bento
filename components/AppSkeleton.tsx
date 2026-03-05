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
const SHIMMER_CSS = `@keyframes gs-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`;
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
  w?: string | number;
  h?: string | number;
  r?: number;
  style?: React.CSSProperties;
}> = ({ w = '100%', h = 14, r = 8, style }) => {
  injectShimmer();
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: w,
        height: h,
        borderRadius: r,
        background: 'var(--color-border)',
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          // --gs-shimmer is set per-render on the root wrapper based on dark/light
          background: 'linear-gradient(90deg,transparent 0%,var(--gs-shimmer,rgba(255,255,255,0.35)) 50%,transparent 100%)',
          animation: 'gs-shimmer 1.6s ease-in-out infinite',
        }}
      />
    </div>
  );
};

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NavSkeleton: React.FC = () => (
  <div
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 64,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 12, zIndex: 100, boxSizing: 'border-box',
    }}
  >
    <Bone w={32} h={32} r={10} />
    <Bone w={80} h={16} r={6} />
    <div style={{ flex: 1 }} />
    {[64, 72, 56, 68].map((w, i) => <Bone key={i} w={w} h={28} r={20} />)}
    <div style={{ flex: 1 }} />
    <Bone w={36} h={36} r={18} />
  </div>
);

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC = () => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Bone w={36} h={36} r={10} />
      <Bone w="55%" h={13} />
    </div>
    <Bone w="70%" h={26} r={6} />
    <Bone w="40%" h={11} />
  </div>
);

// ─── Content card ─────────────────────────────────────────────────────────────
const ContentCard: React.FC<{ tall?: boolean }> = ({ tall }) => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, overflow: 'hidden', flex: 1, minWidth: 0 }}>
    <Bone w="100%" h={tall ? 180 : 140} r={0} />
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Bone w="80%" h={15} />
      <Bone w="55%" h={12} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Bone w={60} h={24} r={20} />
        <Bone w={48} h={24} r={20} />
      </div>
    </div>
  </div>
);

// ─── Side panel ───────────────────────────────────────────────────────────────
const SidePanel: React.FC = () => (
  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: 20, width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Bone w="60%" h={16} />
    {[1, 2, 3, 4].map((i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Bone w={40} h={40} r={12} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Bone w="70%" h={12} />
          <Bone w="45%" h={10} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Hero banner ─────────────────────────────────────────────────────────────
const HeroBanner: React.FC = () => (
  <div
    style={{
      background: 'linear-gradient(135deg,var(--color-surface) 0%,var(--color-background) 100%)',
      border: '1px solid var(--color-border)',
      borderRadius: 24, padding: '28px 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      <Bone w={160} h={13} />
      <Bone w="55%" h={28} r={8} />
      <Bone w="40%" h={13} />
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Bone w={120} h={38} r={20} />
        <Bone w={96} h={38} r={20} />
      </div>
    </div>
    <Bone w={140} h={140} r={20} style={{ flexShrink: 0 }} />
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
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--color-background)',
        overflowY: 'auto',
        fontFamily: 'system-ui, sans-serif',
        // Shimmer highlight intensity: subtle in dark, bright in light
        ['--gs-shimmer' as string]: isDark
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.55)',
      }}
    >
      <NavSkeleton />
      <div
        style={{
          paddingTop: 88, paddingBottom: 48, paddingLeft: 24, paddingRight: 24,
          maxWidth: 1280, margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: 24,
          boxSizing: 'border-box',
        }}
      >
        <HeroBanner />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatCard /><StatCard /><StatCard /><StatCard />
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Bone w={160} h={18} r={6} />
              <Bone w={80} h={30} r={20} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <ContentCard tall /><ContentCard tall /><ContentCard tall />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <ContentCard /><ContentCard />
            </div>
          </div>
          <SidePanel />
        </div>
      </div>
    </div>
  );
};

export default AppSkeleton;
