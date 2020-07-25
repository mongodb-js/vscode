import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import Connection = require('mongodb-connection-model/lib/model');
import DataService = require('mongodb-data-service');

import { ConnectionModelType } from './connectionModelType';
import { DataServiceType } from './dataServiceType';
import { createLogger } from './logging';
import { StatusView } from './views';
import { EventEmitter } from 'events';
import { StorageController, StorageVariables } from './storage';
import { SavedConnection, StorageScope } from './storage/storageController';
import TelemetryController from './telemetry/telemetryController';
import { ext } from './extensionConstants';

const { name, version } = require('../package.json');
const log = createLogger('connection controller');
const MAX_CONNECTION_NAME_LENGTH = 512;

export enum DataServiceEventTypes {
  CONNECTIONS_DID_CHANGE = 'CONNECTIONS_DID_CHANGE',
  ACTIVE_CONNECTION_CHANGED = 'ACTIVE_CONNECTION_CHANGED',
  ACTIVE_CONNECTION_CHANGING = 'ACTIVE_CONNECTION_CHANGING'
}

export enum ConnectionTypes {
  CONNECTION_FORM = 'CONNECTION_FORM',
  CONNECTION_STRING = 'CONNECTION_STRING',
  CONNECTION_ID = 'CONNECTION_ID'
}

export type SavedConnectionInformation = {
  connectionModel: ConnectionModelType;
  driverUrl: string;
};

// A loaded connection contains connection information.
export type LoadedConnection = SavedConnection & SavedConnectionInformation;

export enum NewConnectionType {
  NEW_CONNECTION = 'NEW_CONNECTION',
  SAVED_CONNECTION = 'SAVED_CONNECTION'
}

export default class ConnectionController {
  // This is a map of connection ids to their configurations.
  // These connections can be saved on the session (runtime),
  // on the workspace, or globally in vscode.
  _connections: {
    [key: string]: LoadedConnection;
  } = {};

  private readonly _serviceName = 'mdb.vscode.savedConnections';
  _activeDataService: null | DataServiceType = null;
  _activeConnectionModel: null | ConnectionModelType = null;
  private _currentConnectionId: null | string = null;

  // When we are connecting to a server we save a connection version to
  // the request. That way if a new connection attempt is made while
  // the connection is being established, we know we can ignore the
  // request when it is completed so we don't have two live connections at once.
  private _connectingVersion = 0;

  private _connecting = false;
  private _connectingConnectionId: null | string = null;
  private _disconnecting = false;

