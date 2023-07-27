import * as vscode from 'vscode';
import {
  convertConnectionModelToInfo,
  ConnectionInfo,
  ConnectionOptions,
  getConnectionTitle,
  extractSecrets,
  mergeSecrets,
  connect,
} from 'mongodb-data-service';
import type { DataService } from 'mongodb-data-service';
import ConnectionString from 'mongodb-connection-string-url';
import { EventEmitter } from 'events';
import type { MongoClientOptions } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

import { CONNECTION_STATUS } from './views/webview-app/extension-app-message-constants';
import { createLogger } from './logging';
import { ext } from './extensionConstants';
import formatError from './utils/formatError';
import LegacyConnectionModel from './views/webview-app/connection-model/legacy-connection-model';
import {
  StorageLocation,
  SecretStorageLocationType,
  SecretStorageLocation,
} from './storage/storageController';
import { StorageController, StorageVariables } from './storage';
import { StatusView } from './views';
import TelemetryService from './telemetry/telemetryService';
import LINKS from './utils/links';
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

export interface StoreConnectionInfo {
  id: string; // Connection model id or a new uuid.
  name: string; // Possibly user given name, not unique.
  storageLocation: StorageLocation;
  secretStorageLocation?: SecretStorageLocationType;
  connectionOptions?: ConnectionOptions;
  connectionModel?: LegacyConnectionModel;
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

type StoreConnectionInfoWithConnectionModel = StoreConnectionInfo &
  Required<Pick<StoreConnectionInfo, 'connectionModel'>>;

type StoreConnectionInfoWithConnectionOptions = StoreConnectionInfo &
  Required<Pick<StoreConnectionInfo, 'connectionOptions'>>;

type StoreConnectionInfoWithSecretStorageLocation = StoreConnectionInfo &
  Required<Pick<StoreConnectionInfo, 'secretStorageLocation'>>;

type MigratedStoreConnectionInfoWithConnectionOptions =
  StoreConnectionInfoWithConnectionOptions &
    StoreConnectionInfoWithSecretStorageLocation;

type FailedMigrationConnectionDescriptor = {
  connectionId: string;
  connectionName: string;
};

export const keytarMigrationFailedMessage = (failedConnections: number) => {
  // Writing the message this way to keep it readable.
  return [
    `Unable to migrate ${failedConnections} of your cluster connections from the deprecated Keytar to the VS Code SecretStorage.`,
    'Keytar is officially archived and not being maintained.',
    'In an effort to promote good security practices by not depending on an archived piece of software, VS Code removes Keytar shim in favour of built-in storage utility for secrets.',
    'Please review your connections and delete or recreate those with missing secrets.',
    'You can still access your secrets via OS keychain.',
  ].join(' ');
};

export default class ConnectionController {
  // This is a map of connection ids to their configurations.
  // These connections can be saved on the session (runtime),
  // on the workspace, or globally in vscode.
  _connections: {
    [connectionId: string]: MigratedStoreConnectionInfoWithConnectionOptions;
  } = Object.create(null);
  _activeDataService: DataService | null = null;
  _storageController: StorageController;
  _telemetryService: TelemetryService;

  private readonly _serviceName = 'mdb.vscode.savedConnections';
  private _currentConnectionId: null | string = null;

  // When we are connecting to a server we save a connection version to
  // the request. That way if a new connection attempt is made while
  // the connection is being established, we know we can ignore the
  // request when it is completed so we don't have two live connections at once.
  private _connectingVersion: null | string = null;

  private _connecting = false;
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
    this._storageController = storageController;
    this._telemetryService = telemetryService;
  }

