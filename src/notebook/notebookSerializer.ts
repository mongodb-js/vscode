import { TextDecoder, TextEncoder } from 'util';
import * as vscode from 'vscode';

interface RawNotebookCell {
  languageId: string;
  value: string;
  kind: vscode.NotebookCellKind;
  metadata?: any;
}

export class NotebookSerializer implements vscode.NotebookSerializer {
  deserializeNotebook(content: Uint8Array): any {
    const contents = new TextDecoder().decode(content);

    let raw: RawNotebookCell[];
    try {
      raw = <RawNotebookCell[]>JSON.parse(contents);
    } catch {
      raw = [];
    }

    const notebookType = raw[0]?.metadata?.notebookType;
    const cells = raw.map((item) => {
      const currentCell = new vscode.NotebookCellData(
        item.kind,
        item.value,
        item.languageId
      );
      return currentCell;
    });
    const data = new vscode.NotebookData(cells);
    data.metadata = {
      type: notebookType,
    };

    return data;
  }

  serializeNotebook(data: vscode.NotebookData): any {
    const contents: RawNotebookCell[] = [];
    const notebookType = data?.metadata?.type;

    for (const cell of data.cells) {
      contents.push({
        kind: cell.kind,
        languageId: cell.languageId,
        value: cell.value,
        metadata: {
          editable: false,
          notebookType,
        },
      });
    }

    return new TextEncoder().encode(JSON.stringify(contents));
  }
}
