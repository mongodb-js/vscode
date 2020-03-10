import * as vscode from 'vscode';
import * as Connection from 'mongodb-connection-model/lib/model';
import * as DataService from 'mongodb-data-service';

const { name, version } = require('../package.json');

import { ConnectionConfigType } from './connectionConfig';
import { DataServiceType } from './dataServiceType';
import { createLogger } from './logging';
import { StatusView } from './views';
import { EventEmitter } from 'events';
import { StorageController, StorageVariables } from './storage';
import { StorageScope } from './storage/storageController';

const log = createLogger('connection controller');

function getConnectWebviewContent(): string {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connect to MongoDB</title>
    </head>
    <body>
      <img src="https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif" width="300" />
      <h1>MongoDB Connection Details Form</h1>
      <h2>Also try connecting with URI.</h2>
    </body>
  </html>`;
}

export enum DataServiceEventTypes {
  CONNECTIONS_DID_CHANGE = 'CONNECTIONS_DID_CHANGE'
}

export default class ConnectionController {
  // This is a map of connection instance ids to their connection model.
  private _connectionConfigs: {
    [key: string]: ConnectionConfigType;
  } = {};

  _currentConnection: DataServiceType | null = null;
  private _currentConnectionConfig: ConnectionConfigType | null = null;
  private _currentConnectionInstanceId: string | null = null;

  private _connecting = false;
  private _connectingInstanceId = '';
  private _disconnecting = false;

  private _statusView: StatusView;
  private _storageController: StorageController;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(_statusView: StatusView, storageController: StorageController) {
    this._statusView = _statusView;
    this._storageController = storageController;
  }

  loadSavedConnections(): void {
    // Load saved connections from storage.
    const existingGlobalConnectionStrings =
      this._storageController.get(StorageVariables.GLOBAL_CONNECTION_STRINGS) ||
      {};
    if (Object.keys(existingGlobalConnectionStrings).length > 0) {
      // Try to pull in the previous connections. We are open to failing here
      // in case the old connection has been corrupted or is no longer supported.

      Object.keys(existingGlobalConnectionStrings).forEach(connectionId => {
        Connection.from(
          existingGlobalConnectionStrings[connectionId],
          (
            err: Error | undefined,
            loadedGlobalConnectionConfig: ConnectionConfigType
          ) => {
            if (err) {
              // This may indicate a connection has been corrupted or is no longer supported.
              return;
            }

            // Override the default connection `appname`.
            loadedGlobalConnectionConfig.appname = `${name} ${version}`;

            this._connectionConfigs[
              connectionId
            ] = loadedGlobalConnectionConfig;
            this.eventEmitter.emit(
              DataServiceEventTypes.CONNECTIONS_DID_CHANGE
            );
          }
        );
      });
    }

    const existingWorkspaceConnectionStrings =
      this._storageController.get(
        StorageVariables.WORKSPACE_CONNECTION_STRINGS,
        StorageScope.WORKSPACE
      ) || {};
    if (Object.keys(existingWorkspaceConnectionStrings).length > 0) {
      // Try to pull in the previous connections. We are open to failing here
      // in case the old connection has been corrupted or is no longer supported.
      Object.keys(existingWorkspaceConnectionStrings).forEach(
        (connectionId) => {
          Connection.from(
            existingWorkspaceConnectionStrings[connectionId],
            (err, loadedWorkspaceConnectionConfig) => {
              if (err) {
                // This may indicate a connection has been corrupted or is no longer supported.
                return;
              }

              // Override the default connection `appname`.
              loadedWorkspaceConnectionConfig.appname = `${name} ${version}`;

              this._connectionConfigs[
                connectionId
              ] = loadedWorkspaceConnectionConfig;
              this.eventEmitter.emit(
                DataServiceEventTypes.CONNECTIONS_DID_CHANGE
              );
            }
          );
        }
      );
    }
  }

  public addMongoDBConnection(): Promise<boolean> {
    log.info('mdb.connect command called.');

    // Display a message box to the user.
    vscode.window.showInformationMessage('mdb.connect command run.');

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'Connect to MongoDB', // Title
      vscode.ViewColumn.One // Editor column to show the webview panel in.
    );

    panel.webview.html = getConnectWebviewContent();

    return Promise.resolve(true);
  }

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

    return this.addNewConnectionAndConnect(connectionString);
  }

  public addNewConnectionAndConnect(
    connectionString: string
  ): Promise<boolean> {
    log.info('Trying to connect to a new connection configuration');

    return new Promise<boolean>((resolve, reject) => {
      Connection.from(
        connectionString,
        (error: Error | undefined, newConnectionConfig: ConnectionConfigType) => {
          if (error) {
            vscode.window.showErrorMessage(`Unable to connect: ${error}`);
            return resolve(false);
          }

          const { driverUrl, instanceId } = newConnectionConfig.getAttributes({
            derived: true
          });

          // Ensure we don't already have the supplied connection configuration.
          if (this._connectionConfigs[instanceId]) {
            vscode.window.showErrorMessage(
              'Failed to connect: connection already exists.'
            );
            return resolve(false);
          }

          // Override the default connection `appname`.
          newConnectionConfig.appname = `${name} ${version}`;

          this.connect(newConnectionConfig).then((connectSuccess) => {
            if (!connectSuccess) {
              return resolve(false);
            }

            this._storageController
              .storeNewConnection(driverUrl, instanceId)
              .then(() => {
                return resolve(true);
              });
          }, reject);
        }
      );
    });
  }

  public async connect(connectionConfig: ConnectionConfigType): Promise<boolean> {
    log.info(
      'Connect called to connect to instance:',
      connectionConfig.getAttributes({
        derived: true
      }).instanceId
    );

    if (this._connecting) {
      vscode.window.showErrorMessage('Unable to connect: already connecting.');
      return Promise.resolve(false);
    } else if (this._disconnecting) {
      vscode.window.showErrorMessage(
        'Unable to connect: currently disconnecting.'
      );
      return Promise.resolve(false);
    }

    if (this._currentConnection) {
      await this.disconnect();
    }

    const { instanceId } = connectionConfig.getAttributes({ derived: true });

    this._connecting = true;
    this._connectingInstanceId = instanceId;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    this._statusView.showMessage('Connecting to MongoDB...');

    return new Promise<boolean>((resolve) => {
      const newConnection: DataServiceType = new DataService(connectionConfig);
      newConnection.connect((err: Error | undefined) => {
        this._statusView.hideMessage();

        if (err) {
          this._connecting = false;
          log.info('Failed to connect');
          this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
          vscode.window.showErrorMessage(`Failed to connect: ${err.message}`);
          return resolve(false);
        }

        log.info('Successfully connected');
        vscode.window.showInformationMessage('MongoDB connection successful.');

        if (!this._connectionConfigs[instanceId]) {
          // Add new configurations to our saved connection configurations.
          this._connectionConfigs[instanceId] = connectionConfig;
        }
        this._currentConnectionInstanceId = instanceId;
        this._currentConnectionConfig = connectionConfig;
        this._currentConnection = newConnection;

        this._connecting = false;
        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

        return resolve(true);
      });
    });
  }

  public async connectWithInstanceId(connectionId: string): Promise<boolean> {
    if (this._connectionConfigs[connectionId]) {
      return this.connect(this._connectionConfigs[connectionId]);
    }

    return Promise.reject(new Error('Connection not found.'));
  }

  public disconnect(): Promise<boolean> {
    log.info(
      'Disconnect called, currently connected to:',
      this._currentConnectionInstanceId
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
    return new Promise<boolean>(resolve => {
      if (!this._currentConnection) {
        vscode.window.showErrorMessage(
          'Unable to disconnect: no active connection.'
        );
        return resolve(false);
      }

      this._disconnecting = true;
      this._statusView.showMessage('Disconnecting from current connection...');
      this._currentConnection.disconnect((err: Error | undefined): void => {
        if (err) {
          // Show an error, however we still reset the active connection to free up the extension.
          vscode.window.showErrorMessage(
            'An error occured while disconnecting from the current connection.'
          );
        } else {
          vscode.window.showInformationMessage('MongoDB disconnected.');
        }

        this._currentConnection = null;
        this._currentConnectionInstanceId = null;

        this._disconnecting = false;
        this._statusView.hideMessage();

        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

        return resolve(true);
      });
    });
  }

  public removeConnectionConfig(connectionId: string): void {
    delete this._connectionConfigs[connectionId];
    this._storageController.removeConnection(connectionId);

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
  }

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

    if (!this._connectionConfigs[connectionId]) {
      // No active connection(s) to remove.
      vscode.window.showErrorMessage('Connection does not exist.');
      return Promise.resolve(false);
    }

    const removeConfirmationResponse = await vscode.window.showInformationMessage(
      `Are you sure to want to remove connection ${connectionId}?`,
      { modal: true },
      'Yes'
    );

    if (removeConfirmationResponse !== 'Yes') {
      return Promise.resolve(false);
    }

    if (
      this._currentConnection &&
      connectionId === this._currentConnectionInstanceId
    ) {
      await this.disconnect();
    }

    this.removeConnectionConfig(connectionId);

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

    const connectionInstanceIds = Object.keys(this._connectionConfigs);

    if (connectionInstanceIds.length === 0) {
      // No active connection(s) to remove.
      vscode.window.showErrorMessage('No connections to remove.');
      return Promise.resolve(false);
    }

    let connectionIdToRemove;
    if (connectionInstanceIds.length === 1) {
      connectionIdToRemove = connectionInstanceIds[0];
    } else {
      // There is more than 1 possible connection to remove.
      connectionIdToRemove = await vscode.window.showQuickPick(
        connectionInstanceIds,
        {
          placeHolder: 'Choose a connection to remove...'
        }
      );
    }

    if (!connectionIdToRemove) {
      return Promise.resolve(false);
    }

    return this.removeMongoDBConnection(connectionIdToRemove);
  }

  public getConnectionInstanceIds(): string[] {
    return Object.keys(this._connectionConfigs);
  }

  public getActiveConnectionInstanceId(): string | null {
    return this._currentConnectionInstanceId;
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

  public getConnectingInstanceId(): string {
    return this._connectingInstanceId;
  }

  public getConnectionStringFromConnectionId(connectionId: string): string {
    const { driverUrl } = this._connectionConfigs[connectionId].getAttributes({
      derived: true
    });

    return driverUrl;
  }

  // Exposed for testing.
  public getConnections(): any {
    return this._connectionConfigs;
  }
  public getActiveConnection(): any {
    return this._currentConnection;
  }
  public getActiveConnectionConfig(): any {
    return this._currentConnectionConfig;
  }
  public clearAllConnections(): void {
    this._connectionConfigs = {};
    this._currentConnectionConfig = null;
    this._currentConnectionInstanceId = null;
    this._currentConnection = null;
    this._connecting = false;
    this._disconnecting = false;
    this._connectingInstanceId = '';
  }
  public setActiveConnection(newActiveConnection: any): void {
    this._currentConnection = newActiveConnection;
  }
  public setConnnecting(connecting: boolean): void {
    this._connecting = connecting;
  }
  public setConnnectingInstanceId(connectingInstanceId: string): void {
    this._connectingInstanceId = connectingInstanceId;
  }
  public setDisconnecting(disconnecting: boolean): void {
    this._disconnecting = disconnecting;
  }
}
