import { v4 as uuidv4 } from 'uuid';
import * as vscode from 'vscode';
import Connection = require('mongodb-connection-model/lib/model');
import DataService = require('mongodb-data-service');
import * as keytarType from 'keytar';

const { name, version } = require('../package.json');

import { ConnectionModelType } from './connectionModelType';
import { DataServiceType } from './dataServiceType';
import { createLogger } from './logging';
import { StatusView } from './views';
import { EventEmitter } from 'events';
import { StorageController, StorageVariables } from './storage';
import { SavedConnection, StorageScope } from './storage/storageController';
import { getNodeModule } from './utils/getNodeModule';

const log = createLogger('connection controller');
const MAX_CONNECTION_NAME_LENGTH = 512;

type KeyTar = typeof keytarType;

export enum DataServiceEventTypes {
  CONNECTIONS_DID_CHANGE = 'CONNECTIONS_DID_CHANGE',
  ACTIVE_CONNECTION_CHANGED = 'ACTIVE_CONNECTION_CHANGED',
  ACTIVE_CONNECTION_CHANGING = 'ACTIVE_CONNECTION_CHANGING',
}

export type SavedConnectionInformation = {
  connectionModel: ConnectionModelType;
  driverUrl: string;
};

// A loaded connection contains connection information.
export type LoadedConnection = SavedConnection & SavedConnectionInformation;

export default class ConnectionController {
  // This is a map of connection ids to their configurations.
  // These connections can be saved on the session (runtime),
  // on the workspace, or globally in vscode.
  _connections: {
    [key: string]: LoadedConnection;
  } = {};

  private readonly _serviceName = 'mdb.vscode.savedConnections';
  private _keytar: KeyTar | undefined;

  _activeDataService: null | DataServiceType = null;
  _activeConnectionModel: null | ConnectionModelType = null;
  private _currentConnectionId: null | string = null;

  private _connecting = false;
  private _connectingConnectionId: null | string = null;
  private _disconnecting = false;

  private _statusView: StatusView;
  private _storageController: StorageController;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(_statusView: StatusView, storageController: StorageController) {
    this._statusView = _statusView;
    this._storageController = storageController;

    this._keytar = getNodeModule<typeof keytarType>('keytar');
  }

