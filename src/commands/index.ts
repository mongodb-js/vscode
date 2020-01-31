import * as vscode from 'vscode';

import { createLogger } from '../logging';
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

const addMongoDBConnection = (...args: any[]) => {
  console.log('mdb.connect', args);
  log.info('mdb.connect command called');

  // Display a message box to the user.
  vscode.window.showInformationMessage('mdb.connect command run.');

  // TODO: Open connect dialogue web view.
  // Create and show a new webview
  const panel = vscode.window.createWebviewPanel(
    'connectDialogueWebview',
    'Connect to MongoDB', // Title
    vscode.ViewColumn.One // Editor column to show the webview panel in.
  );

  panel.webview.html = getConnectWebviewContent();
};

const connectWithURI = async (...args: any[]) => {
  console.log('mdb.connectWithURI', args);
  log.info('connectWithURI command called');

  const connectionString = await vscode.window.showInputBox({
    value: '',
    // valueSelection: [2, 4],
    placeHolder: 'MongoDB connection string',
    prompt: 'Enter your connection string (SRV or standard)',
    validateInput: text => {
      // TODO: Validate the connection string.
      // Parse URI - https://github.com/mongodb-js/connection-model or mongosh service model.

      const mockInvalidConnectionString = text.length > 0;
      return mockInvalidConnectionString ? 'Invalid connection string' : null;
    }
  });

  if (!connectionString) {
    return;
  }

  // TODO: If the user inputted a valid connection then connect to that uri.
  // This can be done asynchronously, with a `Status Bar Item` message showing
  // the state of the connection.

  let mockConnectionError = true;
  if (mockConnectionError) {
    vscode.window.showErrorMessage(
      'Failed to connect'
    );

    return;
  }

  vscode.window.showInformationMessage('Successfully created new database connection.');
};

const removeMongoDBConnection = async () => {
  console.log('mdb.removeMongoDBConnection');
  log.info('mdb.removeMongoDBConnection command called');

  const mockConnections = [
    'example connection 1',
    'example connection 2',
    'example connection 3'
  ];

  if (mockConnections.length === 0) {
    // No active connection(s) to remove.
    vscode.window.showWarningMessage('There are currently no active connections to remove.', {
      modal: true
    });

    return;
  }

  let connectionToRemove;
  if (mockConnections.length === 1) {
    connectionToRemove = mockConnections[0];
  } else {
    // More than 1 possible connection to remove.
    connectionToRemove = await vscode.window.showQuickPick(mockConnections, {
      placeHolder: 'Choose a connection to remove...'
    });
  }

  if (connectionToRemove) {
    const removeConfirmationResponse = await vscode.window.showInformationMessage(
      `Are you sure to want to remove connection ${connectionToRemove}?`,
      { modal: true },
      'Yes'
    );

    if (removeConfirmationResponse === 'Yes') {
      // TODO: Disconnect from the chosen connection.
      vscode.window.showInformationMessage('MongoDB connection removed.');
    }
  }
};

function launchMongoShell() {
  const mongoShell = vscode.window.createTerminal('Mongo Shell');
  mongoShell.sendText('mongo');
  mongoShell.show();
}

const registerCommands = (context: vscode.ExtensionContext) => {
  console.group('registerCommands');

  vscode.commands.registerCommand('mdb.connect', addMongoDBConnection);
  vscode.commands.registerCommand('mdb.addConnection', addMongoDBConnection);

  vscode.commands.registerCommand('mdb.connectWithURI', connectWithURI);
  vscode.commands.registerCommand('mdb.addConnectionWithURI', connectWithURI);

  vscode.commands.registerCommand('mdb.removeConnection', removeMongoDBConnection);

  vscode.commands.registerCommand('mdb.launchShell', launchMongoShell);

  console.groupEnd();
};

export { launchMongoShell, registerCommands };
