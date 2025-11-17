import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { WhiteboardPoint, WhiteboardStateSnapshot, WhiteboardTool } from "@skylive/shared";
import { cn } from "@/lib/utils";
import { WhiteboardToolbar } from "./whiteboard-toolbar";

interface WhiteboardSurfaceProps {
  state: WhiteboardStateSnapshot | null;
  isActive: boolean;
  canAnnotate: boolean;
  tool: WhiteboardTool;
  color: string;
  colors: string[];
  size: number;
  onToolChange: (tool: WhiteboardTool) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onClear: () => void;
  sendStroke: (points: WhiteboardPoint[]) => void;
  presenterName?: string;
  canClear: boolean;
}

const MIN_POINTS_FOR_STROKE = 2;

export function WhiteboardSurface({
  state,
  isActive,
  canAnnotate,
  tool,
  color,
  colors,
  size,
  onToolChange,
  onColorChange,
  onSizeChange,
  onClear,
  sendStroke,
  presenterName,
  canClear,
}: WhiteboardSurfaceProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [draftPoints, setDraftPoints] = useState<WhiteboardPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);

  const strokes = useMemo(() => state?.strokes ?? [], [state]);

  useEffect(() => {
    const element = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!element || !canvas) {
      return undefined;
    }

    const resizeCanvas = () => {
      const rect = element.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      setDimensions({ width: rect.width, height: rect.height });
    };

    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    renderCanvas(canvasRef.current, strokes, draftPoints, dimensions, {
      tool,
      color,
      size,
    });
  }, [strokes, draftPoints, dimensions, tool, color, size]);

  const handlePointerEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isActive || !canAnnotate) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (event.type === "pointerdown") {
      event.preventDefault();
      setIsDrawing(true);
      canvas.setPointerCapture(event.pointerId);
      setDraftPoints([eventToPoint(canvas, event)]);
      return;
    }

    if (event.type === "pointermove") {
      if (!isDrawing) {
        return;
      }
      event.preventDefault();
      setDraftPoints((prev) => prev.concat(eventToPoint(canvas, event)));
      return;
    }

    if (event.type === "pointerup" || event.type === "pointercancel") {
      if (!isDrawing) {
        return;
      }
      event.preventDefault();
      setIsDrawing(false);
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      const nextPoints = draftPoints.concat(eventToPoint(canvas, event));
      setDraftPoints([]);
      if (!nextPoints.length) {
        return;
      }
      const prepared = nextPoints.length >= MIN_POINTS_FOR_STROKE ? nextPoints : nextPoints.concat(nextPoints);
      sendStroke(prepared);
      return;
    }
  };

  const presenterLabel = presenterName ?? "";

  return (
    <div className="absolute inset-0 z-10 flex h-full w-full items-center justify-center">
      {isActive ? (
        <>
          <div className="absolute right-4 top-4 z-20 flex flex-col items-end gap-3 sm:right-6 sm:top-6">
            <button
              type="button"
              aria-expanded={isToolbarVisible}
              onClick={() => setIsToolbarVisible((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.18)] transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skylive-cyan/50"
              title={isToolbarVisible ? "Hide tools" : "Show tools"}
            >
              <ToolbarToggleGlyph hidden={!isToolbarVisible} />
              <span className="sr-only">{isToolbarVisible ? "Hide tools" : "Show tools"}</span>
            </button>
            {isToolbarVisible ? (
              <WhiteboardToolbar
                tool={tool}
                onToolChange={onToolChange}
                color={color}
                colors={colors}
                onColorChange={onColorChange}
                size={size}
                onSizeChange={onSizeChange}
                onClear={onClear}
                canClear={canClear}
                canAnnotate={canAnnotate}
              />
            ) : null}
          </div>
          {presenterLabel ? (
            <div className="absolute left-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm sm:left-6 sm:top-6">
              Hosted by {presenterLabel}
            </div>
          ) : null}
          <div className="flex h-full w-full min-h-[340px] items-center justify-center px-4 pb-6 pt-4 sm:min-h-[420px] sm:px-6 sm:pb-8 sm:pt-6">
            <div
              ref={wrapperRef}
              className="relative h-full w-full min-h-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
            >
              <canvas
                ref={canvasRef}
                className={cn(
                  "block h-full w-full touch-none",
                  tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
                  !canAnnotate ? "cursor-not-allowed" : "",
                )}
                onPointerDown={handlePointerEvent}
                onPointerMove={handlePointerEvent}
                onPointerUp={handlePointerEvent}
                onPointerCancel={handlePointerEvent}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full min-h-[280px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/15 bg-black/40 text-center sm:min-h-[360px]">
          <div className="text-sm font-semibold uppercase tracking-[0.32em] text-white/50">Whiteboard</div>
          <p className="max-w-sm text-balance text-xs text-white/60">
            When the host enables the board, you&apos;ll see the shared canvas here. Ask the host to turn it on if you need to collaborate in real time.
          </p>
        </div>
      )}
    </div>
  );
}

function eventToPoint(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>): WhiteboardPoint {
  const rect = canvas.getBoundingClientRect();
  const x = clamp((event.clientX - rect.left) / (rect.width || 1), 0, 1);
  const y = clamp((event.clientY - rect.top) / (rect.height || 1), 0, 1);
  return {
    x,
    y,
    pressure: typeof event.pressure === "number" && event.pressure > 0 ? event.pressure : undefined,
    t: event.timeStamp,
  };
}

function ToolbarToggleGlyph({ hidden }: { hidden: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {hidden ? (
        <>
          <path d="M6 12h12" />
          <path d="M12 6v12" />
        </>
      ) : (
        <path d="M6 12h12" />
      )}
    </svg>
  );
}

function renderCanvas(
  canvas: HTMLCanvasElement | null,
  strokes: WhiteboardStateSnapshot["strokes"],
  draft: WhiteboardPoint[],
  dimensions: { width: number; height: number },
  current: { tool: WhiteboardTool; color: string; size: number },
) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const width = dimensions.width;
  const height = dimensions.height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const drawStroke = (stroke: WhiteboardStateSnapshot["strokes"][number]) => {
    const points = stroke.points;
    if (!points.length) {
      return;
    }

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = stroke.tool === "highlighter" ? stroke.size * 2 : stroke.size;
    ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
    ctx.globalAlpha = stroke.tool === "highlighter" ? 0.42 : 1;
    ctx.globalCompositeOperation = "source-over";

    if (points.length === 1) {
      const [single] = points;
      ctx.beginPath();
      ctx.arc(single.x * width, single.y * height, Math.max(1, ctx.lineWidth / 2), 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(points[0]!.x * width, points[0]!.y * height);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i]!;
      ctx.lineTo(point.x * width, point.y * height);
    }
    ctx.stroke();
    ctx.restore();
  };

  strokes.forEach((stroke) => drawStroke(stroke));

  if (draft.length) {
    drawStroke({
      id: "draft",
      roomId: "draft",
      userId: "draft",
      tool: current.tool,
      color: current.tool === "eraser" ? "rgba(0,0,0,1)" : current.color,
      size: current.size,
      points: draft,
      createdAt: new Date().toISOString(),
    });
  }

  ctx.restore();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