  _loadSavedConnection = async (
    connectionId: string,
    savedConnection: SavedConnection
  ): Promise<void> => {
    if (!this._keytar) {
      return;
    }

    let loadedSavedConnection: LoadedConnection;
    try {
      const unparsedConnectionInformation = await this._keytar.getPassword(
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
    if (!this._keytar) {
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
    log.info('connectWithURI command called');

    let connectionString;
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

          return this.saveNewConnectionAndConnect(newConnectionModel).then(
            resolve,
            reject
          );
        }
      );
    });
  };

  public parseNewConnectionAndConnect = (
    newConnectionModel
  ): Promise<boolean> => {
    // Here we re-parse the connection, as it can be loaded from storage or
    // passed by the connection model without the class methods.
    let connectionModel;

    try {
      connectionModel = new Connection(newConnectionModel);
    } catch (error) {
      vscode.window.showErrorMessage(`Unable to load connection: ${error}`);
      return Promise.reject(new Error(`Unable to load connection: ${error}`));
    }

    return this.saveNewConnectionAndConnect(connectionModel);
  };

  public saveNewConnectionAndConnect = async (
    connectionModel: ConnectionModelType
  ): Promise<boolean> => {
    const { driverUrl, instanceId } = connectionModel.getAttributes({
      derived: true
    });

    const connectionId = uuidv4();
    const connectionInformation: SavedConnectionInformation = {
      connectionModel,
      driverUrl
    };
    const savedConnection: SavedConnection = {
      id: connectionId,
      name: instanceId,
      // To begin we just store it on the session, the storage controller
      // handles changing this based on user preference.
      storageLocation: StorageScope.NONE
    };
    const newLoadedConnection = {
      ...savedConnection,
      ...connectionInformation
    };
    this._connections[connectionId] = newLoadedConnection;

    if (this._keytar) {
      const connectionInfoAsString = JSON.stringify(connectionInformation);

      await this._keytar.setPassword(
        this._serviceName,
        connectionId,
        connectionInfoAsString
      );
      this._storageController.storeNewConnection(newLoadedConnection);
    }

    return new Promise((resolve, reject) => {
      this.connect(connectionId, connectionModel).then((connectSuccess) => {
        if (!connectSuccess) {
          return resolve(false);
        }

        resolve(true);
      }, reject);
    });
  };

  public connect = async (
    connectionId: string,
    connectionModel: ConnectionModelType
  ): Promise<boolean> => {
    log.info(
      'Connect called to connect to instance:',
      connectionModel.getAttributes({
        derived: true
      }).instanceId
    );

    if (this._connecting) {
      return Promise.reject(
        new Error('Unable to connect: already connecting.')
      );
    } else if (this._disconnecting) {
      return Promise.reject(
        new Error('Unable to connect: currently disconnecting.')
      );
    }

    if (this._activeDataService) {
      await this.disconnect();
    }

    this._connecting = true;
    this._connectingConnectionId = connectionId;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
    this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGING);

    this._statusView.showMessage('Connecting to MongoDB...');

    return new Promise<boolean>((resolve, reject) => {
      // Override the default connection `appname`.
      connectionModel.appname = `${name} ${version}`;

      const newDataService: DataServiceType = new DataService(connectionModel);
      newDataService.connect((err: Error | undefined) => {
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

        return resolve(true);
      });
    });
  };

  public connectWithConnectionId = (connectionId: string): Promise<boolean> => {
    if (this._connections[connectionId]) {
      let connectionModel;

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
        this.connect(connectionId, connectionModel).then(
          resolve,
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

    if (this._disconnecting) {
      vscode.window.showErrorMessage(
        'Unable to disconnect: already disconnecting from an instance.'
      );
      return Promise.resolve(false);
    }

    if (this._connecting) {
      // TODO: The desired UX here may be for the connection to be interrupted.
      vscode.window.showErrorMessage(
        'Unable to disconnect: currently connecting to an instance.'
      );
      return Promise.resolve(false);
    }

    // Disconnect from the active connection.
    return new Promise<boolean>((resolve) => {
      if (!this._activeDataService) {
        vscode.window.showErrorMessage(
          'Unable to disconnect: no active connection.'
        );
        return resolve(false);
      }

      this._disconnecting = true;
      this._statusView.showMessage('Disconnecting from current connection...');
      this._activeDataService.disconnect((err: Error | undefined): void => {
        if (err) {
          // Show an error, however we still reset the active connection to free up the extension.
          vscode.window.showErrorMessage(
            'An error occured while disconnecting from the current connection.'
          );
        } else {
          vscode.window.showInformationMessage('MongoDB disconnected.');
        }

        this._activeDataService = null;
        this._currentConnectionId = null;
        this._activeConnectionModel = null;

        this._disconnecting = false;
        this._statusView.hideMessage();

        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
        this.eventEmitter.emit(DataServiceEventTypes.ACTIVE_CONNECTION_CHANGED);

        return resolve(true);
      });
    });
  }

  public removeSavedConnection = async (
    connectionId: string
  ): Promise<void> => {
    delete this._connections[connectionId];
    if (this._keytar) {
      await this._keytar.deletePassword(this._serviceName, connectionId);
      // We only remove the connection from the saved connections if we
      // have deleted the connection information with keytar.
      this._storageController.removeConnection(connectionId);
    }

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    return Promise.resolve();
  };

  // Prompts the user to remove the connection then removes it on affirmation.
  public async removeMongoDBConnection(connectionId: string): Promise<boolean> {
    // Ensure we aren't currently connecting.
    if (this._connecting) {
      vscode.window.showErrorMessage(
        'Unable to remove connection: currently connecting.'
      );
      return Promise.resolve(false);
    }
    // Ensure we aren't currently disconnecting.
    if (this._disconnecting) {
      vscode.window.showErrorMessage(
        'Unable to remove connection: currently disconnecting.'
      );
      return Promise.resolve(false);
    }

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

    await this.removeSavedConnection(connectionId);

    vscode.window.showInformationMessage('MongoDB connection removed.');
    return Promise.resolve(true);
  }

  public async onRemoveMongoDBConnection(): Promise<boolean> {
    log.info('mdb.removeConnection command called');

    // Ensure we aren't currently connecting.
    if (this._connecting) {
      vscode.window.showErrorMessage(
        'Unable to remove connection: currently connecting.'
      );
      return Promise.resolve(false);
    }
    // Ensure we aren't currently disconnecting.
    if (this._disconnecting) {
      vscode.window.showErrorMessage(
        'Unable to remove connection: currently disconnecting.'
      );
      return Promise.resolve(false);
    }

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
    let inputtedConnectionName;
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
      } else if (
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
}
