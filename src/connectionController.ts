import * as vscode from 'vscode';
import { connect, createConnectionAttempt } from 'mongodb-data-service';
import type {
  DataService,
  ConnectionAttempt,
  ConnectionOptions,
} from 'mongodb-data-service';
import ConnectionString from 'mongodb-connection-string-url';
import { EventEmitter } from 'events';
import type { MongoClientOptions } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep, merge } from 'lodash';
import { mongoLogId } from 'mongodb-log-writer';
import { extractSecrets } from '@mongodb-js/connection-info';
import { adjustConnectionOptionsBeforeConnect } from '@mongodb-js/connection-form';

import { CONNECTION_STATUS } from './views/webview-app/extension-app-message-constants';
import { createLogger } from './logging';
import formatError from './utils/formatError';
import type { StorageController } from './storage';
import type { StatusView } from './views';
import type { TelemetryService } from './telemetry';
import { openLink } from './utils/linkHelper';
import type {
  ConnectionSource,
  LoadedConnection,
} from './storage/connectionStorage';
import { ConnectionStorage } from './storage/connectionStorage';
import LINKS from './utils/links';
import { isAtlasStream } from 'mongodb-build-info';
import type { ConnectionTreeItem } from './explorer';
import { PresetConnectionEditedTelemetryEvent } from './telemetry';
import type { RequiredBy } from './utils/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require('../package.json');

const log = createLogger('connection controller');

const MAX_CONNECTION_NAME_LENGTH = 512;

interface DataServiceEventTypes {
  CONNECTIONS_DID_CHANGE: [];
  ACTIVE_CONNECTION_CHANGED: [];
}

export enum ConnectionTypes {
  CONNECTION_FORM = 'CONNECTION_FORM',
  CONNECTION_STRING = 'CONNECTION_STRING',
  CONNECTION_ID = 'CONNECTION_ID',
}

export enum NewConnectionType {
  NEW_CONNECTION = 'NEW_CONNECTION',
  SAVED_CONNECTION = 'SAVED_CONNECTION',
}

interface ConnectionAttemptResult {
  successfullyConnected: boolean;
  connectionErrorMessage: string;
}

interface ConnectionQuickPicks {
  label: string;
  data: { type: NewConnectionType; connectionId?: string };
}

type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object | undefined
      ? RecursivePartial<T[P]>
      : T[P];
};

interface NewConnectionParams {
  connectionString?: string;
  name?: string;
  reuseExisting?: boolean;
}

function isOIDCAuth(connectionString: string): boolean {
  const authMechanismString = (
    new ConnectionString(connectionString).searchParams.get('authMechanism') ||
    ''
  ).toUpperCase();

  return authMechanismString === 'MONGODB-OIDC';
}

// Exported for testing.
export function getNotifyDeviceFlowForConnectionAttempt(
  connectionOptions: ConnectionOptions,
):
  | ((deviceFlowInformation: {
      verificationUrl: string;
      userCode: string;
    }) => void)
  | undefined {
  const isOIDCConnectionAttempt = isOIDCAuth(
    connectionOptions.connectionString,
  );
  let notifyDeviceFlow:
    | ((deviceFlowInformation: {
        verificationUrl: string;
        userCode: string;
      }) => void)
    | undefined;

  if (isOIDCConnectionAttempt) {
    notifyDeviceFlow = ({
      verificationUrl,
      userCode,
    }: {
      verificationUrl: string;
      userCode: string;
    }): void => {
      void vscode.window.showInformationMessage(
        `Visit the following URL to complete authentication: ${verificationUrl}  Enter the following code on that page: ${userCode}`,
      );
    };
  }

  return notifyDeviceFlow;
}

export default class ConnectionController {
  // This is a map of connection ids to their configurations.
  // These connections can be saved on the session (runtime),
  // on the workspace, or globally in vscode.
  _connections: {
    [connectionId: string]: LoadedConnection;
  } = Object.create(null);
  // Additional connection information that is merged with the connections
  // when connecting. This is useful for instances like OIDC sessions where we
  // have a setting on the system for storing credentials.
  // When the setting is on this `connectionMergeInfos` would have the session
  // credential information and merge it before connecting.
  private _connectionMergeInfos: Record<
    string,
    RecursivePartial<LoadedConnection>
  > = Object.create(null);

