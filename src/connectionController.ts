import * as vscode from 'vscode';
import { connect, createConnectionAttempt } from 'mongodb-data-service';
import type {
  DataService,
  ConnectionAttempt,
  ConnectionOptions as ConnectionOptionsFromCurrentDS,
} from 'mongodb-data-service';
import ConnectionString from 'mongodb-connection-string-url';
import { EventEmitter } from 'events';
import type { MongoClientOptions } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { cloneDeep, merge } from 'lodash';
import { mongoLogId } from 'mongodb-log-writer';
import type {
  ConnectionInfo as ConnectionInfoFromLegacyDS,
  ConnectionOptions as ConnectionOptionsFromLegacyDS,
} from 'mongodb-data-service-legacy';
import {
  extractSecrets,
  convertConnectionModelToInfo,
} from 'mongodb-data-service-legacy';
import { adjustConnectionOptionsBeforeConnect } from '@mongodb-js/connection-form';

import { CONNECTION_STATUS } from './views/webview-app/extension-app-message-constants';
import { createLogger } from './logging';
import formatError from './utils/formatError';
import type LegacyConnectionModel from './views/webview-app/legacy/connection-model/legacy-connection-model';
import type { StorageController } from './storage';
import type { StatusView } from './views';
import type TelemetryService from './telemetry/telemetryService';
import { openLink } from './utils/linkHelper';
import type { LoadedConnection } from './storage/connectionStorage';
import { ConnectionStorage } from './storage/connectionStorage';
import LINKS from './utils/links';
import { isAtlasStream } from 'mongodb-build-info';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJSON = require('../package.json');

const log = createLogger('connection controller');

const MAX_CONNECTION_NAME_LENGTH = 512;

