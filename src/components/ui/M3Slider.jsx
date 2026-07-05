import { useState, useEffect, useRef, useId } from 'react';

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
  thumbClass = '',
  height = undefined,
  ariaLabel = 'Slider',
  ariaValueText = undefined,
  id = undefined,
  name = undefined,
  commitOnly = false,
}) {
  const generatedId = useId();
  const inputId = id || `m3-slider-${generatedId.replace(/:/g, '')}`;
  const inputName = name || inputId;
  const colorClass =
    propColorClass === 'bg-[var(--accent-color)]' ? 'bg-[var(--accent-color)]' : propColorClass;
  const [internalValue, setInternalValue] = useState(value);
  const [isInteracting, setIsInteracting] = useState(false);
  const isInteractingRef = useRef(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const frameRef = useRef(null);
  const pendingValueRef = useRef(value);
  const committedValueRef = useRef(value);
  const lockedCommitValueRef = useRef(null);

  useEffect(() => {
    if (!isInteracting) {
      if (commitOnly && lockedCommitValueRef.current !== null) {
        const tolerance = Math.max(Number(step) || 1, 2);
        if (Math.abs(value - lockedCommitValueRef.current) <= tolerance) {
          lockedCommitValueRef.current = null;
        } else {
          setInternalValue(lockedCommitValueRef.current);
          return;
        }
      }
      setInternalValue(value);
    }
    committedValueRef.current = value;
  }, [value, isInteracting, commitOnly]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const percentage =
    max === min ? 0 : Math.min(100, Math.max(0, ((internalValue - min) / (max - min)) * 100));

  const normalizeValue = (rawValue) => {
    const numericStep = Number(step) || 1;
    const clamped = Math.min(max, Math.max(min, rawValue));
    const stepped = Math.round((clamped - min) / numericStep) * numericStep + min;
    return Math.min(max, Math.max(min, stepped));
  };

  const previewValue = (nextValue) => {
    setInternalValue(nextValue);
    pendingValueRef.current = nextValue;
    if (inputRef.current instanceof HTMLInputElement) {
      inputRef.current.value = String(nextValue);
    }
    onPreviewChange?.({ target: { value: String(nextValue) } });
  };

  const valueFromClientX = (clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return pendingValueRef.current;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return normalizeValue(min + ratio * (max - min));
  };

  const updateFromPointer = (event) => {
    if (!commitOnly || disabled || event.clientX == null) return;
    previewValue(valueFromClientX(event.clientX));
  };

  const beginInteraction = (event) => {
    lockedCommitValueRef.current = null;
    isInteractingRef.current = true;
    setIsInteracting(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    event?.currentTarget?.setPointerCapture?.(event.pointerId);
    updateFromPointer(event || {});
  };

  const endInteraction = (event) => {
    if (!isInteractingRef.current) return;
    updateFromPointer(event || {});
    isInteractingRef.current = false;
    const inputValue =
      inputRef.current instanceof HTMLInputElement
        ? parseFloat(inputRef.current.value)
        : pendingValueRef.current;
    pendingValueRef.current = inputValue;
    setInternalValue(inputValue);
    if (commitOnly && pendingValueRef.current !== committedValueRef.current) {
      committedValueRef.current = pendingValueRef.current;
      lockedCommitValueRef.current = pendingValueRef.current;
      onChange({ target: { value: String(pendingValueRef.current) } });
    }
    timeoutRef.current = setTimeout(() => setIsInteracting(false), 120);
  };

  const handleInputChange = (e) => {
    const nextValue = parseFloat(e.target.value);
    previewValue(nextValue);

    if (commitOnly && isInteractingRef.current) return;
    if (frameRef.current) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      onChange({ target: { value: String(pendingValueRef.current) } });
    });
  };

  const commonInputProps = {
    type: 'range',
    min,
    max,
    step,
    value: internalValue,
    disabled,
    id: inputId,
    name: inputName,
    'aria-label': ariaLabel,
    'aria-orientation': /** @type {const} */ ('horizontal'),
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': internalValue,
    'aria-valuetext': ariaValueText,
    onPointerDown: beginInteraction,
    onPointerUp: endInteraction,
    onPointerCancel: endInteraction,
    onMouseDown: beginInteraction,
    onMouseUp: endInteraction,
    onTouchStart: beginInteraction,
    onTouchEnd: endInteraction,
    onInput: handleInputChange,
    onChange: handleInputChange,
    className: 'absolute w-full h-full opacity-0 cursor-pointer z-20 select-none',
    style: { touchAction: commitOnly ? 'none' : 'pan-x', WebkitTapHighlightColor: 'transparent' },
  };

  const handleTouchMove = (event) => {
    if (!commitOnly || !isInteractingRef.current) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    previewValue(valueFromClientX(touch.clientX));
  };

  const handleTouchEnd = () => {
    endInteraction({});
  };

  const containerProps = {
    ref: containerRef,
    onPointerDown: beginInteraction,
    onPointerMove: (event) => {
      if (isInteractingRef.current) updateFromPointer(event);
    },
    onPointerUp: endInteraction,
    onPointerCancel: endInteraction,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  if (variant === 'thin') {
    return (
      <div
        {...containerProps}
        className={`group relative flex h-4 w-full cursor-pointer items-center ${disabled ? 'pointer-events-none opacity-30' : ''}`}
        style={{ touchAction: commitOnly ? 'none' : 'pan-x' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute h-1 w-full overflow-hidden rounded-full bg-white/10 transition-all duration-300 group-hover:h-1.5">
          <div
            className={`h-full ${colorClass} ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input ref={inputRef} {...commonInputProps} />
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
        {...containerProps}
        className={`group relative flex h-6 w-full cursor-pointer items-center ${disabled ? 'pointer-events-none opacity-30' : ''}`}
        style={{ touchAction: commitOnly ? 'none' : 'pan-x' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute h-2 w-full overflow-hidden rounded-full bg-white/10 transition-all duration-300 group-hover:h-2.5">
          <div
            className={`h-full ${colorClass} ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input ref={inputRef} {...commonInputProps} />
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
        {...containerProps}
        className={`group relative flex h-10 w-full items-center ${disabled ? 'pointer-events-none opacity-30' : ''}`}
        style={{ touchAction: commitOnly ? 'none' : 'pan-x' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-white/5">
          <div
            className={`h-full ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'} ${colorClass} opacity-90`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          ref={inputRef}
          {...commonInputProps}
          className="absolute z-10 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    );
  }

  // Default / Custom
  const containerH = height || 'h-10';

  return (
    <div
      {...containerProps}
      className={`relative w-full ${containerH} group flex items-center ${disabled ? 'pointer-events-none opacity-30' : ''}`}
      style={{ touchAction: commitOnly ? 'none' : 'pan-x' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Track */}
      {trackClass ? (
        <div className={`absolute w-full ${trackClass} overflow-hidden rounded-full`}>
          <div
            className={`h-full ${colorClass} ${isInteracting ? 'transition-none' : 'transition-all duration-150 ease-out'}`}
            style={{ width: `${percentage}%` }}
          />
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

      <input ref={inputRef} {...commonInputProps} />

      {/* Thumb (Optional / Custom) */}
      {thumbClass ? (
        <div
          className={`pointer-events-none absolute z-10 ${thumbClass}`}
          style={{ left: `calc(${percentage}% - 6px)` }} // simple centering, adjustment might be needed
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
