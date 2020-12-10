import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { MongoClient } from 'mongodb';

import { createLogger } from './logging';
import { ext } from './extensionConstants';
import { SavedConnection, StorageScope } from './storage/storageController';
import { StatusView } from './views';
import { StorageController, StorageVariables } from './storage';
import TelemetryService from './telemetry/telemetryService';
import { CONNECTION_STATUS } from './views/webview-app/extension-app-message-constants';
import ConnectionModel, {
  getConnectionNameFromConnectionModel,
  getDriverOptionsFromConnectionModel,
  buildConnectionModelFromConnectionString,
  buildConnectionStringFromConnectionModel,
  parseConnectionModel
} from './views/webview-app/connection-model/connection-model';

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
  _connections: {
    [key: string]: LoadedConnection;
  } = {};

  private readonly _serviceName = 'mdb.vscode.savedConnections';
  _activeDataService: null | MongoClient = null;
  _activeConnectionModel: null | ConnectionModel = null;
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

  _loadSavedConnection = async (
    connectionId: string,
    savedConnection: SavedConnection
  ): Promise<void> => {
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
        return Promise.resolve();
      }

      const connectionInformation: SavedConnectionInformation = JSON.parse(
        unparsedConnectionInformation
      );

      if (!connectionInformation.connectionModel) {
        // Ignore empty connections.
        return Promise.resolve();
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
      return Promise.resolve();
    }

    this._connections[connectionId] = {
      ...loadedSavedConnection,
      connectionModel: parseConnectionModel(loadedSavedConnection.connectionModel)
    };
    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    Promise.resolve();
  };

  loadSavedConnections = async (): Promise<void> => {
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
      ) || {};

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
  };

  public async connectWithURI(): Promise<boolean> {
    let connectionString: string | undefined;

    log.info('connectWithURI command called');

    try {
      connectionString = await vscode.window.showInputBox({
        value: '',
        ignoreFocusOut: true,
        placeHolder:
          'e.g. mongodb+srv://username:password@cluster0.mongodb.net/admin',
        prompt: 'Enter your connection string (SRV or standard)',
        validateInput: (uri?: string) => {
          if (
            uri &&
            !uri.startsWith('mongodb://') &&
            !uri.startsWith('mongodb+srv://')
          ) {
            return 'MongoDB connection strings begin with "mongodb://" or "mongodb+srv://"';
          }

          return null;
        }
      });
    } catch (e) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      if (!connectionString) {
        return resolve(false);
      }

      this.addNewConnectionStringAndConnect(connectionString).then(
        resolve,
        (err) => {
          vscode.window.showErrorMessage(err.message);
          resolve(false);
        }
      );
    });
  }

  // Resolves the new connection id when the connection is successfully added.
  // Resolves false when it is added and not connected.
  // The connection can fail to connect but be successfully added.
  public addNewConnectionStringAndConnect = (
    connectionString: string
  ): Promise<boolean> => {
    log.info('Trying to connect to a new connection configuration');

    let model: ConnectionModel;
    try {
      model = buildConnectionModelFromConnectionString(connectionString);
    } catch (error: any) {
      return Promise.reject(new Error(`Unable to create connection: ${error}`));
    }

    return new Promise((resolve, reject) => {
      this.saveNewConnectionAndConnect(
        model,
        ConnectionTypes.CONNECTION_STRING
      ).then(
        (connectResult) => resolve(connectResult.successfullyConnected),
        reject
      );
    });
  };

  public sendTelemetry(
    newDataService: MongoClient,
    connectionType: ConnectionTypes
  ): void {
    this._telemetryService.trackNewConnection(
      newDataService,
      connectionType
    );
  }

  public parseNewConnection = (
    newConnectionModel: ConnectionModel
  ): ConnectionModel => {
    // Here we re-parse the connection, as it can be loaded from storage or
    // passed by the connection model without the class methods.
    const connectionModel = parseConnectionModel(
      newConnectionModel
    );

    return connectionModel;
  };

  public saveNewConnectionAndConnect = async (
    connectionModel: ConnectionModel,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> => {
    const connectionName = getConnectionNameFromConnectionModel(connectionModel);

    const connectionId = uuidv4();
    const connectionInformation: SavedConnectionInformation = {
      connectionModel
    };
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
      this._storageController.storeNewConnection(newLoadedConnection);
    }

    return this.connect(connectionId, connectionModel, connectionType);
  };

  public connect = async (
    connectionId: string,
    connectionModel: ConnectionModel,
    connectionType: ConnectionTypes
  ): Promise<ConnectionAttemptResult> => {
    log.info(
      'Connect called to connect to instance:',
      getConnectionNameFromConnectionModel(connectionModel)
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

    return new Promise<ConnectionAttemptResult>((resolve, reject) => {
      const newDataService = new MongoClient(
        buildConnectionStringFromConnectionModel(connectionModel),
        getDriverOptionsFromConnectionModel(connectionModel)
      );

      newDataService.connect((err: Error | undefined) => {
        if (
          connectingAttemptVersion !== this._connectingVersion ||
          !this._connections[connectionId]
        ) {
          // If the current attempt is no longer the most recent attempt
          // or the connection no longer exists we silently end the connection
          // and return.
          try {
            newDataService.close(() => {});
          } catch (e) {
            /* */
          }

          return resolve({
            successfullyConnected: false,
            connectionErrorMessage: 'connection attempt overriden'
          });
        }

        this._statusView.hideMessage();

        if (err) {
          this._connecting = false;
          log.info('Failed to connect');
          this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

          return reject(new Error(`Failed to connect: ${err.message}`));
        }

        log.info('Successfully connected');
        vscode.window.showInformationMessage('MongoDB connection successful.');

        this._activeDataService = newDataService;
        this._activeConnectionModel = connectionModel;
        this._currentConnectionId = connectionId;
        this._connecting = false;
        this._connectingConnectionId = null;
        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
        this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

        // Send metrics to Segment
        this.sendTelemetry(newDataService, connectionType);

        return resolve({
          successfullyConnected: true,
          connectionErrorMessage: ''
        });
      });
    });
  };

  public connectWithConnectionId = (connectionId: string): Promise<boolean> => {
    if (this._connections[connectionId]) {
      let connectionModel: ConnectionModel;

      try {
        const savedConnectionModel = this._connections[connectionId]
          .connectionModel;

        connectionModel = parseConnectionModel(savedConnectionModel);
      } catch (error) {
        vscode.window.showErrorMessage(`Unable to load connection: ${error}`);

        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        this.connect(
          connectionId,
          connectionModel,
          ConnectionTypes.CONNECTION_ID
        ).then(
          (connectResult) => resolve(connectResult.successfullyConnected),
          (err: Error) => {
            vscode.window.showErrorMessage(err.message);

            return resolve(false);
          }
        );
      });
    }

    return Promise.reject(new Error('Connection not found.'));
  };

  public disconnect(): Promise<boolean> {
    log.info(
      'Disconnect called, currently connected to:',
      this._currentConnectionId
    );

    if (!this._activeDataService) {
      vscode.window.showErrorMessage(
        'Unable to disconnect: no active connection.'
      );

      return Promise.resolve(false);
    }

    const dataServiceToDisconnectFrom = this._activeDataService;

    this._activeDataService = null;
    this._currentConnectionId = null;
    this._activeConnectionModel = null;
    this._disconnecting = true;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    // Disconnect from the active connection.
    return new Promise<boolean>((resolve) => {
      this._statusView.showMessage('Disconnecting from current connection...');
      dataServiceToDisconnectFrom.close((err: Error | undefined): void => {
        if (err) {
          // Show an error, however we still reset the active connection to free up the extension.
          vscode.window.showErrorMessage(
            'An error occured while disconnecting from the current connection.'
          );
        } else {
          vscode.window.showInformationMessage('MongoDB disconnected.');
        }
        this._disconnecting = false;
        this._statusView.hideMessage();

        return resolve(true);
      });
    });
  }

  public removeSavedConnection = async (
    connectionId: string
  ): Promise<void> => {
    delete this._connections[connectionId];

    if (ext.keytarModule) {
      await ext.keytarModule.deletePassword(this._serviceName, connectionId);
      // We only remove the connection from the saved connections if we
      // have deleted the connection information with keytar.
      this._storageController.removeConnection(connectionId);
    }

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    return Promise.resolve();
  };

  // Prompts the user to remove the connection then removes it on affirmation.
  public async removeMongoDBConnection(connectionId: string): Promise<boolean> {
    if (!this._connections[connectionId]) {
      // No active connection(s) to remove.
      vscode.window.showErrorMessage('Connection does not exist.');

      return Promise.resolve(false);
    }

    const removeConfirmationResponse = await vscode.window.showInformationMessage(
      `Are you sure to want to remove connection ${this._connections[connectionId].name}?`,
      { modal: true },
      'Yes'
    );

    if (removeConfirmationResponse !== 'Yes') {
      return Promise.resolve(false);
    }

    if (this._activeDataService && connectionId === this._currentConnectionId) {
      await this.disconnect();
    }

    if (!this._connections[connectionId]) {
      // If the connection was removed while we were disconnecting we resolve.
      return Promise.resolve(false);
    }

    await this.removeSavedConnection(connectionId);

    vscode.window.showInformationMessage('MongoDB connection removed.');

    return Promise.resolve(true);
  }

  public async onRemoveMongoDBConnection(): Promise<boolean> {
    log.info('mdb.removeConnection command called');

    const connectionIds = Object.keys(this._connections);

    if (connectionIds.length === 0) {
      // No active connection(s) to remove.
      vscode.window.showErrorMessage('No connections to remove.');

      return Promise.resolve(false);
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
      return Promise.resolve(false);
    }

    // We attach the index of the connection so that we can infer their pick.
    const connectionIndexToRemove =
      Number(connectionNameToRemove.split(':', 1)[0]) - 1;
    const connectionIdToRemove = connectionIds[connectionIndexToRemove];

    return this.removeMongoDBConnection(connectionIdToRemove);
  }

  public async renameConnection(connectionId: string): Promise<boolean> {
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
      return Promise.resolve(false);
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

  public getSavedConnections(): SavedConnection[] {
    return Object.values(this._connections);
  }

  public getActiveConnectionId(): string | null {
    return this._currentConnectionId;
  }

  public addEventListener(
    eventType: DataServiceEventTypes,
    listener: () => void
  ): void {
    this.eventEmitter.addListener(eventType, listener);
  }

  public removeEventListener(
    eventType: DataServiceEventTypes,
    listener: () => void
  ): void {
    this.eventEmitter.removeListener(eventType, listener);
  }

  public isConnecting(): boolean {
    return this._connecting;
  }

  public isDisconnecting(): boolean {
    return this._disconnecting;
  }

  public getSavedConnectionName(connectionId: string): string {
    return this._connections[connectionId]
      ? this._connections[connectionId].name
      : '';
  }

  public getActiveConnectionName(): string {
    if (!this._currentConnectionId) {
      return '';
    }

    return this._connections[this._currentConnectionId]
      ? this._connections[this._currentConnectionId].name
      : '';
  }

  public isConnectionWithIdSaved(connectionId: string | null): boolean {
    if (connectionId === null) {
      return false;
    }

    return !!this._connections[connectionId];
  }
  public getConnectingConnectionId(): string | null {
    return this._connectingConnectionId;
  }

  public getConnectionStringFromConnectionId(connectionId: string): string {
    // TODO: With or without ssh?
    const connectionString = buildConnectionStringFromConnectionModel(
      this._connections[connectionId].connectionModel
    );

    return connectionString;
  }

  public isCurrentlyConnected(): boolean {
    return this._activeDataService !== null;
  }

  public getActiveDataService(): null | MongoClient {
    return this._activeDataService;
  }

  public getActiveConnectionModel(): null | ConnectionModel {
    return this._activeConnectionModel;
  }

  public getConnectionStatus(): CONNECTION_STATUS {
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

  public getConnectionStatusStringForConnection(connectionId: string): string {
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
  public clearAllConnections(): void {
    this._connections = {};
    this._activeDataService = null;
    this._activeConnectionModel = null;
    this._currentConnectionId = null;
    this._connecting = false;
    this._disconnecting = false;
    this._connectingConnectionId = '';
    this._connectingVersion = null;
  }

  public getConnectingVersion(): string | null {
    return this._connectingVersion;
  }

  public setActiveConnection(newActiveConnection: any): void {
    this._activeDataService = newActiveConnection;
  }

  public setConnnecting(connecting: boolean): void {
    this._connecting = connecting;
  }

  public setConnnectingConnectionId(connectingConnectionId: string): void {
    this._connectingConnectionId = connectingConnectionId;
  }

  public setDisconnecting(disconnecting: boolean): void {
    this._disconnecting = disconnecting;
  }

  public getСonnectionQuickPicks(): any[] {
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
