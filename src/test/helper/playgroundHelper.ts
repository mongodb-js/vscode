import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionContext } from 'vscode';
import { CancellationTokenSource } from 'vscode-languageclient';
import { LanguageServerController } from '../../language';
import { StorageController } from '../../storage';

// Get a test document from fixtures.
export const getDocUri = (docName: string): vscode.Uri => {
  const docPath = path.resolve(
    __dirname,
    '../../../../src/test/fixture',
    docName
  );

  return vscode.Uri.file(docPath);
};

// // Open the MongoDB playground.
// export async function openPlayground(docUri: vscode.Uri): Promise<any> {
//   try {
//     const doc = await vscode.workspace.openTextDocument(docUri);

//     await vscode.window.showTextDocument(doc);
//   } catch (error) {
//     return Promise.reject();
//   }
// }

// Mock the language client.
export class MockLanguageServerController implements LanguageServerController {
  _context: ExtensionContext;
  _storageController?: StorageController;
  _source?: CancellationTokenSource;
  client: any;

  constructor(context: ExtensionContext, storageController: StorageController) {
    this._context = context;
    this._storageController = storageController;
    this.client = null;
  }

  activate(): void {}

  deactivate(): void {}

  executeAll(codeToEvaluate): Promise<any> {
    return Promise.resolve(true);
  }

  connectToServiceProvider(params: {
    connectionString?: string;
    connectionOptions?: any;
  }): Promise<any> {
    return Promise.resolve(true);
  }

  disconnectFromServiceProvider(): Promise<any> {
    return Promise.resolve(false);
  }

  startStreamLanguageServerLogs(): Promise<boolean> {
    return Promise.resolve(true);
  }

  cancelAll(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
