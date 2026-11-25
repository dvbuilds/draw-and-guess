import { useCallback, useEffect, useRef, useState } from 'react';
import { clearDrawingSocket, sendDrawingStroke, syncDrawingSocket, undoDrawingSocket } from '../../services/socket.js';
import { useSocket } from '../../hooks/useSocket.js';
import { Button } from '../ui/index.js';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675;
const PALETTE = ['#111827', '#DC2626', '#2563EB', '#16A34A', '#9333EA', '#F59E0B'];

function drawSegments(canvas, segments) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (const segment of segments) {
    if (!Array.isArray(segment.points) || segment.points.length < 2) continue;
    context.globalCompositeOperation = segment.tool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = segment.color;
    context.lineWidth = segment.width;
    context.beginPath();
    context.moveTo(segment.points[0].x * canvas.width, segment.points[0].y * canvas.height);
    for (const point of segment.points.slice(1)) {
      context.lineTo(point.x * canvas.width, point.y * canvas.height);
    }
    context.stroke();
  }
  context.globalCompositeOperation = 'source-over';
}

export function DrawingCanvas({
  roomCode,
  lobbyStatus,
  gameStatus,
  currentRound,
  currentTurn,
  currentDrawerPlayerId,
  isCurrentDrawer,
  canDraw,
  isSocketConnected,
}) {
  const { socket } = useSocket();
  const canvasRef = useRef(null);
  const activeStrokeRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(5);
  const [tool, setTool] = useState('pen');
  const [error, setError] = useState(null);

  const applySegments = useCallback((update) => {
    setSegments((previous) => {
      const next = typeof update === 'function' ? update(previous) : update;
      return next;
    });
  }, []);

  useEffect(() => {
    drawSegments(canvasRef.current, segments);
  }, [segments]);

  useEffect(() => {
    const matchesRoom = (payload) => payload?.roomCode === roomCode;
    const onStroke = (payload) => {
      if (matchesRoom(payload)) applySegments((previous) => [...previous, payload]);
    };
    const onUndo = (payload) => {
      if (matchesRoom(payload)) {
        applySegments((previous) => previous.filter((segment) => segment.strokeId !== payload.strokeId));
      }
    };
    const onClear = (payload) => {
      if (matchesRoom(payload)) applySegments([]);
    };
    const onTurn = (payload) => {
      if (!payload?.roomCode || payload.roomCode === roomCode) applySegments([]);
    };
    const onComplete = (payload) => {
      if (!payload?.roomCode || payload.roomCode === roomCode) applySegments([]);
    };

    socket.on('drawing:stroke', onStroke);
    socket.on('drawing:undone', onUndo);
    socket.on('drawing:cleared', onClear);
    socket.on('game_start', onTurn);
    socket.on('game_turn', onTurn);
    socket.on('game_complete', onComplete);
    return () => {
      socket.off('drawing:stroke', onStroke);
      socket.off('drawing:undone', onUndo);
      socket.off('drawing:cleared', onClear);
      socket.off('game_start', onTurn);
      socket.off('game_turn', onTurn);
      socket.off('game_complete', onComplete);
    };
  }, [socket, roomCode, applySegments]);

  useEffect(() => {
    if (!isSocketConnected || lobbyStatus !== 'joined' || gameStatus !== 'started') return undefined;
    let cancelled = false;
    syncDrawingSocket()
      .then((state) => {
        if (!cancelled && state?.roomCode === roomCode && Array.isArray(state.strokes)) {
          applySegments(state.strokes);
        }
      })
      .catch((err) => {
        if (!cancelled && err?.code !== 'SOCKET_DISCONNECTED') {
          setError({ message: err.message || 'Unable to sync the drawing canvas' });
        }
      });
    return () => { cancelled = true; };
  }, [isSocketConnected, lobbyStatus, gameStatus, roomCode, currentRound, currentTurn, currentDrawerPlayerId, applySegments]);

  const pointFor = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (event) => {
    if (!canDraw || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStrokeRef.current = {
      strokeId: globalThis.crypto?.randomUUID?.() || `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      segmentIndex: 0,
      lastPoint: pointFor(event),
    };
  };

  const handlePointerMove = (event) => {
    const active = activeStrokeRef.current;
    if (!active || !canDraw || (event.buttons & 1) !== 1) return;
    const nextPoint = pointFor(event);
    const segment = {
      strokeId: active.strokeId,
      segmentIndex: active.segmentIndex,
      points: [active.lastPoint, nextPoint],
      color,
      width,
      tool,
    };
    active.segmentIndex += 1;
    active.lastPoint = nextPoint;
    applySegments((previous) => [...previous, segment]);
    sendDrawingStroke(segment).catch((err) => {
      applySegments((previous) => previous.filter((item) => item.strokeId !== segment.strokeId));
      activeStrokeRef.current = null;
      setError({ message: err.message || 'The server rejected this stroke' });
    });
  };

  const stopStroke = (event) => {
    activeStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const undo = async () => {
    setError(null);
    try {
      const result = await undoDrawingSocket();
      if (result.undone) {
        applySegments((previous) => previous.filter((segment) => segment.strokeId !== result.strokeId));
      }
    } catch (err) {
      setError({ message: err.message || 'Unable to undo the last stroke' });
    }
  };

  const clear = async () => {
    setError(null);
    try {
      await clearDrawingSocket();
      applySegments([]);
    } catch (err) {
      setError({ message: err.message || 'Unable to clear the canvas' });
    }
  };

  return (
    <section className="space-y-3" aria-label="Shared drawing canvas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Shared Canvas</h3>
          <p className="text-xs text-slate-500">
            {canDraw ? 'Your strokes appear live for everyone in this room.' : 'Watch the drawer sketch live.'}
          </p>
        </div>
        {isCurrentDrawer && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
            Current drawer
          </span>
        )}
      </div>

      {canDraw && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex items-center gap-1" aria-label="Brush color">
            {PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use color ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => { setColor(swatch); setTool('pen'); }}
                className={`h-7 w-7 rounded-full border-2 ${color === swatch ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-white shadow'}`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            Size
            <input aria-label="Brush size" type="range" min="2" max="24" value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          </label>
          <Button variant={tool === 'eraser' ? 'primary' : 'outline'} size="sm" onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}>
            {tool === 'eraser' ? 'Eraser on' : 'Eraser'}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={!isSocketConnected}>Undo</Button>
            <Button variant="secondary" size="sm" onClick={clear} disabled={!isSocketConnected}>Clear</Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          aria-label={canDraw ? 'Drawing canvas. Use pointer or touch to draw.' : 'Read-only shared drawing canvas'}
          className={`block aspect-video w-full touch-none ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopStroke}
          onPointerCancel={stopStroke}
        />
      </div>
      {gameStatus === 'started' && isCurrentDrawer && !canDraw && (
        <p className="text-xs text-amber-800">Select a word before drawing.</p>
      )}
      {!isSocketConnected && <p className="text-xs font-medium text-amber-700">Reconnect to synchronize canvas actions.</p>}
      {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error.message}</p>}
    </section>
  );
}
