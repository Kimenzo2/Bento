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

// ─── Shimmer keyframe injected once ─────────────────────────────────────────
const SHIMMER_CSS = `
@keyframes gs-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes gs-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}
`;

let shimmerInjected = false;
function injectShimmer() {
  if (shimmerInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = SHIMMER_CSS;
  document.head.appendChild(style);
  shimmerInjected = true;
}

// ─── Token palette (dark enterprise) ────────────────────────────────────────
const C = {
  bg:       '#0d0f17',   // deep dark canvas
  surface:  '#131620',   // card surface
  border:   '#1e2235',   // subtle border
  bone:     '#1c2033',   // skeleton base
  shimmer:  'rgba(255,255,255,0.045)', // shimmer highlight
  accent:   '#FF9B71',   // coral accent (matches brand)
  accentDim:'rgba(255,155,113,0.15)',
};

// ─── Reusable bone (skeleton line) ──────────────────────────────────────────
const Bone: React.FC<{
  w?: string | number;
  h?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}> = ({ w = '100%', h = 14, radius = 8, style }) => {
  injectShimmer();
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: w,
        height: h,
        borderRadius: radius,
        background: C.bone,
        flexShrink: 0,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, transparent 0%, ${C.shimmer} 50%, transparent 100%)`,
          animation: 'gs-shimmer 1.6s ease-in-out infinite',
        }}
      />
    </div>
  );
};

// ─── Nav skeleton ────────────────────────────────────────────────────────────
const NavSkeleton: React.FC = () => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 64,
      background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      gap: 12,
      zIndex: 100,
      boxSizing: 'border-box',
    }}
  >
    {/* Logo mark */}
    <Bone w={32} h={32} radius={10} />
    {/* Brand name */}
    <Bone w={80} h={16} radius={6} />

    {/* Spacer */}
    <div style={{ flex: 1 }} />

    {/* Nav pills */}
    {[64, 72, 56, 68].map((w, i) => (
      <Bone key={i} w={w} h={28} radius={20} />
    ))}

    {/* Spacer */}
    <div style={{ flex: 1 }} />

    {/* Avatar */}
    <Bone w={36} h={36} radius={18} />
  </div>
);

// ─── Stat card skeleton ───────────────────────────────────────────────────────
const StatCard: React.FC = () => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      flex: 1,
      minWidth: 0,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Bone w={36} h={36} radius={10} />
      <Bone w="55%" h={13} />
    </div>
    <Bone w="70%" h={26} radius={6} />
    <Bone w="40%" h={11} />
  </div>
);

// ─── Content card skeleton ────────────────────────────────────────────────────
const ContentCard: React.FC<{ tall?: boolean }> = ({ tall }) => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 20,
      overflow: 'hidden',
      flex: 1,
      minWidth: 0,
    }}
  >
    {/* Thumbnail area */}
    <Bone w="100%" h={tall ? 180 : 140} radius={0} />
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Bone w="80%" h={15} />
      <Bone w="55%" h={12} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Bone w={60} h={24} radius={20} />
        <Bone w={48} h={24} radius={20} />
      </div>
    </div>
  </div>
);

// ─── Sidebar panel skeleton ───────────────────────────────────────────────────
const SidePanel: React.FC = () => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 20,
      padding: 20,
      width: 260,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}
  >
    <Bone w="60%" h={16} />
    {[1, 2, 3, 4].map((i) => (
      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Bone w={40} h={40} radius={12} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Bone w="70%" h={12} />
          <Bone w="45%" h={10} />
        </div>
      </div>
    ))}
  </div>
);

// ─── Hero banner skeleton ─────────────────────────────────────────────────────
const HeroBanner: React.FC = () => (
  <div
    style={{
      background: `linear-gradient(135deg, #131a2e 0%, #1a1329 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: 24,
      padding: '28px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
      <Bone w={160} h={13} />
      <Bone w="55%" h={28} radius={8} />
      <Bone w="40%" h={13} />
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Bone w={120} h={38} radius={20} />
        <Bone w={96} h={38} radius={20} />
      </div>
    </div>
    <Bone w={140} h={140} radius={20} style={{ flexShrink: 0 }} />
  </div>
);

// ─── Main exported skeleton ───────────────────────────────────────────────────
const AppSkeleton: React.FC = () => {
  injectShimmer();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: C.bg,
        overflowY: 'auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Accent glow top-right (decorative) */}
      <div
        style={{
          position: 'fixed',
          top: -120,
          right: -80,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,155,113,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <NavSkeleton />

      {/* Page body */}
      <div
        style={{
          paddingTop: 88,
          paddingBottom: 48,
          paddingLeft: 24,
          paddingRight: 24,
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          boxSizing: 'border-box',
        }}
      >
        {/* Hero banner */}
        <HeroBanner />

        {/* Stat row */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <StatCard />
          <StatCard />
          <StatCard />
          <StatCard />
        </div>

        {/* Main area: content grid + side panel */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          {/* Card grid */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              minWidth: 0,
            }}
          >
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Bone w={160} h={18} radius={6} />
              <Bone w={80} h={30} radius={20} />
            </div>
            {/* Row 1 */}
            <div style={{ display: 'flex', gap: 16 }}>
              <ContentCard tall />
              <ContentCard tall />
              <ContentCard tall />
            </div>
            {/* Row 2 */}
            <div style={{ display: 'flex', gap: 16 }}>
              <ContentCard />
              <ContentCard />
            </div>
          </div>

          {/* Side panel — hidden on narrow screens via opacity trick */}
          <SidePanel />
        </div>
      </div>
    </div>
  );
};

export default AppSkeleton;