  private _activeDataService: DataService | null = null;
  _connectionStorage: ConnectionStorage;
  _telemetryService: TelemetryService;

  private _currentConnectionId: null | string = null;

  _connectionAttempt: null | ConnectionAttempt = null;
  private _connectionStringInputCancellationToken: null | vscode.CancellationTokenSource =
    null;
  private _connectingConnectionId: null | string = null;
  private _disconnecting = false;

  private _statusView: StatusView;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter<DataServiceEventTypes> =
    new EventEmitter();

  constructor({
    statusView,
    storageController,
    telemetryService,
  }: {
    statusView: StatusView;
    storageController: StorageController;
    telemetryService: TelemetryService;
  }) {
    this._statusView = statusView;
    this._telemetryService = telemetryService;
    this._connectionStorage = new ConnectionStorage({
      storageController,
    });
  }

  async openPresetConnectionsSettings(
    originTreeItem: ConnectionTreeItem | undefined,
  ): Promise<void> {
    this._telemetryService.track(
      new PresetConnectionEditedTelemetryEvent(
        originTreeItem ? 'tree_item' : 'header',
      ),
    );
    let source: ConnectionSource | undefined = originTreeItem?.source;
    if (!source) {
      const mdbConfiguration = vscode.workspace.getConfiguration('mdb');

      const presetConnections = mdbConfiguration?.inspect('presetConnections');

      if (presetConnections?.workspaceValue) {
        source = 'workspaceSettings';
      } else if (presetConnections?.globalValue) {
        source = 'globalSettings';
      } else {
        // If no preset settings exist in workspace and global scope,
        // set a default one inside the workspace and open it.
        source = 'workspaceSettings';
        await mdbConfiguration.update('presetConnections', [
          {
            name: 'Preset Connection',
            connectionString: 'mongodb://localhost:27017',
          },
        ]);
      }
    }
    switch (source) {
      case 'globalSettings':
        await vscode.commands.executeCommand(
          'workbench.action.openSettingsJson',
        );
        break;
      case 'workspaceSettings':
      case 'user':
        await vscode.commands.executeCommand(
          'workbench.action.openWorkspaceSettingsFile',
        );
        break;
      default:
        throw new Error('Unknown preset connection source');
    }
  }

  async loadSavedConnections(): Promise<void> {
    this._connections = Object.create(null);

    const loadedConnections = await this._connectionStorage.loadConnections();

    for (const connection of loadedConnections) {
      this._connections[connection.id] = connection;
    }

    if (loadedConnections.length) {
      this.eventEmitter.emit('CONNECTIONS_DID_CHANGE');
    }

    // TODO: re-enable with fewer 'Saved Connections Loaded' events
    // https://jira.mongodb.org/browse/VSCODE-462
    /* this._telemetryService.track(new SavedConnectionsLoadedTelemetryEvent({
      saved_connections: globalAndWorkspaceConnections.length,
      loaded_connections: loadedConnections.length,
      ).length,
      connections_with_secrets_in_secret_storage: loadedConnections.filter(
        (connection) =>
          connection.secretStorageLocation ===
          SecretStorageLocation.SecretStorage
      ).length,
    })); */
  }

  async connectWithURI({
    connectionString,
    reuseExisting,
    name,
  }: NewConnectionParams = {}): Promise<boolean> {
    log.info('connectWithURI command called');

    const cancellationToken = new vscode.CancellationTokenSource();
    this._connectionStringInputCancellationToken = cancellationToken;

    try {
      connectionString ??= await vscode.window.showInputBox(
        {
          value: '',
          ignoreFocusOut: true,
          placeHolder:
            'e.g. mongodb+srv://username:password@cluster0.mongodb.net/admin',
          prompt: 'Enter your SRV or standard connection string',
          validateInput: (uri: string) => {
            if (
              !uri.startsWith('mongodb://') &&
              !uri.startsWith('mongodb+srv://')
            ) {
              return 'MongoDB connection strings begin with "mongodb://" or "mongodb+srv://"';
            }

            try {
              // eslint-disable-next-line no-new
              new ConnectionString(uri);
            } catch (error) {
              return formatError(error).message;
            }

            return null;
          },
        },
        cancellationToken.token,
      );
    } catch (e) {
      return false;
    } finally {
      if (this._connectionStringInputCancellationToken === cancellationToken) {
        this._connectionStringInputCancellationToken.dispose();
        this._connectionStringInputCancellationToken = null;
      }
    }

    if (!connectionString) {
      return false;
    }

    return this.addNewConnectionStringAndConnect({
      connectionString,
      reuseExisting: reuseExisting ?? false,
      name,
    });
  }

