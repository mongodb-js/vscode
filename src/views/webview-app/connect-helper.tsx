import React from 'react';
import {
  css,
  spacing,
  Button,
  Body,
  palette,
  cx,
} from '@mongodb-js/compass-components';
import { connectWithConnectionString } from './vscode-api';

const containerStyles = css({
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'column',
  gap: spacing[2],
  marginTop: spacing[4],
});

const cardContainerStyles = css({
  width: '400px',
  height: '200px',
  borderRadius: '6px',
  overflow: 'hidden',
});

const inlineCardStyles = css({
  width: '50%',
  height: '100%',
  display: 'inline-flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: spacing[4],
});

const leftCardStyles = cx(
  inlineCardStyles,
  css({
    background: palette.gray.light2,
  })
);

const rightCardStyles = cx(
  inlineCardStyles,
  css({
    background: palette.gray.dark4,
  })
);

const getOSCommandShortcutName = (): string => {
  if (navigator.userAgent.includes('Win')) {
    return 'Ctrl';
  }

  return 'Cmd';
};

const ConnectHelper: React.FC<{
  onClickOpenConnectionForm: () => void;
}> = ({ onClickOpenConnectionForm }) => {
  return (
    <div className={containerStyles}>
      <div className={cardContainerStyles}>
        <div className={leftCardStyles}>
          <div>
            <Body as="div" darkMode={false}>
              Connect with
            </Body>
            <Body as="div" darkMode={false}>
              <strong>Connection String</strong>
            </Body>
          </div>
          <Button
            aria-label="Connect with connection string"
            darkMode={false}
            onClick={connectWithConnectionString}
          >
            Connect
          </Button>
        </div>
        <div className={rightCardStyles}>
          <div>
            <Body as="div" darkMode>
              Advanced
            </Body>
            <Body as="div" darkMode>
              <strong>Connection Settings</strong>
            </Body>
          </div>
          <Button
            aria-label="Open connection form"
            darkMode
            onClick={onClickOpenConnectionForm}
          >
            Open form
          </Button>
        </div>
      </div>
      <Body as="p">
        <strong>{getOSCommandShortcutName()} + Shift + P</strong> for all
        MongoDB Command Palette options
      </Body>
    </div>
  );
};

export default ConnectHelper;
