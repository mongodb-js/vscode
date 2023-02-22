import * as vscode from 'vscode';

import PlaygroundController from '../editors/playgroundController';
import ConnectionController from '../connectionController';
import { ShellExecuteAllResult } from '../types/playgroundType';

import playgroundTemplate from '../templates/playgroundTemplate';

import formatError from '../utils/formatError';

export class NotebookKernel {
  readonly id = 'mongodb-notebook-kernel';
  public readonly label = 'MongoDB Noteboook Kernel';
  readonly supportedLanguages = ['javascript'];

  private _executionOrder = 0;
  private readonly _controller: vscode.NotebookController;

  private _playgroundController: PlaygroundController;
  private _connectionController: ConnectionController;

  constructor(
    playgroundController: PlaygroundController,
    connectionController: ConnectionController
  ) {
    this._playgroundController = playgroundController;
    this._connectionController = connectionController;
    this._controller = vscode.notebooks.createNotebookController(this.id,
      'mongodb-notebook',
      this.label);

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._executeAll.bind(this);
    this._controller.interruptHandler = this._cancelAll.bind(this);
  }

  dispose(): void {
    this._controller.dispose();
  }

  async createPlaygroundNotebook(): Promise<boolean> {
    const useDefaultTemplate = !!vscode.workspace
      .getConfiguration('mdb')
      .get('useDefaultTemplateForPlayground');
    const content = useDefaultTemplate ? playgroundTemplate : '';

    try {
      const playgroundCell = new vscode.NotebookCellData(vscode.NotebookCellKind.Code, content, 'javascript');
      const data = new vscode.NotebookData([playgroundCell]);
      data.metadata = {
        custom: {
          cells: [],
          metadata: {
            orig_nbformat: 4
          },
          nbformat: 4,
          nbformat_minor: 2
        }
      };
      const doc = await vscode.workspace.openNotebookDocument('mongodb-notebook', data);
      await vscode.window.showNotebookDocument(doc);

      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a playground notebook: ${formatError(error).message}`
      );

      return false;
    }
  }

  private _cancelAll(): void {
    this._playgroundController._languageServerController.cancelAll();
  }

  private async _executeAll(cells: vscode.NotebookCell[]): Promise<void> {
    for (const cell of cells) {
      await this._doExecution(cell);
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    if (!this._connectionController.isCurrentlyConnected()) {
      await vscode.window.showErrorMessage(
        'Please connect to a database before running a playground.'
      );
      return;
    }

    const execution = this._controller.createNotebookCellExecution(cell);

    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now());

		if (!vscode.window.activeNotebookEditor) {
			return;
		}

    const text = vscode.window.activeNotebookEditor.notebook.getCells()
      .filter((_, idx) => idx <= cell.index)
      .map((c) => c.document.getText()).join(' ');

    await execution.clearOutput();

    // Run all playground scripts.
    const result: ShellExecuteAllResult = await this._playgroundController._evaluate(text);

    try {
      await execution.replaceOutput([
        new vscode.NotebookCellOutput([
          // vscode.NotebookCellOutputItem.text(JSON.stringify(result?.result?.content, null, 2))
          vscode.NotebookCellOutputItem.json(result?.result?.content)
        ])
      ]);

      execution.end(true, Date.now());
    } catch (err) {
      const errString = err instanceof Error ? err.message : String(err);
      await execution.appendOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text(errString)]));
      execution.end(false, Date.now());
    }
  }
}
