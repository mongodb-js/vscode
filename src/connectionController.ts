const Connection = require('mongodb-connection-model');
const DataService = require('mongodb-data-service');
import * as vscode from 'vscode';

import { createLogger } from './logging';
import { StatusView } from './views';
import { EventEmitter } from 'events';

const log = createLogger('connection controller');

function getConnectWebviewContent() {
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
    [key: string]: any
  } = {};

  private _currentConnection: any;
  private _currentConnectionInstanceId: string | null = null;

  private _connecting: boolean = false;
  private _connectingInstanceId: string = '';
  private _disconnecting: boolean = false;

  private _statusView: StatusView;

  // Used by other parts of the extension that respond to changes in the connections.
  private eventEmitter: EventEmitter = new EventEmitter();

  constructor(_statusView: StatusView) {
    this._statusView = _statusView;
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
        placeHolder: 'e.g. mongodb+srv://username:password@cluster0.mongodb.net/admin',
        prompt: 'Enter your connection string (SRV or standard)',
        validateInput: uri => {
          let connectionStringError = null;

          if (!Connection.isURI(uri)) {
            connectionStringError = 'MongoDB connection strings begin with "mongodb://" or "mongodb+srv://"';
          }

          return connectionStringError;
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

  public addNewConnectionAndConnect(connectionString: string): Promise<boolean> {
    log.info('Trying to connect to a new connection configuration');

    return new Promise<boolean>((resolve, reject) => {
      Connection.from(connectionString, (error: any, newConnectionConfig: any) => {
        if (error) {
          return reject('Failed to connect: invalid connection string.');
        }

        const { instanceId } = newConnectionConfig.getAttributes({ derived: true });

        // Ensure we don't already have the supplied connection configuration.
        if (this._connectionConfigs[instanceId]) {
          return reject('Failed to connect: connection already exists.');
        }

        this.connect(newConnectionConfig).then(resolve, reject);
      });
    });
  }

  public async connect(connectionConfig: any): Promise<boolean> {
    log.info('Connect called to connect to instance:', connectionConfig.getAttributes({
      derived: true
    }).instanceId);

    if (this._connecting) {
      return Promise.reject('Unable to connect: already connecting.');
    } else if (this._disconnecting) {
      return Promise.reject('Unable to connect: currently disconnecting.');
    }

    if (this._currentConnection) {
      await this.disconnect();
    }

    const { instanceId } = connectionConfig.getAttributes({ derived: true });

    this._connecting = true;
    this._connectingInstanceId = instanceId;

    this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

    this._statusView.showMessage('Connecting to MongoDB...');

    return new Promise<boolean>((resolve, reject) => {
      const newConnection = new DataService(connectionConfig);
      newConnection.connect((err: any) => {
        this._statusView.hideMessage();

        if (err) {
          this._connecting = false;
          log.info('Failed to connect');
          this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);
          return reject(`Failed to connect: ${err}`);
        }

        log.info('Successfully connected');
        vscode.window.showInformationMessage('MongoDB connection successful.');

        if (!this._connectionConfigs[instanceId]) {
          // Add new configurations to our saved connection configurations.
          this._connectionConfigs[instanceId] = (connectionConfig);
        }
        this._currentConnectionInstanceId = instanceId;
        this._currentConnection = newConnection;
        this._connecting = false;

        this.eventEmitter.emit(DataServiceEventTypes.CONNECTIONS_DID_CHANGE);

        resolve(true);
      });
    });
  }

  public async connectWithInstanceId(connectionId: string): Promise<boolean> {
    if (this._connectionConfigs[connectionId]) {
      return this.connect(this._connectionConfigs[connectionId]);
    } else {
      return Promise.reject('Connection not found.');
    }
  }

  public disconnect(): Promise<boolean> {
    log.info('Disconnect called, currently connected to', this._currentConnectionInstanceId);

    if (this._disconnecting) {
      // TODO: The desired UX here may be for the connection to be interrupted.
      return Promise.reject('Unable to disconnect: already disconnecting from an instance.');
    }

    if (!this._currentConnection) {
      return Promise.resolve(false);
    }

    // Disconnect from the active connection.
    return new Promise<boolean>((resolve, reject) => {
      this._disconnecting = true;
      this._statusView.showMessage('Disconnecting from current connection...');

      this._currentConnection.disconnect((err: any) => {
        if (err) {
          // Show an error, however we still reset the active connection to free up the extension.
          vscode.window.showErrorMessage('An error occured while disconnecting from the current connection.');
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

  public async removeMongoDBConnection(): Promise<boolean> {
    log.info('mdb.removeMongoDBConnection command called');

    // Ensure we aren't currently connecting or disconnecting.
    if (this._connecting) {
      return Promise.reject('Unable to remove connection: currently connecting.');
    }

    const connectionInstanceIds = Object.keys(this._connectionConfigs);

    if (connectionInstanceIds.length === 0) {
      // No active connection(s) to remove.
      return Promise.reject('No connections to remove.');
    }

    let connectionToRemove;
    if (connectionInstanceIds.length === 1) {
      connectionToRemove = connectionInstanceIds[0];
    } else {
      // There is more than 1 possible connection to remove.
      connectionToRemove = await vscode.window.showQuickPick(connectionInstanceIds, {
        placeHolder: 'Choose a connection to remove...'
      });
    }

    if (!connectionToRemove) {
      return Promise.resolve(false);
    }

    const removeConfirmationResponse = await vscode.window.showInformationMessage(
      `Are you sure to want to remove connection ${connectionToRemove}?`,
      { modal: true },
      'Yes'
    );

    if (removeConfirmationResponse !== 'Yes') {
      return Promise.resolve(false);
    }

    if (this._currentConnection && connectionToRemove === this._currentConnectionInstanceId) {
      await this.disconnect();
    }

    delete this._connectionConfigs[connectionToRemove];
    vscode.window.showInformationMessage('MongoDB connection removed.');
    return Promise.resolve(true);
  }

  public getConnectionInstanceIds(): string[] {
    return Object.keys(this._connectionConfigs);
  }

  public getActiveConnectionInstanceId() {
    return this._currentConnectionInstanceId;
  }

  public addEventListener(eventType: DataServiceEventTypes, listener: () => void) {
    this.eventEmitter.addListener(eventType, listener);
  }

  public removeEventListener(eventType: DataServiceEventTypes, listener: () => void) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  public isConnnecting() {
    return this._connecting;
  }

  public isDisconnecting() {
    return this._disconnecting;
  }

  public getConnectingInstanceId() {
    return this._connectingInstanceId;
  }

  // Exposed for testing.
  public getConnections() {
    return this._connectionConfigs;
  }
  public getActiveConnection() {
    return this._currentConnection;
  }
  public setActiveConnection(newActiveConnection: any) {
    this._currentConnection = newActiveConnection;
  }
  public setConnnecting(connecting: boolean) {
    this._connecting = connecting;
  }
  public setConnnectingInstanceId(connectingInstanceId: string) {
    this._connectingInstanceId = connectingInstanceId;
  }
  public setDisconnecting(disconnecting: boolean) {
    this._disconnecting = disconnecting;
  }
}
