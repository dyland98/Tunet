import { useCallback, memo } from 'react';
import { getIconComponent } from '../../icons';
import { ToggleRight, Thermometer, Droplets } from '../../icons';

/** @param {any} props */
const SwitchCard = ({
  cardId,
  dragProps,
  controls,
  cardStyle,
  entities,
  editMode,
  cardSettings,
  settingsKey,
  customNames,
  customIcons,
  onOpen,
  isMobile,
  callService,
  t,
}) => {
  const entity = entities[cardId];
  const DefaultIcon = ToggleRight;
  const iconName = customIcons[cardId] || entity?.attributes?.icon;
  const CardIcon = iconName ? getIconComponent(iconName) || DefaultIcon : DefaultIcon;
  const state = entity?.state;
  const isUnavailable = state === 'unavailable' || state === 'unknown' || !state;
  const isOn = state === 'on';
  const subEntities = entity?.attributes?.entity_id || [];
  const activeCount = Array.isArray(subEntities)
    ? subEntities.filter((id) => entities[id]?.state === 'on').length
    : 0;
  const totalCount = Array.isArray(subEntities) ? subEntities.length : 0;
  const name = customNames[cardId] || entity?.attributes?.friendly_name;

  const settings = cardSettings[settingsKey] || cardSettings[cardId] || {};
  const sizeSetting = settings.size;
  const isSmall = sizeSetting === 'small';
  const isDenseMobile = isMobile && !isSmall;

  const tempEntityId = settings.tempEntityId;
  const humidityEntityId = settings.humidityEntityId;
  const tempEntity = tempEntityId ? entities[tempEntityId] : null;
  const humidityEntity = humidityEntityId ? entities[humidityEntityId] : null;
  const tempValue = tempEntity && tempEntity.state !== 'unavailable' ? tempEntity.state : null;
  const tempUnit = tempEntity?.attributes?.unit_of_measurement || '°C';
  const humidityValue =
    humidityEntity && humidityEntity.state !== 'unavailable' ? humidityEntity.state : null;
  const humidityUnit = humidityEntity?.attributes?.unit_of_measurement || '%';

  const handleToggle = useCallback(
    (event) => {
      event.stopPropagation();
      if (isUnavailable) return;
      callService('switch', 'toggle', { entity_id: cardId });
    },
    [cardId, callService, isUnavailable]
  );

  if (isSmall) {
    return (
      <div
        key={cardId}
        {...dragProps}
        data-haptic={editMode ? undefined : 'card'}
        onClick={(e) => {
          e.stopPropagation();
          if (!editMode) onOpen();
        }}
        onKeyDown={(e) => {
          if (editMode) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onOpen();
          }
        }}
        role={editMode ? undefined : 'button'}
        tabIndex={editMode ? -1 : 0}
        className={`touch-feedback group relative flex h-full items-center gap-4 overflow-hidden rounded-3xl border p-4 pl-5 font-sans transition-all duration-500 ${!editMode ? 'cursor-pointer active:scale-[0.98]' : 'cursor-move'} ${isUnavailable ? 'opacity-70' : ''}`}
        style={cardStyle}
      >
        {controls}
        <button
          onClick={handleToggle}
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-500 ${isOn ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-bg-hover)]'}`}
          disabled={isUnavailable}
          aria-label={`${name || t('common.switch') || 'Switch'}: ${isOn ? t('common.off') : t('common.on')}`}
        >
          <CardIcon
            className={`h-6 w-6 stroke-[1.5px] ${isOn ? 'fill-amber-400/20' : ''} transition-transform duration-300 group-hover:scale-110`}
          />
        </button>
        <div className="flex h-full min-w-0 flex-1 flex-col justify-center gap-3 pt-1">
          <div className="flex items-baseline justify-between pr-1">
            <p className="truncate text-xs leading-none font-bold tracking-wide text-[var(--text-secondary)] uppercase opacity-60">
              {String(name || t('common.switch') || 'Switch')}
            </p>
            {isUnavailable && (
              <span
                className="text-lg leading-none font-medium text-[var(--status-error-fg)]"
                aria-label={t('status.unavailable')}
                title={t('status.unavailable')}
              >
                ⚠
              </span>
            )}
          </div>
          <div className="flex w-full items-center h-6">
            <div
              className="relative w-full h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 bg-amber-500`}
                style={{ width: isUnavailable ? '0%' : isOn ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      key={cardId}
      {...dragProps}
      data-haptic={editMode ? undefined : 'card'}
      onClick={(e) => {
        e.stopPropagation();
        if (!editMode) onOpen();
      }}
      onKeyDown={(e) => {
        if (editMode) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onOpen();
        }
      }}
      role={editMode ? undefined : 'button'}
      tabIndex={editMode ? -1 : 0}
      className={`touch-feedback group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border font-sans transition-all duration-500 ${isDenseMobile ? 'p-5' : 'p-7'} ${!editMode ? 'cursor-pointer active:scale-98' : 'cursor-move'} ${isUnavailable ? 'opacity-70' : ''}`}
      style={cardStyle}
    >
      {controls}
      <div className="flex items-start justify-between">
        <button
          onClick={handleToggle}
          className={`transition-all duration-500 ${isOn ? 'bg-amber-500/20 text-amber-400' : 'bg-[var(--glass-bg)] text-[var(--text-muted)]'} ${isDenseMobile ? 'rounded-xl p-2.5' : 'rounded-2xl p-3'}`}
          disabled={isUnavailable}
          aria-label={`${name || t('common.switch') || 'Switch'}: ${isOn ? t('common.off') : t('common.on')}`}
        >
          <CardIcon
            className={`${isDenseMobile ? 'h-4 w-4' : 'h-5 w-5'} stroke-[1.5px] ${isOn ? 'fill-amber-400/20' : ''} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
          />
        </button>
        <div
          className={`flex items-center rounded-full border transition-all ${isUnavailable ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : isOn ? 'border-amber-500/20 bg-amber-500/10 text-amber-500' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'} ${isDenseMobile ? 'gap-1 px-2.5 py-1' : 'gap-1.5 px-3 py-1'}`}
        >
          <span className={`${isDenseMobile ? 'text-[10px]' : 'text-xs'} font-bold tracking-widest uppercase`}>
            {isUnavailable
              ? t('status.unavailable')
              : totalCount > 0
                ? activeCount > 0
                  ? `${activeCount}/${totalCount}`
                  : t('common.off')
                : isOn
                  ? t('common.on')
                  : t('common.off')}
          </span>
        </div>
      </div>

      {(tempValue !== null || humidityValue !== null) && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-end gap-1.5 ${isDenseMobile ? 'right-5' : 'right-7'}`}
        >
          {tempValue !== null && (
            <div className="flex items-center gap-1 rounded-full bg-[var(--glass-bg)] px-2.5 py-1 text-[var(--text-secondary)]">
              <Thermometer className={`${isDenseMobile ? 'h-3 w-3' : 'h-3.5 w-3.5'} stroke-[1.75px]`} />
              <span className={`${isDenseMobile ? 'text-[10px]' : 'text-xs'} font-bold tabular-nums`}>
                {parseFloat(tempValue).toFixed(1)}{tempUnit}
              </span>
            </div>
          )}
          {humidityValue !== null && (
            <div className="flex items-center gap-1 rounded-full bg-[var(--glass-bg)] px-2.5 py-1 text-[var(--text-secondary)]">
              <Droplets className={`${isDenseMobile ? 'h-3 w-3' : 'h-3.5 w-3.5'} stroke-[1.75px]`} />
              <span className={`${isDenseMobile ? 'text-[10px]' : 'text-xs'} font-bold tabular-nums`}>
                {parseFloat(humidityValue).toFixed(0)}{humidityUnit}
              </span>
            </div>
          )}
        </div>
      )}

      <div className={`${isDenseMobile ? 'mt-1' : 'mt-2'} font-sans`}>
        {!isDenseMobile && (
          <p className="mb-0.5 text-[10px] leading-none font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase opacity-60">
            {String(name || t('common.switch') || 'Switch')}
          </p>
        )}
        <div className={`flex items-baseline gap-1 leading-none ${isDenseMobile ? 'mt-0.5' : 'mt-1'}`}>
          <span
            className={`${isDenseMobile ? 'text-3xl' : 'text-4xl'} leading-none font-thin text-[var(--text-primary)]`}
          >
            {isUnavailable ? '--' : isOn ? '100' : '0'}
          </span>
          <span className={`${isDenseMobile ? 'text-lg' : 'ml-1 text-xl'} font-light text-[var(--text-muted)]`}>
            %
          </span>
        </div>
        {isDenseMobile && (
          <p className="mt-3 mb-1 text-[10px] leading-none font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase opacity-60">
            {String(name || t('common.switch') || 'Switch')}
          </p>
        )}
        <div className={`flex w-full items-center ${isDenseMobile ? 'mt-2' : 'mt-3'} h-10`}>
          <div
            className="relative w-full h-5 overflow-hidden rounded-full border"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="h-full transition-all duration-500 ease-out bg-amber-500/60"
              style={{ width: isUnavailable ? '0%' : isOn ? '100%' : '0%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(SwitchCard);
