import { memo, useCallback, useEffect, useRef } from 'react'
import type { Page } from '../../types'
import type { SceneNodeData } from '../../lib/canvas/canvasTypes'
import { ChevronLeft, ChevronRight, Edit3, ImageIcon, X } from 'lucide-react'

const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
}

interface SceneNodeDetailProps {
  data: SceneNodeData
  totalPages: number
  allPages: Page[]
  onClose: () => void
  onEdit: (pageNumber: number) => void
  onNavigate: (pageNumber: number) => void
}

function SceneNodeDetailInner({
  data,
  totalPages,
  allPages,
  onClose,
  onEdit,
  onNavigate,
}: SceneNodeDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const pageNumber = data.pageNumber as number

  // Slide-in animation
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      el.style.transform = 'translateX(0)'
      return
    }
    el.style.transform = 'translateX(360px)'
    requestAnimationFrame(() => {
      el.style.transition = 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1)'
      el.style.transform = 'translateX(0)'
    })
  }, [data.pageId])

  const handleEdit = useCallback(() => {
    onEdit(pageNumber)
  }, [onEdit, pageNumber])

  const handlePrev = useCallback(() => {
    if (pageNumber > 1) {
      const prevPage = allPages.find((p) => p.pageNumber === pageNumber - 1)
      if (prevPage) onNavigate(prevPage.pageNumber)
    }
  }, [pageNumber, allPages, onNavigate])

  const handleNext = useCallback(() => {
    if (pageNumber < totalPages) {
      const nextPage = allPages.find((p) => p.pageNumber === pageNumber + 1)
      if (nextPage) onNavigate(nextPage.pageNumber)
    }
  }, [pageNumber, totalPages, allPages, onNavigate])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 360,
        height: '100%',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        boxShadow: '-8px 0 24px rgba(var(--color-shadow), 0.12)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* Header — 48px */}
      <div
        style={{
          height: 48,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={onClose}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderRadius: 6,
            color: 'var(--color-text-light)',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-primary-start)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-light)'
          }}
          title="Close detail panel"
          aria-label="Close detail panel"
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
        <span
          style={{
            fontFamily: F.sans,
            fontSize: 13,
            color: 'var(--color-text-light)',
          }}
        >
          Page {pageNumber} of {totalPages}
        </span>
      </div>

      {/* Image — 200px */}
      <div
        style={{
          height: 200,
          flexShrink: 0,
          overflow: 'hidden',
          background: 'var(--color-background)',
        }}
      >
        {data.imageUrl ? (
          <img
            src={data.imageUrl as string}
            alt={`Page ${pageNumber} illustration`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            draggable={false}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <ImageIcon
              style={{
                width: 32,
                height: 32,
                color: 'var(--color-text-light)',
                opacity: 0.4,
              }}
            />
            <span
              style={{
                fontFamily: F.sans,
                fontSize: 12,
                color: 'var(--color-text-light)',
              }}
            >
              Not yet illustrated
            </span>
          </div>
        )}
      </div>

      {/* Story Text — scrollable */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
        }}
      >
        <p
          style={{
            fontFamily: F.serif,
            fontSize: 15,
            lineHeight: 1.75,
            color: 'var(--color-text)',
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {(data.text as string) || 'No text yet.'}
        </p>

        {/* Visual Description */}
        {data.imagePrompt && (
          <div style={{ marginTop: 20 }}>
            <span
              style={{
                fontFamily: F.sans,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-light)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Visual Description
            </span>
            <p
              style={{
                fontFamily: F.sans,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--color-text-light)',
                margin: 0,
              }}
            >
              {data.imagePrompt as string}
            </p>
          </div>
        )}
      </div>

      {/* Footer — 48px */}
      <div
        style={{
          height: 48,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={handlePrev}
          disabled={pageNumber <= 1}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40 active:scale-[0.98]"
          style={{
            fontFamily: F.sans,
            fontSize: 12,
            color:
              pageNumber > 1
                ? 'var(--color-text-light)'
                : 'var(--color-border)',
            background: 'none',
            border: 'none',
            cursor: pageNumber > 1 ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '4px 8px',
            borderRadius: 4,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (pageNumber > 1) e.currentTarget.style.color = 'var(--color-text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = pageNumber > 1 ? 'var(--color-text-light)' : 'var(--color-border)'
          }}
          aria-label="Previous page"
        >
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Previous
        </button>

        <button
          onClick={handleEdit}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40 active:scale-[0.98]"
          style={{
            fontFamily: F.sans,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--color-background)',
            background: 'var(--color-primary-start)',
            border: 'none',
            borderRadius: 6,
            padding: '4px 14px',
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          aria-label="Edit this page"
        >
          <Edit3 style={{ width: 13, height: 13 }} />
          Edit Page
        </button>

        <button
          onClick={handleNext}
          disabled={pageNumber >= totalPages}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-burst/40 active:scale-[0.98]"
          style={{
            fontFamily: F.sans,
            fontSize: 12,
            color:
              pageNumber < totalPages
                ? 'var(--color-text-light)'
                : 'var(--color-border)',
            background: 'none',
            border: 'none',
            cursor: pageNumber < totalPages ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: '4px 8px',
            borderRadius: 4,
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (pageNumber < totalPages) e.currentTarget.style.color = 'var(--color-text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = pageNumber < totalPages ? 'var(--color-text-light)' : 'var(--color-border)'
          }}
          aria-label="Next page"
        >
          Next
          <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  )
}

export const SceneNodeDetail = memo(SceneNodeDetailInner)
export default SceneNodeDetail
