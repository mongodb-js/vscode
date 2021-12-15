import * as vscode from 'vscode';
import {
  connect,
  convertConnectionModelToInfo,
  convertConnectionInfoToModel,
  ConnectionInfo,
  ConnectionOptions,
  DataService
} from 'mongodb-data-service';
import ConnectionModel from 'mongodb-connection-model';
import { EventEmitter } from 'events';
import { promisify } from 'util';

import { CONNECTION_STATUS } from './views/webview-app/extension-app-message-constants';
import { createLogger } from './logging';
import { ext } from './extensionConstants';
import { ConnectionSecrets, extractSecrets, mergeSecrets } from './utils/connectionSecrets';
import RawConnectionModel from './views/webview-app/connection-model/connection-model';
import { StorageScope, ConnectionsFromStorage } from './storage/storageController';
import { StorageController, StorageVariables } from './storage';
import { StatusView } from './views';
import TelemetryService from './telemetry/telemetryService';

const log = createLogger('connection controller');
const { name, version } = require('../package.json');

const MAX_CONNECTION_NAME_LENGTH = 512;

export enum DataServiceEventTypes {
  CONNECTIONS_DID_CHANGE = 'CONNECTIONS_DID_CHANGE',
  ACTIVE_CONNECTION_CHANGED = 'ACTIVE_CONNECTION_CHANGED'
}

export enum ConnectionTypes {
  CONNECTION_FORM = 'CONNECTION_FORM',
  CONNECTION_STRING = 'CONNECTION_STRING',
  CONNECTION_ID = 'CONNECTION_ID'
}

export interface SavedConnectionInfo {
  id: string; // Connection model id or a new uuid.
  name: string; // Possibly user given name, not unique.
  storageLocation: StorageScope;
  connectionOptions: ConnectionOptions;
}

export enum NewConnectionType {
  NEW_CONNECTION = 'NEW_CONNECTION',
  SAVED_CONNECTION = 'SAVED_CONNECTION'
}

interface ConnectionAttemptResult {
  successfullyConnected: boolean;
  connectionErrorMessage: string;
}

interface СonnectionQuickPicks {
  label: string;
  data: { type: NewConnectionType, connectionId?: string }
}

export default class ConnectionController {
  // This is a map of connection ids to their configurations.
  // These connections can be saved on the session (runtime),
  // on the workspace, or globally in vscode.
  _connections: { [key: string]: SavedConnectionInfo } = {};
  _activeDataService: DataService| null = null;
  _activeConnectionModel: ConnectionModel | null = null;

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
  private _storageController: StorageController;
  private _telemetryService: TelemetryService;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(
    statusView: StatusView,
    storageController: StorageController,
    telemetryService: TelemetryService
  ) {
    this._statusView = statusView;
    this._storageController = storageController;
    this._telemetryService = telemetryService;
  }

  private _migratePreviouslySavedConnection () {}

  private async _getConnectionOptionsWithSecrets(connectionId: string): Promise<ConnectionOptions|undefined> {
    if (!ext.keytarModule) {
      log.error('VSCode extension keytar module is undefined.');
      return;
    }

    try {
      const unparsedSecrets = await ext.keytarModule.getPassword(
        this._serviceName,
        connectionId
      );

      if (!unparsedSecrets) {
        // Ignore empty secrets.
        return;
      }

      const secrets = JSON.parse(unparsedSecrets);

      if (secrets.connectionModel) {
        this._migratePreviouslySavedConnection();
      }

      const connectionOptions = this._connections[connectionId].connectionOptions;
      const connectionInfoWithSecrets = mergeSecrets({ connectionOptions }, secrets);

      return connectionInfoWithSecrets.connectionOptions;
    } catch (error) {
      // Here we're leniant when loading connections in case their
      // connections have become corrupted.
      return;
    }
  }

  private async _loadSavedConnectionsByStore(
    savedConnections: ConnectionsFromStorage
  ): Promise<void> {
    if (Object.keys(savedConnections).length < 1) {
      return;
    }

    await Promise.all(
      Object.keys(savedConnections).map(async (connectionId) => {
        this._connections[connectionId] = { ...savedConnections[connectionId] };

        const connectionOptionsWithSecrets = await this._getConnectionOptionsWithSecrets(
          connectionId
        );

        if (connectionOptionsWithSecrets) {
          this._connections[connectionId].connectionOptions = connectionOptionsWithSecrets;
        }

        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
      })
    );
  }