  async loadSavedConnections(): Promise<void> {
    const globalAndWorkspaceConnections = Object.entries({
      ...this._storageController.get(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS,
        StorageLocation.GLOBAL
      ),
      ...this._storageController.get(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        StorageLocation.WORKSPACE
      ),
    });

    // A list of connection ids that we could not migrate in previous load of
    // connections because of Keytar not being available.
    const connectionIdsThatDidNotMigrateEarlier =
      globalAndWorkspaceConnections.reduce<string[]>(
        (ids, [connectionId, connectionInfo]) => {
          if (
            connectionInfo.secretStorageLocation ===
            SecretStorageLocation.Keytar
          ) {
            return [...ids, connectionId];
          }
          return ids;
        },
        []
      );

    // A list of connection descriptors that we could not migration in the
    // current load of connections because of Keytar not being available.
    const connectionsThatDidNotMigrate = (
      await Promise.all(
        globalAndWorkspaceConnections.map<
          Promise<FailedMigrationConnectionDescriptor | undefined>
        >(async ([connectionId, connectionInfo]) => {
          const connectionInfoWithSecrets =
            await this._getConnectionInfoWithSecrets(connectionInfo);
          if (!connectionInfoWithSecrets) {
            return;
          }

          this._connections[connectionId] = connectionInfoWithSecrets;
          const connectionSecretsInKeytar =
            connectionInfoWithSecrets.secretStorageLocation ===
            SecretStorageLocation.Keytar;
          if (
            connectionSecretsInKeytar &&
            !connectionIdsThatDidNotMigrateEarlier.includes(connectionId)
          ) {
            return {
              connectionId,
              connectionName: connectionInfo.name,
            };
          }
        })
      )
    ).filter((conn): conn is FailedMigrationConnectionDescriptor => !!conn);

    const loadedConnections = Object.values(this._connections);
    if (loadedConnections.length) {
      this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    }

    this._telemetryService.trackSavedConnectionsLoaded({
      saved_connections: globalAndWorkspaceConnections.length,
      loaded_connections: loadedConnections.length,
      connections_with_secrets_in_keytar: loadedConnections.filter(
        (connection) =>
          connection.secretStorageLocation === SecretStorageLocation.Keytar
      ).length,
      connections_with_secrets_in_secret_storage: loadedConnections.filter(
        (connection) =>
          connection.secretStorageLocation ===
          SecretStorageLocation.SecretStorage
      ).length,
    });

    if (connectionsThatDidNotMigrate.length) {
      log.error(
        `Could not migrate secrets for ${connectionsThatDidNotMigrate.length} connections`,
        connectionsThatDidNotMigrate
      );
      this._telemetryService.trackKeytarSecretsMigrationFailed({
        saved_connections: globalAndWorkspaceConnections.length,
        loaded_connections: loadedConnections.length,
        connections_with_failed_keytar_migration:
          connectionsThatDidNotMigrate.length,
      });
      void vscode.window.showInformationMessage(
        keytarMigrationFailedMessage(connectionsThatDidNotMigrate.length)
      );
    }
  }

  async _getConnectionInfoWithSecrets(
    connectionInfo: StoreConnectionInfo
  ): Promise<MigratedStoreConnectionInfoWithConnectionOptions | undefined> {
    try {
      if (connectionInfo.connectionModel) {
        return await this._migrateConnectionWithConnectionModel(
          connectionInfo as StoreConnectionInfoWithConnectionModel
        );
      }

      if (!connectionInfo.secretStorageLocation) {
        return await this._migrateConnectionWithKeytarSecrets(
          connectionInfo as StoreConnectionInfoWithConnectionOptions
        );
      }

      // We tried migrating this connection earlier but failed because Keytar was not
      // available. So we return simply the connection without secrets.
      if (
        connectionInfo.secretStorageLocation === SecretStorageLocation.Keytar
      ) {
        return connectionInfo as MigratedStoreConnectionInfoWithConnectionOptions;
      }

      const unparsedSecrets =
        (await this._storageController.getSecret(connectionInfo.id)) ?? '';

      return this._mergedConnectionInfoWithSecrets(
        connectionInfo as MigratedStoreConnectionInfoWithConnectionOptions,
        unparsedSecrets
      );
    } catch (error) {
      log.error('Error while retrieving connection info', error);
      return undefined;
    }
  }

  async _migrateConnectionWithConnectionModel(
    savedConnectionInfo: StoreConnectionInfoWithConnectionModel
  ): Promise<MigratedStoreConnectionInfoWithConnectionOptions | undefined> {
    // Transform a raw connection model from storage to an ampersand model.
    const newConnectionInfoWithSecrets = convertConnectionModelToInfo(
      savedConnectionInfo.connectionModel
    );

    const connectionInfoWithSecrets = {
      id: savedConnectionInfo.id,
      name: savedConnectionInfo.name,
      storageLocation: savedConnectionInfo.storageLocation,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: newConnectionInfoWithSecrets.connectionOptions,
    };

    await this._saveConnectionWithSecrets(connectionInfoWithSecrets);
    return connectionInfoWithSecrets;
  }

