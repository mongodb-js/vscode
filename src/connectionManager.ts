const Connection = require('mongodb-connection-model');
const DataService = require('mongodb-data-service');
import * as vscode from 'vscode';

import { createLogger } from './logging';
import { StatusView } from './views';

const log = createLogger('commands');

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

export default class ConnectionManager {
  // This is a map of connection instance ids to their connection model.
  _connectionConfigs: {
    [key: string]: any
  } = {};

  _currentConnection: any;
  _currentConnectionInstanceId: string | null = null;

  _connecting: boolean = false;
  _disconnecting: boolean = false;

  _statusView: StatusView;

  constructor(_statusView: StatusView) {
    this._statusView = _statusView;
  }

  public addMongoDBConnection(): Promise<boolean> {
    console.log('mdb.connect');
    log.info('mdb.connect command called');

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

  // Exposed for testing.
  public connectToDatabase(connectionString: string): Promise<boolean> {
    console.log('Try to connect using connection string:', connectionString);

    if (this._connecting) {
      vscode.window.showWarningMessage('Please wait for the current connecting operation to complete before starting a new one.', {
        modal: true
      });
      return Promise.resolve(false);
    } else if (this._disconnecting) {
      vscode.window.showWarningMessage('Please wait for the current disconnecting operation to complete.', {
        modal: true
      });
      return Promise.resolve(false);
    }

    this._connecting = true;

    return new Promise<boolean>((resolve, reject) => {
      Connection.from(connectionString, async (error: any, newConnectionConfig: any) => {
        if (error) {
          this._connecting = false;
          return reject('Failed to connect: invalid connection string.');
        }

        const { instanceId } = newConnectionConfig.getAttributes({ derived: true });
        console.log('new connection config', newConnectionConfig.getAttributes({ derived: true }));
        console.log('more', newConnectionConfig.getAttributes({ props: true }));
        console.log('extra options?', newConnectionConfig.getAttributes({ extraOptions: true }));
        // newConnectionConfig.set()
        // mongodb://localhost?connectTimeoutMS=5000

        // Ensure we don't already have the supplied connection configuration.
        if (this._connectionConfigs[instanceId]) {
          this._connecting = false;
          return reject('Failed to connect: connection already exists.');
        }

        console.log('New connection config with instance id:', instanceId);

        if (this._currentConnection) {
          // TODO: Ensure this happens sync like we want it to.
          await this.disconnect();
        }

        this._statusView.showMessage('Connecting to MongoDB...');

        const newConnection = new DataService(newConnectionConfig);
        newConnection.connect((err: any) => {
          this._statusView.hideMessage();

          if (err) {
            this._connecting = false;
            return reject(`Failed to connect: ${err}`);
          }

          console.log('Connected to new connection:', instanceId);
          vscode.window.showInformationMessage('MongoDB connection successful.');

          this._connectionConfigs[instanceId] = (newConnectionConfig);
          this._currentConnectionInstanceId = instanceId;
          this._currentConnection = newConnection;
          this._connecting = false;

          // TODO: Push an event to notify listeners of the new data source.

          resolve(true);
        });
      });
    });
  }

  public async connectWithURI(): Promise<boolean> {
    console.log('mdb.connectWithURI');
    log.info('connectWithURI command called');

    let connectionString;
    try {
      connectionString = await vscode.window.showInputBox({
        value: '',
        placeHolder: 'MongoDB connection string',
        prompt: 'Enter your connection string (SRV or standard)',
        validateInput: text => {
          let connectionStringError = null;
          if (text && text.indexOf('mongodb://') === -1 && text.indexOf('mongodb+srv://') === -1) {
            connectionStringError = 'MongoDB connection strings begin with "mongodb://" or "mongodb+srv://"';
          }

          return connectionStringError;
        }
      });
    } catch (e) {
      return Promise.resolve(false);
    }

    if (!connectionString) {
      console.log('Not connecting, no connection string.');
      return Promise.resolve(false);
    }

    return this.connectToDatabase(connectionString);
  }

  public disconnect(): Promise<boolean> {
    // Disconnect from the active connection.
    return new Promise<boolean>(resolve => {
      if (this._disconnecting) {
        vscode.window.showWarningMessage('Please wait for the current disconnecting operation to complete.', {
          modal: true
        });
        return resolve(false);
      }

      if (!this._currentConnection) {
        return resolve(false);
      }

      console.log('Disconnecting from current connection...');

      this._disconnecting = true;
      this._statusView.showMessage('Disconnecting from current connection...');

      this._currentConnection.disconnect((err: any) => {
        if (err) {
          vscode.window.showErrorMessage('An error occured while disconnecting from the current connection.');
          console.log('An error occured while disconnecting.');
        } else {
          vscode.window.showInformationMessage('MongoDB connection removed.');
          console.log('Disconnected.');
        }

        this._currentConnection = null;
        this._currentConnectionInstanceId = null;

        this._disconnecting = false;
        this._statusView.hideMessage();

        if (err) {
          return resolve(false);
        }

        return resolve(true);
      });
    });
  }

  public async removeMongoDBConnection(): Promise<boolean> {
    console.log('mdb.removeMongoDBConnection');
    log.info('mdb.removeMongoDBConnection command called');

    // Ensure we aren't currently connecting or disconnecting.
    if (this._connecting) {
      vscode.window.showWarningMessage('Please wait for the current connecting operation to complete before starting a new one.', {
        modal: true
      });
      return Promise.resolve(false);
    }

    const connectionInstanceIds = Object.keys(this._connectionConfigs);

    if (connectionInstanceIds.length === 0) {
      // No active connection(s) to remove.
      vscode.window.showWarningMessage('There are currently no connections to remove.', {
        modal: true
      });

      return Promise.resolve(false);
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

  // Exposed for testing.
  public getConnections() {
    return this._connectionConfigs;
  }

  // Exposed for testing.
  public getActiveConnectionInstanceId() {
    return this._currentConnectionInstanceId;
  }

  // Exposed for testing
  public getActiveConnection() {
    return this._currentConnectionInstanceId;
  }
}



