import { TextDecoder, TextEncoder } from 'util';
import * as vscode from 'vscode';

interface RawNotebookCell {
  language: string;
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

    const cells = raw.map(
      (item) =>
        new vscode.NotebookCellData(item.kind, item.value, item.language)
    );

    return new vscode.NotebookData(cells);
  }

  serializeNotebook(data: vscode.NotebookData): any {
    const contents: RawNotebookCell[] = [];

    for (const cell of data.cells) {
      contents.push({
        kind: cell.kind,
        language: cell.languageId,
        value: cell.value,
        metadata: {
          editable: false
        }
      });
    }

    return new TextEncoder().encode(JSON.stringify(contents));
  }
}
