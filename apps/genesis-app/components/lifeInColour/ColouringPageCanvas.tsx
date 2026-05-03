import { useCallback, useEffect, useRef, useState } from 'react';
import { Brush, Copy, Download, Eraser, Trash2, Undo2, Upload } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { toast } from '../ui/sonner';
import { createOutlineImageData } from '../../src/lib/colouringPagePipeline';
import type { LifeInColourDisplaySize } from './lifeInColourSizing';
import { LIFE_IN_COLOUR_DISPLAY_SIZE_CONFIG } from './lifeInColourSizing';

type ColouringPageCanvasData =
  | {
      kind: 'outline';
      width: number;
      height: number;
      outlinePixels: Uint8ClampedArray;
    }
  | {
      kind: 'image';
      width: number;
      height: number;
      imageUrl: string;
    };

interface ColouringPageCanvasProps {
  canvas: ColouringPageCanvasData;
  sourceName: string;
  onReplacePhoto: () => void;
  displaySize?: LifeInColourDisplaySize;
}

interface Point {
  x: number;
  y: number;
}

type ToolMode = 'brush' | 'eraser';

type BrushSizePreset = 'small' | 'medium' | 'large';

interface Stroke {
  mode: ToolMode;
  color: string;
  brushSize: number;
  points: Point[];
}

const BRUSH_COLORS = [
  '#f97316',
  '#ef4444',
  '#14b8a6',
  '#2563eb',
  '#8b5cf6',
  '#84cc16',
  '#e11d48',
  '#f59e0b',
];

const BRUSH_SIZE_VALUES: Record<BrushSizePreset, number> = {
  small: 12,
  medium: 18,
  large: 28,
};

const BRUSH_SIZE_LABELS: Record<BrushSizePreset, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
};

const BRUSH_SIZE_PRESETS: BrushSizePreset[] = ['small', 'medium', 'large'];

const MAX_HISTORY_STROKES = 30;

function normalizeCanvasDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1;
}

function getSafeFileStem(sourceName: string): string {
  const strippedName = sourceName.replace(/\.[^.]+$/, '');
  const normalized = strippedName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'life-in-colour';
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error('Unable to export the colouring page.'));
    }, 'image/png');
  });
}

function applyStrokeContext(context: CanvasRenderingContext2D, stroke: Stroke) {
  context.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.mode === 'eraser' ? 'rgba(0, 0, 0, 1)' : stroke.color;
  context.fillStyle = stroke.mode === 'eraser' ? 'rgba(0, 0, 0, 1)' : stroke.color;
  context.lineWidth = stroke.brushSize;
  context.lineJoin = 'round';
  context.lineCap = 'round';
}

