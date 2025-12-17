import React from 'react';
import { css, keyframes } from '@mongodb-js/compass-components';
import ResourcesPanelHeader from './header';
import ResourcesPanelLinks from './links';
import ResourcesPanelFooter from './footer';

const panelActualWidth = 428;
const panelWidthWithMargin = 468;

const resourcesPanelStyles = css({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 10,
});

const bgDarkenAnimation = keyframes({
  from: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  to: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

const resourcesPanelBackgroundStyles = css({
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: -1,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  animationDuration: '250ms',
  animationDirection: 'forwards',
  animationName: bgDarkenAnimation,
});

const panelOpenAnimation = keyframes({
  from: {
    left: '100%',
  },
  to: {
    left: `calc(100% - ${panelWidthWithMargin}px)`,
  },
});

const resourcePanelContentStyles = css({
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: `calc(100% - ${panelWidthWithMargin}px)`,
  width: `${panelActualWidth}px`,
  overflow: 'auto',
  padding: '24px',
  paddingBottom: '48px',
  background: 'var(--vscode-editor-background)',
  animationDuration: '250ms',
  animationDirection: 'forwards',
  animationName: panelOpenAnimation,
  animationTimingFunction: 'cubic-bezier(0, 1.3, 0.7, 1)',
  boxShadow: '-4px 0px 5px rgba(0, 0, 0, 0.25)',
});

const ResourcesPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className={resourcesPanelStyles}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={resourcesPanelBackgroundStyles} onClick={onClose} />
      <div className={resourcePanelContentStyles}>
        <ResourcesPanelHeader onCloseClick={onClose} />
        <ResourcesPanelLinks />
        <ResourcesPanelFooter />
      </div>
    </div>
  );
};

export const TELEMETRY_SCREEN_ID = 'overviewResourcesPanel';

export default ResourcesPanel;