  // Resolves the new connection id when the connection is successfully added.
  // Resolves false when it is added and not connected.
  // The connection can fail to connect but be successfully added.
  async addNewConnectionStringAndConnect({
    connectionString,
    reuseExisting,
    name,
  }: RequiredBy<NewConnectionParams, 'connectionString'>): Promise<boolean> {
    log.info('Trying to connect to a new connection configuration...');

    const connectionStringData = new ConnectionString(connectionString);

    try {
      let existingConnection: LoadedConnection | undefined;
      if (reuseExisting) {
        existingConnection =
          this._findConnectionByConnectionString(connectionString);

        if (existingConnection && existingConnection.name !== name) {
          void vscode.window.showInformationMessage(
            `Connection with the same connection string already exists, under a different name: '${existingConnection.name}'. Connecting to the existing one...`,
          );
        }
      }

      const connectResult = await (existingConnection
        ? this.connectWithConnectionId(existingConnection.id)
        : this.saveNewConnectionAndConnect({
            connectionId: uuidv4(),
            connectionOptions: {
              connectionString: connectionStringData.toString(),
            },
            connectionType: ConnectionTypes.CONNECTION_STRING,
            name,
          }));

      return connectResult.successfullyConnected;
    } catch (error) {
      const printableError = formatError(error);
      log.error('Failed to connect with a connection string', error);
      void vscode.window.showErrorMessage(
        `Unable to connect: ${printableError.message}`,
      );
      return false;
    }
  }

  private sendTelemetry(
    newDataService: DataService,
    connectionType: ConnectionTypes,
  ): void {
    void this._telemetryService.trackNewConnection(
      newDataService,
      connectionType,
    );
  }

  async saveNewConnectionAndConnect({
    connectionOptions,
    connectionId,
    connectionType,
    name,
  }: {
    connectionOptions: ConnectionOptions;
    connectionId: string;
    connectionType: ConnectionTypes;
    name?: string;
  }): Promise<ConnectionAttemptResult> {
    const connection = this._connectionStorage.createNewConnection({
      connectionId,
      connectionOptions,
      name,
    });

    await this._connectionStorage.saveConnection(connection);

    this._connections[connection.id] = cloneDeep(connection);

    return this._connect(connection.id, connectionType);
  }

  /**
   * In older versions, we'd manually store a connectionString with an appended
   * appName with the VSCode extension name and version. This overrides the
   * connection string if needed and returns true if it does so, false otherwise.
   */
  private _overrideLegacyConnectionStringAppName(
    connectionId: string,
  ): boolean {
    const connectionString = new ConnectionString(
      this._connections[connectionId].connectionOptions.connectionString,
    );

    if (
      connectionString.searchParams
        .get('appname')
        ?.match(/mongodb-vscode \d\.\d\.\d.*/)
    ) {
      connectionString.searchParams.delete('appname');

      this._connections[connectionId].connectionOptions.connectionString =
        connectionString.toString();

      return true;
    }
    return false;
  }