  async _migrateConnectionWithKeytarSecrets(
    savedConnectionInfo: StoreConnectionInfoWithConnectionOptions
  ): Promise<MigratedStoreConnectionInfoWithConnectionOptions | undefined> {
    // If the Keytar module is not available, we simply mark the connections
    // storage as Keytar and return
    if (!ext.keytarModule) {
      log.error('Could not migrate Keytar secrets, module not found');
      return await this._storageController.saveConnection<MigratedStoreConnectionInfoWithConnectionOptions>(
        {
          ...savedConnectionInfo,
          secretStorageLocation: SecretStorageLocation.Keytar,
        }
      );
    }

    // If there is nothing in keytar, we will save an empty object as secrets in
    // new storage and mark this connection as migrated
    const keytarSecrets =
      (await ext.keytarModule.getPassword(
        this._serviceName,
        savedConnectionInfo.id
      )) || '{}';

    const migratedConnectionInfoWithSecrets =
      this._mergedConnectionInfoWithSecrets(
        {
          ...savedConnectionInfo,
          secretStorageLocation: SecretStorageLocation.SecretStorage,
        },
        keytarSecrets
      );

    await this._saveConnectionWithSecrets(migratedConnectionInfoWithSecrets);

    return migratedConnectionInfoWithSecrets;
  }

