import { memo, useCallback, useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SceneNodeData } from '../../lib/canvas/canvasTypes'
import { Edit3, GripVertical, ImageIcon } from 'lucide-react'

const F = {
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
}

function SceneNodeInner({ data, selected }: NodeProps) {
  const {
    pageNumber,
    text,
    imageUrl,
    imagePrompt,
    isImageOutdated,
    onEdit,
  } = data as SceneNodeData

  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setMounted(true)
      return
    }
    const delay = (pageNumber - 1) * 60
    const timer = setTimeout(() => setMounted(true), delay)
    return () => clearTimeout(timer)
  }, [pageNumber])

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      ;(onEdit as (n: number) => void)(pageNumber as number)
    },
    [onEdit, pageNumber]
  )

  const truncatedText =
    typeof text === 'string' && (text as string).length > 80
      ? `${(text as string).slice(0, 80)}…`
      : (text as string) || ''

  const hasImage = Boolean(imageUrl) && !imageError

  return (
    <div
      className="group"
      style={{
        width: 240,
        height: 300,
        borderRadius: 12,
        overflow: 'hidden',
        border: selected
          ? '2px solid var(--color-primary-start)'
          : '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: selected
          ? '0 0 0 1px var(--color-primary-start), 0 0 20px 4px rgba(var(--color-shadow), 0.3)'
          : '0 2px 8px rgba(var(--color-shadow), 0.08)',
        transition: 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1), border-color 200ms ease, box-shadow 200ms ease, opacity 350ms ease-out',
        transform: mounted ? 'scale(1)' : 'scale(0.92)',
        opacity: mounted ? 1 : 0,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          const el = e.currentTarget
          el.style.transform = 'translateY(-4px) scale(1)'
          el.style.borderColor = 'var(--color-primary-start)'
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.transform = 'scale(1)'
        if (!selected) {
          el.style.borderColor = 'var(--color-border)'
        }
      }}
    >
      {/* Target Handle — top center */}
      <Handle
        type="target"
        position={Position.Top}
        className="genesis-handle"
        style={{ top: -5, left: '50%', transform: 'translateX(-50%)' }}
      />

      {/* Header Bar — 32px */}
      <div
        style={{
          height: 32,
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: F.sans,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-primary-start)',
            background: 'color-mix(in srgb, var(--color-primary-start) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-primary-start) 40%, transparent)',
            padding: '3px 8px',
            borderRadius: 999,
            lineHeight: 1,
          }}
        >
          P{pageNumber as number}
        </span>

        {isImageOutdated && (
          <span
            style={{
              fontFamily: F.sans,
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--color-primary-end)',
              background: 'color-mix(in srgb, var(--color-primary-end) 15%, transparent)',
              padding: '2px 6px',
              borderRadius: 999,
              lineHeight: 1,
            }}
          >
            Outdated
          </span>
        )}
      </div>

      {/* Image Area — 160px */}
      <div
        style={{
          height: 160,
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--color-background)',
        }}
      >
        {hasImage ? (
          <>
            {!imageLoaded && (
              <div
                className="genesis-shimmer-bg"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(90deg, var(--color-surface) 0%, var(--color-background) 50%, var(--color-surface) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'genesis-shimmer 1.5s ease-in-out infinite',
                }}
              />
            )}
            <img
              src={imageUrl as string}
              alt={`Page ${pageNumber} illustration`}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 300ms ease',
              }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              draggable={false}
            />
          </>
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <ImageIcon
              style={{ width: 24, height: 24, color: 'var(--color-text-light)', opacity: 0.5 }}
            />
            <span style={{ fontFamily: F.sans, fontSize: 11, color: 'var(--color-text-light)' }}>
              Not yet illustrated
            </span>
          </div>
        )}
      </div>

      {/* Text Area — 76px */}
      <div style={{ height: 76, padding: '8px 10px', overflow: 'hidden', flexShrink: 0 }}>
        <p
          style={{
            fontFamily: F.sans,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--color-text-light)',
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {truncatedText}
        </p>
      </div>

      {/* Action Bar — 32px */}
      <div
        style={{
          height: 32,
          padding: '0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={handleEdit}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
          style={{
            fontFamily: F.sans,
            fontSize: 12,
            color: 'var(--color-text-light)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary-start)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-light)' }}
          aria-label={`Edit page ${pageNumber}`}
        >
          <Edit3 style={{ width: 12, height: 12 }} />
          Edit
        </button>
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-light)', opacity: 0.5 }}>
          <GripVertical style={{ width: 14, height: 14 }} />
        </span>
      </div>

      {/* Source Handle — bottom center */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="genesis-handle"
        style={{ bottom: -5, left: '50%', transform: 'translateX(-50%)' }}
      />
    </div>
  )
}

export const SceneNode = memo(SceneNodeInner)
export default SceneNode