  // eslint-disable-next-line complexity
  async _connect(
    connectionId: string,
    connectionType: ConnectionTypes,
  ): Promise<ConnectionAttemptResult> {
    log.info(
      'Connect called to connect to instance',
      this._connections[connectionId]?.name || 'empty connection name',
    );

    // Cancel the current connection attempt if we're connecting.
    this._connectionAttempt?.cancelConnectionAttempt();

    const connectionAttempt = createConnectionAttempt({
      connectFn: (connectionConfig) =>
        connect({
          ...connectionConfig,
          productName: packageJSON.name,
          productDocsLink: LINKS.extensionDocs(),
        }),
      logger: Object.assign(log, { mongoLogId }),
      proxyOptions: {},
    });
    this._connectionAttempt = connectionAttempt;
    this._connectingConnectionId = connectionId;
    this.eventEmitter.emit('CONNECTIONS_DID_CHANGE');

    if (this._activeDataService) {
      log.info('Disconnecting from the previous connection...', {
        connectionId: this._currentConnectionId,
      });
      await this.disconnect();
    }

    if (connectionAttempt.isClosed()) {
      return {
        successfullyConnected: false,
        connectionErrorMessage: 'connection attempt cancelled',
      };
    }

    const connectionInfo: LoadedConnection = merge(
      cloneDeep(this._connections[connectionId]),
      this._connectionMergeInfos[connectionId] ?? {},
    );

    if (!connectionInfo.connectionOptions) {
      throw new Error('Connect failed: connectionOptions are missing.');
    }

    this._statusView.showMessage('Connecting to MongoDB...');
    log.info('Connecting to MongoDB...', {
      connectionInfo: JSON.stringify(
        extractSecrets(this._connections[connectionId]).connectionInfo,
      ),
    });

    let dataService;
    try {
      const notifyDeviceFlow = getNotifyDeviceFlowForConnectionAttempt(
        connectionInfo.connectionOptions,
      );

      const connectionOptions = adjustConnectionOptionsBeforeConnect({
        connectionOptions: connectionInfo.connectionOptions,
        connectionId,
        defaultAppName: `${packageJSON.name} ${packageJSON.version}`,
        notifyDeviceFlow,
        preferences: {
          forceConnectionOptions: [],
          telemetryAnonymousId: this._connectionStorage.getUserAnonymousId(),
          browserCommandForOIDCAuth: undefined, // We overwrite this below.
        },
      });
      const browserAuthCommand = vscode.workspace
        .getConfiguration('mdb')
        .get<string>('browserCommandForOIDCAuth');
      dataService = await connectionAttempt.connect({
        ...connectionOptions,
        oidc: {
          ...cloneDeep(connectionOptions.oidc),
          openBrowser: browserAuthCommand
            ? { command: browserAuthCommand }
            : async ({ signal, url }): Promise<void> => {
                try {
                  await openLink(url);
                } catch (err) {
                  if (signal.aborted) return;
                  // If opening the link fails we default to regular link opening.
                  await vscode.commands.executeCommand(
                    'vscode.open',
                    vscode.Uri.parse(url),
                  );
                }
              },
        },
      });

      if (!dataService || connectionAttempt.isClosed()) {
        return {
          successfullyConnected: false,
          connectionErrorMessage: 'connection attempt cancelled',
        };
      }
    } catch (error) {
      throw error;
    } finally {
      if (
        this._connectionAttempt === connectionAttempt &&
        this._connectingConnectionId === connectionId
      ) {
        // When this is still the most recent connection attempt cleanup the connecting messages.
        this._statusView.hideMessage();
        this._connectionAttempt = null;
        this._connectingConnectionId = null;
      }

      this.eventEmitter.emit('CONNECTIONS_DID_CHANGE');
    }

    log.info('Successfully connected', { connectionId });

    this._statusView.showTemporaryMessage('MongoDB connection successful.');

    dataService.addReauthenticationHandler(
      this._reauthenticationHandler.bind(this),
    );
    this.setActiveDataService(dataService);
    this._currentConnectionId = connectionId;
    this._connectionAttempt = null;
    this._connectingConnectionId = null;

    this._connections[connectionId].lastUsed = new Date();
    this.eventEmitter.emit('ACTIVE_CONNECTION_CHANGED');
    await this._connectionStorage.saveConnection(
      this._connections[connectionId],
    );

    // Send metrics to Segment
    this.sendTelemetry(dataService, connectionType);

    void vscode.commands.executeCommand(
      'setContext',
      'mdb.connectedToMongoDB',
      true,
    );

    void vscode.commands.executeCommand(
      'setContext',
      'mdb.isAtlasStreams',
      this.isConnectedToAtlasStreams(),
    );

    void this.onConnectSuccess({
      connectionInfo,
      dataService,
    });

    return {
      successfullyConnected: true,
      connectionErrorMessage: '',
    };
  }

  // Used to re-authenticate with OIDC.
  async _reauthenticationHandler(): Promise<void> {
    const removeConfirmationResponse =
      await vscode.window.showInformationMessage(
        'You need to re-authenticate to the database in order to continue.',
        { modal: true },
        'Confirm',
      );

    if (removeConfirmationResponse !== 'Confirm') {
      throw new Error('Reauthentication declined by user');
    }
  }

