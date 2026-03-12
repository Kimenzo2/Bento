import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { BookProject, Page } from '../types'
import type { SceneNodeData } from '../lib/canvas/canvasTypes'
import { computeLayout } from '../lib/canvas/layoutEngine'
import { DEFAULT_LAYOUT } from '../lib/canvas/canvasTypes'

interface UseStoryCanvasProps {
  project: BookProject
  onEditPage: (pageNumber: number) => void
}

export function useStoryCanvas({ project, onEditPage }: UseStoryCanvasProps) {
  const allPages: Page[] = useMemo(
    () => project.chapters.flatMap((c) => c.pages),
    [project]
  )

  const onEditRef = useRef(onEditPage)
  onEditRef.current = onEditPage

  const stableOnEdit = useCallback((pageNum: number) => {
    onEditRef.current(pageNum)
  }, [])

  const nodes: Node<SceneNodeData>[] = useMemo(() => {
    const layout = computeLayout(allPages.length, DEFAULT_LAYOUT)

    return allPages.map((page, index) => ({
      id: `page-${page.pageNumber}`,
      type: 'sceneNode' as const,
      position: layout[index]?.position ?? { x: 0, y: 0 },
      data: {
        pageId: page.id,
        pageNumber: page.pageNumber,
        text: page.text,
        imageUrl: page.imageUrl ?? null,
        imagePrompt: page.imagePrompt ?? null,
        isImageOutdated: page.isImageOutdated ?? false,
        onEdit: stableOnEdit,
      },
    }))
  }, [allPages, stableOnEdit])

  const edges: Edge[] = useMemo(() => {
    const edgeList: Edge[] = []

    for (let i = 0; i < allPages.length - 1; i++) {
      const sourcePage = allPages[i]
      const targetPage = allPages[i + 1]
      edgeList.push({
        id: `edge-${sourcePage.pageNumber}-${targetPage.pageNumber}`,
        source: `page-${sourcePage.pageNumber}`,
        target: `page-${targetPage.pageNumber}`,
        type: 'sceneEdge',
        markerEnd: 'url(#genesis-arrow)',
      })
    }

    // Add branching edges from choices
    for (const page of allPages) {
      if (page.choices) {
        for (const choice of page.choices) {
          const edgeId = `choice-${page.pageNumber}-${choice.targetPageNumber}`
          // Skip if we already have a sequential edge for this pair
          if (!edgeList.some((e) => e.id === edgeId)) {
            edgeList.push({
              id: edgeId,
              source: `page-${page.pageNumber}`,
              target: `page-${choice.targetPageNumber}`,
              type: 'sceneEdge',
              markerEnd: 'url(#genesis-arrow)',
              label: choice.text.length > 30 ? `${choice.text.slice(0, 30)}…` : choice.text,
            })
          }
        }
      }
    }

    return edgeList
  }, [allPages])

  return {
    nodes,
    edges,
    isLoading: false,
    bookTitle: project.title,
    totalPages: allPages.length,
    allPages,
  }
}
