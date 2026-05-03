import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { BookProject } from '../../types';
import type { SceneNodeData } from '../../lib/canvas/canvasTypes';
import { SceneNode } from './SceneNode';
import { SceneEdge } from './SceneEdge';
import { CanvasToolbar } from './CanvasToolbar';
import { CanvasMinimap } from './CanvasMinimap';
import { SceneNodeDetail } from './SceneNodeDetail';
import { CanvasEmptyState } from './CanvasEmptyState';
import { useStoryCanvas } from '../../hooks/useStoryCanvas';
import { ArrowLeft } from 'lucide-react';

const GEN_IMAGE_PATH = '/images/onboarding/Style_directive_highend_202512150033.jpeg';

const nodeTypes = { sceneNode: SceneNode };
const edgeTypes = { sceneEdge: SceneEdge };

interface StoryCanvasProps {
  project: BookProject;
  onSwitchToPages: (pageNumber?: number) => void;
  onAddScene: () => void;
}

export function StoryCanvas({ project, onSwitchToPages, onAddScene }: StoryCanvasProps) {
  const { nodes, edges, totalPages, allPages } = useStoryCanvas({
    project,
    onEditPage: onSwitchToPages,
  });

  const [selectedNodeData, setSelectedNodeData] = useState<SceneNodeData | null>(null);
  const [minimapVisible, setMinimapVisible] = useState(true);
  const [genTooltipVisible, setGenTooltipVisible] = useState(false);
  const reactFlowInstance = useReactFlow();

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeData(node.data as SceneNodeData);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeData(null);
  }, []);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn({ duration: 300 });
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut({ duration: 300 });
  }, [reactFlowInstance]);

  const handleFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.15, duration: 600 });
  }, [reactFlowInstance]);

  const handleToggleMinimap = useCallback(() => {
    setMinimapVisible((v) => !v);
  }, []);

  const handleAddScene = useCallback(() => {
    onAddScene();
  }, [onAddScene]);

  const handleDetailNavigate = useCallback(
    (pageNumber: number) => {
      const page = allPages.find((p) => p.pageNumber === pageNumber);
      if (page) {
        setSelectedNodeData({
          pageId: page.id,
          pageNumber: page.pageNumber,
          text: page.text,
          imageUrl: page.imageUrl ?? null,
          imagePrompt: page.imagePrompt ?? null,
          isImageOutdated: page.isImageOutdated ?? false,
          onEdit: onSwitchToPages,
        });

        const node = reactFlowInstance.getNode(`page-${page.pageNumber}`);
        if (node) {
          const position = node.position;
          const width = node.measured?.width ?? node.width ?? 0;
          const height = node.measured?.height ?? node.height ?? 0;

          reactFlowInstance.setCenter(position.x + width / 2, position.y + height / 2, {
            duration: 300,
          });
        }
      }
    },
    [allPages, onSwitchToPages, reactFlowInstance]
  );

  const fitViewOptions = useMemo(() => ({ padding: 0.15, duration: 600 }), []);

  return (
    <div className="relative w-full h-full" style={{ background: 'var(--color-background)' }}>
      {/* Canvas styles — all colours from theme CSS variables */}
      <style>{`
        /* Edge flow animation */
        .genesis-edge-flow {
          stroke: var(--color-primary-start);
          stroke-opacity: 0.55;
          stroke-width: 2;
          stroke-dasharray: 6 4;
          animation: genesis-edge-flow 1.5s linear infinite;
        }
        @keyframes genesis-edge-flow {
          from { stroke-dashoffset: 20; }
          to   { stroke-dashoffset: 0; }
        }

        /* Arrowhead fill */
        .genesis-arrow-fill {
          fill: var(--color-primary-start);
          opacity: 0.8;
        }

        /* Skeleton shimmer */
        @keyframes genesis-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* Gen float */
        @keyframes genesis-gen-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-8px); }
        }

        /* Handle styling */
        .genesis-handle {
          width: 10px !important;
          height: 10px !important;
          background: var(--color-primary-start) !important;
          border: 2px solid var(--color-background) !important;
          opacity: 0 !important;
          transition: opacity 150ms ease !important;
        }
        .react-flow__node:hover .genesis-handle {
          opacity: 1 !important;
        }

        /* React Flow overrides for Genesis */
        .genesis-canvas .react-flow__background {
          background-color: var(--color-background) !important;
        }
        .genesis-canvas .react-flow__nodesselection-rect {
          border-color: var(--color-primary-start) !important;
          background: transparent !important;
        }
        .genesis-canvas .react-flow__attribution {
          display: none !important;
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .genesis-edge-flow {
            animation: none;
            stroke-dasharray: none;
          }
          .genesis-shimmer-bg {
            animation: none;
          }
        }
      `}</style>

      <div className="genesis-canvas" style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          {/* Custom arrowhead marker definition */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <marker
                id="genesis-arrow"
                viewBox="0 0 10 7"
                refX="9"
                refY="3.5"
                markerWidth="10"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 0 L 10 3.5 L 0 7 Z" className="genesis-arrow-fill" />
              </marker>
            </defs>
          </svg>

          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.2}
            color="var(--color-border)"
            style={{ opacity: 0.4 }}
          />
          <CanvasMinimap visible={minimapVisible} />
        </ReactFlow>
      </div>

      {/* Back to Pages button — top left */}
      <button
        type="button"
        onClick={() => onSwitchToPages(undefined)}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '8px 14px',
          boxShadow: '0 2px 8px rgba(var(--color-shadow), 0.1)',
          height: 44,
          zIndex: 10,
          cursor: 'pointer',
          fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--color-text-light)',
          transition: 'color 150ms ease',
          outline: 'none',
        }}
        className="focus-visible:ring-2 focus-visible:ring-coral-burst/40"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-primary-start)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-light)';
        }}
        aria-label="Back to Pages view"
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Pages
      </button>

      {/* Toolbar */}
      <CanvasToolbar
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onToggleMinimap={handleToggleMinimap}
        onAddScene={handleAddScene}
        minimapVisible={minimapVisible}
      />

      {/* Empty state */}
      {nodes.length === 0 && <CanvasEmptyState onStartWriting={() => onSwitchToPages(1)} />}

      {/* Detail panel */}
      {selectedNodeData && (
        <SceneNodeDetail
          data={selectedNodeData}
          totalPages={totalPages}
          allPages={allPages}
          onClose={() => setSelectedNodeData(null)}
          onEdit={(pageNum) => {
            setSelectedNodeData(null);
            onSwitchToPages(pageNum);
          }}
          onNavigate={handleDetailNavigate}
        />
      )}

      {/* Gen ambient presence — bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          zIndex: 10,
        }}
        onMouseEnter={() => setGenTooltipVisible(true)}
        onMouseLeave={() => setGenTooltipVisible(false)}
      >
        {genTooltipVisible && (
          <div
            style={{
              position: 'absolute',
              bottom: 72,
              left: 0,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 2px 12px rgba(var(--color-shadow), 0.1)',
              whiteSpace: 'nowrap',
              fontFamily: '"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif',
              fontSize: 12,
              color: 'var(--color-text-light)',
              pointerEvents: 'none',
            }}
          >
            This is your whole story. Beautiful, isn&rsquo;t it?
          </div>
        )}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow:
              '0 0 20px 4px rgba(var(--color-shadow), 0.25), 0 0 40px 8px rgba(var(--color-shadow), 0.1)',
            cursor: 'default',
          }}
        >
          <img
            src={GEN_IMAGE_PATH}
            alt="Gen, your AI creative assistant"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default StoryCanvas;
