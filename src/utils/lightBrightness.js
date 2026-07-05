export const MAX_LIGHT_BRIGHTNESS = 255;

export function getLightBrightness(entity, fallback = 0) {
  if (!entity || entity.state === 'unavailable' || entity.state === 'unknown') return fallback;
  if (entity.state !== 'on') return 0;
  return entity.attributes?.brightness ?? MAX_LIGHT_BRIGHTNESS;
}

export function getEffectiveLightBrightness(entityId, entities, localBrightness = {}) {
  const localValue = localBrightness[entityId];
  if (localValue !== undefined) return localValue;
  return getLightBrightness(entities[entityId]);
}

export function getAverageLightBrightness(entityIds, entities, localBrightness = {}) {
  if (!Array.isArray(entityIds) || entityIds.length === 0) return 0;
  const total = entityIds.reduce((sum, entityId) => {
    return sum + getEffectiveLightBrightness(entityId, entities, localBrightness);
  }, 0);
  return Math.round(total / entityIds.length);
}

export function brightnessToPercent(brightness) {
  return Math.round((Math.min(MAX_LIGHT_BRIGHTNESS, Math.max(0, brightness)) / MAX_LIGHT_BRIGHTNESS) * 100);
}
