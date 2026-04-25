import { SwitchCard } from '../../components';

/**
 * @param {string} cardId
 * @param {Record<string, any>} dragProps
 * @param {(id: string) => any} getControls
 * @param {Record<string, any>} cardStyle
 * @param {string} settingsKey
 * @param {Record<string, any>} ctx
 */
export function renderSwitchCard(cardId, dragProps, getControls, cardStyle, settingsKey, ctx) {
  const {
    entities,
    editMode,
    cardSettings,
    customNames,
    customIcons,
    callService,
    setShowSwitchModal,
    isMobile,
    t,
  } = ctx;

  return (
    <SwitchCard
      key={cardId}
      cardId={cardId}
      dragProps={dragProps}
      controls={getControls(cardId)}
      cardStyle={cardStyle}
      entities={entities}
      editMode={editMode}
      cardSettings={cardSettings}
      settingsKey={settingsKey}
      customNames={customNames}
      customIcons={customIcons}
      callService={callService}
      onOpen={() => {
        if (!editMode) setShowSwitchModal(cardId);
      }}
      isMobile={isMobile}
      t={t}
    />
  );
}
