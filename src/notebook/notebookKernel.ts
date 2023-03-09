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

    if (notebook?.metadata.type === 'index' && cells.length > 1) {
      void vscode.window.showErrorMessage(
        'To create an index please run one cell with a corresponding index type.'
      );
      return;
    }

    if (notebook?.metadata.type === 'aggregation') {
      await this._executeAggregation(cells);
      return;
    }

    for (const cell of cells) {
      await this._executeCell({ cell });
    }
  }

  private async _executeAggregation(
    cells: vscode.NotebookCell[]
  ): Promise<void> {
    const stagesToEvaluate: string[] = [];

    for (const cell of cells) {
      const cellText = cell.document.getText();

      if (cellText.includes('useNamespace')) {
        const runBefore = `var mdbnbDBName;
        var mdbnbCollName;
        var useNamespace = (nmspc) => {
          var prsdnmsp = nmspc.split('.');
          mdbnbDBName = prsdnmsp[0];
          mdbnbCollName = prsdnmsp[1];
          return use(prsdnmsp[0]);
        };
        var runStage = (mdbnbStg) => {
          mdbnbStages.push(mdbnbStg);
        };`;
        await this._executeCell({ cell, runBefore });
      }

      if (cellText.includes('runStage')) {
        await this._executeCell({
          cell,
          runBefore: `var mdbnbStages = []; ${stagesToEvaluate.join(' ')}`,
          runAfter: 'db.getCollection(mdbnbCollName).aggregate(mdbnbStages);',
        });
        stagesToEvaluate.push(cellText);
      }
    }
  }

  private async _executeCell({
    cell,
    runBefore = '',
    runAfter = '',
  }: {
    cell: vscode.NotebookCell;
    runBefore?: string;
    runAfter?: string;
  }): Promise<void> {
    let codeToEvaluate = cell.document.getText();

    if (!codeToEvaluate) {
      log.error('Execute notebook called but the cell is empty');
      return;
    }

    codeToEvaluate = [runBefore, codeToEvaluate, runAfter].join(' ');
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
}
