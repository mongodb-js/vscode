import * as vscode from 'vscode';
import EXTENSION_COMMANDS from '../commands';

// Returns a boolean if the selection is one that is valid to show a
// code lens for (isn't a partial line etc.).
export function isSelectionValidForCodeLens(
  selections: vscode.Selection[],
  textDocument: vscode.TextDocument
): boolean {
  if (selections.length > 1) {
    // Show codelens when it's multi cursor.
    return true;
  }

  if (!selections[0].isSingleLine) {
    // Show codelens when it's a multi-line selection.
    return true;
  }

  const lineContent = (textDocument.lineAt(selections[0].end.line).text || '').trim();
  const selectionContent = (textDocument.getText(selections[0]) || '').trim();

  // Show codelens when it contains the whole line.
  return lineContent === selectionContent;
}

export function getCodeLensLineOffsetForSelection(
  selections: vscode.Selection[],
  editor: vscode.TextEditor
): number {
  const lastSelection = selections[selections.length - 1];
  const lastSelectedLineNumber = lastSelection.end.line;
  const lastSelectedLineContent = editor.document.lineAt(lastSelectedLineNumber).text || '';

  // Show a code lens after the selected line, unless the
  // contents of the selection in the last line is empty.
  const lastSelectedLineContentRange = new vscode.Range(
    new vscode.Position(
      lastSelection.end.line,
      0
    ),
    new vscode.Position(
      lastSelection.end.line,
      lastSelectedLineContent.length
    )
  );
  const interectedSelection = lastSelection.intersection(lastSelectedLineContentRange);
  if (!interectedSelection || interectedSelection.isEmpty) {
    return 0;
  }

  return lastSelectedLineContent.trim().length > 0 ? 1 : 0;
}

export default class PartialExecutionCodeLensProvider
implements vscode.CodeLensProvider {
  _selection?: vscode.Range;
  _onDidChangeCodeLenses: vscode.EventEmitter<
    void
  > = new vscode.EventEmitter<void>();

  readonly onDidChangeCodeLenses: vscode.Event<void> = this
    ._onDidChangeCodeLenses.event;

  constructor() {
    vscode.workspace.onDidChangeConfiguration(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  refresh(selection?: vscode.Range): void {
    this._selection = selection;
    this._onDidChangeCodeLenses.fire();
  }

  provideCodeLenses(): vscode.CodeLens[] {
    if (!this._selection) {
      return [];
    }

    const message = '► Run Selected Lines From Playground';
    const codeLens = new vscode.CodeLens(this._selection);

    codeLens.command = {
      title: message,
      command: EXTENSION_COMMANDS.MDB_RUN_SELECTED_PLAYGROUND_BLOCKS,
      arguments: [message]
    };

    return [codeLens];
  }
}
