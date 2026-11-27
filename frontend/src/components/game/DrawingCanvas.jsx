import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_POINTS_PER_SEGMENT,
  clampPoint,
  generateStrokeId,
  renderStrokesToContext,
} from '../../utils/drawingEngine.js';

export function DrawingCanvas({
  strokes = [],
  canDraw = false,
  tool = 'pen',
  color = '#0F172A',
  brushSize = 6,
  overlayMessage = null,
  onStrokeSegment,
  onEmitSegment,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Active pointer stroke state
  const activeStrokeRef = useRef(null);
  const rafRef = useRef(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const { width, height } = sizeRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const ctx = canvas.getContext('2d');
    renderStrokesToContext(ctx, width, height, strokesRef.current);
  }, []);

  // Keep canvas sized crisply to responsive container & DPR
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;

      sizeRef.current = { width, height };
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      setCanvasSize({ width, height });
      renderStrokesToContext(ctx, width, height, strokesRef.current);
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Re-render whenever authoritative stroke state updates
  useEffect(() => {
    redraw();
  }, [strokes, canvasSize, redraw]);

  const flushSegments = useCallback(
    (isFinal = false) => {
      const active = activeStrokeRef.current;
      if (!active) return;

      const pts = active.pendingPoints;
      if (pts.length === 0) return;

      // Single tap/click: duplicate point to satisfy backend points.length >= 2
      if (isFinal && pts.length === 1 && active.segmentIndex === 0) {
        pts.push({ ...pts[0] });
      }

      if (pts.length < 2) {
        if (isFinal) active.pendingPoints = [];
        return;
      }

      while (pts.length >= 2) {
        const chunk = pts.slice(0, MAX_POINTS_PER_SEGMENT);
        const remaining = pts.slice(MAX_POINTS_PER_SEGMENT - 1);

        const segment = {
          strokeId: active.strokeId,
          segmentIndex: active.segmentIndex,
          points: chunk,
          color: active.color,
          width: active.width,
          tool: active.tool,
        };

        active.segmentIndex += 1;
        onStrokeSegment?.(segment);
        onEmitSegment?.(segment);

        if (remaining.length >= 2) {
          pts.splice(0, pts.length, ...remaining);
        } else {
          // Keep the last anchor point for continuous next segment unless stroke ended
          active.pendingPoints = isFinal ? [] : [chunk[chunk.length - 1]];
          break;
        }
      }
    },
    [onStrokeSegment, onEmitSegment]
  );

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      flushSegments(false);
    });
  }, [flushSegments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canDraw) return undefined;

    const preventTouchScroll = (event) => {
      event.preventDefault();
    };

    canvas.addEventListener('touchstart', preventTouchScroll, { passive: false });
    canvas.addEventListener('touchmove', preventTouchScroll, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', preventTouchScroll);
      canvas.removeEventListener('touchmove', preventTouchScroll);
    };
  }, [canDraw]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const getNormalizedPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return clampPoint({
      x: (e.clientX - rect.left) / Math.max(1, rect.width),
      y: (e.clientY - rect.top) / Math.max(1, rect.height),
    });
  };

  const handlePointerDown = (e) => {
    if (!canDraw) return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const startPoint = getNormalizedPoint(e);
    activeStrokeRef.current = {
      pointerId: e.pointerId,
      strokeId: generateStrokeId(),
      segmentIndex: 0,
      color: tool === 'eraser' ? '#FFFFFF' : color.toUpperCase(),
      width: Number(brushSize),
      tool,
      pendingPoints: [startPoint],
    };
  };

  const handlePointerMove = (e) => {
    const active = activeStrokeRef.current;
    if (!canDraw || !active || active.pointerId !== e.pointerId) return;

    e.preventDefault();
    const nextPoint = getNormalizedPoint(e);
    const last = active.pendingPoints[active.pendingPoints.length - 1];
    if (last && last.x === nextPoint.x && last.y === nextPoint.y) return;

    active.pendingPoints.push(nextPoint);
    if (active.pendingPoints.length >= MAX_POINTS_PER_SEGMENT) {
      flushSegments(false);
    } else {
      scheduleFlush();
    }
  };

  const finishStroke = (e) => {
    const active = activeStrokeRef.current;
    if (!active || active.pointerId !== e.pointerId) return;

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (e.type === 'pointerup' && canDraw) {
      const endPoint = getNormalizedPoint(e);
      const last = active.pendingPoints[active.pendingPoints.length - 1];
      if (!last || last.x !== endPoint.x || last.y !== endPoint.y) {
        active.pendingPoints.push(endPoint);
      }
    }

    flushSegments(true);
    activeStrokeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full max-h-[65vh] overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-inner"
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        style={{ touchAction: canDraw ? 'none' : 'pan-y' }}
        className={`block h-full w-full select-none ${
          canDraw ? 'touch-none overscroll-none cursor-crosshair' : 'cursor-default'
        }`}
      />

      {overlayMessage && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px] p-4">
          <div className="rounded-xl border-2 border-slate-200 bg-white/95 px-4 py-2.5 text-center text-xs font-bold text-slate-700 shadow-sm">
            {overlayMessage}
          </div>
        </div>
      )}
    </div>
  );
}
