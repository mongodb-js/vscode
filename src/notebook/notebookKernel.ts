import * as vscode from 'vscode';

import NotebookController from '../notebook/notebookController';

import { createLogger } from '../logging';
const log = createLogger('notebook controller');

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
    for (const cell of cells) {
      await this._doExecution(cell);
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    const codeToEvaluate = cell.document.getText();
    if (!codeToEvaluate) {
      log.info('NOTEBOOK_KERNEL _doExecution: the cell is empty.');
      return;
    }

    log.info('NOTEBOOK_KERNEL _doExecution cell content', codeToEvaluate);

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
}