  _findConnectionByConnectionString(
    connectionString: string,
  ): LoadedConnection | undefined {
    const searchStrings = [connectionString];
    if (!connectionString.endsWith('/')) {
      searchStrings.push(`${connectionString}/`);
    }

    return this.getConnectionsFromHistory().find((connection) =>
      searchStrings.includes(connection.connectionOptions?.connectionString),
    );
  }

  private async onConnectSuccess({
    connectionInfo,
    dataService,
  }: {
    connectionInfo: LoadedConnection;
    dataService: DataService;
  }): Promise<void> {
    if (connectionInfo.storageLocation === 'NONE') {
      return;
    }

    let mergeConnectionInfo: LoadedConnection | {} = {};
    if (vscode.workspace.getConfiguration('mdb').get('persistOIDCTokens')) {
      mergeConnectionInfo = {
        connectionOptions: await dataService.getUpdatedSecrets(),
      };
      this._connectionMergeInfos[connectionInfo.id] = merge(
        cloneDeep(this._connectionMergeInfos[connectionInfo.id]),
        mergeConnectionInfo,
      );
    }

    await this._connectionStorage.saveConnection({
      ...merge(
        this._connections[connectionInfo.id] ?? connectionInfo,
        mergeConnectionInfo,
      ),
    });

    // ?. because mocks in tests don't provide it
    dataService.on?.('connectionInfoSecretsChanged', () => {
      void (async (): Promise<void> => {
        try {
          if (
            !vscode.workspace.getConfiguration('mdb').get('persistOIDCTokens')
          ) {
            return;
          }
          // Get updated secrets first (and not in parallel) so that the
          // race condition window between load() and save() is as short as possible.
          const mergeConnectionInfo = {
            connectionOptions: await dataService.getUpdatedSecrets(),
          };
          if (!mergeConnectionInfo) return;
          this._connectionMergeInfos[connectionInfo.id] = merge(
            cloneDeep(this._connectionMergeInfos[connectionInfo.id]),
            mergeConnectionInfo,
          );

          if (!this._connections[connectionInfo.id]) return;
          await this._connectionStorage.saveConnection({
            ...merge(this._connections[connectionInfo.id], mergeConnectionInfo),
          });
        } catch (err: any) {
          log.warn(
            'Connection Controller',
            'Failed to update connection store with updated secrets',
            { err: err?.stack },
          );
        }
      })();
    });
  }

  cancelConnectionAttempt(): void {
    this._connectionAttempt?.cancelConnectionAttempt();
  }

  async connectWithConnectionId(
    connectionId: string,
  ): Promise<ConnectionAttemptResult> {
    if (!this._connections[connectionId]) {
      throw new Error('Connection not found.');
    }

    try {
      const wasOverridden =
        this._overrideLegacyConnectionStringAppName(connectionId);

      const result = await this._connect(
        connectionId,
        ConnectionTypes.CONNECTION_ID,
      );

      /** After successfully connecting with an overridden connection
       *  string, save it to storage for the future. */
      if (result.successfullyConnected && wasOverridden) {
        await this._connectionStorage.saveConnection(
          this._connections[connectionId],
        );
      }

      return result;
    } catch (error) {
      log.error('Failed to connect by a connection id', error);
      const printableError = formatError(error);
      void vscode.window.showErrorMessage(
        `Unable to connect: ${printableError.message}`,
      );
      return {
        successfullyConnected: false,
        connectionErrorMessage: '',
      };
    }
  }

  async disconnect(): Promise<boolean> {
    log.info(
      'Disconnect called, currently connected to',
      this._currentConnectionId,
    );

    this._currentConnectionId = null;
    this._disconnecting = true;
    this._statusView.showMessage('Disconnecting from current connection...');

    this.eventEmitter.emit('CONNECTIONS_DID_CHANGE');
    this.eventEmitter.emit('ACTIVE_CONNECTION_CHANGED');

    if (!this._activeDataService) {
      log.error('Unable to disconnect: no active connection');
      return false;
    }

    const originalDisconnect = this._activeDataService.disconnect.bind(this);
    this._activeDataService = null;

    try {
      // Disconnect from the active connection.
      await originalDisconnect();
    } catch (error) {
      log.error('Unable to disconnect', error);
    }

    void vscode.commands.executeCommand(
      'setContext',
      'mdb.connectedToMongoDB',
      false,
    );
    void vscode.commands.executeCommand(
      'setContext',
      'mdb.isAtlasStreams',
      false,
    );

    this._disconnecting = false;

    this._statusView.showTemporaryMessage('MongoDB disconnected.');
    return true;
  }

