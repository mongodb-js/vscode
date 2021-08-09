import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import Connection from 'mongodb-connection-model/lib/model';
import DataService from 'mongodb-data-service';
import { EventEmitter } from 'events';
import { promisify } from 'util';

import { CONNECTION_STATUS } from './views/webview-app/extension-app-message-constants';
import { ConnectionModel } from './types/connectionModelType';
import { createLogger } from './logging';
import { DataServiceType } from './types/dataServiceType';
import { ext } from './extensionConstants';
import { SavedConnection, StorageScope } from './storage/storageController';
import SSH_TUNNEL_TYPES from './views/webview-app/connection-model/constants/ssh-tunnel-types';
import { StatusView } from './views';
import { StorageController, StorageVariables } from './storage';
import TelemetryService from './telemetry/telemetryService';

const { name, version } = require('../package.json');
const log = createLogger('connection controller');
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

export type SavedConnectionInformation = {
  connectionModel: ConnectionModel;
};

// A loaded connection contains connection information.
export type LoadedConnection = SavedConnection & SavedConnectionInformation;

export enum NewConnectionType {
  NEW_CONNECTION = 'NEW_CONNECTION',
  SAVED_CONNECTION = 'SAVED_CONNECTION'
}

type ConnectionAttemptResult = {
  successfullyConnected: boolean;
  connectionErrorMessage: string;
};

