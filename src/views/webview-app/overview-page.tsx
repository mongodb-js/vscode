import React, { useCallback, useLayoutEffect, useState } from 'react';
import type { ElectronShowFileDialogProvider } from '@mongodb-js/compass-components';
import {
  HorizontalRule,
  css,
  resetGlobalCSS,
  spacing,
  FileInputBackendProvider,
  createElectronFileInputBackend,
  type ElectronFileDialogOptions,
} from '@mongodb-js/compass-components';
import type { ConnectionOptions } from 'mongodb-data-service';

import OverviewHeader from './overview-header';
import ConnectionStatus from './connection-status';
import ConnectHelper from './connect-helper';
import AtlasCta from './atlas-cta';
import ResourcesPanel from './resources-panel/panel';
import { ConnectionForm } from './connection-form';
import useConnectionForm, {
  FileChooserMode,
  type FileChooserOptions,
} from './use-connection-form';
import type { MessageFromExtensionToWebview } from './extension-app-message-constants';
import { MessageType } from './extension-app-message-constants';

const pageStyles = css({
  width: '90%',
  minWidth: '500px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  padding: spacing[3],
  gap: spacing[4],
  alignItems: 'center',
  textAlign: 'center',
  fontSize: '14px',
});

const OverviewPage: React.FC = () => {
  const [showResourcesPanel, setShowResourcesPanel] = useState(false);
  const {
    initialConnectionInfo,
    isConnecting,
    isConnectionFormOpen,
    openConnectionForm,
    closeConnectionForm,
    connectionErrorMessage,
    handleCancelConnectClicked,
    handleSaveConnectionClicked,
    handleConnectClicked,
    handleOpenFileChooser,
  } = useConnectionForm();
  const handleResourcesPanelClose = useCallback(
    () => setShowResourcesPanel(false),
    [],
  );
  const handleResourcesClick = useCallback(
    () => setShowResourcesPanel(true),
    [],
  );

  useLayoutEffect(() => {
    // TODO(VSCODE-490): Move this reset css call to the top level entry point
    // of the app and out of the react lifecycle.
    resetGlobalCSS();
  }, []);

  function handleOpenFileChooserResult<T>(
    options: FileChooserOptions,
  ): Promise<T> {
    const requestId = handleOpenFileChooser(options);
    return new Promise((resolve) => {
      const messageHandler = (
        event: MessageEvent<MessageFromExtensionToWebview>,
      ): void => {
        const message = event.data;
        if (
          message.command === MessageType.openFileChooserResult &&
          message.requestId === requestId
        ) {
          window.removeEventListener('message', messageHandler);
          resolve(message.fileChooserResult as T);
        }
      };
      window.addEventListener('message', messageHandler);
    });
  }

  // Electron 32.0 removed support for the `path` property of the Web File object in favor of the webUtils.getPathForFile method.
  // https://github.com/electron/electron/blob/83d704009687956fb4b69cb13ab03664d7950118/docs/breaking-changes.md%23removed-filepath
  // We can not import `dialog` and `webUtils` from 'electron' in the sandboxed webview.
  // To work around this, we use a custom dialog provider that uses webview APIs
  // to send a message to the extension process to open the electron file dialog
  // and listen for the response to get the file path and send them to the electron file input backend.
  const dialogProvider: ElectronShowFileDialogProvider<void> = {
    getCurrentWindow(): void {
      /* Intentional left blank. */
    },
    dialog: {
      async showSaveDialog(
        window: void,
        electronFileDialogOptions: Partial<ElectronFileDialogOptions>,
      ): Promise<{ canceled: boolean; filePath?: string }> {
        return handleOpenFileChooserResult({
          electronFileDialogOptions,
          mode: FileChooserMode.save,
        });
      },
      async showOpenDialog(
        window: void,
        electronFileDialogOptions: Partial<ElectronFileDialogOptions>,
      ): Promise<{ canceled: boolean; filePaths: string[] }> {
        return handleOpenFileChooserResult({
          electronFileDialogOptions,
          mode: FileChooserMode.open,
        });
      },
    },
  };

  return (
    <div data-testid="overview-page" className={pageStyles}>
      {showResourcesPanel && (
        <ResourcesPanel onClose={handleResourcesPanelClose} />
      )}
      {isConnectionFormOpen && (
        <FileInputBackendProvider
          createFileInputBackend={createElectronFileInputBackend(
            dialogProvider,
            null,
          )}
        >
          <ConnectionForm
            isConnecting={isConnecting}
            initialConnectionInfo={initialConnectionInfo}
            onSaveAndConnectClicked={({
              id,
              connectionOptions,
            }: {
              id: string;
              connectionOptions: ConnectionOptions;
            }): void => {
              void handleSaveConnectionClicked();
              handleConnectClicked({
                id,
                connectionOptions,
              });
            }}
            onCancelConnectClicked={handleCancelConnectClicked}
            onClose={closeConnectionForm}
            open={isConnectionFormOpen}
            connectionErrorMessage={connectionErrorMessage}
          />
        </FileInputBackendProvider>
      )}
      <OverviewHeader onResourcesClick={handleResourcesClick} />
      <HorizontalRule />
      <ConnectionStatus />
      <ConnectHelper onClickOpenConnectionForm={openConnectionForm} />
      <AtlasCta />
    </div>
  );
};

export default OverviewPage;