  async removeSavedConnection(connectionId: string): Promise<void> {
    if (
      this._connectionAttempt &&
      connectionId === this._connectingConnectionId
    ) {
      this.cancelConnectionAttempt();
    }

    delete this._connections[connectionId];
    await this._connectionStorage.removeConnection(connectionId);
    this.eventEmitter.emit('CONNECTIONS_DID_CHANGE');
  }

  // Prompts the user to remove the connection then removes it on affirmation.
  async _removeMongoDBConnection({
    connectionId,
    force = false,
  }: {
    connectionId: string;
    force?: boolean;
  }): Promise<boolean> {
    const connection = this._connections[connectionId];
    if (!connection) {
      // No active connection(s) to remove.
      void vscode.window.showErrorMessage('Connection does not exist.');

      return false;
    }

    if (!force) {
      const removeConfirmationResponse =
        await vscode.window.showInformationMessage(
          `Are you sure to want to remove connection ${connection.name}?`,
          { modal: true },
          'Yes',
        );

      if (removeConfirmationResponse !== 'Yes') {
        return false;
      }
    }

    if (this._activeDataService && connectionId === this._currentConnectionId) {
      await this.disconnect();
    }

    if (!this._connections[connectionId]) {
      // If the connection was removed while we were disconnecting we resolve.
      return false;
    }

    await this.removeSavedConnection(connectionId);

    void vscode.window.showInformationMessage(
      `MongoDB connection '${connection.name}' removed.`,
    );

    return true;
  }

  async onRemoveMongoDBConnection(
    options: (
      | { connectionString: string }
      | { name: string }
      | { id: string }
      | {}
    ) & {
      force?: boolean;
    } = {},
  ): Promise<boolean> {
    log.info('mdb.removeConnection command called');

    let connectionIdToRemove: string;
    if ('id' in options) {
      connectionIdToRemove = options.id;
    } else if ('connectionString' in options) {
      const connectionId = this._findConnectionByConnectionString(
        options.connectionString,
      )?.id;

      if (!connectionId) {
        // No connection to remove, so just return silently.
        return false;
      }

      connectionIdToRemove = connectionId;
    } else if ('name' in options) {
      const connectionId = this.getConnectionsFromHistory().find(
        (connection) => connection.name === options.name,
      )?.id;
      if (!connectionId) {
        // No connection to remove, so just return silently.
        return false;
      }

      connectionIdToRemove = connectionId;
    } else {
      const connectionIds = this.getConnectionsFromHistory();

      if (connectionIds.length === 0) {
        // No active connection(s) to remove.
        void vscode.window.showErrorMessage('No connections to remove.');

        return false;
      }

      if (connectionIds.length === 1) {
        connectionIdToRemove = connectionIds[0].id;
      } else {
        // There is more than 1 possible connection to remove.
        // We attach the index of the connection so that we can infer their pick.
        const connectionNameToRemove: string | undefined =
          await vscode.window.showQuickPick(
            connectionIds.map(
              (connection, index) => `${index + 1}: ${connection.name}`,
            ),
            {
              placeHolder: 'Choose a connection to remove...',
            },
          );

        if (!connectionNameToRemove) {
          return false;
        }

        // We attach the index of the connection so that we can infer their pick.
        const connectionIndexToRemove =
          Number(connectionNameToRemove.split(':', 1)[0]) - 1;
        connectionIdToRemove = connectionIds[connectionIndexToRemove].id;
      }
    }

    return this._removeMongoDBConnection({
      connectionId: connectionIdToRemove,
      force: options.force,
    });
  }

  async updateConnection({
    connectionId,
    connectionOptions,
  }: {
    connectionId: string;
    connectionOptions: ConnectionOptions;
  }): Promise<void> {
    if (!this._connections[connectionId]) {
      throw new Error('Cannot find connection to update.');
    }

    this._connections[connectionId] = {
      ...this._connections[connectionId],
      connectionOptions,
    };
    await this._connectionStorage.saveConnection(
      this._connections[connectionId],
    );
  }