export default class ConnectionController {
  // This is a map of connection ids to their configurations.
  // These connections can be saved on the session (runtime),
  // on the workspace, or globally in vscode.
  _connections: { [key: string]: LoadedConnection } = {};
  _activeDataService: null | DataServiceType = null;
  _activeConnectionModel: null | ConnectionModel = null;

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
    _statusView: StatusView,
    storageController: StorageController,
    telemetryService: TelemetryService
  ) {
    this._statusView = _statusView;
    this._storageController = storageController;
    this._telemetryService = telemetryService;
  }

  async _loadSavedConnection(
    connectionId: string,
    savedConnection: SavedConnection
  ): Promise<void> {
    if (!ext.keytarModule) {
      return;
    }

    let loadedSavedConnection: LoadedConnection;

    try {
      const unparsedConnectionInformation = await ext.keytarModule.getPassword(
        this._serviceName,
        connectionId
      );

      if (!unparsedConnectionInformation) {
        // Ignore empty connections.
        return;
      }

      const connectionInformation: SavedConnectionInformation = JSON.parse(
        unparsedConnectionInformation
      );

      if (!connectionInformation.connectionModel) {
        // Ignore empty connections.
        return;
      }

      loadedSavedConnection = {
        id: connectionId,
        name: savedConnection.name,
        connectionModel: connectionInformation.connectionModel,
        storageLocation: savedConnection.storageLocation
      };
    } catch (error) {
      // Here we're leniant when loading connections in case their
      // connections have become corrupted.
      return;
    }

    this._connections[connectionId] = {
      ...loadedSavedConnection,
      connectionModel: new Connection(loadedSavedConnection.connectionModel)
    };
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    return;
  }

  async loadSavedConnections(): Promise<void> {
    if (!ext.keytarModule) {
      return;
    }

    // Load saved connections from storage.
    const existingGlobalConnections: SavedConnection[] =
      this._storageController.get(StorageVariables.GLOBAL_SAVED_CONNECTIONS) ||
      {};

    if (Object.keys(existingGlobalConnections).length > 0) {
      // Try to pull in the connections previously saved globally on vscode.
      await Promise.all(
        Object.keys(existingGlobalConnections).map((connectionId) =>
          this._loadSavedConnection(
            connectionId,
            existingGlobalConnections[connectionId]
          )
        )
      );
    }

    const existingWorkspaceConnections: SavedConnection[] =
      this._storageController.get(
        StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
        StorageScope.WORKSPACE
      ) ||
      {};

    if (Object.keys(existingWorkspaceConnections).length > 0) {
      // Try to pull in the connections previously saved on the workspace.
      await Promise.all(
        Object.keys(existingWorkspaceConnections).map((connectionId) =>
          this._loadSavedConnection(
            connectionId,
            existingWorkspaceConnections[connectionId]
          )
        )
      );
    }
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
          if (!Connection.isURI(uri)) {
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
      void vscode.window.showErrorMessage(error.message);

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

    const connectionFrom = promisify(Connection.from.bind(Connection));

    try {
      const newConnectionModel = await connectionFrom(connectionString);
      const connectResult = await this.saveNewConnectionAndConnect(
        newConnectionModel,
        ConnectionTypes.CONNECTION_STRING
      );

      return connectResult.successfullyConnected;
    } catch (error) {
      throw new Error(`Unable to create connection: ${error}`);
    }
  }

  public sendTelemetry(
    newDataService: DataServiceType,
    connectionModel: ConnectionModel,
    connectionType: ConnectionTypes
  ): void {
    void this._telemetryService.trackNewConnection(
      newDataService.client.client,
      connectionModel,
      connectionType
    );
  }

  parseNewConnection(newConnectionModel: ConnectionModel): ConnectionModel {
    // Here we re-parse the connection, as it can be loaded from storage or
    // passed by the connection model without the class methods.
    const connectionModel: ConnectionModel = new Connection(
      newConnectionModel
    );

    return connectionModel;
  }

  getConnectionNameFromConnectionModel(connectionModel: ConnectionModel): string {
    const { sshTunnelOptions } = connectionModel.getAttributes({
      derived: true
    });

    if (
      connectionModel.sshTunnel &&
      connectionModel.sshTunnel !== SSH_TUNNEL_TYPES.NONE &&
      sshTunnelOptions.host &&
      sshTunnelOptions.port
    ) {
      return `SSH to ${connectionModel.hosts
        .map(({ host, port }) => `${host}:${port}`)
        .join(',')}`;
    }

    if (connectionModel.isSrvRecord) {
      return connectionModel.hostname;
    }

    if (connectionModel.hosts && connectionModel.hosts.length > 0) {
      return connectionModel.hosts
        .map(({ host, port }) => `${host}:${port}`)
        .join(',');
    }

    return connectionModel.hostname;
  }

  async saveNewConnectionAndConnect(
    connectionModel: ConnectionModel,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
    const connectionId = uuidv4();
    const connectionInformation: SavedConnectionInformation = {
      connectionModel
    };
    const connectionName = this.getConnectionNameFromConnectionModel(
      connectionModel
    );
    const savedConnection: SavedConnection = {
      id: connectionId,
      name: connectionName,
      // To begin we just store it on the session, the storage controller
      // handles changing this based on user preference.
      storageLocation: StorageScope.NONE
    };
    const newLoadedConnection = {
      ...savedConnection,
      ...connectionInformation
    };

    this._connections[connectionId] = newLoadedConnection;

    if (ext.keytarModule) {
      const connectionInfoAsString = JSON.stringify(connectionInformation);

      await ext.keytarModule.setPassword(
        this._serviceName,
        connectionId,
        connectionInfoAsString
      );
      void this._storageController.storeNewConnection(newLoadedConnection);
    }

    return this.connect(connectionId, connectionModel, connectionType);
  }

  private _endPrevConnectAttempt (attempt: {
    connectionId: string,
    connectingAttemptVersion: null | string,
    newDataService: DataServiceType
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
        newDataService.disconnect(() => {});
      } catch (e) {
        /* */
      }

      return true;
    }

    return false;
  }

  async connect(
    connectionId: string,
    connectionModel: ConnectionModel,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> {
    log.info(
      'Connect called to connect to instance:',
      this.getConnectionNameFromConnectionModel(connectionModel)
    );

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

    // Override the default connection `appname`.
    connectionModel.appname = `${name} ${version}`;

    const newDataService: DataServiceType = new DataService(connectionModel);
    const _connect = promisify(newDataService.connect.bind(newDataService));
    let connectError;

    try {
      await _connect();
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
    this._activeConnectionModel = connectionModel;
    this._currentConnectionId = connectionId;
    this._connecting = false;
    this._connectingConnectionId = null;
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    // Send metrics to Segment
    this.sendTelemetry(newDataService, connectionModel, connectionType);

    return {
      successfullyConnected: true,
      connectionErrorMessage: ''
    };
  }

  async connectWithConnectionId(connectionId: string): Promise<boolean> {
    if (!this._connections[connectionId]) {
      throw new Error('Connection not found.');
    }

    let connectionModel: ConnectionModel;

    try {
      const savedConnectionModel = this._connections[connectionId].connectionModel;

      // Here we rebuild the connection model to ensure it's up to date and
      // contains the connection model class methods (not just attributes).
      connectionModel = new Connection(
        savedConnectionModel.getAttributes
          ? savedConnectionModel.getAttributes({ props: true })
          : savedConnectionModel
      );
    } catch (error) {
      void vscode.window.showErrorMessage(`Unable to load connection: ${error}`);

      return false;
    }

    try {
      const connectResult = await this.connect(
        connectionId,
        connectionModel,
        ConnectionTypes.CONNECTION_ID
      );

      return connectResult.successfullyConnected;
    } catch (error) {
      void vscode.window.showErrorMessage(error.message);

      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    log.info(
      'Disconnect called, currently connected to:',
      this._currentConnectionId
    );

    if (!this._activeDataService) {
      void vscode.window.showErrorMessage(
        'Unable to disconnect: no active connection.'
      );

      return false;
    }

    const dataServiceToDisconnectFrom = this._activeDataService;

    this._activeDataService = null;
    this._currentConnectionId = null;
    this._activeConnectionModel = null;
    this._disconnecting = true;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    // Disconnect from the active connection.
    const _disconnect = promisify(
      dataServiceToDisconnectFrom.disconnect.bind(dataServiceToDisconnectFrom)
    );

    this._statusView.showMessage('Disconnecting from current connection...');

    try {
      await _disconnect();
      void vscode.window.showInformationMessage('MongoDB disconnected.');
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

    if (ext.keytarModule) {
      await ext.keytarModule.deletePassword(this._serviceName, connectionId);
      // We only remove the connection from the saved connections if we
      // have deleted the connection information with keytar.
      this._storageController.removeConnection(connectionId);
    }

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

  getSavedConnections(): SavedConnection[] {
    return Object.values(this._connections);
  }

  getActiveConnectionId(): string | null {
    return this._currentConnectionId;
  }

  getActiveConnectionDriverUrl(): string | null {
    if (!this._currentConnectionId) {
      return null;
    }

    return this._connections[this._currentConnectionId].connectionModel.driverUrl;
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

  getSavedConnectionName(connectionId: string): string {
    return this._connections[connectionId]
      ? this._connections[connectionId].name
      : '';
  }

  getActiveConnectionName(): string {
    if (!this._currentConnectionId) {
      return '';
    }

    return this._connections[this._currentConnectionId]
      ? this._connections[this._currentConnectionId].name
      : '';
  }

  isConnectionWithIdSaved(connectionId: string | null): boolean {
    if (connectionId === null) {
      return false;
    }

    return !!this._connections[connectionId];
  }

  getConnectingConnectionId(): string | null {
    return this._connectingConnectionId;
  }

  getConnectionStringFromConnectionId(connectionId: string): string {
    return this._connections[connectionId].connectionModel.driverUrlWithSsh;
  }

  isCurrentlyConnected(): boolean {
    return this._activeDataService !== null;
  }

  getActiveDataService(): null | DataServiceType {
    return this._activeDataService;
  }

  getActiveConnectionModel(): null | ConnectionModel {
    return this._activeConnectionModel;
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

  setActiveConnection(newActiveConnection: any): void {
    this._activeDataService = newActiveConnection;
  }

  setConnnecting(connecting: boolean): void {
    this._connecting = connecting;
  }

  setConnnectingConnectionId(connectingConnectionId: string): void {
    this._connectingConnectionId = connectingConnectionId;
  }

  setDisconnecting(disconnecting: boolean): void {
    this._disconnecting = disconnecting;
  }

  getСonnectionQuickPicks(): any[] {
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
        .sort((connectionA: { name: string }, connectionB: any) =>
          (connectionA.name || '').localeCompare(connectionB.name || '')
        )
        .map((item: any) => ({
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

    // Get the saved connection by id and return as the current connection.
    return this.connectWithConnectionId(
      selectedQuickPickItem.data.connectionId
    );
  }
}