  async loadSavedConnections(): Promise<void> {
    // Try to pull in the connections previously saved in the global storage of vscode.
    const existingGlobalConnections =
      this._storageController.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS) ||
      {};
    await this._loadSavedConnectionsByStore(existingGlobalConnections);

    // Try to pull in the connections previously saved in the workspace storage of vscode.
    const existingWorkspaceConnections =
      this._storageController.get(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        StorageScope.WORKSPACE
      ) ||
      {};
    await this._loadSavedConnectionsByStore(existingWorkspaceConnections);
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
          if (!ConnectionModel.isURI(uri)) {
            return 'MongoDB connection strings begin with "mongodb://" or "mongodb+srv://"';
          }

          return null;
        }
      });
    } catch (e) {
      return false;
    }

    if (!connectionString) {
      return false;
    }

    try {
      return this.addNewConnectionStringAndConnect(connectionString);
    } catch (error) {
      const printableError = error as { message: string };
      void vscode.window.showErrorMessage(printableError.message);

      return false;
    }
  }

  // Resolves the new connection id when the connection is successfully added.
  // Resolves false when it is added and not connected.
  // The connection can fail to connect but be successfully added.
  async addNewConnectionStringAndConnect(
    connectionString: string
  ): Promise<boolean> {
    log.info('Trying to connect to a new connection configuration');

    const connectionFrom = promisify(ConnectionModel.from.bind(ConnectionModel));

    try {
      const connectionModel = await connectionFrom(connectionString);

      if (typeof connectionModel.appname === 'undefined') {
        connectionModel.appname = `${name} ${version}`;
      }

      const connectionInfo = convertConnectionModelToInfo(connectionModel);
      const connectResult = await this.saveNewConnectionAndConnect(
        connectionInfo,
        ConnectionTypes.CONNECTION_STRING
      );

      return connectResult.successfullyConnected;
    } catch (error) {
      throw new Error(`Unable to create connection: ${error}`);
    }
  }

  public sendTelemetry(newDataService: DataService, connectionType: ConnectionTypes): void {
    void this._telemetryService.trackNewConnection(newDataService, connectionType);
  }

  parseNewConnection(rawConnectionModel: RawConnectionModel): ConnectionInfo {
    const connectionModel = new ConnectionModel(rawConnectionModel);

    return convertConnectionModelToInfo(connectionModel);
  }

  private async _saveSecretsToKeychain(
    { connectionId, secrets }: { connectionId: string, secrets: ConnectionSecrets }
  ): Promise<void> {
    if (ext.keytarModule) {
      const secretsAsString = JSON.stringify(secrets);

      await ext.keytarModule.setPassword(
        this._serviceName,
        connectionId,
        secretsAsString
      );
    }
  }

  async saveNewConnectionAndConnect(
    originalConnectionInfo: ConnectionInfo,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
    // We don't want to store secrets to disc.
    const { connectionInfo: safeConnectionInfo, secrets } = extractSecrets(
      originalConnectionInfo
    );
    const savedConnectionInfo = await this._storageController.storeNewConnection(
      safeConnectionInfo // The connection info without secrtes.
    );

    // We want to keep secrets in memory tho.
    this._connections[savedConnectionInfo.id] = {
      ...savedConnectionInfo,
      connectionOptions: originalConnectionInfo.connectionOptions // The connection options with secrtes.
    };

    // We also want to store secrets to keychain.
    await this._saveSecretsToKeychain({
      connectionId: savedConnectionInfo.id,
      secrets
    });

    log.info(`Connect called to connect to instance: ${savedConnectionInfo.name}`);
    return this._connect(savedConnectionInfo.id, connectionType);
  }

  async getDataServiceAndConnect(connectionOptions: ConnectionOptions) {
    const dataService = await connect(connectionOptions);
    await dataService.connect();

    return dataService;
  }

  private async _connect(
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
      await this.disconnect();
    }

    this._statusView.showMessage('Connecting to MongoDB...');

    const connectionOptions = this._connections[connectionId].connectionOptions;

    if (!connectionOptions) {
      throw new Error('Connection not found.');
    }

    let newDataService;
    let connectError;

    try {
      newDataService = await this.getDataServiceAndConnect(connectionOptions);
    } catch (error) {
      connectError = error;
    }

    if (this._endPrevConnectAttempt({ connectionId, connectingAttemptVersion, newDataService })) {
      return {
        successfullyConnected: false,
        connectionErrorMessage: 'connection attempt overriden'
      };
    }

    this._statusView.hideMessage();

    if (connectError) {
      this._connecting = false;
      log.info('Failed to connect');
      this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

      throw new Error(`Failed to connect: ${connectError.message}`);
    }

    log.info('Successfully connected');
    void vscode.window.showInformationMessage('MongoDB connection successful.');

    this._activeDataService = newDataService;
    this._activeConnectionModel = await convertConnectionInfoToModel({ connectionOptions });
    this._currentConnectionId = connectionId;
    this._connecting = false;
    this._connectingConnectionId = null;
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    // Send metrics to Segment
    this.sendTelemetry(newDataService, connectionType);

    return {
      successfullyConnected: true,
      connectionErrorMessage: ''
    };
  }

  private _endPrevConnectAttempt (attempt: {
    connectionId: string,
    connectingAttemptVersion: null | string,
    newDataService: DataService
  }): Boolean {
    const { connectionId, connectingAttemptVersion, newDataService } = attempt;

    if (
      connectingAttemptVersion !== this._connectingVersion ||
      !this._connections[connectionId]
    ) {
      // If the current attempt is no longer the most recent attempt
      // or the connection no longer exists we silently end the connection
      // and return.
      try {
        void newDataService.disconnect();
      } catch (e) {
        /* */
      }

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
      throw new Error(`Unable to connection: ${error}`);
    }
  }

  async disconnect(): Promise<boolean> {
    log.info(
      'Disconnect called, currently connected to:',
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
      this._activeConnectionModel = null;
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
    if (ext.keytarModule) {
      await ext.keytarModule.deletePassword(this._serviceName, connectionId);
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

    const removeConfirmationResponse = await vscode.window.showInformationMessage(
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
    const connectionNameToRemove:
      | string
      | undefined = await vscode.window.showQuickPick(
        connectionIds.map(
          (id, index) => `${index + 1}: ${this._connections[id].name}`
        ),
        {
          placeHolder: 'Choose a connection to remove...'
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
        }
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

    if (
      this._connections[connectionId].storageLocation === StorageScope.GLOBAL
    ) {
      await this._storageController.saveConnectionToGlobalStore(
        this._connections[connectionId]
      );
      return true;
    }

    if (
      this._connections[connectionId].storageLocation === StorageScope.WORKSPACE
    ) {
      await this._storageController.saveConnectionToWorkspaceStore(
        this._connections[connectionId]
      );

      return true;
    }

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

  getSavedConnections(): SavedConnectionInfo[] {
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

  getActiveDataService(): DataService | null {
    return this._activeDataService;
  }

  getActiveDerivedConnectionModel(): ConnectionModel {
    return this._activeConnectionModel
      ? this._activeConnectionModel.getAttributes({ derived: true })
      : null;
  }

  async getConnectionStringByConnectionId(connectionId: string): Promise<string> {
    const connectionOptions = this._connections[connectionId].connectionOptions;

    if (!connectionOptions) {
      throw new Error('Connection not found.');
    }

    const connectionModel = await convertConnectionInfoToModel({ connectionOptions });

    return connectionModel.driverUrlWithSsh || '';
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
    this._activeConnectionModel = null;
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

  getСonnectionQuickPicks(): СonnectionQuickPicks[] {
    if (!this._connections) {
      return [
        {
          label: 'Add new connection',
          data: {
            type: NewConnectionType.NEW_CONNECTION
          }
        }
      ];
    }

    return [
      {
        label: 'Add new connection',
        data: {
          type: NewConnectionType.NEW_CONNECTION
        }
      },
      ...Object.values(this._connections)
        .sort((connectionA: SavedConnectionInfo, connectionB: SavedConnectionInfo) =>
          (connectionA.name || '').localeCompare(connectionB.name || '')
        )
        .map((item: SavedConnectionInfo) => ({
          label: item.name,
          data: {
            type: NewConnectionType.SAVED_CONNECTION,
            connectionId: item.id
          }
        }))
    ];
  }

  async changeActiveConnection(): Promise<boolean> {
    const selectedQuickPickItem = await vscode.window.showQuickPick(
      this.getСonnectionQuickPicks(),
      {
        placeHolder: 'Select new connection...'
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

    return this.connectWithConnectionId(selectedQuickPickItem.data.connectionId);
  }
}
