import { DEFAULT_LAYOUT, type LayoutConfig } from './canvasTypes'

export interface NodePosition {
  id: string
  position: { x: number; y: number }
}

export function computeLayout(
  pageCount: number,
  config: LayoutConfig = DEFAULT_LAYOUT
): NodePosition[] {
  /*
   * Arrange nodes in a flowing diagonal cascade:
   *
   *  [P1]           [P3]           [P5]
   *       [P2]           [P4]           [P6]
   *
   * Every other node is offset vertically to create a river of story.
   */
  const positions: NodePosition[] = []

  for (let i = 0; i < pageCount; i++) {
    positions.push({
      id: `page-${i + 1}`,
      position: {
        x: config.startX + i * (config.nodeWidth + config.horizontalGap),
        y: config.startY + (i % 2 === 0 ? 0 : config.verticalOffset),
      },
    })
  }

  return positions
}
