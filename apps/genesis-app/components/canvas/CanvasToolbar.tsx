import { memo } from 'react'
import { Minus, Plus, Maximize2, Map } from 'lucide-react'

const F = {
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
}

interface CanvasToolbarProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onToggleMinimap: () => void
  onAddScene: () => void
  minimapVisible: boolean
}

function CanvasToolbarInner({
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleMinimap,
  onAddScene,
  minimapVisible,
}: CanvasToolbarProps) {
  const ghostBtn =
    'flex items-center justify-center rounded-md border-none bg-transparent cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40'

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '8px 16px',
        boxShadow: '0 2px 8px rgba(var(--color-shadow), 0.06)',
        height: 44,
        zIndex: 10,
      }}
    >
      {/* Zoom Out */}
      <button
        type="button"
        onClick={onZoomOut}
        className={ghostBtn}
        style={{ width: 32, height: 32, color: 'var(--color-text-light)' }}
        title="Zoom out"
        aria-label="Zoom out"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-primary-start)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-light)'
        }}
      >
        <Minus style={{ width: 16, height: 16 }} />
      </button>

      {/* Fit View */}
      <button
        type="button"
        onClick={onFitView}
        className={ghostBtn}
        style={{
          fontFamily: F.sans,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-light)',
          padding: '4px 8px',
          height: 32,
        }}
        title="Fit to view"
        aria-label="Fit to view"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-primary-start)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-light)'
        }}
      >
        <Maximize2 style={{ width: 14, height: 14, marginRight: 4 }} />
        Fit
      </button>

      {/* Zoom In */}
      <button
        type="button"
        onClick={onZoomIn}
        className={ghostBtn}
        style={{ width: 32, height: 32, color: 'var(--color-text-light)' }}
        title="Zoom in"
        aria-label="Zoom in"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-primary-start)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-light)'
        }}
      >
        <Plus style={{ width: 16, height: 16 }} />
      </button>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 20,
          background: 'var(--color-border)',
          margin: '0 4px',
        }}
      />

      {/* Minimap Toggle */}
      <button
        type="button"
        onClick={onToggleMinimap}
        className={ghostBtn}
        style={{
          width: 32,
          height: 32,
          color: minimapVisible
            ? 'var(--color-primary-start)'
            : 'var(--color-text-light)',
        }}
        title={minimapVisible ? 'Hide minimap' : 'Show minimap'}
        aria-label={minimapVisible ? 'Hide minimap' : 'Show minimap'}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-primary-start)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = minimapVisible
            ? 'var(--color-primary-start)'
            : 'var(--color-text-light)'
        }}
      >
        <Map style={{ width: 16, height: 16 }} />
      </button>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 20,
          background: 'var(--color-border)',
          margin: '0 4px',
        }}
      />

      {/* Add Scene */}
      <button
        type="button"
        onClick={onAddScene}
        style={{
          fontFamily: F.sans,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-background)',
          background: 'var(--color-primary-start)',
          border: 'none',
          borderRadius: 6,
          padding: '4px 12px',
          height: 32,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          transition: 'opacity 150ms ease',
          outline: 'none',
        }}
        className="focus-visible:ring-2 focus-visible:ring-white/50"
        title="Add a new scene"
        aria-label="Add a new scene"
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
      >
        <Plus style={{ width: 14, height: 14 }} />
        Add Scene
      </button>
    </div>
  )
}

export const CanvasToolbar = memo(CanvasToolbarInner)
export default CanvasToolbar
