import React from 'react';

/**
 * Battery-shaped container for header content.
 * Pure presentational — pill shape with optional terminal nub.
 *
 * @param {Object} props
 * @param {'glass'|'solid'|'outline'} [props.variant='glass']
 * @param {boolean} [props.showNub=true]
 * @param {boolean} [props.isMobile=false]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function BatteryBar({
  variant = 'glass',
  showNub = true,
  isMobile = false,
  className = '',
  children,
}) {
  const variantClass =
    variant === 'solid'
      ? 'battery-bar--solid'
      : variant === 'outline'
        ? 'battery-bar--outline'
        : 'battery-bar--glass';

  return (
    <div
      className={`battery-bar ${variantClass} ${isMobile ? 'battery-bar--mobile' : ''} ${className}`}
    >
      <div className="battery-bar__body">{children}</div>
      {showNub && <div className="battery-bar__nub" />}
    </div>
  );
}
