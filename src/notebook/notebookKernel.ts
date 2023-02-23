import * as vscode from 'vscode';
import { Worker as WorkerThreads } from 'worker_threads';
import path from 'path';

import ConnectionController from '../connectionController';
import { ShellExecuteAllResult } from '../types/playgroundType';

import playgroundNotebookTemplate from '../templates/playgroundNotebookTemplate';

import formatError from '../utils/formatError';

import { createLogger } from '../logging';
const log = createLogger('playground notebook kernel controller');

export class NotebookKernel {
  readonly id = 'mongodb-notebook-kernel';
  public readonly label = 'MongoDB Noteboook Kernel';
  readonly supportedLanguages = ['javascript', 'json'];

  private _executionOrder = 0;
  private readonly _controller: vscode.NotebookController;

  private _context: vscode.ExtensionContext;
  private _connectionController: ConnectionController;
  private _worker?: WorkerThreads;

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController
  ) {
    this._context = context;
    this._connectionController = connectionController;
    this._controller = vscode.notebooks.createNotebookController(
      this.id,
      'mongodb-notebook',
      this.label
    );

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._executeAll.bind(this);
    this._controller.interruptHandler = this._cancelAll.bind(this);
  }

  dispose(): void {
    this._controller.dispose();
  }

  async createPlaygroundNotebook(): Promise<boolean> {
    try {
      const data = new vscode.NotebookData(playgroundNotebookTemplate);
      data.metadata = {
        custom: {
          cells: [],
          metadata: {
            orig_nbformat: 4,
          },
          nbformat: 4,
          nbformat_minor: 2,
        },
      };
      const doc = await vscode.workspace.openNotebookDocument(
        'mongodb-notebook',
        data
      );
      await vscode.window.showNotebookDocument(doc);

      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a playground notebook: ${formatError(error).message}`
      );

      return false;
    }
  }

  private async _cancelAll(): Promise<void> {
    // terminate worker
    await this._worker?.terminate();
    this._worker = undefined;
  }

  private async _executeAll(cells: vscode.NotebookCell[]): Promise<void> {
    for (const cell of cells) {
      await this._doExecution(cell);
    }
  }

  async executeCell(codeToEvaluate: string): Promise<ShellExecuteAllResult> {
    return new Promise((resolve, reject) => {
      if (!this._context.extensionPath) {
        return reject(new Error('extensionPath is undefined'));
      }

      const connectionId = this._connectionController.getActiveConnectionId();

      if (!connectionId) {
        return reject(new Error('connectionId is undefined'));
      }

      if (!this._worker) {
        this._worker = new WorkerThreads(
          path.resolve(this._context.extensionPath, 'dist', 'notebookWorker.js')
        );
      }

      const mongoClientOptions =
        this._connectionController.getMongoClientConnectionOptions();

      if (!mongoClientOptions) {
        return reject(new Error('mongoClientOptions are undefined'));
      }

      // Evaluate runtime in the worker thread.
      this._worker?.postMessage({
        name: 'EXECUTE_NOTEBOOK',
        data: {
          codeToEvaluate: codeToEvaluate,
          connectionString: mongoClientOptions.url,
          connectionOptions: mongoClientOptions.options,
        },
      });

      // Listen for results from the worker thread.
      this._worker.on(
        'message',
        (response: [Error, ShellExecuteAllResult | undefined]) => {
          const [error, result] = response;

          if (error) {
            return reject(formatError(error));
          }

          return resolve(result);
        }
      );
    });
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

    await execution.clearOutput();

    const codeToEvaluate = cell.document.getText();
    log.info('NOTEBOOK_KERNEL execute all body', codeToEvaluate);

    // Run all playground scripts.
    let evaluateResponse: ShellExecuteAllResult;
    try {
      evaluateResponse = await this.executeCell(codeToEvaluate);
    } catch (error) {
      log.error('NOTEBOOK_KERNEL execute all error', error);
    }

    try {
      const debugOutput =
        evaluateResponse?.outputLines?.map(
          (line) =>
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.json(line.content),
            ])
        ) || [];
      const playgroundOutput: vscode.NotebookCellOutput[] = evaluateResponse
        ?.result?.content
        ? [
            new vscode.NotebookCellOutput([
              vscode.NotebookCellOutputItem.json(
                evaluateResponse?.result?.content
              ),
            ]),
          ]
        : [];
      await execution.replaceOutput([...debugOutput, ...playgroundOutput]);

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
