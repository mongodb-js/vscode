import * as vscode from 'vscode';
const path = require('path');

function getConnectWebviewContent(jsAppFileUrl: vscode.Uri): string {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Connect to MongoDB</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="${jsAppFileUrl}"></script>
    </body>
  </html>`;
}

export default class ConnectFormView {
  showConnectForm(
    context: vscode.ExtensionContext,
    connect: (connectionString: string) => Promise<boolean>
  ): Promise<boolean> {
    const extensionPath = context.extensionPath;

    // Create and show a new connect dialogue webview.
    const panel = vscode.window.createWebviewPanel(
      'connectDialogueWebview',
      'Connect to MongoDB', // Title
      vscode.ViewColumn.One, // Editor column to show the webview panel in.
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionPath, 'connect-form'))
        ]
      }
    );

    const jsAppFilePath = vscode.Uri.file(
      path.join(extensionPath, 'connect-form', 'connectForm.js')
    );
    const reactAppUri = jsAppFilePath.with({ scheme: 'vscode-resource' });

    panel.webview.html = getConnectWebviewContent(reactAppUri);

    // Handle messages from the webview.
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'connect':
            connect(message.driverUrl).then(connectionSuccess => {
              panel.webview.postMessage({
                command: 'connectResult',
                connectionSuccess
              });
            });
            return;
          default:
            // no-op.
            return;
        }
      },
      undefined,
      context.subscriptions
    );

    return Promise.resolve(true);
  }
}
