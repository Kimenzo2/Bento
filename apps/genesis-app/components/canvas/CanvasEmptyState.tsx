import { memo } from 'react'
import { Pen } from 'lucide-react'

const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
}

const GEN_IMAGE_PATH = '/images/onboarding/Style_directive_highend_202512150033.jpeg'

interface CanvasEmptyStateProps {
  onStartWriting: () => void
}

function CanvasEmptyStateInner({ onStartWriting }: CanvasEmptyStateProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 400,
          textAlign: 'center',
          pointerEvents: 'auto',
        }}
      >
        {/* Gen — ambient floating */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            overflow: 'hidden',
            marginBottom: 24,
            boxShadow:
              '0 0 40px 8px rgba(var(--color-shadow), 0.35), 0 0 80px 16px rgba(var(--color-shadow), 0.15)',
            animation: 'genesis-gen-float 4s ease-in-out infinite',
          }}
        >
          <img
            src={GEN_IMAGE_PATH}
            alt="Gen, your AI creative assistant"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            draggable={false}
          />
        </div>

        {/* Heading */}
        <h2
          style={{
            fontFamily: F.serif,
            fontSize: 24,
            lineHeight: 1.3,
            color: 'var(--color-text)',
            margin: '0 0 12px 0',
          }}
        >
          Your story doesn&rsquo;t have any scenes yet
        </h2>

        {/* Body */}
        <p
          style={{
            fontFamily: F.sans,
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--color-text-light)',
            margin: '0 0 24px 0',
          }}
        >
          Go to Pages view to start writing and generating your story.
          Once you have scenes, they&rsquo;ll appear here as illustrated cards.
        </p>

        {/* CTA */}
        <button
          onClick={onStartWriting}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40 active:scale-[0.98]"
          style={{
            fontFamily: F.sans,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-background)',
            background: 'var(--color-primary-start)',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          aria-label="Start writing your story"
        >
          <Pen style={{ width: 14, height: 14 }} />
          Start Writing
        </button>
      </div>
    </div>
  )
}

export const CanvasEmptyState = memo(CanvasEmptyStateInner)
export default CanvasEmptyState
