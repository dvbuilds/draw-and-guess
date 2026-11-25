import { BRUSH_SIZES, DRAWING_COLORS } from '../../utils/drawingEngine.js';
import { Button } from '../ui/index.js';

export function DrawingToolbar({
  tool,
  color,
  brushSize,
  disabled = false,
  canUndo = false,
  canClear = false,
  onToolChange,
  onColorChange,
  onBrushSizeChange,
  onUndo,
  onClear,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50/80 p-3">
      {/* Tool Selection: Pen / Eraser */}
      <div className="flex items-center gap-1.5">
        <Button
          variant={tool === 'pen' ? 'primary' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => onToolChange('pen')}
          aria-pressed={tool === 'pen'}
        >
          Pen
        </Button>
        <Button
          variant={tool === 'eraser' ? 'secondary' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => onToolChange('eraser')}
          aria-pressed={tool === 'eraser'}
        >
          Eraser
        </Button>
      </div>

      {/* Color Swatches */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Brush colors">
        {DRAWING_COLORS.map((swatch) => {
          const isActive = tool === 'pen' && color.toUpperCase() === swatch.toUpperCase();
          return (
            <button
              key={swatch}
              type="button"
              disabled={disabled}
              aria-label={`Color ${swatch}`}
              aria-pressed={isActive}
              onClick={() => {
                onToolChange('pen');
                onColorChange(swatch);
              }}
              style={{ backgroundColor: swatch }}
              className={`h-6 w-6 rounded-full border-2 transition-transform cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive
                  ? 'scale-110 border-slate-900 ring-2 ring-indigo-500 ring-offset-1'
                  : 'border-white/90 shadow-sm hover:scale-105'
              }`}
            />
          );
        })}
      </div>

      {/* Brush Size Presets & Slider */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Size
        </span>
        <div className="flex items-center gap-1">
          {BRUSH_SIZES.map((size) => {
            const active = brushSize === size;
            return (
              <button
                key={size}
                type="button"
                disabled={disabled}
                aria-label={`Brush size ${size}`}
                aria-pressed={active}
                onClick={() => onBrushSizeChange(size)}
                className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: `${Math.min(18, Math.max(4, Math.round(size * 0.55)))}px`,
                    height: `${Math.min(18, Math.max(4, Math.round(size * 0.55)))}px`,
                  }}
                  className="rounded-full bg-current"
                />
              </button>
            );
          })}
        </div>
        <input
          type="range"
          min={1}
          max={40}
          value={brushSize}
          disabled={disabled}
          aria-label="Custom brush size"
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="w-20 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
        />
        <span className="w-7 text-right font-mono text-xs font-bold text-slate-700">
          {brushSize}
        </span>
      </div>

      {/* Undo & Clear Controls */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !canUndo}
          onClick={onUndo}
        >
          Undo
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || !canClear}
          onClick={onClear}
          className="text-rose-700 hover:bg-rose-50"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