export enum DataServiceEventTypes {
  CONNECTIONS_DID_CHANGE = 'CONNECTIONS_DID_CHANGE',
  ACTIVE_CONNECTION_CHANGED = 'ACTIVE_CONNECTION_CHANGED',
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

export function launderConnectionOptionTypeFromLegacyToCurrent(
  opts: ConnectionOptionsFromLegacyDS
): ConnectionOptionsFromCurrentDS {
  // Ensure that, at most, the types for OIDC mismatch here.
  return opts as Omit<typeof opts, 'oidc'>;
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
  connectionMergeInfos: Record<string, RecursivePartial<LoadedConnection>> =
    Object.create(null);

  _activeDataService: DataService | null = null;
  _connectionStorage: ConnectionStorage;
  _telemetryService: TelemetryService;

  private readonly _serviceName = 'mdb.vscode.savedConnections';
  private _currentConnectionId: null | string = null;

  _connectionAttempt: null | ConnectionAttempt = null;
  private _connectingConnectionId: null | string = null;
  private _disconnecting = false;

  private _statusView: StatusView;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter = new EventEmitter();

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

  async loadSavedConnections(): Promise<void> {
    const loadedConnections = await this._connectionStorage.loadConnections();

    for (const connection of loadedConnections) {
      this._connections[connection.id] = connection;
    }

    if (loadedConnections.length) {
      this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    }

    // TODO: re-enable with fewer 'Saved Connections Loaded' events
    // https://jira.mongodb.org/browse/VSCODE-462
    /* this._telemetryService.trackSavedConnectionsLoaded({
      saved_connections: globalAndWorkspaceConnections.length,
      loaded_connections: loadedConnections.length,
      ).length,
      connections_with_secrets_in_secret_storage: loadedConnections.filter(
        (connection) =>
          connection.secretStorageLocation ===
          SecretStorageLocation.SecretStorage
      ).length,
    }); */
  }

  async connectWithURI(): Promise<boolean> {
    let connectionString: string | undefined;

    log.info('connectWithURI command called');

    try {
      connectionString = await vscode.window.showInputBox({
        value: '',
        ignoreFocusOut: true,
        placeHolder:
          'e.g. mongodb+srv://username:password@cluster0.mongodb.net/admin',
        prompt: 'Enter your connection string (SRV or standard)',
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
      });
    } catch (e) {
      return false;
    }

    if (!connectionString) {
      return false;
    }

    return this.addNewConnectionStringAndConnect(connectionString);
  }

  // Resolves the new connection id when the connection is successfully added.
  // Resolves false when it is added and not connected.
  // The connection can fail to connect but be successfully added.
  async addNewConnectionStringAndConnect(
    connectionString: string
  ): Promise<boolean> {
    log.info('Trying to connect to a new connection configuration...');

    const connectionStringData = new ConnectionString(connectionString);

    // TODO: Allow overriding appname + use driverInfo instead
    // (https://jira.mongodb.org/browse/MONGOSH-1015)
    connectionStringData.searchParams.set(
      'appname',
      `${packageJSON.name} ${packageJSON.version}`
    );

    try {
      const connectResult = await this.saveNewConnectionAndConnect(
        {
          id: uuidv4(),
          connectionOptions: {
            connectionString: connectionStringData.toString(),
          },
        },
        ConnectionTypes.CONNECTION_STRING
      );

      return connectResult.successfullyConnected;
    } catch (error) {
      const printableError = formatError(error);
      log.error('Failed to connect with a connection string', error);
      void vscode.window.showErrorMessage(
        `Unable to connect: ${printableError.message}`
      );
      return false;
    }
  }

  public sendTelemetry(
    newDataService: DataService,
    connectionType: ConnectionTypes
  ): void {
    void this._telemetryService.trackNewConnection(
      newDataService,
      connectionType
    );
  }

  parseNewConnection(
    rawConnectionModel: LegacyConnectionModel
  ): ConnectionInfoFromLegacyDS {
    return convertConnectionModelToInfo({
      ...rawConnectionModel,
      appname: `${packageJSON.name} ${packageJSON.version}`, // Override the default connection appname.
    });
  }

  async saveNewConnectionAndConnect(
    originalConnectionInfo: ConnectionInfoFromLegacyDS,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
    const savedConnectionWithoutSecrets =
      await this._connectionStorage.saveNewConnection(originalConnectionInfo);

    this._connections[savedConnectionWithoutSecrets.id] = {
      ...savedConnectionWithoutSecrets,
      connectionOptions: originalConnectionInfo.connectionOptions, // The connection options with secrets.
    };

    log.info(
      'Connect called to connect to instance',
      savedConnectionWithoutSecrets.name
    );

    return this._connect(savedConnectionWithoutSecrets.id, connectionType);
  }

  async _connect(
    connectionId: string,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
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
    });
    this._connectionAttempt = connectionAttempt;
    this._connectingConnectionId = connectionId;
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

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
      this.connectionMergeInfos[connectionId] ?? {}
    );

    if (!connectionInfo.connectionOptions) {
      throw new Error('Connect failed: connectionOptions are missing.');
    }

    this._statusView.showMessage('Connecting to MongoDB...');
    log.info('Connecting to MongoDB...', {
      connectionInfo: JSON.stringify(
        extractSecrets(this._connections[connectionId]).connectionInfo
      ),
    });

    let dataService;
    try {
      const connectionOptions = adjustConnectionOptionsBeforeConnect({
        connectionOptions: launderConnectionOptionTypeFromLegacyToCurrent(
          connectionInfo.connectionOptions
        ),
        defaultAppName: packageJSON.name,
        notifyDeviceFlow: undefined,
        preferences: {
          forceConnectionOptions: [],
          browserCommandForOIDCAuth: undefined, // We overwrite this below.
        },
      });
      const browserAuthCommand = vscode.workspace
        .getConfiguration('mdb')
        .get('browserCommandForOIDCAuth');
      dataService = await connectionAttempt.connect({
        ...connectionOptions,
        oidc: {
          ...cloneDeep(connectionOptions.oidc),
          openBrowser: browserAuthCommand
            ? { command: browserAuthCommand }
            : async ({ signal, url }) => {
                try {
                  await openLink(url);
                } catch (err) {
                  if (signal.aborted) return;
                  // If opening the link fails we default to regular link opening.
                  await vscode.commands.executeCommand(
                    'vscode.open',
                    vscode.Uri.parse(url)
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
        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
      }
    }

    log.info('Successfully connected', { connectionId });
    void vscode.window.showInformationMessage('MongoDB connection successful.');

    dataService.addReauthenticationHandler(
      this._reauthenticationHandler.bind(this)
    );
    this._activeDataService = dataService;
    this._currentConnectionId = connectionId;
    this._connectionAttempt = null;
    this._connectingConnectionId = null;
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    // Send metrics to Segment
    this.sendTelemetry(dataService, connectionType);

    void vscode.commands.executeCommand(
      'setContext',
      'mdb.connectedToMongoDB',
      true
    );

    void vscode.commands.executeCommand(
      'setContext',
      'mdb.isAtlasStreams',
      this.isConnectedToAtlasStreams()
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
  async _reauthenticationHandler() {
    const removeConfirmationResponse =
      await vscode.window.showInformationMessage(
        'You need to re-authenticate to the database in order to continue.',
        { modal: true },
        'Confirm'
      );

    if (removeConfirmationResponse !== 'Confirm') {
      await this.disconnect();
      throw new Error('Reauthentication declined by user');
    }
  }

  private async onConnectSuccess({
    connectionInfo,
    dataService,
  }: {
    connectionInfo: LoadedConnection;
    dataService: DataService;
  }) {
    if (connectionInfo.storageLocation === 'NONE') {
      return;
    }

    let mergeConnectionInfo: LoadedConnection | {} = {};
    if (vscode.workspace.getConfiguration('mdb').get('persistOIDCTokens')) {
      mergeConnectionInfo = {
        connectionOptions: await dataService.getUpdatedSecrets(),
      };
      this.connectionMergeInfos[connectionInfo.id] = merge(
        cloneDeep(this.connectionMergeInfos[connectionInfo.id]),
        mergeConnectionInfo
      );
    }

    await this._connectionStorage.saveConnection({
      ...merge(
        this._connections[connectionInfo.id] ?? connectionInfo,
        mergeConnectionInfo
      ),
    });

    // ?. because mocks in tests don't provide it
    dataService.on?.('connectionInfoSecretsChanged', () => {
      void (async () => {
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
          this.connectionMergeInfos[connectionInfo.id] = merge(
            cloneDeep(this.connectionMergeInfos[connectionInfo.id]),
            mergeConnectionInfo
          );

          if (!this._connections[connectionInfo.id]) return;
          await this._connectionStorage.saveConnection({
            ...merge(this._connections[connectionInfo.id], mergeConnectionInfo),
          });
        } catch (err: any) {
          log.warn(
            'Connection Controller',
            'Failed to update connection store with updated secrets',
            { err: err?.stack }
          );
        }
      })();
    });
  }

  cancelConnectionAttempt() {
    this._connectionAttempt?.cancelConnectionAttempt();
  }

  async connectWithConnectionId(connectionId: string): Promise<boolean> {
    if (!this._connections[connectionId]) {
      throw new Error('Connection not found.');
    }

    try {
      await this._connect(connectionId, ConnectionTypes.CONNECTION_ID);

      return true;
    } catch (error) {
      log.error('Failed to connect by a connection id', error);
      const printableError = formatError(error);
      void vscode.window.showErrorMessage(
        `Unable to connect: ${printableError.message}`
      );
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    log.info(
      'Disconnect called, currently connected to',
      this._currentConnectionId
    );

    this._currentConnectionId = null;
    this._disconnecting = true;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    if (!this._activeDataService) {
      void vscode.window.showErrorMessage(
        'Unable to disconnect: no active connection.'
      );

      return false;
    }

    this._statusView.showMessage('Disconnecting from current connection...');

    try {
      // Disconnect from the active connection.
      await this._activeDataService.disconnect();
      void vscode.window.showInformationMessage('MongoDB disconnected.');
      this._activeDataService = null;

      void vscode.commands.executeCommand(
        'setContext',
        'mdb.connectedToMongoDB',
        false
      );
      void vscode.commands.executeCommand(
        'setContext',
        'mdb.isAtlasStreams',
        false
      );
    } catch (error) {
      // Show an error, however we still reset the active connection to free up the extension.
      void vscode.window.showErrorMessage(
        'An error occured while disconnecting from the current connection.'
      );
    }

    this._disconnecting = false;
    this._statusView.hideMessage();

    return true;
  }

  async removeSavedConnection(connectionId: string): Promise<void> {
    delete this._connections[connectionId];

    await this._connectionStorage.removeConnection(connectionId);

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
  }

  // Prompts the user to remove the connection then removes it on affirmation.
  async removeMongoDBConnection(connectionId: string): Promise<boolean> {
    if (!this._connections[connectionId]) {
      // No active connection(s) to remove.
      void vscode.window.showErrorMessage('Connection does not exist.');

      return false;
    }

    const removeConfirmationResponse =
      await vscode.window.showInformationMessage(
        `Are you sure to want to remove connection ${this._connections[connectionId].name}?`,
        { modal: true },
        'Yes'
      );

    if (removeConfirmationResponse !== 'Yes') {
      return false;
    }

    if (this._activeDataService && connectionId === this._currentConnectionId) {
      await this.disconnect();
    }

    if (!this._connections[connectionId]) {
      // If the connection was removed while we were disconnecting we resolve.
      return false;
    }

    await this.removeSavedConnection(connectionId);

    void vscode.window.showInformationMessage('MongoDB connection removed.');

    return true;
  }

  async onRemoveMongoDBConnection(): Promise<boolean> {
    log.info('mdb.removeConnection command called');

    const connectionIds = Object.keys(this._connections);

    if (connectionIds.length === 0) {
      // No active connection(s) to remove.
      void vscode.window.showErrorMessage('No connections to remove.');

      return false;
    }

    if (connectionIds.length === 1) {
      return this.removeMongoDBConnection(connectionIds[0]);
    }

    // There is more than 1 possible connection to remove.
    // We attach the index of the connection so that we can infer their pick.
    const connectionNameToRemove: string | undefined =
      await vscode.window.showQuickPick(
        connectionIds.map(
          (id, index) => `${index + 1}: ${this._connections[id].name}`
        ),
        {
          placeHolder: 'Choose a connection to remove...',
        }
      );

    if (!connectionNameToRemove) {
      return false;
    }

    // We attach the index of the connection so that we can infer their pick.
    const connectionIndexToRemove =
      Number(connectionNameToRemove.split(':', 1)[0]) - 1;
    const connectionIdToRemove = connectionIds[connectionIndexToRemove];

    return this.removeMongoDBConnection(connectionIdToRemove);
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
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    await this._connectionStorage.saveConnection(
      this._connections[connectionId]
    );

    // No storing needed.
    return true;
  }

  addEventListener(
    eventType: DataServiceEventTypes,
    listener: () => void
  ): void {
    this.eventEmitter.addListener(eventType, listener);
  }

  removeEventListener(
    eventType: DataServiceEventTypes,
    listener: () => void
  ): void {
    this.eventEmitter.removeListener(eventType, listener);
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
        options.proxyPassword
      );
    }

    if (options.proxyPort) {
      connectionStringData.searchParams.set(
        'proxyPort',
        `${options.proxyPort}`
      );
    }

    if (options.proxyUsername) {
      connectionStringData.searchParams.set(
        'proxyUsername',
        options.proxyUsername
      );
    }

    return connectionStringData.toString();
  }

  isConnectedToAtlasStreams() {
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

  getActiveDataService() {
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
        'Copy connection string failed: connectionOptions are missing.'
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

  // Exposed for testing.
  setActiveDataService(newDataService: DataService): void {
    this._activeDataService = newDataService;
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
          (connectionA.name || '').localeCompare(connectionB.name || '')
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
      }
    );

    if (!selectedQuickPickItem) {
      return true;
    }

    if (selectedQuickPickItem.data.type === NewConnectionType.NEW_CONNECTION) {
      return this.connectWithURI();
    }

    if (!selectedQuickPickItem.data.connectionId) {
      return true;
    }

    return this.connectWithConnectionId(
      selectedQuickPickItem.data.connectionId
    );
  }
}
