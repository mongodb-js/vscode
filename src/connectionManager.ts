const Connection = require('mongodb-connection-model');
const DataService = require('mongodb-data-service');
import * as vscode from 'vscode';

import { createLogger } from './logging';

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

// let ourStatusBarItem: vscode.StatusBarItem;

export default class ConnectionManager {
  _connectionConfigs: Array<any> = [];

  _currentConnection: any;
  _currentConnectionInstanceId: string = '';

  _connecting: boolean = false;
  _disconnecting: boolean = false;

  constructor() {

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

  private connectToDatabase(connectionString: string): Promise<boolean> {
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
      Connection.from(connectionString, (error: any, newConnectionConfig: any) => {
        if (error) {
          vscode.window.showErrorMessage('Invalid connection string.');
          this._connecting = false;
          return reject('Failed to connect.');
        }

        const { instanceId } = newConnectionConfig.getAttributes({ derived: true });

        // Ensure we don't already have that connection configuration.
        for (let i = 0; i < this._connectionConfigs.length; i++) {
          const derivedProps = this._connectionConfigs[i].getAttributes({ derived: true });
          if (derivedProps.instanceId === instanceId) {
            vscode.window.showErrorMessage('Connection already exists.');
            this._connecting = false;
            return reject('Connection already exists.');
          }
        }

        console.log('New connection config with instance id:', instanceId);

        if (this._currentConnection) {
          // TODO: Disconnect from the active connection.
        }

        vscode.window.showInformationMessage('Connecting...');

        const newConnection = new DataService(newConnectionConfig);
        newConnection.connect((err: any) => {
          if (err) {
            this._connecting = false;
            console.log('Failed to connect:', err);
            return reject('Failed to connect.');
          }

          console.log('Connected!');
          vscode.window.showInformationMessage('Successfully connected.');

          this._connectionConfigs.push(newConnectionConfig);
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

  public async removeMongoDBConnection(): Promise<boolean> {
    console.log('mdb.removeMongoDBConnection');
    log.info('mdb.removeMongoDBConnection command called');

    // Ensure we aren't currently connecting or disconnecting.
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

    this._disconnecting = true;

    const connections = this._connectionConfigs.map(connectionConfig => connectionConfig.getAttributes({ derived: true }).instanceId);

    if (connections.length === 0) {
      // No active connection(s) to remove.
      vscode.window.showWarningMessage('There are currently no connections to remove.', {
        modal: true
      });

      this._disconnecting = false;
      return Promise.resolve(false);
    }

    let connectionToRemove;
    if (connections.length === 1) {
      connectionToRemove = connections[0];
    } else {
      try {
        // More than 1 possible connection to remove.
        connectionToRemove = await vscode.window.showQuickPick(connections, {
          placeHolder: 'Choose a connection to remove...'
        });
      } catch (err) {
        this._disconnecting = false;
        return Promise.resolve(false);
      }
    }

    if (!connectionToRemove) {
      this._disconnecting = false;
      return Promise.resolve(false);
    }

    try {
      const removeConfirmationResponse = await vscode.window.showInformationMessage(
        `Are you sure to want to remove connection ${connectionToRemove}?`,
        { modal: true },
        'Yes'
      );

      if (removeConfirmationResponse !== 'Yes') {
        this._disconnecting = false;
        return Promise.resolve(false);
      }
    } catch (err) {
      this._disconnecting = false;
      return Promise.resolve(false);
    }

    this._connectionConfigs.splice(connections.indexOf(this._currentConnectionInstanceId), 1);

    if (this._currentConnection && connectionToRemove === this._currentConnectionInstanceId) {
      // Disconnect from the active connection.
      // TODO: We should be lenient here - does it error if the connection
      // is already closed?
      return new Promise<boolean>((resolve, reject) => {
        this._currentConnection.disconnect((err: any) => {
          if (err) {
            vscode.window.showErrorMessage('Unable to remove connection.');
            this._disconnecting = false;
            return reject('Unable to remove connection.');
          }

          this._currentConnection = null;
          this._currentConnectionInstanceId = '';

          vscode.window.showInformationMessage('MongoDB connection removed.');
          this._disconnecting = false;
          resolve(true);
        });
      });
    } else {
      vscode.window.showInformationMessage('MongoDB connection removed.');
      this._disconnecting = false;
      return Promise.resolve(true);
    }
  }
}