  async updateConnectionAndConnect({
    connectionId,
    connectionOptions,
  }: {
    connectionId: string;
    connectionOptions: ConnectionOptions;
  }): Promise<ConnectionAttemptResult> {
    await this.updateConnection({
      connectionId,
      connectionOptions,
    });

    return await this.connectWithConnectionId(connectionId);
  }

  async renameConnection(connectionId: string): Promise<boolean> {
    let inputtedConnectionName: string | undefined;

    try {
      inputtedConnectionName = await vscode.window.showInputBox({
        value: this._connections[connectionId].name,
        placeHolder: 'e.g. My Connection Name',
        prompt: 'Enter new connection name.',
        validateInput: (inputConnectionName: string) => {
          if (
            inputConnectionName &&
            inputConnectionName.length > MAX_CONNECTION_NAME_LENGTH
          ) {
            return `Connection name too long (Max ${MAX_CONNECTION_NAME_LENGTH} characters).`;
          }

          return null;
        },
      });
    } catch (e) {
      throw new Error(`An error occurred parsing the connection name: ${e}`);
    }

    if (!inputtedConnectionName) {
      return false;
    }

    this._connections[connectionId].name = inputtedConnectionName;
    this.eventEmitter.emit('CONNECTIONS_DID_CHANGE');
    this.eventEmitter.emit('ACTIVE_CONNECTION_CHANGED');

    await this._connectionStorage.saveConnection(
      this._connections[connectionId],
    );

    // No storing needed.
    return true;
  }

  addEventListener(
    eventType: keyof DataServiceEventTypes,
    listener: () => void,
  ): void {
    this.eventEmitter.addListener(eventType, listener);
  }

  removeEventListener(
    eventType: keyof DataServiceEventTypes,
    listener: () => void,
  ): void {
    this.eventEmitter.removeListener(eventType, listener);
  }

  deactivate(): void {
    this.eventEmitter.removeAllListeners();
  }

  closeConnectionStringInput(): void {
    this._connectionStringInputCancellationToken?.cancel();
  }

  isConnecting(): boolean {
    return !!this._connectionAttempt;
  }

  isDisconnecting(): boolean {
    return this._disconnecting;
  }

  isCurrentlyConnected(): boolean {
    return this._activeDataService !== null;
  }

  getSavedConnections(): LoadedConnection[] {
    return Object.values(this._connections);
  }

  private getConnectionsFromHistory(): LoadedConnection[] {
    return this.getSavedConnections().filter((connection) => {
      return (
        connection.source !== 'globalSettings' &&
        connection.source !== 'workspaceSettings'
      );
    });
  }

  getSavedConnectionName(connectionId: string): string {
    return this._connections[connectionId]
      ? this._connections[connectionId].name
      : '';
  }

  getConnectingConnectionId(): string | null {
    return this._connectingConnectionId;
  }

  getActiveConnectionId(): string | null {
    return this._currentConnectionId;
  }

  getActiveConnectionName(): string {
    if (!this._currentConnectionId) {
      return '';
    }

    return this._connections[this._currentConnectionId]
      ? this._connections[this._currentConnectionId].name
      : '';
  }

  getConnectionConnectionOptions(
    connectionId: string,
  ): ConnectionOptions | undefined {
    const connectionStringWithoutAppName = new ConnectionString(
      this._connections[connectionId]?.connectionOptions.connectionString,
    );
    connectionStringWithoutAppName.searchParams.delete('appname');

    return {
      ...this._connections[connectionId]?.connectionOptions,
      connectionString: connectionStringWithoutAppName.toString(),
    };
  }

  _getConnectionStringWithProxy({
    url,
    options,
  }: {
    url: string;
    options: MongoClientOptions;
  }): string {
    const connectionStringData = new ConnectionString(url);

    if (options.proxyHost) {
      connectionStringData.searchParams.set('proxyHost', options.proxyHost);
    }

    if (options.proxyPassword) {
      connectionStringData.searchParams.set(
        'proxyPassword',
        options.proxyPassword,
      );
    }

    if (options.proxyPort) {
      connectionStringData.searchParams.set(
        'proxyPort',
        `${options.proxyPort}`,
      );
    }

    if (options.proxyUsername) {
      connectionStringData.searchParams.set(
        'proxyUsername',
        options.proxyUsername,
      );
    }

    return connectionStringData.toString();
  }

