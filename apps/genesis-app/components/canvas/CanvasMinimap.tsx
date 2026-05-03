import { memo } from 'react';
import { MiniMap } from '@xyflow/react';

interface CanvasMinimapProps {
  visible: boolean;
}

function CanvasMinimapInner({ visible }: CanvasMinimapProps) {
  if (!visible) return null;

  return (
    <MiniMap
      nodeColor="var(--color-primary-start)"
      maskColor="color-mix(in srgb, var(--color-background) 80%, transparent)"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(var(--color-shadow), 0.08)',
        width: 180,
        height: 120,
        bottom: 20,
        right: 20,
      }}
      pannable
      zoomable
    />
  );
}

export const CanvasMinimap = memo(CanvasMinimapInner);
export default CanvasMinimap;
