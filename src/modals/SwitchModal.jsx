import React from 'react';
import { X, AlertTriangle, ToggleRight } from '../icons';
import AccessibleModalShell from '../components/ui/AccessibleModalShell';
import { getIconComponent } from '../icons';

export default function SwitchModal({
  show,
  onClose,
  switchId,
  entities,
  callService,
  getA,
  customIcons,
  t,
}) {
  const activeSwitchId = String(switchId || '');
  const entity = entities[activeSwitchId];
  const isUnavailable = entity?.state === 'unavailable' || entity?.state === 'unknown' || !entity;
  const isOn = entity?.state === 'on';

  const groupedEntityIds = activeSwitchId ? (entity?.attributes?.entity_id || []) : [];
  const showRightPanel = groupedEntityIds.length > 0;
  const modalTitleId = `switch-modal-title-${activeSwitchId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

  const iconName = customIcons[activeSwitchId] || entity?.attributes?.icon;
  const SwitchIcon = iconName ? getIconComponent(iconName) || ToggleRight : ToggleRight;

  const glowColor = isOn ? '#fbbf24' : 'transparent';

  if (!show || !activeSwitchId) return null;

  return (
    <AccessibleModalShell
      open={show && !!activeSwitchId}
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
          {/* Close Button */}
          <div className="absolute top-6 right-6 z-50 md:top-10 md:right-10">
            <button onClick={onClose} className="modal-close" aria-label={t('common.close')}>
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* LEFT PANEL */}
          <div
            className={`${showRightPanel ? 'border-b lg:col-span-3 lg:border-r lg:border-b-0' : 'h-full w-full flex-1'} relative flex shrink-0 flex-col justify-between overflow-hidden p-4 md:p-10`}
            style={{ borderColor: 'var(--glass-border)' }}
          >
            {/* Ambient Glow */}
            <div
              className="pointer-events-none absolute top-1/2 left-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-5 blur-[100px] transition-all duration-1000"
              style={{ backgroundColor: glowColor }}
            />

            {/* Header */}
            <div className="relative z-10 mb-6 flex shrink-0 items-center gap-4">
              <div
                className={`rounded-2xl p-4 transition-all duration-500 ${isUnavailable ? 'bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : isOn ? 'bg-amber-500/15 text-amber-400' : 'bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
              >
                <SwitchIcon className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <h2
                  id={modalTitleId}
                  className="truncate pr-1 text-2xl leading-none font-light tracking-tight text-[var(--text-primary)] uppercase italic"
                >
                  {getA(activeSwitchId, 'friendly_name', t('common.switch') || 'Switch')}
                </h2>
                <div
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 ${isUnavailable ? 'border-[var(--status-error-border)] bg-[var(--status-error-bg)] text-[var(--status-error-fg)]' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full ${isUnavailable ? 'bg-[var(--status-error-fg)]' : isOn ? 'bg-[var(--status-success-fg)] shadow-[0_0_6px_var(--status-success-fg)]' : 'bg-slate-600'}`}
                  />
                  <span className="text-[10px] font-bold tracking-widest uppercase italic">
                    {isUnavailable
                      ? t('status.unavailable')
                      : isOn
                        ? t('common.on')
                        : t('common.off')}
                  </span>
                </div>
              </div>
            </div>

            {/* Toggle Button */}
            <div className="relative z-10 my-4 flex min-h-[100px] flex-1 items-center justify-center md:my-0 md:min-h-0">
              <button
                onClick={() =>
                  !isUnavailable && callService('switch', 'toggle', { entity_id: activeSwitchId })
                }
                aria-label={t('common.toggle')}
                disabled={isUnavailable}
                className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-700 md:h-36 md:w-36 ${
                  isUnavailable
                    ? 'cursor-not-allowed bg-[var(--status-error-bg)] text-[var(--status-error-fg)]'
                    : isOn
                      ? 'cursor-pointer bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-2xl active:scale-95'
                      : 'cursor-pointer bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] active:scale-95'
                } border border-[var(--glass-border)]`}
                style={{
                  boxShadow: isOn ? `0 0 60px -10px ${glowColor}40` : 'none',
                }}
              >
                {isUnavailable ? (
                  <AlertTriangle className="h-8 w-8 md:h-10 md:w-10" />
                ) : (
                  <SwitchIcon className="h-10 w-10 stroke-[1.5px] md:h-16 md:w-16" />
                )}
                {isOn && (
                  <div className="absolute inset-0 rounded-full border border-white/10 opacity-30" />
                )}
              </button>
            </div>

            {/* Empty bottom spacer to match LightModal layout */}
            <div className="relative z-10 mx-auto w-full max-w-sm shrink-0" />
          </div>

          {/* RIGHT PANEL: Group Entities */}
          {showRightPanel && (
            <div className="flex max-h-[90vh] flex-col overflow-hidden lg:col-span-2">
              <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4 md:space-y-8 md:p-8 lg:pt-16">
                <div className="border-t border-[var(--glass-border)] pt-4 md:pt-6">
                  <h3 className="mb-2 pl-1 text-xs font-bold tracking-[0.2em] text-[var(--text-secondary)] uppercase md:mb-4">
                    {t('light.roomLights') || 'Entities'}
                  </h3>
                  <div className="space-y-2 md:space-y-3">
                    {groupedEntityIds.map((cid) => {
                      const subEnt = entities[cid];
                      const subName =
                        subEnt?.attributes?.friendly_name || cid.split('.')[1].replace(/_/g, ' ');
                      const subIsOn = subEnt?.state === 'on';
                      const subUnavail =
                        subEnt?.state === 'unavailable' || subEnt?.state === 'unknown' || !subEnt;

                      return (
                        <div key={cid} className="flex items-end gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-end justify-between px-1">
                              <span className="truncate text-xs font-bold text-[var(--text-secondary)] opacity-90">
                                {subName}
                              </span>
                            </div>
                            <div className="relative h-8 w-full overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]">
                              <div
                                className={`absolute top-0 left-0 h-full transition-all duration-500 ${subIsOn ? 'bg-amber-500 opacity-80' : 'bg-black/20 opacity-30'}`}
                                style={{ width: subIsOn ? '100%' : '0%' }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              !subUnavail &&
                              callService('switch', 'toggle', { entity_id: cid })
                            }
                            aria-label={`${subName} ${t('common.toggle')}`}
                            disabled={subUnavail}
                            className={`flex h-8 w-12 items-center justify-center rounded-xl border transition-all ${subIsOn ? 'border-amber-500/30 bg-amber-500/20 text-amber-400' : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]'}`}
                          >
                            <div
                              className={`h-2 w-2 rounded-full transition-all ${subIsOn ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-[var(--text-secondary)] opacity-50'}`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AccessibleModalShell>
  );
}