  isConnectedToAtlasStreams(): boolean {
    return (
      this.isCurrentlyConnected() &&
      isAtlasStream(this.getActiveConnectionString())
    );
  }

  getActiveConnectionString(): string {
    const mongoClientConnectionOptions = this.getMongoClientConnectionOptions();
    const connectionString = mongoClientConnectionOptions?.url;

    if (!connectionString) {
      throw new Error('Connection string not found.');
    }

    if (mongoClientConnectionOptions?.options.proxyHost) {
      return this._getConnectionStringWithProxy(mongoClientConnectionOptions);
    }

    return connectionString;
  }

  getActiveDataService(): DataService | null {
    return this._activeDataService;
  }

  getMongoClientConnectionOptions():
    | {
        url: string;
        options: NonNullable<
          ReturnType<DataService['getMongoClientConnectionOptions']>
        >['options'];
      }
    | undefined {
    return this._activeDataService?.getMongoClientConnectionOptions();
  }

  // Copy connection string from the sidebar does not need appname in it.
  copyConnectionStringByConnectionId(connectionId: string): string {
    const connectionOptions = this._connections[connectionId].connectionOptions;

    if (!connectionOptions) {
      throw new Error(
        'Copy connection string failed: connectionOptions are missing.',
      );
    }

    const url = new ConnectionString(connectionOptions.connectionString);
    url.searchParams.delete('appname');
    return url.toString();
  }

  getConnectionStatus(): CONNECTION_STATUS {
    if (this.isCurrentlyConnected()) {
      if (this.isDisconnecting()) {
        return CONNECTION_STATUS.DISCONNECTING;
      }

      return CONNECTION_STATUS.CONNECTED;
    }

    if (this.isConnecting()) {
      return CONNECTION_STATUS.CONNECTING;
    }

    return CONNECTION_STATUS.DISCONNECTED;
  }

  getConnectionStatusStringForConnection(connectionId: string): string {
    if (this.getActiveConnectionId() === connectionId) {
      if (this.isDisconnecting()) {
        return 'disconnecting...';
      }

      return 'connected';
    }

    if (
      this.isConnecting() &&
      this.getConnectingConnectionId() === connectionId
    ) {
      return 'connecting...';
    }

    return '';
  }

  // Exposed for testing.
  clearAllConnections(): void {
    this._connections = {};
    this._activeDataService = null;
    this._currentConnectionId = null;
    this._connectionAttempt?.cancelConnectionAttempt();
    this._connectionAttempt = null;
    this._disconnecting = false;
    this._connectingConnectionId = '';
  }

  setActiveDataService(newDataService: DataService): void {
    this._activeDataService = newDataService;

    // Disconnect the extension if the MongoDB client is closed.
    this._activeDataService?.once('close', () => {
      void this.disconnect();
    });
  }

  getConnectionQuickPicks(): ConnectionQuickPicks[] {
    if (!this._connections) {
      return [
        {
          label: 'Add new connection',
          data: {
            type: NewConnectionType.NEW_CONNECTION,
          },
        },
      ];
    }

    return [
      {
        label: 'Add new connection',
        data: {
          type: NewConnectionType.NEW_CONNECTION,
        },
      },
      ...Object.values(this._connections)
        .sort((connectionA: LoadedConnection, connectionB: LoadedConnection) =>
          (connectionA.name || '').localeCompare(connectionB.name || ''),
        )
        .map((item: LoadedConnection) => ({
          label: item.name,
          data: {
            type: NewConnectionType.SAVED_CONNECTION,
            connectionId: item.id,
          },
        })),
    ];
  }

  async changeActiveConnection(): Promise<boolean> {
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      this.getConnectionQuickPicks(),
      {
        placeHolder: 'Select new connection...',
      },
    );

    if (!selectedQuickPickItem) {
      return false;
    }

    if (selectedQuickPickItem.data.type === NewConnectionType.NEW_CONNECTION) {
      return this.connectWithURI();
    }

    if (!selectedQuickPickItem.data.connectionId) {
      return false;
    }

    const { successfullyConnected } = await this.connectWithConnectionId(
      selectedQuickPickItem.data.connectionId,
    );
    return successfullyConnected;
  }
}