  _mergedConnectionInfoWithSecrets<
    T extends StoreConnectionInfoWithConnectionOptions
  >(connectionInfo: T, unparsedSecrets: string) {
    if (!unparsedSecrets) {
      return connectionInfo;
    }

    const secrets = JSON.parse(unparsedSecrets);
    const connectionInfoWithSecrets = mergeSecrets(
      {
        id: connectionInfo.id,
        connectionOptions: connectionInfo.connectionOptions,
      },
      secrets
    );

    return {
      ...connectionInfo,
      connectionOptions: connectionInfoWithSecrets.connectionOptions,
    };
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
      const connectResult = await this.saveNewConnectionFromFormAndConnect(
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
  ): ConnectionInfo {
    return convertConnectionModelToInfo({
      ...rawConnectionModel,
      appname: `${packageJSON.name} ${packageJSON.version}`, // Override the default connection appname.
    });
  }

  private async _saveConnectionWithSecrets(
    newStoreConnectionInfoWithSecrets: MigratedStoreConnectionInfoWithConnectionOptions
  ): Promise<MigratedStoreConnectionInfoWithConnectionOptions> {
    // We don't want to store secrets to disc.
    const { connectionInfo: safeConnectionInfo, secrets } = extractSecrets(
      newStoreConnectionInfoWithSecrets as ConnectionInfo
    );
    const savedConnectionInfo = await this._storageController.saveConnection({
      ...newStoreConnectionInfoWithSecrets,
      connectionOptions: safeConnectionInfo.connectionOptions, // The connection info without secrets.
    });
    await this._storageController.setSecret(
      savedConnectionInfo.id,
      JSON.stringify(secrets)
    );

    return savedConnectionInfo;
  }

  async saveNewConnectionFromFormAndConnect(
    originalConnectionInfo: ConnectionInfo,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
    const name = getConnectionTitle(originalConnectionInfo);
    const newConnectionInfo = {
      id: originalConnectionInfo.id,
      name,
      // To begin we just store it on the session, the storage controller
      // handles changing this based on user preference.
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: originalConnectionInfo.connectionOptions,
    };

    const savedConnectionInfo = await this._saveConnectionWithSecrets(
      newConnectionInfo
    );

    this._connections[savedConnectionInfo.id] = {
      ...savedConnectionInfo,
      connectionOptions: originalConnectionInfo.connectionOptions, // The connection options with secrets.
    };

    log.info('Connect called to connect to instance', savedConnectionInfo.name);

    return this._connect(savedConnectionInfo.id, connectionType);
  }

  async _connectWithDataService(connectionOptions: ConnectionOptions) {
    return connect({
      connectionOptions,
      productName: packageJSON.name,
      productDocsLink: LINKS.extensionDocs(),
    });
  }

  async _connect(
    connectionId: string,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
    // Store a version of this connection, so we can see when the conection
    // is successful if it is still the most recent connection attempt.
    this._connectingVersion = connectionId;
    const connectingAttemptVersion = this._connectingVersion;
    this._connecting = true;
    this._connectingConnectionId = connectionId;
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    if (this._activeDataService) {
      log.info('Disconnecting from the previous connection...', {
        connectionId: this._currentConnectionId,
      });
      await this.disconnect();
    }

    this._statusView.showMessage('Connecting to MongoDB...');
    log.info('Connecting to MongoDB...', {
      connectionInfo: JSON.stringify(
        extractSecrets(this._connections[connectionId]).connectionInfo
      ),
    });

    const connectionOptions = this._connections[connectionId].connectionOptions;

    if (!connectionOptions) {
      throw new Error('Connect failed: connectionOptions are missing.');
    }

    let dataService;
    let connectError;

    try {
      dataService = await this._connectWithDataService(connectionOptions);
    } catch (error) {
      connectError = error;
    }

    const shouldEndPrevConnectAttempt = this._endPrevConnectAttempt({
      connectionId,
      connectingAttemptVersion,
      dataService,
    });

    if (shouldEndPrevConnectAttempt) {
      return {
        successfullyConnected: false,
        connectionErrorMessage: 'connection attempt overriden',
      };
    }

    this._statusView.hideMessage();

    if (connectError) {
      this._connecting = false;
      this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

      throw connectError;
    }

    log.info('Successfully connected', { connectionId });
    void vscode.window.showInformationMessage('MongoDB connection successful.');

    this._activeDataService = dataService;
    this._currentConnectionId = connectionId;
    this._connecting = false;
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

    return {
      successfullyConnected: true,
      connectionErrorMessage: '',
    };
  }

  private _endPrevConnectAttempt({
    connectionId,
    connectingAttemptVersion,
    dataService,
  }: {
    connectionId: string;
    connectingAttemptVersion: null | string;
    dataService: DataService | null;
  }): boolean {
    if (
      connectingAttemptVersion !== this._connectingVersion ||
      !this._connections[connectionId]
    ) {
      // If the current attempt is no longer the most recent attempt
      // or the connection no longer exists we silently end the connection
      // and return.
      void dataService?.disconnect().catch(() => {
        /* ignore */
      });

      return true;
    }

    return false;
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

  private async _removeSecretsFromKeychain(connectionId: string) {
    await this._storageController.deleteSecret(connectionId);
    // Even though we migrated to SecretStorage from keytar, we are still removing
    // secrets from keytar to make sure that we don't leave any left-overs when a
    // connection is removed. This block can safely be removed after our migration
    // has been out for some time.
    try {
      await ext.keytarModule?.deletePassword(this._serviceName, connectionId);
    } catch (error) {
      log.error('Failed to remove secret from keytar', error);
    }
  }

  async removeSavedConnection(connectionId: string): Promise<void> {
    delete this._connections[connectionId];

    await this._removeSecretsFromKeychain(connectionId);
    this._storageController.removeConnection(connectionId);

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
      throw new Error(`An error occured parsing the connection name: ${e}`);
    }

    if (!inputtedConnectionName) {
      return false;
    }

    this._connections[connectionId].name = inputtedConnectionName;
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    await this._storageController.saveConnection(
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
    return this._connecting;
  }

  isDisconnecting(): boolean {
    return this._disconnecting;
  }

  isCurrentlyConnected(): boolean {
    return this._activeDataService !== null;
  }

  getSavedConnections(): StoreConnectionInfo[] {
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
    this._connecting = false;
    this._disconnecting = false;
    this._connectingConnectionId = '';
    this._connectingVersion = null;
  }

  getConnectingVersion(): string | null {
    return this._connectingVersion;
  }

  setActiveDataService(newDataService: DataService): void {
    this._activeDataService = newDataService;
  }

  setConnnecting(connecting: boolean): void {
    this._connecting = connecting;
  }

  setDisconnecting(disconnecting: boolean): void {
    this._disconnecting = disconnecting;
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
        .sort(
          (
            connectionA: StoreConnectionInfo,
            connectionB: StoreConnectionInfo
          ) => (connectionA.name || '').localeCompare(connectionB.name || '')
        )
        .map((item: StoreConnectionInfo) => ({
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
