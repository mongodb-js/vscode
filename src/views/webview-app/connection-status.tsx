import React from 'react';
import {
  Body,
  Button,
  Icon,
  IconButton,
  css,
  cx,
  palette,
  spacing,
} from '@mongodb-js/compass-components';
import { CONNECTION_STATUS } from './extension-app-message-constants';
import LINKS from '../../utils/links';
import useConnectionStatus from './use-connection-status';
import { createNewPlayground, renameActiveConnection } from './vscode-api';

const connectedContainerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[4],
});

const statusDotStyles = css({
  width: spacing[2],
  height: spacing[2],
  borderRadius: '50%',
  pointerEvents: 'none',
  display: 'inline-block',
  marginRight: spacing[2],
});

const connectedStatusDotStyles = cx(
  statusDotStyles,
  css({
    backgroundColor: palette.green.base,
  })
);

const disconnectedStatusDotStyles = cx(
  statusDotStyles,
  css({
    backgroundColor: palette.red.base,
  })
);

const statusContainerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[1],
  alignItems: 'center',
  justifyContent: 'center',
  '@media(min-width: 500px)': {
    '&': {
      flexDirection: 'row',
      gap: spacing[2],
    },
  },
});

const connectionNameStyles = css({
  display: 'flex',
  alignItems: 'center',
});

const playgroundCtaContainerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[3],
  alignItems: 'center',
  '@media(min-width: 500px)': {
    '&': {
      gap: spacing[5],
      justifyContent: 'center',
      flexDirection: 'row',
    },
  },
});

const textContainerStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: spacing[1],
});

const ctaTextStyles = css({
  fontSize: '18px',
  display: 'flex',
  alignItems: 'center',
});

const ConnectionStatusConnected: React.FC<{ connectionName: string }> = ({
  connectionName,
}) => {
  return (
    <div className={connectedContainerStyles}>
      <div className={statusContainerStyles}>
        <Body as="div">
          <span className={connectedStatusDotStyles} />
          Connected to:
        </Body>
        <Body as="div" className={connectionNameStyles}>
          <strong>{connectionName}</strong>
          <IconButton
            onClick={renameActiveConnection}
            aria-label="Rename connection"
          >
            <Icon size="xsmall" glyph="Edit" />
          </IconButton>
        </Body>
      </div>
      <div className={playgroundCtaContainerStyles}>
        <Body className={textContainerStyles} as="div">
          <div className={ctaTextStyles}>All set. Ready to start?</div>
          <div className={ctaTextStyles}>
            Create a playground.
            <IconButton
              target="_blank"
              rel="noopener"
              as="a"
              href={LINKS.extensionDocs('playgrounds')}
              aria-label="Learn about playgrounds"
            >
              <Icon glyph="InfoWithCircle" />
            </IconButton>
          </div>
        </Body>
        <Button
          onClick={createNewPlayground}
          variant="baseGreen"
          aria-label="Create playground"
        >
          Create playground
        </Button>
      </div>
    </div>
  );
};

// eslint-disable-next-line react/no-multi-comp
const ConnectionStatus: React.FC = () => {
  const { connectionStatus, connectionName } = useConnectionStatus();
  return (
    <>
      {connectionStatus === CONNECTION_STATUS.CONNECTED && (
        <ConnectionStatusConnected connectionName={connectionName} />
      )}
      {connectionStatus === CONNECTION_STATUS.DISCONNECTED && (
        <Body as="div">
          <span className={disconnectedStatusDotStyles} />
          Not connected.
        </Body>
      )}
      {connectionStatus === CONNECTION_STATUS.LOADING && (
        <Body as="p">Loading...</Body>
      )}
      {connectionStatus === CONNECTION_STATUS.CONNECTING && (
        <Body as="p">Connecting...</Body>
      )}
      {connectionStatus === CONNECTION_STATUS.DISCONNECTING && (
        <Body as="p">Disconnecting...</Body>
      )}
    </>
  );
};

export default ConnectionStatus;
