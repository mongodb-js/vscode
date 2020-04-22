import * as vscode from 'vscode';
import * as path from 'path';

// Gets a test document from fixtures.
export const getDocUri = (docName: string): vscode.Uri => {
  const docPath = path.resolve(
    __dirname,
    '../../../../src/test/fixture',
    docName
  );

  return vscode.Uri.file(docPath);
};

// Opens the MongoDB playground.
export async function openPlayground(docUri: vscode.Uri): Promise<any> {
  try {
    const doc = await vscode.workspace.openTextDocument(docUri);

    await vscode.window.showTextDocument(doc);
  } catch (error) {
    return Promise.reject();
  }
}
