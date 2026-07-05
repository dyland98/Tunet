import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  Lightbulb,
  Utensils,
  Sofa,
  LampDesk,
  Palette,
  Thermometer,
  Sun,
} from '../icons';
import M3Slider from '../components/ui/M3Slider';
import AccessibleModalShell from '../components/ui/AccessibleModalShell';
import { getIconComponent } from '../icons';
import {
  brightnessToPercent,
  getAverageLightBrightness,
  getEffectiveLightBrightness,
  getLightBrightness,
} from '../utils/lightBrightness';

const LIGHT_SERVICE_DEBOUNCE_MS = 260;
const LIGHT_TRANSITION_SETTLE_MS = 1800;

function RoomLightBrightnessSlider({ entityId, value, isOn, disabled, ariaLabel, onCommit }) {
  return (
    <M3Slider
      min={0}
      max={255}
      step={1}
      value={value}
      disabled={disabled}
      onChange={(event) => onCommit(entityId, parseInt(event.target.value, 10))}
      ariaLabel={ariaLabel}
      colorClass={isOn ? 'bg-amber-500' : 'bg-black/20'}
      height="h-8"
      commitOnly
    />
  );
}

export default function LightModal({
  show,
  onClose,
  lightId,
  entities,
  callService,
  getA,
  customIcons,
  t,
}) {
  const activeLightId = String(lightId || '');

  const entity = entities[activeLightId];
  const isUnavailable = entity?.state === 'unavailable' || entity?.state === 'unknown' || !entity;
  const isOn = entity?.state === 'on';

  // --- Feature Detection ---
  const supportedColorModes = entity?.attributes?.supported_color_modes;
  const isDimmable = supportedColorModes
    ? !supportedColorModes.includes('onoff') || supportedColorModes.length > 1
    : (entity?.attributes?.supported_features & 1) === 1;

  const colorModes = entity?.attributes?.supported_color_modes || [];
  const supportsColorTemp =
    colorModes.includes('color_temp') || colorModes.includes('color_temp_kelvin');
  const supportsColor = colorModes.some((mode) => ['hs', 'rgb', 'xy'].includes(mode));
  const showPills = isDimmable && (supportsColorTemp || supportsColor);
  const groupedEntityIds = activeLightId ? getA(activeLightId, 'entity_id', []) : [];
  const groupedEntityIdsKey = groupedEntityIds.join('|');
  const showRightPanel = isDimmable || groupedEntityIds.length > 0;
  const modalTitleId = `light-modal-title-${activeLightId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  // --- Icon ---
  let DefaultIcon = Lightbulb;
  if (activeLightId.includes('kjokken') || activeLightId.includes('kitchen'))
    DefaultIcon = Utensils;
  else if (activeLightId.includes('stova') || activeLightId.includes('living')) DefaultIcon = Sofa;
  else if (activeLightId.includes('studio') || activeLightId.includes('office'))
    DefaultIcon = LampDesk;
  const lightIconName = customIcons[activeLightId] || entities[activeLightId]?.attributes?.icon;
  const LightIcon = lightIconName ? getIconComponent(lightIconName) || DefaultIcon : DefaultIcon;

  // --- Values & Ranges ---
  const minKelvin =
    entity?.attributes?.min_color_temp_kelvin ||
    (entity?.attributes?.max_mireds ? Math.round(1000000 / entity.attributes.max_mireds) : 2000);
  const maxKelvin =
    entity?.attributes?.max_color_temp_kelvin ||
    (entity?.attributes?.min_mireds ? Math.round(1000000 / entity.attributes.min_mireds) : 6500);

  // Current values from Entity
  const remoteKelvin =
    entity?.attributes?.color_temp_kelvin ||
    (entity?.attributes?.color_temp
      ? Math.round(1000000 / entity.attributes.color_temp)
      : Math.round((minKelvin + maxKelvin) / 2));
  const remoteHue = entity?.attributes?.hs_color?.[0] ?? 0;
  const remoteGroupBrightness =
    groupedEntityIds.length > 0 ? getAverageLightBrightness(groupedEntityIds, entities) : null;
  const remoteBrightness =
    remoteGroupBrightness ?? getLightBrightness(entity, getA(activeLightId, 'brightness') || 0);

  // --- Local State for Optimistic UI ---
  const [activeTab, setActiveTab] = useState('brightness');
  const [localBrightness, setLocalBrightness] = useState(remoteBrightness);
  const [localKelvin, setLocalKelvin] = useState(remoteKelvin);
  const [localHue, setLocalHue] = useState(remoteHue);
  const [localSubBrightness, setLocalSubBrightness] = useState({});
  const displayBrightness =
    groupedEntityIds.length > 0
      ? getAverageLightBrightness(groupedEntityIds, entities, localSubBrightness)
      : localBrightness;
  const isVisuallyOn = displayBrightness > 0 || (groupedEntityIds.length === 0 && isOn);
  const serviceTimersRef = useRef(new Map());
  const subSettleTimersRef = useRef(new Map());
  const brightnessSettleTimerRef = useRef(null);
  const pendingBrightnessRef = useRef(null);
  const pendingKelvinRef = useRef(null);
  const pendingHueRef = useRef(null);
  const localSubBrightnessRef = useRef(localSubBrightness);

  const scheduleLightService = (entityId, payload, onCommit) => {
    const currentTimer = serviceTimersRef.current.get(entityId);
    if (currentTimer) clearTimeout(currentTimer);
    const timer = setTimeout(() => {
      serviceTimersRef.current.delete(entityId);
      onCommit?.();
      callService('light', 'turn_on', { entity_id: entityId, ...payload });
    }, LIGHT_SERVICE_DEBOUNCE_MS);
    serviceTimersRef.current.set(entityId, timer);
  };

  const commitLightBrightness = (entityId, brightness) => {
    if (brightness <= 0) {
      callService('light', 'turn_off', { entity_id: entityId });
      return;
    }
    callService('light', 'turn_on', { entity_id: entityId, brightness });
  };

  useEffect(() => {
    return () => {
      serviceTimersRef.current.forEach((timer) => clearTimeout(timer));
      serviceTimersRef.current.clear();
      subSettleTimersRef.current.forEach((timer) => clearTimeout(timer));
      subSettleTimersRef.current.clear();
      if (brightnessSettleTimerRef.current) clearTimeout(brightnessSettleTimerRef.current);
      pendingBrightnessRef.current = null;
      pendingKelvinRef.current = null;
      pendingHueRef.current = null;
    };
  }, []);

  useEffect(() => {
    localSubBrightnessRef.current = localSubBrightness;
  }, [localSubBrightness]);

  // Reset tab on open
  useEffect(() => {
    if (show) setActiveTab('brightness');
  }, [show]);

  useEffect(() => {
    if (
      show &&
      !brightnessSettleTimerRef.current &&
      subSettleTimersRef.current.size === 0
    ) {
      const pending = pendingBrightnessRef.current;
      if (pending !== null) {
        if (Math.abs(remoteBrightness - pending) <= 2) {
          pendingBrightnessRef.current = null;
          setLocalBrightness(remoteBrightness);
        }
        return;
      }
      setLocalBrightness(remoteBrightness);
    }
  }, [activeLightId, remoteBrightness, show]);

  useEffect(() => {
    if (!show) return;
    const nextValues = {};
    groupedEntityIds.forEach((entityId) => {
      const localValue = localSubBrightnessRef.current[entityId];
      nextValues[entityId] =
        subSettleTimersRef.current.has(entityId) && localValue !== undefined
          ? localValue
          : getEffectiveLightBrightness(entityId, entities);
    });
    setLocalSubBrightness(nextValues);
  }, [entities, groupedEntityIdsKey, show]);

  // Sync remote -> local when NOT dragging
  useEffect(() => {
    if (remoteKelvin) {
      const pending = pendingKelvinRef.current;
      if (pending !== null) {
        if (Math.abs(remoteKelvin - pending) <= 50) {
          pendingKelvinRef.current = null;
          setLocalKelvin(remoteKelvin);
        }
        return;
      }
      setLocalKelvin(remoteKelvin);
    }
  }, [remoteKelvin]);

  useEffect(() => {
    if (remoteHue !== undefined) {
      const pending = pendingHueRef.current;
      if (pending !== null) {
        const diff = Math.abs(remoteHue - pending);
        if (Math.min(diff, 360 - diff) <= 2) {
          pendingHueRef.current = null;
          setLocalHue(remoteHue);
        }
        return;
      }
      setLocalHue(remoteHue);
    }
  }, [remoteHue]);

  // --- Handlers ---
  const handleTempChange = (e) => {
    if (!activeLightId) return;
    const val = parseInt(e.target.value, 10);
    pendingKelvinRef.current = val;
    setLocalKelvin(val);
    scheduleLightService(activeLightId, { color_temp_kelvin: val });
  };

  const handleHueChange = (e) => {
    if (!activeLightId) return;
    const val = parseInt(e.target.value, 10);
    pendingHueRef.current = val;
    setLocalHue(val);
    scheduleLightService(activeLightId, { hs_color: [val, 100] });
  };

  const handleBrightnessChange = (e) => {
    if (!activeLightId) return;
    const val = parseInt(e.target.value, 10);
    pendingBrightnessRef.current = val;
    if (brightnessSettleTimerRef.current) clearTimeout(brightnessSettleTimerRef.current);

    const targetEntityIds = groupedEntityIds.length > 0 ? groupedEntityIds : [activeLightId];
    if (groupedEntityIds.length > 0) {
      const nextLocalValues = { ...localSubBrightnessRef.current };
      targetEntityIds.forEach((entityId) => {
        nextLocalValues[entityId] = val;
      });
      localSubBrightnessRef.current = nextLocalValues;
      setLocalSubBrightness((prev) => {
        const next = { ...prev };
        targetEntityIds.forEach((entityId) => {
          next[entityId] = val;
          const currentTimer = subSettleTimersRef.current.get(entityId);
          if (currentTimer) clearTimeout(currentTimer);
        });
        return next;
      });
    } else {
      setLocalBrightness(val);
    }

    targetEntityIds.forEach((entityId) => {
      commitLightBrightness(entityId, val);
    });

    brightnessSettleTimerRef.current = setTimeout(() => {
      brightnessSettleTimerRef.current = null;
    }, LIGHT_TRANSITION_SETTLE_MS);

    if (groupedEntityIds.length > 0) {
      targetEntityIds.forEach((entityId) => {
        const timer = setTimeout(() => {
          subSettleTimersRef.current.delete(entityId);
          const nextLocalValues = { ...localSubBrightnessRef.current };
          delete nextLocalValues[entityId];
          localSubBrightnessRef.current = nextLocalValues;
          setLocalSubBrightness((prev) => {
            const next = { ...prev };
            delete next[entityId];
            return next;
          });
        }, LIGHT_TRANSITION_SETTLE_MS);
        subSettleTimersRef.current.set(entityId, timer);
      });
    }
  };

  const handleBrightnessPreview = (e) => {
    if (!activeLightId) return;
    const val = parseInt(e.target.value, 10);
    if (groupedEntityIds.length > 0) {
      const nextLocalValues = { ...localSubBrightnessRef.current };
      groupedEntityIds.forEach((entityId) => {
        nextLocalValues[entityId] = val;
      });
      localSubBrightnessRef.current = nextLocalValues;
      setLocalSubBrightness((prev) => {
        const next = { ...prev };
        groupedEntityIds.forEach((entityId) => {
          next[entityId] = val;
        });
        return next;
      });
      return;
    }
    setLocalBrightness(val);
  };

  const updateLocalGroupBrightness = (localValues = localSubBrightnessRef.current) => {
    if (groupedEntityIds.length === 0) return;
    const nextGroupBrightness = getAverageLightBrightness(groupedEntityIds, entities, localValues);
    pendingBrightnessRef.current = nextGroupBrightness;
    setLocalBrightness(nextGroupBrightness);
  };

  const keepSubBrightnessLocal = (entityId, value) => {
    const nextLocalValues = { ...localSubBrightnessRef.current, [entityId]: value };
    localSubBrightnessRef.current = nextLocalValues;
    setLocalSubBrightness((prev) => ({ ...prev, [entityId]: value }));
    updateLocalGroupBrightness(nextLocalValues);

    const currentTimer = subSettleTimersRef.current.get(entityId);
    if (currentTimer) clearTimeout(currentTimer);
    const timer = setTimeout(() => {
      subSettleTimersRef.current.delete(entityId);
      const settledLocalValues = { ...localSubBrightnessRef.current };
      delete settledLocalValues[entityId];
      localSubBrightnessRef.current = settledLocalValues;
      setLocalSubBrightness((prev) => {
        const next = { ...prev };
        delete next[entityId];
        return next;
      });
      if (!brightnessSettleTimerRef.current) updateLocalGroupBrightness(settledLocalValues);
    }, LIGHT_TRANSITION_SETTLE_MS);
    subSettleTimersRef.current.set(entityId, timer);
  };

  const handleSubBrightnessCommit = (entityId, value) => {
    keepSubBrightnessLocal(entityId, value);
    commitLightBrightness(entityId, value);
  };

  const handleSubToggle = (entityId) => {
    const subEntity = entities[entityId];
    const isCurrentlyOn = subEntity?.state === 'on';
    const nextValue = isCurrentlyOn
      ? 0
      : Math.max(
          1,
          localSubBrightnessRef.current[entityId] ??
            subEntity?.attributes?.brightness ??
            displayBrightness ??
            255
        );
    keepSubBrightnessLocal(entityId, nextValue);
    if (isCurrentlyOn) {
      callService('light', 'turn_off', { entity_id: entityId });
    } else {
      callService('light', 'turn_on', { entity_id: entityId, brightness: nextValue });
    }
  };

  // Determine glow color
  const getGlowColor = () => {
    if (!isVisuallyOn) return 'transparent';
    if (activeTab === 'color' && supportsColor) {
      return `hsl(${localHue}, 100%, 50%)`;
    }
    if (activeTab === 'warmth' && supportsColorTemp) {
      if (localKelvin < 3000) return '#f59e0b'; // Warm/Orange
      if (localKelvin > 5000) return '#93c5fd'; // Cool/Blue
      return '#fbbf24'; // Neutral
    }
    return '#fbbf24'; // Default amber
  };

  if (!show || !activeLightId) return null;

  return (
    <AccessibleModalShell
      open={show && !!activeLightId}
      onClose={onClose}
      titleId={modalTitleId}
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      overlayStyle={{ backdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.3)' }}
      panelClassName={`w-full border ${showRightPanel ? 'max-w-5xl' : 'max-w-xl'} flex flex-col overflow-hidden rounded-3xl md:rounded-[3rem] ${showRightPanel ? 'lg:grid lg:grid-cols-5' : ''} popup-anim relative max-h-[90vh] shadow-2xl backdrop-blur-xl md:min-h-[550px]`}
      panelStyle={{
        background: 'linear-gradient(135deg, var(--card-bg) 0%, var(--modal-bg) 100%)',
        borderColor: 'var(--glass-border)',
        color: 'var(--text-primary)',
      }}
    >
      {() => (
        <>
        {/* Close Button Row (Mobile & Desktop) */}
        <div className="absolute top-6 right-6 z-50 md:top-10 md:right-10">
          <button onClick={onClose} className="modal-close" aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* LEFT PANEL: Visuals & Ambient (3 cols) */}
        <div
          className={`${showRightPanel ? 'border-b lg:col-span-3 lg:border-r lg:border-b-0' : 'h-full w-full flex-1'} relative flex shrink-0 flex-col justify-between overflow-hidden p-4 md:p-10`}
          style={{ borderColor: 'var(--glass-border)' }}
        >
          {/* Dynamic Ambient Glow - Subtler */}
          <div
            className="pointer-events-none absolute top-1/2 left-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-5 blur-[100px] transition-all duration-1000"
            style={{ backgroundColor: getGlowColor() }}
          />

          {/* Header */}
          <div className="relative z-10 mb-6 flex shrink-0 items-center gap-4">
            <div
              className={`rounded-2xl p-4 transition-all duration-500 ${isUnavailable ? 'bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : isVisuallyOn ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
            >
              <LightIcon className="h-8 w-8" />
            </div>
            <div className="min-w-0">
              <h2
                id={modalTitleId}
                className="truncate pr-1 text-2xl leading-none font-light tracking-tight text-[var(--text-primary)] uppercase italic"
              >
                {getA(activeLightId, 'friendly_name', t('common.light'))}
              </h2>
              <div
                className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 ${isUnavailable ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${isUnavailable ? 'bg-[var(--status-error-fg)]' : isVisuallyOn ? 'bg-[var(--status-success-fg)] shadow-[0_0_6px_var(--status-success-fg)]' : 'bg-slate-600'}`}
                />
                <span className="text-[10px] font-bold tracking-widest uppercase italic">
                  {isUnavailable
                    ? t('status.unavailable')
                    : isVisuallyOn
                      ? t('common.on')
                      : t('common.off')}
                </span>
                {isVisuallyOn && (
                  <span className="border-l border-[var(--glass-border)] pl-2 text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase italic">
                    {brightnessToPercent(displayBrightness)}
                    %
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Centerpiece Icon - Toggle Button */}
          <div className="relative z-10 my-4 flex min-h-[100px] flex-1 items-center justify-center md:my-0 md:min-h-0">
            <button
              onClick={() =>
                !isUnavailable && callService('light', 'toggle', { entity_id: activeLightId })
              }
              aria-label={t('light.toggle') || t('common.toggle')}
              disabled={isUnavailable}
              className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-700 md:h-36 md:w-36 ${
                isUnavailable
                  ? 'cursor-not-allowed bg-[var(--status-error-bg)] text-[var(--status-error-fg)]'
                  : isVisuallyOn
                    ? 'cursor-pointer bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-2xl active:scale-95'
                    : 'cursor-pointer bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] active:scale-95'
              } border border-[var(--glass-border)]`}
              style={{
                // Dimmed glow behind icon (lower opacity on hex color or lower radius)
                boxShadow: isVisuallyOn ? `0 0 60px -10px ${getGlowColor()}15` : 'none',
              }}
            >
              {isUnavailable ? (
                <AlertTriangle className="h-8 w-8 md:h-10 md:w-10" />
              ) : (
                <LightIcon className="h-10 w-10 stroke-[1.5px] md:h-16 md:w-16" />
              )}

              {/* Subtle inner ring */}
              {isVisuallyOn && (
                <div className="absolute inset-0 rounded-full border border-white/10 opacity-30" />
              )}
            </button>
          </div>

          {/* Tabs / Mode Switcher - Sleek Segmented Control */}
          <div className="relative z-10 mx-auto w-full max-w-sm shrink-0">
            {showPills && (
              <div className="flex w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1">
                <button
                  onClick={() => setActiveTab('brightness')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'brightness' ? 'bg-[var(--glass-bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'}`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  <span>{t('light.brightness')}</span>
                </button>
                {supportsColorTemp && (
                  <button
                    onClick={() => setActiveTab('warmth')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'warmth' ? 'bg-[var(--glass-bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Thermometer className="h-3.5 w-3.5" />
                    <span>{t('light.warmth')}</span>
                  </button>
                )}
                {supportsColor && (
                  <button
                    onClick={() => setActiveTab('color')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold tracking-wider uppercase transition-all duration-300 ${activeTab === 'color' ? 'bg-[var(--glass-bg-hover)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'}`}
                  >
                    <Palette className="h-3.5 w-3.5" />
                    <span>{t('light.color')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Controls (2 cols) */}
        {showRightPanel && (
          <div className="flex max-h-[90vh] flex-col overflow-hidden lg:col-span-2">
            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4 md:space-y-8 md:p-8 lg:pt-16">
              {/* Dynamic Control Area - Simplified */}
              {isDimmable && (
                <div className="flex min-h-[100px] flex-col justify-center md:min-h-[140px]">
                  {/* Brightness Slider */}
                  {activeTab === 'brightness' && (
                    <div className="space-y-2 md:space-y-4">
                      <div className="flex items-end justify-between px-1">
                        <label className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                          {t('light.brightness')}
                        </label>
                        <span className="font-mono text-lg font-medium text-[var(--text-primary)]">
                          {brightnessToPercent(displayBrightness)}
                          %
                        </span>
                      </div>
                      <div className="h-10">
                        <M3Slider
                          min={0}
                          max={255}
                          step={1}
                          value={displayBrightness}
                          disabled={isUnavailable}
                          onChange={handleBrightnessChange}
                          onPreviewChange={handleBrightnessPreview}
                          ariaLabel={t('light.brightness')}
                          colorClass="bg-amber-500"
                          variant="fat" // Keep fat for touch, but in smaller container
                          commitOnly
                        />
                      </div>
                    </div>
                  )}

                  {/* Warmth Slider - Re-styled */}
                  {activeTab === 'warmth' && (
                    <div className="space-y-2 md:space-y-4">
                      <div className="flex items-end justify-between px-1">
                        <label className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                          {t('light.colorTemperature')}
                        </label>
                        <span className="font-mono text-lg font-medium text-[var(--text-primary)]">
                          {localKelvin}K
                        </span>
                      </div>
                      <div className="h-10">
                        <M3Slider
                          min={minKelvin}
                          max={maxKelvin}
                          step={50}
                          value={localKelvin}
                          disabled={isUnavailable}
                          onChange={handleTempChange}
                          onPreviewChange={(event) => setLocalKelvin(parseInt(event.target.value, 10))}
                          ariaLabel={t('light.colorTemperature')}
                          ariaValueText={`${localKelvin}K`}
                          trackClass="h-full rounded-xl shadow-inner"
                          trackStyle={{
                            background:
                              'linear-gradient(90deg, #ffb14e 0%, #fffbe6 50%, #9cb8ff 100%)',
                          }}
                          thumbClass="top-0 bottom-0 w-1.5 border-x border-[var(--glass-border)] bg-black/40 shadow-sm backdrop-blur-sm"
                          thumbOffset={3}
                          showFill={false}
                          commitOnly
                        />
                      </div>
                    </div>
                  )}

                  {/* Color Slider - Re-styled */}
                  {activeTab === 'color' && (
                    <div className="space-y-2 md:space-y-4">
                      <div className="flex items-end justify-between px-1">
                        <label className="text-xs font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                          {t('light.hue')}
                        </label>
                        {/* Color Preview Dot */}
                        <div
                          className="h-6 w-6 rounded-full border border-[var(--glass-border)] shadow-sm"
                          style={{ backgroundColor: `hsl(${localHue}, 100%, 50%)` }}
                        />
                      </div>
                      <div className="h-10">
                        <M3Slider
                          min={0}
                          max={360}
                          step={1}
                          value={localHue}
                          disabled={isUnavailable}
                          onChange={handleHueChange}
                          onPreviewChange={(event) => setLocalHue(parseInt(event.target.value, 10))}
                          ariaLabel={t('light.hue')}
                          ariaValueText={`${localHue} degrees`}
                          trackClass="h-full rounded-xl shadow-inner"
                          trackStyle={{
                            background:
                              'linear-gradient(90deg, #ef4444 0%, #f59e0b 16%, #facc15 32%, #22c55e 48%, #06b6d4 64%, #6366f1 80%, #d946ef 100%)',
                          }}
                          thumbClass="top-0 bottom-0 w-1.5 bg-white/80 shadow-sm backdrop-blur-sm"
                          thumbOffset={3}
                          showFill={false}
                          commitOnly
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub Entities - Cleaner list */}
              {groupedEntityIds.length > 0 && (
                <div className="border-t border-[var(--glass-border)] pt-4 md:pt-6">
                  <h3 className="mb-2 pl-1 text-xs font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase md:mb-4">
                    {t('light.roomLights')}
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    {groupedEntityIds.map((cid) => {
                      const subEnt = entities[cid];
                      const subName =
                        subEnt?.attributes?.friendly_name || cid.split('.')[1].replace(/_/g, ' ');
                      const subIsOn = subEnt?.state === 'on';
                      const subUnavail = subEnt?.state === 'unavailable';
                      const subBrightness =
                        getEffectiveLightBrightness(cid, entities, localSubBrightness);
                      const subVisualIsOn = subBrightness > 0 || subIsOn;

                      return (
                        <div key={cid} className="flex items-end gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-end justify-between px-1">
                              <span className="truncate text-xs font-bold text-[var(--text-secondary)] opacity-90">
                                {subName}
                              </span>
                            </div>
                            <RoomLightBrightnessSlider
                              entityId={cid}
                              value={subBrightness}
                              isOn={subVisualIsOn}
                              disabled={subUnavail}
                              ariaLabel={`${subName} ${t('light.brightness')}`}
                              onCommit={handleSubBrightnessCommit}
                            />
                          </div>

                          {/* Toggle Button - Aligned to bottom (items-end on parent) */}
                          <button
                            onClick={() => handleSubToggle(cid)}
                            aria-label={`${subName} ${t('common.toggle')}`}
                            className={`flex h-8 w-12 items-center justify-center rounded-xl border transition-all ${subVisualIsOn ? 'border-amber-500/30 bg-amber-500/20 text-amber-400' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
                          >
                            <div
                              className={`h-2 w-2 rounded-full transition-all ${subVisualIsOn ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-[var(--text-secondary)] opacity-50'}`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions Footer (Right Column) - Removed redundant toggle */}
          </div>
        )}
        </>
      )}
    </AccessibleModalShell>
  );
}
