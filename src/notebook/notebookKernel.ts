import * as vscode from 'vscode';

import NotebookController from '../notebook/notebookController';

import { createLogger } from '../logging';
const log = createLogger('notebook kernel');

export default class NotebookKernel {
  public readonly label = 'MongoDB Noteboook Kernel';
  readonly id = 'mongodb-notebook-kernel';
  readonly supportedLanguages = ['javascript'];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;

  private _notebookController: NotebookController;

  constructor(notebookController: NotebookController) {
    this._notebookController = notebookController;
    this._controller = vscode.notebooks.createNotebookController(
      this.id,
      'mongodb-notebook',
      this.label
    );

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._executeAll.bind(this);
  }

  dispose(): void {
    this._controller.dispose();
  }

  private async _executeAll(cells: vscode.NotebookCell[]): Promise<void> {
    const notebook = vscode.window.activeNotebookEditor?.notebook;
    if (notebook?.metadata.custom.type === 'index' && cells.length > 1) {
      void vscode.window.showErrorMessage(
        'To create an index please run one cell with a corresponding index type.'
      );
      return;
    }

    for (const cell of cells) {
      await this._executeCell(cell);
    }
  }

  private async _executeCell(cell: vscode.NotebookCell): Promise<void> {
    const codeToEvaluate = cell.document.getText();
    if (!codeToEvaluate) {
      log.error('Execute notebook called but the cell is empty');
      return;
    }

    log.info('Execute notebook cell', codeToEvaluate);

    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now());
    await execution.clearOutput();

    try {
      const result = await this._notebookController.executeCell(
        codeToEvaluate,
        execution.token
      );
      await execution.replaceOutput(result);
      execution.end(true, Date.now());
    } catch (err) {
      const errString = err instanceof Error ? err.message : String(err);
      await execution.appendOutput(
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.text(errString),
        ])
      );
      execution.end(false, Date.now());
    }
  }

  async runCellsOnCreateNotebook(cellIndexesToRun: number[]) {
    const notebook = vscode.window.activeNotebookEditor?.notebook;

    for (const cellIndex of cellIndexesToRun) {
      const cell = notebook?.cellAt(cellIndex);
      if (!cell) {
        log.error(`The cell with the '${cellIndex}' index not found`);
      } else {
        await this._executeCell(cell);
        log.error(`The c with the '${cellIndex}' index was executed`);
      }
    }

    return true;
  }
}
