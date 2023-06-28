import * as vscode from 'vscode';

const onChangedDocument = (
  documentUri: vscode.Uri,
  disposables: vscode.Disposable[]
) => {
  return new Promise<vscode.TextDocument>((resolve) =>
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === documentUri.toString()) {
          resolve(e.document);
        }
      },
      undefined,
      disposables
    )
  );
};

export async function typeCommitCharacter(
  uri: vscode.Uri,
  character: string,
  _disposables: vscode.Disposable[]
) {
  const didChangeDocument = onChangedDocument(uri, _disposables);
  await vscode.commands.executeCommand('editor.action.triggerSuggest');
  await wait(2000); // Give time for suggestions to show.
  await vscode.commands.executeCommand('type', { text: character });
  return await didChangeDocument;
}

const retryUntilDocumentChanges = async (
  documentUri: vscode.Uri,
  options: { retries: number; timeout: number },
  disposables: vscode.Disposable[],
  exec: () => Thenable<unknown>
) => {
  const didChangeDocument = onChangedDocument(documentUri, disposables);

  let done = false;

  const result = await Promise.race([
    didChangeDocument,
    (async () => {
      for (let i = 0; i < options.retries; ++i) {
        await wait(options.timeout);
        if (done) {
          return;
        }
        await exec();
      }
    })(),
  ]);
  done = true;
  return result;
};

export function acceptFirstSuggestion(
  uri: vscode.Uri,
  _disposables: vscode.Disposable[]
) {
  return retryUntilDocumentChanges(
    uri,
    { retries: 10, timeout: 0 },
    _disposables,
    async () => {
      await vscode.commands.executeCommand('editor.action.triggerSuggest');
      await wait(1000);
      await vscode.commands.executeCommand('acceptSelectedSuggestion');
    }
  );
}

export const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

export function disposeAll(disposables: vscode.Disposable[]) {
  while (disposables.length) {
    const item = disposables.pop();
    item?.dispose();
  }
}

export function getFullRange(document: vscode.TextDocument): vscode.Range {
  return new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(document.lineCount, 0)
  );
}