  private _statusView: StatusView;
  private _storageController: StorageController;
  private _telemetryController: TelemetryController;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(
    _statusView: StatusView,
    storageController: StorageController,
    telemetryController: TelemetryController
  ) {
    this._statusView = _statusView;
    this._storageController = storageController;
    this._telemetryController = telemetryController;
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
        driverUrl: connectionInformation.driverUrl,
        name: savedConnection.name,
        connectionModel: connectionInformation.connectionModel,
        storageLocation: savedConnection.storageLocation
      };
    } catch (error) {
      // Here we're leniant when loading connections in case their
      // connections have become corrupted.
      return Promise.resolve();
    }

    this._connections[connectionId] = loadedSavedConnection;
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
    let connectionString: any;

    log.info('connectWithURI command called');

    try {
      connectionString = await vscode.window.showInputBox({
        value: '',
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
      return Promise.resolve(false);
    }

    if (!connectionString) {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.addNewConnectionStringAndConnect(connectionString).then(
        resolve,
        (err) => {
          vscode.window.showErrorMessage(err.message);
          resolve(false);
        }
      );
    });
  }

  // Resolves true when the connection is successfully added.
  // The connection can fail to connect but be successfully added.
  public addNewConnectionStringAndConnect = (
    connectionString: string
  ): Promise<boolean> => {
    log.info('Trying to connect to a new connection configuration');

    return new Promise<boolean>((resolve, reject) => {
      Connection.from(
        connectionString,
        (error: Error | undefined, newConnectionModel: ConnectionModelType) => {
          if (error) {
            return reject(new Error(`Unable to create connection: ${error}`));
          }

          return this.saveNewConnectionAndConnect(
            newConnectionModel,
            ConnectionTypes.CONNECTION_STRING
          ).then(resolve, reject);
        }
      );
    });
  };

  public sendTelemetry(
    newDataService: DataServiceType,
    connectionType: ConnectionTypes
  ): void {
    // Send metrics to Segment
    this._telemetryController.trackNewConnection(
      newDataService,
      connectionType
    );
  }

  public parseNewConnectionAndConnect = (
    newConnectionModel: ConnectionModelType
  ): Promise<boolean> => {
    // Here we re-parse the connection, as it can be loaded from storage or
    // passed by the connection model without the class methods.
    let connectionModel: ConnectionModelType;

    try {
      connectionModel = new Connection(newConnectionModel);
    } catch (error) {
      vscode.window.showErrorMessage(`Unable to load connection: ${error}`);
      return Promise.reject(new Error(`Unable to load connection: ${error}`));
    }

    return this.saveNewConnectionAndConnect(
      connectionModel,
      ConnectionTypes.CONNECTION_FORM
    );
  };

  public saveNewConnectionAndConnect = async (
    connectionModel: ConnectionModelType,
    connectionType: ConnectionTypes
  ): Promise<boolean> => {
    const {
      driverUrl,
      instanceId,
      sshTunnelOptions
    } = connectionModel.getAttributes({
      derived: true
    });
    const connectionId = uuidv4();
    const connectionInformation: SavedConnectionInformation = {
      connectionModel,
      driverUrl
    };
    const connectionName =
      sshTunnelOptions.host && sshTunnelOptions.port
        ? `${sshTunnelOptions.host}:${sshTunnelOptions.port}`
        : instanceId;
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

    return new Promise((resolve, reject) => {
      this.connect(connectionId, connectionModel, connectionType).then(
        (connectSuccess) => {
          if (!connectSuccess) {
            return resolve(false);
          }

          return resolve(true);
        },
        reject
      );
    });
  };

  public connect = async (
    connectionId: string,
    connectionModel: ConnectionModelType,
    connectionType: ConnectionTypes
  ): Promise<boolean> => {
    log.info(
      'Connect called to connect to instance:',
      connectionModel.getAttributes({
        derived: true
      }).instanceId
    );

    // TODO:
    // 1. Version the connect.
    // 2. Allow disconnecting while connecting.
    // 3. Allow adding / connecting to a new database when connecting.

    // Store a version of this connection, so we can see when the conection
    // is successful if it is still the most recent connection attempt.
    this._connectingVersion++;
    const connectingAttemptVersion = this._connectingVersion;

    this._connecting = true;
    this._connectingConnectionId = connectionId;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGING);

    if (this._activeDataService) {
      await this.disconnect();
    }

    this._statusView.showMessage('Connecting to MongoDB...');

    return new Promise<boolean>((resolve, reject) => {
      // Override the default connection `appname`.
      connectionModel.appname = `${name} ${version}`;

      const newDataService: DataServiceType = new DataService(connectionModel);

      newDataService.connect((err: Error | undefined) => {
        if (
          connectingAttemptVersion !== this._connectingVersion
          || !this._connections[connectionId]
        ) {
          // If the current attempt is no longer the most recent attempt
          // or the connection no longer exists we silently end the connection
          // and return.
          newDataService.disconnect(() => {});

          return resolve(false);
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

        return resolve(true);
      });
    });
  };

  public connectWithConnectionId = (connectionId: string): Promise<boolean> => {
    if (this._connections[connectionId]) {
      let connectionModel: ConnectionModelType;

      try {
        const savedConnectionModel = this._connections[connectionId]
          .connectionModel;

        // Here we rebuild the connection model to ensure it's up to date and
        // contains the connection model class methods (not just attributes).
        connectionModel = new Connection(
          savedConnectionModel.getAttributes
            ? savedConnectionModel.getAttributes({ props: true })
            : savedConnectionModel
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Unable to load connection: ${error}`);

        return Promise.resolve(false);
      }

      return new Promise((resolve) => {
        this.connect(
          connectionId,
          connectionModel,
          ConnectionTypes.CONNECTION_ID
        ).then(resolve, (err: Error) => {
          vscode.window.showErrorMessage(err.message);

          return resolve(false);
        });
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
      dataServiceToDisconnectFrom.disconnect((err: Error | undefined): void => {
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
    let inputtedConnectionName: any;

    try {
      inputtedConnectionName = await vscode.window.showInputBox({
        value: this._connections[connectionId].name,
        placeHolder: 'e.g. My Connection Name',
        prompt: 'Enter new connection name.',
        validateInput: (inputConnectionName: any) => {
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
      return Promise.reject(
        new Error(`An error occured parsing the connection name: ${e}`)
      );
    }

    if (!inputtedConnectionName) {
      return Promise.resolve(false);
    }

    this._connections[connectionId].name = inputtedConnectionName;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

    return new Promise((resolve, reject) => {
      if (
        this._connections[connectionId].storageLocation === StorageScope.GLOBAL
      ) {
        return this._storageController
          .saveConnectionToGlobalStore(this._connections[connectionId])
          .then(() => resolve(true), reject);
      }

      if (
        this._connections[connectionId].storageLocation ===
        StorageScope.WORKSPACE
      ) {
        return this._storageController
          .saveConnectionToWorkspaceStore(this._connections[connectionId])
          .then(() => resolve(true), reject);
      }

      // No storing needed.
      return resolve(true);
    });
  }

  public getSavedConnections(): SavedConnection[] {
    return Object.values(this._connections);
  }

  public getActiveConnectionId(): string | null {
    return this._currentConnectionId;
  }

  public getActiveConnectionDriverUrl(): string | null {
    if (!this._currentConnectionId) {
      return null;
    }

    return this._connections[this._currentConnectionId].driverUrl;
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
  public getConnectingConnectionName(): string | null {
    if (this._connectingConnectionId === null) {
      return null;
    }

    return this._connections[this._connectingConnectionId].name;
  }
  public getConnectingConnectionId(): string | null {
    return this._connectingConnectionId;
  }

  public getConnectionStringFromConnectionId(connectionId: string): string {
    return this._connections[connectionId].driverUrl;
  }

  public isCurrentlyConnected(): boolean {
    return this._activeDataService !== null;
  }

  public getActiveDataService(): null | DataServiceType {
    return this._activeDataService;
  }

  public getActiveConnectionModel(): null | ConnectionModelType {
    return this._activeConnectionModel;
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
        .sort((connectionA: any, connectionB: any) =>
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

  public changeActiveConnection(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const selectedQuickPickItem = await vscode.window.showQuickPick(
        this.getСonnectionQuickPicks(),
        {
          placeHolder: 'Select new connection...'
        }
      );

      if (!selectedQuickPickItem) {
        return resolve(true);
      }

      if (
        selectedQuickPickItem.data.type === NewConnectionType.NEW_CONNECTION
      ) {
        return this.connectWithURI();
      }

      // Get the saved connection by id and return as the current connection.
      return this.connectWithConnectionId(
        selectedQuickPickItem.data.connectionId
      );
    });
  }
}
