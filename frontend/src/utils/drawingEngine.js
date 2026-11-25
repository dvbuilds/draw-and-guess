export const DRAWING_COLORS = [
  '#0F172A', // Slate Black
  '#64748B', // Gray
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#92400E', // Brown
];

export const BRUSH_SIZES = [3, 6, 12, 20, 32];
export const CANVAS_REFERENCE_WIDTH = 800;
export const MAX_POINTS_PER_SEGMENT = 32;

export function generateStrokeId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `str_${Date.now().toString(36)}_${rand}`;
}

export function clampNormalized(value) {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(1, Math.max(0, value));
  return Number(clamped.toFixed(4));
}

export function clampPoint(point) {
  return {
    x: clampNormalized(point.x),
    y: clampNormalized(point.y),
  };
}

/**
 * Merges a stroke segment into the ordered stroke list idempotently.
 */
export function applyStrokeSegment(strokes, segment) {
  if (!segment?.strokeId || !Array.isArray(segment.points) || segment.points.length < 2) {
    return strokes;
  }

  const existingIdx = strokes.findIndex((s) => s.strokeId === segment.strokeId);
  if (existingIdx === -1) {
    return [
      ...strokes,
      {
        strokeId: segment.strokeId,
        color: segment.color,
        width: segment.width,
        tool: segment.tool,
        segments: [
          {
            segmentIndex: segment.segmentIndex,
            points: segment.points,
          },
        ],
      },
    ];
  }

  const target = strokes[existingIdx];
  if (target.segments.some((seg) => seg.segmentIndex === segment.segmentIndex)) {
    return strokes;
  }

  const nextSegments = [
    ...target.segments,
    { segmentIndex: segment.segmentIndex, points: segment.points },
  ].sort((a, b) => a.segmentIndex - b.segmentIndex);

  const next = [...strokes];
  next[existingIdx] = { ...target, segments: nextSegments };
  return next;
}

/**
 * Removes a stroke by strokeId (or the last stroke if strokeId is omitted).
 */
export function applyUndoStroke(strokes, strokeId) {
  if (!strokeId) {
    return strokes.length > 0 ? strokes.slice(0, -1) : strokes;
  }
  return strokes.filter((s) => s.strokeId !== strokeId);
}

/**
 * Rebuilds ordered stroke objects from a flat drawing:sync segments snapshot.
 */
export function hydrateStrokesFromSync(segments = []) {
  let result = [];
  for (const seg of segments) {
    result = applyStrokeSegment(result, seg);
  }
  return result;
}

/**
 * Renders all normalized strokes onto a 2D canvas context scaled to CSS dimensions.
 */
export function renderStrokesToContext(ctx, width, height, strokes = []) {
  if (!ctx || width <= 0 || height <= 0) return;

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const scale = width / CANVAS_REFERENCE_WIDTH;

  for (const stroke of strokes) {
    const strokeColor = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color || '#0F172A';
    const lineWidth = Math.max(1, (stroke.width || 6) * scale);

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const seg of stroke.segments || []) {
      const pts = seg.points || [];
      if (pts.length === 0) continue;

      if (pts.length === 1 || (pts.length === 2 && pts[0].x === pts[1].x && pts[0].y === pts[1].y)) {
        ctx.beginPath();
        ctx.arc(pts[0].x * width, pts[0].y * height, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x * width, pts[0].y * height);
      for (let i = 1; i < pts.length; i += 1) {
        ctx.lineTo(pts[i].x * width, pts[i].y * height);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}