function getCanvasPoint(
  event: ReactPointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function drawDot(context: CanvasRenderingContext2D, point: Point, stroke: Stroke) {
  context.save();
  applyStrokeContext(context, stroke);
  context.beginPath();
  context.arc(point.x, point.y, Math.max(stroke.brushSize / 2, 1), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSegment(context: CanvasRenderingContext2D, from: Point, to: Point, stroke: Stroke) {
  context.save();
  applyStrokeContext(context, stroke);
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
}

function drawStroke(context: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) {
    return;
  }

  drawDot(context, stroke.points[0], stroke);

  for (let index = 1; index < stroke.points.length; index += 1) {
    const from = stroke.points[index - 1];
    const to = stroke.points[index];

    if (from && to) {
      drawSegment(context, from, to, stroke);
    }
  }
}

export function ColouringPageCanvas({
  canvas,
  sourceName,
  onReplacePhoto,
  displaySize = 'medium',
}: ColouringPageCanvasProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const strokeHistoryRef = useRef<Stroke[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [selectedColor, setSelectedColor] = useState(BRUSH_COLORS[0]);
  const [toolMode, setToolMode] = useState<ToolMode>('brush');
  const [brushSizePreset, setBrushSizePreset] = useState<BrushSizePreset>('medium');
  const [strokeCount, setStrokeCount] = useState(0);
  const [baseLayerReady, setBaseLayerReady] = useState(false);

  const canvasWidth = normalizeCanvasDimension(canvas.width);
  const canvasHeight = normalizeCanvasDimension(canvas.height);
  const brushSize = BRUSH_SIZE_VALUES[brushSizePreset];
  const displayConfig = LIFE_IN_COLOUR_DISPLAY_SIZE_CONFIG[displaySize];
  const stageWidthCap = Math.round(displayConfig.maxStageHeight * (canvasWidth / canvasHeight));

  const clearPaintLayer = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const redrawPaintLayer = useCallback(() => {
    const canvas = paintCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokeHistoryRef.current) {
      drawStroke(context, stroke);
    }
  }, []);

  const commitActiveStroke = useCallback(() => {
    const currentStroke = activeStrokeRef.current;
    if (!currentStroke) {
      return;
    }

    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    strokeHistoryRef.current = [...strokeHistoryRef.current, currentStroke].slice(
      -MAX_HISTORY_STROKES
    );
    setStrokeCount(strokeHistoryRef.current.length);
  }, []);

  useEffect(() => {
    const baseCanvas = baseCanvasRef.current;
    const paintCanvas = paintCanvasRef.current;

    if (!baseCanvas || !paintCanvas) {
      return;
    }

    baseCanvas.width = canvasWidth;
    baseCanvas.height = canvasHeight;
    paintCanvas.width = canvasWidth;
    paintCanvas.height = canvasHeight;

    const baseContext = baseCanvas.getContext('2d');
    strokeHistoryRef.current = [];
    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    setStrokeCount(0);
    clearPaintLayer();
    setBaseLayerReady(false);

    if (!baseContext) {
      return;
    }

    baseContext.clearRect(0, 0, canvasWidth, canvasHeight);

    if (canvas.kind === 'outline') {
      baseContext.putImageData(
        createOutlineImageData(canvas.outlinePixels, canvasWidth, canvasHeight),
        0,
        0
      );
      setBaseLayerReady(true);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      if (cancelled) {
        return;
      }

      baseContext.clearRect(0, 0, canvasWidth, canvasHeight);
      baseContext.drawImage(image, 0, 0, canvasWidth, canvasHeight);
      setBaseLayerReady(true);
    };
    image.onerror = () => {
      if (!cancelled) {
        toast.error('Could not draw the Andrew colouring page.');
      }
    };
    image.src = canvas.imageUrl;

    return () => {
      cancelled = true;
    };
  }, [canvas, canvasHeight, canvasWidth, clearPaintLayer]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = paintCanvasRef.current;
      if (!canvas) {
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      if (activeStrokeRef.current) {
        commitActiveStroke();
      }

      canvas.setPointerCapture(event.pointerId);

      const point = getCanvasPoint(event, canvas);
      const stroke: Stroke = {
        mode: toolMode,
        color: selectedColor,
        brushSize,
        points: [point],
      };

      activeStrokeRef.current = stroke;
      activePointerIdRef.current = event.pointerId;
      drawDot(context, point, stroke);
    },
    [brushSize, commitActiveStroke, selectedColor, toolMode]
  );

  const finishStroke = useCallback(
    (event?: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = paintCanvasRef.current;
      if (canvas && event && activePointerIdRef.current === event.pointerId) {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore pointer release errors from cancelled capture.
        }
      }

      commitActiveStroke();
    },
    [commitActiveStroke]
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = paintCanvasRef.current;
    if (!canvas || !activeStrokeRef.current || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const currentStroke = activeStrokeRef.current;
    if (!currentStroke) {
      return;
    }

    const nextPoint = getCanvasPoint(event, canvas);
    const lastPoint = currentStroke.points[currentStroke.points.length - 1] ?? nextPoint;

    currentStroke.points.push(nextPoint);
    drawSegment(context, lastPoint, nextPoint, currentStroke);
  }, []);

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      finishStroke(event);
    },
    [finishStroke]
  );

  const handleUndo = useCallback(() => {
    if (activeStrokeRef.current) {
      commitActiveStroke();
    }

    if (strokeHistoryRef.current.length === 0) {
      clearPaintLayer();
      setStrokeCount(0);
      return;
    }

    strokeHistoryRef.current = strokeHistoryRef.current.slice(0, -1);
    setStrokeCount(strokeHistoryRef.current.length);
    redrawPaintLayer();
  }, [clearPaintLayer, commitActiveStroke, redrawPaintLayer]);

  const handleClearPage = useCallback(() => {
    activeStrokeRef.current = null;
    activePointerIdRef.current = null;
    strokeHistoryRef.current = [];
    setStrokeCount(0);
    clearPaintLayer();
  }, [clearPaintLayer]);

  const createExportCanvas = useCallback(() => {
    const baseCanvas = baseCanvasRef.current;
    const paintCanvas = paintCanvasRef.current;

    if (!baseCanvas || !paintCanvas || !baseLayerReady) {
      return null;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasWidth;
    exportCanvas.height = canvasHeight;

    const context = exportCanvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.drawImage(paintCanvas, 0, 0, canvasWidth, canvasHeight);
    context.drawImage(baseCanvas, 0, 0, canvasWidth, canvasHeight);

    return exportCanvas;
  }, [baseLayerReady, canvasHeight, canvasWidth]);

  const handleDownloadPage = useCallback(async () => {
    const exportCanvas = createExportCanvas();
    if (!exportCanvas) {
      toast.error('The colouring page is not ready yet.');
      return;
    }

    try {
      const blob = await canvasToBlob(exportCanvas);
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${getSafeFileStem(sourceName)}-colouring-page.png`;
      downloadLink.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      toast.success('Colouring page downloaded.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not download the colouring page.'
      );
    }
  }, [createExportCanvas, sourceName]);

  const handleCopyPage = useCallback(async () => {
    const exportCanvas = createExportCanvas();
    if (!exportCanvas) {
      toast.error('The colouring page is not ready yet.');
      return;
    }

    try {
      const blob = await canvasToBlob(exportCanvas);

      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        throw new Error('Copy to clipboard is not supported in this browser.');
      }

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Colouring page copied to clipboard.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not copy the colouring page.');
    }
  }, [createExportCanvas]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[28px] border border-peach-soft bg-surface/90 p-4 shadow-[0_18px_44px_-32px_rgba(0,0,0,0.45)] md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="text-xs font-heading uppercase tracking-[0.18em] text-cocoa-light">
                Colors
              </span>
              <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-peach-soft bg-cream-base px-2 py-2">
                {BRUSH_COLORS.map((color) => {
                  const active = selectedColor === color;

                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`h-7 w-7 rounded-full border transition-all ${
                        active
                          ? 'scale-110 border-charcoal-soft shadow-sm'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select brush color ${color}`}
                      aria-pressed={active}
                    />
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-heading uppercase tracking-[0.18em] text-cocoa-light">
                Brush size
              </span>
              <div className="flex items-center gap-1 rounded-full border border-peach-soft bg-cream-base p-1">
                {BRUSH_SIZE_PRESETS.map((preset) => {
                  const active = brushSizePreset === preset;

                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBrushSizePreset(preset)}
                      className={`h-8 min-w-8 rounded-full px-3 text-xs font-heading font-bold transition-all ${
                        active
                          ? 'bg-charcoal-soft text-white shadow-sm'
                          : 'text-cocoa-light hover:bg-white/80 hover:text-charcoal-soft'
                      }`}
                      aria-label={`Set brush size ${BRUSH_SIZE_LABELS[preset]}`}
                      aria-pressed={active}
                    >
                      {BRUSH_SIZE_LABELS[preset]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-peach-soft bg-cream-base p-1">
              <button
                type="button"
                onClick={() => setToolMode('brush')}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-heading font-bold transition-all ${
                  toolMode === 'brush'
                    ? 'bg-charcoal-soft text-white shadow-sm'
                    : 'text-cocoa-light hover:bg-white/80 hover:text-charcoal-soft'
                }`}
                aria-pressed={toolMode === 'brush'}
              >
                <Brush className="h-4 w-4" />
                Brush
              </button>
              <button
                type="button"
                onClick={() => setToolMode('eraser')}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-heading font-bold transition-all ${
                  toolMode === 'eraser'
                    ? 'bg-charcoal-soft text-white shadow-sm'
                    : 'text-cocoa-light hover:bg-white/80 hover:text-charcoal-soft'
                }`}
                aria-pressed={toolMode === 'eraser'}
              >
                <Eraser className="h-4 w-4" />
                Eraser
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleUndo} disabled={strokeCount === 0}>
                <Undo2 className="h-4 w-4" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearPage}
                disabled={strokeCount === 0}
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={onReplacePhoto}>
                <Upload className="h-4 w-4" />
                New photo
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    Save
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={handleCopyPage}>
                    <Copy className="h-4 w-4" />
                    Copy to clipboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPage}>
                    <Download className="h-4 w-4" />
                    Download file
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div
        className="mx-auto w-full overflow-hidden rounded-[28px] border border-peach-soft bg-white shadow-[0_18px_44px_-32px_rgba(0,0,0,0.45)]"
        style={{ maxWidth: `${stageWidthCap}px` }}
      >
        <div
          className="relative w-full"
          style={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            maxHeight: `${displayConfig.maxStageHeight}px`,
          }}
        >
          <div className="absolute inset-0 bg-white" />
          <canvas
            ref={paintCanvasRef}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            style={{ pointerEvents: 'auto' }}
            aria-label="Colouring page paint layer"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={finishStroke}
            onPointerCancel={finishStroke}
          />
          <canvas
            ref={baseCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
