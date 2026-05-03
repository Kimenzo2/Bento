import { memo } from 'react';
import { getSmoothStepPath, type EdgeProps } from '@xyflow/react';

function SceneEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <path id={id} className="genesis-edge-flow" d={edgePath} fill="none" markerEnd={markerEnd} />
  );
}

export const SceneEdge = memo(SceneEdgeInner);
export default SceneEdge;
