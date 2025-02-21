import * as vscode from 'vscode';

/**
 * Provider for mongo json editors.
 *
 * Mongo JSON editors are used for `.mongodb.json` files, which are just json files.
 * To get started, run this extension and open an empty `.mongodb.json` file in VS Code.
 *
 * This provider demonstrates:
 *
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
export class MongoJSONEditorProvider
  implements vscode.CustomTextEditorProvider
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MongoJSONEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      MongoJSONEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  private static readonly viewType = 'catCustoms.mongoJSON';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Called when our custom editor is opened.
   *
   *
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    function updateWebview() {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText(),
      });
    }

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    //
    // Remember that a single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // Receive message from the webview.
    webviewPanel.webview.onDidReceiveMessage((e) => {
      switch (e.type) {
        case 'add':
          // this.addNewScratch(document);
          return;

        case 'delete':
          // this.deleteScratch(document, e.id);
          return;
      }
    });

    updateWebview();
  }

  private formatSubset() {}

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to whitelist which scripts can be run
    // const nonce = getNonce();

    const assetUri = (fp: string) => {
      return webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, fp)
      );
    };

    /* prettier-ignore */
    return /*html*/`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!-- We'd generally want a content security policy -->
				<script
				src="${assetUri('node_modules/@vscode-elements/elements/dist/bundled.js')}"
				type="module"
				></script>
				<link rel="stylesheet" href="${assetUri('media/style.css')}"> 
				<script
				src= src="${assetUri('node_modules/@vscode-elements/elements/dist/bundled.js')}"
				type="module"
				></script>
				<script src="${assetUri('node_modules/monaco-editor/dev/vs/loader.js')}"></script>	
			</head>
			<body>
				<div id="documents"></div>
				<script>
				require.config({ paths: { vs: '${assetUri("node_modules/monaco-editor/dev/vs")}'}} );	
				</script>
				<script src="${assetUri('media/script.js')}"></script>
			</body>
			</html>`;
  }

  /**
   * Delete an existing scratch from a document.
   */
  private deleteScratch(document: vscode.TextDocument, id: string) {
    const json = this.getDocumentAsJson(document);
    if (!Array.isArray(json.scratches)) {
      return;
    }

    json.scratches = json.scratches.filter((note: any) => note.id !== id);

    return this.updateTextDocument(document, json);
  }

  /**
   * Try to get a current document as json text.
   */
  private getDocumentAsJson(document: vscode.TextDocument): any {
    const text = document.getText();
    if (text.trim().length === 0) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        'Could not get document as json. Content is not valid json'
      );
    }
  }

  /**
   * Write out the json to a given document.
   */
  private updateTextDocument(document: vscode.TextDocument, json: any) {
    const edit = new vscode.WorkspaceEdit();

    // Just replace the entire document every time for this example extension.
    // A more complete extension should compute minimal edits instead.
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      JSON.stringify(json, null, 2)
    );

    return vscode.workspace.applyEdit(edit);
  }
}
