import { useEffect, useId, useRef, useState } from 'react';

const LOCK_TOLERANCE_MIN = 2;

export default function M3Slider({
  min,
  max,
  step,
  value,
  onChange,
  onPreviewChange,
  colorClass: propColorClass = 'bg-[var(--accent-color)]',
  disabled = false,
  variant = 'default',
  trackClass = '',
  trackStyle = undefined,
  fillStyle = undefined,
  thumbClass = '',
  thumbStyle = undefined,
  thumbOffset = 6,
  showFill = true,
  height = undefined,
  ariaLabel = 'Slider',
  ariaValueText = undefined,
  id = undefined,
  name = undefined,
  commitOnly = false,
}) {
  const generatedId = useId();
  const sliderId = id || `m3-slider-${generatedId.replace(/:/g, '')}`;
  const colorClass =
    propColorClass === 'bg-[var(--accent-color)]' ? 'bg-[var(--accent-color)]' : propColorClass;

  const [internalValue, setInternalValue] = useState(value);
  const [isInteracting, setIsInteracting] = useState(false);
  const rootRef = useRef(null);
  const frameRef = useRef(null);
  const isInteractingRef = useRef(false);
  const pendingValueRef = useRef(value);
  const lockedCommitValueRef = useRef(null);

  const numericStep = Number(step) || 1;
  const tolerance = Math.max(numericStep, LOCK_TOLERANCE_MIN);

  const normalizeValue = (rawValue) => {
    const clamped = Math.min(max, Math.max(min, rawValue));
    const stepped = Math.round((clamped - min) / numericStep) * numericStep + min;
    return Math.min(max, Math.max(min, stepped));
  };

  const emitChange = (nextValue, callback = onChange) => {
    callback?.({ target: { value: String(nextValue), name: name || sliderId } });
  };

  useEffect(() => {
    if (isInteractingRef.current) {
      return;
    }

    if (commitOnly && lockedCommitValueRef.current !== null) {
      if (Math.abs(value - lockedCommitValueRef.current) <= tolerance) {
        lockedCommitValueRef.current = null;
      } else {
        setInternalValue(lockedCommitValueRef.current);
        return;
      }
    }

    setInternalValue(value);
    pendingValueRef.current = value;
  }, [commitOnly, tolerance, value]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const percentage =
    max === min ? 0 : Math.min(100, Math.max(0, ((internalValue - min) / (max - min)) * 100));

  const valueFromClientX = (clientX) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return pendingValueRef.current;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return normalizeValue(min + ratio * (max - min));
  };

  const previewValue = (nextValue) => {
    const normalized = normalizeValue(nextValue);
    pendingValueRef.current = normalized;
    setInternalValue(normalized);
    emitChange(normalized, onPreviewChange);
  };

  const scheduleLiveCommit = () => {
    if (commitOnly || frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      emitChange(pendingValueRef.current);
    });
  };

  const startInteraction = (event) => {
    if (disabled) return;
    lockedCommitValueRef.current = null;
    isInteractingRef.current = true;
    setIsInteracting(true);
    rootRef.current?.focus?.({ preventScroll: true });
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    previewValue(valueFromClientX(event.clientX));
    scheduleLiveCommit();
  };

  const moveInteraction = (event) => {
    if (!isInteractingRef.current || disabled) return;
    previewValue(valueFromClientX(event.clientX));
    scheduleLiveCommit();
  };

  const finishInteraction = (event) => {
    if (!isInteractingRef.current) return;
    if (event?.clientX != null) previewValue(valueFromClientX(event.clientX));

    isInteractingRef.current = false;
    setIsInteracting(false);
    const finalValue = pendingValueRef.current;

    if (commitOnly) {
      lockedCommitValueRef.current = finalValue;
      emitChange(finalValue);
    }
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    let nextValue = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      nextValue = internalValue + numericStep;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      nextValue = internalValue - numericStep;
    } else if (event.key === 'Home') {
      nextValue = min;
    } else if (event.key === 'End') {
      nextValue = max;
    } else if (event.key === 'PageUp') {
      nextValue = internalValue + numericStep * 10;
    } else if (event.key === 'PageDown') {
      nextValue = internalValue - numericStep * 10;
    }

    if (nextValue === null) return;
    event.preventDefault();
    const normalized = normalizeValue(nextValue);
    lockedCommitValueRef.current = commitOnly ? normalized : null;
    previewValue(normalized);
    emitChange(normalized);
  };

  const rootProps = {
    ref: rootRef,
    id: sliderId,
    role: 'slider',
    tabIndex: disabled ? -1 : 0,
    'aria-label': ariaLabel,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': internalValue,
    'aria-valuetext': ariaValueText,
    'aria-orientation': 'horizontal',
    'aria-disabled': disabled || undefined,
    onPointerDown: startInteraction,
    onPointerMove: moveInteraction,
    onPointerUp: finishInteraction,
    onPointerCancel: finishInteraction,
    onKeyDown: handleKeyDown,
    onClick: (event) => event.stopPropagation(),
  };

  if (variant === 'thin') {
    return (
      <div
        {...rootProps}
        className={`group relative flex h-4 w-full cursor-pointer touch-none items-center select-none ${disabled ? 'pointer-events-none opacity-30' : ''}`}
      >
        <div className="absolute h-1 w-full overflow-hidden rounded-full bg-white/10 transition-all duration-300 group-hover:h-1.5">
          <div
            className={`h-full ${colorClass} ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className={`pointer-events-none absolute z-10 h-3 w-3 rounded-full bg-white shadow-lg group-hover:opacity-100 ${isInteracting ? 'opacity-100 transition-none' : 'opacity-0 transition-opacity duration-200'}`}
          style={{ left: `calc(${percentage}% - 6px)` }}
        />
      </div>
    );
  }

  if (variant === 'thinLg') {
    return (
      <div
        {...rootProps}
        className={`group relative flex h-6 w-full cursor-pointer touch-none items-center select-none ${disabled ? 'pointer-events-none opacity-30' : ''}`}
      >
        <div className="absolute h-2 w-full overflow-hidden rounded-full bg-white/10 transition-all duration-300 group-hover:h-2.5">
          <div
            className={`h-full ${colorClass} ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div
          className={`pointer-events-none absolute z-10 h-4 w-4 rounded-full bg-white shadow-lg group-hover:opacity-100 ${isInteracting ? 'opacity-100 transition-none' : 'opacity-0 transition-opacity duration-200'}`}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    );
  }

  if (variant === 'volume') {
    return (
      <div
        {...rootProps}
        className={`group relative flex h-10 w-full touch-none items-center select-none ${disabled ? 'pointer-events-none opacity-30' : ''}`}
      >
        <div className="absolute h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-white/5">
          <div
            className={`h-full ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'} ${colorClass} opacity-90`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  const containerH = height || 'h-10';

  return (
    <div
      {...rootProps}
      className={`relative w-full ${containerH} group flex cursor-pointer touch-none items-center select-none ${disabled ? 'pointer-events-none opacity-30' : ''}`}
    >
      {trackClass ? (
        <div
          className={`absolute w-full ${trackClass} overflow-hidden rounded-full`}
          style={trackStyle}
        >
          {showFill && (
            <div
              className={`h-full ${colorClass} ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
              style={{ width: `${percentage}%`, ...fillStyle }}
            />
          )}
        </div>
      ) : (
        <div
          className={`absolute w-full ${height ? 'h-full rounded bg-white/10' : 'h-5 rounded-full border'} overflow-hidden`}
          style={
            !height
              ? { backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.05)' }
              : {}
          }
        >
          <div
            className={`h-full ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'} ${colorClass}`}
            style={{
              width: `${percentage}%`,
              boxShadow: !height ? '0_0_15px_rgba(0,0,0,0.2)' : 'none',
            }}
          />
        </div>
      )}

      {thumbClass ? (
        <div
          className={`pointer-events-none absolute z-10 ${thumbClass}`}
          style={{ left: `calc(${percentage}% - ${thumbOffset}px)`, ...thumbStyle }}
        />
      ) : (
        !height && (
          <div
            className={`pointer-events-none absolute h-8 w-1 rounded-full bg-white group-active:scale-y-110 ${isInteracting ? 'transition-none' : 'transition-transform duration-200'}`}
            style={{
              left: `calc(${percentage}% - 2px)`,
              boxShadow: '0_0_15px_rgba(255,255,255,0.4)',
            }}
          />
        )
      )}
    </div>
  );
}
