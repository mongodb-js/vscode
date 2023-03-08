import * as vscode from 'vscode';

import path from 'path';
import { Worker as WorkerThreads } from 'worker_threads';

import formatError from '../utils/formatError';
import notebookStartTemplate from '../templates/notebookStartTemplate';
import { ShellExecuteAllResult } from '../types/playgroundType';
import ConnectionController from '../connectionController';
import { PlaygroundController } from '../editors';

import { createLogger } from '../logging';
const log = createLogger('notebook controller');

/**
 * This controller manages notebook.
 */
export default class NotebookController {
  private _context: vscode.ExtensionContext;
  private _connectionController: ConnectionController;
  private _playgroundController: PlaygroundController;
  private _notebooks: {
    [id: string]: {
      worker?: WorkerThreads;
    };
  };

  constructor(
    context: vscode.ExtensionContext,
    connectionController: ConnectionController,
    playgroundController: PlaygroundController
  ) {
    this._context = context;
    this._connectionController = connectionController;
    this._playgroundController = playgroundController;
    this._notebooks = {};

    const leafyGreenTableMessageChannel =
      vscode.notebooks.createRendererMessaging('mongodb-leafy-green-table');
    leafyGreenTableMessageChannel.onDidReceiveMessage((e) => {
      if (e.message.request === 'leafyGreenTableRendererLoaded') {
        log.info('The leafy green table renderer loaded');
      }
      if (e.message.request === 'openNotebookAsPlaygroundResult') {
        log.info('Opening notebook as playground result...');
        this._playgroundController.openNotebookAsPlaygroundResult(
          e.message.data
        );
      }
      if (e.message.request === 'getWindowSettings') {
        log.info('The leafyGreenTable renderer requested window settings');
        void leafyGreenTableMessageChannel.postMessage({
          request: 'setWindowSettings',
          data: {
            darkMode:
              vscode.window.activeColorTheme.kind ===
              vscode.ColorThemeKind.Dark,
          },
        });
      }
    });

    const errorMessageChannel =
      vscode.notebooks.createRendererMessaging('mongodb-error');
    errorMessageChannel.onDidReceiveMessage((e) => {
      if (e.message.request === 'errorRendererLaded') {
        log.info('The error renderer loaded');
      }
      if (e.message.request === 'getWindowSettings') {
        log.info('The error renderer requested window settings');
        void errorMessageChannel.postMessage({
          request: 'setWindowSettings',
          data: {
            darkMode:
              vscode.window.activeColorTheme.kind ===
              vscode.ColorThemeKind.Dark,
          },
        });
      }
    });

    vscode.window.onDidChangeActiveColorTheme((e) => {
      log.info('The active color theme changed');
      void leafyGreenTableMessageChannel.postMessage({
        request: 'activeColorThemeChanged',
        data: { darkMode: e.kind === vscode.ColorThemeKind.Dark },
      });
    });

    vscode.workspace.onDidCloseNotebookDocument((document) => {
      const uri = document.uri.toString();
      void this._notebooks[uri]?.worker?.terminate().then(() => {
        delete this._notebooks[uri];
      });
    });
  }

  _createNotebookWorker() {
    if (!this._context.extensionPath) {
      throw new Error('extensionPath is undefined');
    }

    return new WorkerThreads(
      path.resolve(this._context.extensionPath, 'dist', 'notebookWorker.js')
    );
  }

  _getNotebookWorker() {
    if (!vscode.window.activeNotebookEditor) {
      throw new Error('The Active Notebook is not found');
    }

    const uri = vscode.window.activeNotebookEditor.notebook.uri.toString();
    const worker = this._notebooks[uri]?.worker;
    return worker ? worker : this._createNotebookWorker();
  }

  resetNotebookRuntime() {
    if (!vscode.window.activeNotebookEditor) {
      throw new Error('The Active Notebook is not found');
    }

    const uri = vscode.window.activeNotebookEditor.notebook.uri.toString();
    this._notebooks[uri] = {
      worker: this._createNotebookWorker(),
    };

    void vscode.window.showInformationMessage(
      'The Notebook Runtime was reset.'
    );

    return Promise.resolve(true);
  }

  async createNewNotebook(): Promise<boolean> {
    const notebookNewTemplate = [
      {
        kind: vscode.NotebookCellKind.Markup,
        languageId: 'markdown',
        value: '# Notebook Title',
      },
      {
        kind: vscode.NotebookCellKind.Code,
        languageId: 'javascript',
        value: '/* Write your code here */',
      },
    ];

    try {
      const data = new vscode.NotebookData(notebookNewTemplate);
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
      this._notebooks[doc.uri.toString()] = {
        worker: this._createNotebookWorker(),
      };
      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a new notebook: ${formatError(error).message}`
      );

      return false;
    }
  }

  async createNotebook(): Promise<boolean> {
    try {
      const data = new vscode.NotebookData(notebookStartTemplate);
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
      this._notebooks[doc.uri.toString()] = {
        worker: this._createNotebookWorker(),
      };
      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to create a notebook: ${formatError(error).message}`
      );

      return false;
    }
  }

  _prepareNotebookOutput(evaluateResponse) {
    const debugOutput =
      evaluateResponse?.outputLines?.map(
        (line) =>
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.json(line.content),
          ])
      ) || [];
    const contentOutput: vscode.NotebookCellOutput[] = evaluateResponse?.result
      ?.content
      ? [
          new vscode.NotebookCellOutput([
            vscode.NotebookCellOutputItem.json(
              evaluateResponse?.result?.content
            ),
          ]),
        ]
      : [];

    return [...debugOutput, ...contentOutput];
  }

  async executeCell(
    codeToEvaluate: string,
    token: vscode.CancellationToken
  ): Promise<vscode.NotebookCellOutput[]> {
    return new Promise((resolve, reject) => {
      const connectionId = this._connectionController.getActiveConnectionId();
      if (!connectionId) {
        void vscode.window.showErrorMessage(
          'Please connect to a database before running code.'
        );
        return resolve([]);
      }

      let worker;

      try {
        worker = this._getNotebookWorker();
      } catch (error) {
        return reject(error);
      }

      const mongoClientOptions =
        this._connectionController.getMongoClientConnectionOptions();
      if (!mongoClientOptions) {
        return reject(new Error('mongoClientOptions are undefined'));
      }

      // Evaluate runtime in the worker thread.
      worker.postMessage({
        name: 'EXECUTE_NOTEBOOK',
        data: {
          codeToEvaluate: codeToEvaluate,
          connectionString: mongoClientOptions.url,
          connectionOptions: mongoClientOptions.options,
        },
      });

      // Listen for results from the worker thread.
      worker.on(
        'message',
        (response: [Error, ShellExecuteAllResult | undefined]) => {
          const [error, result] = response;

          if (error) {
            return resolve([
              new vscode.NotebookCellOutput([
                vscode.NotebookCellOutputItem.error(error),
              ]),
            ]);
          }

          return resolve(this._prepareNotebookOutput(result));
        }
      );

      token.onCancellationRequested(() => {
        log.info('The executing of the notebook was canceled');
        void vscode.window.showInformationMessage(
          'The running notebook operation was canceled.'
        );
        void worker.terminate().then(() => {
          return resolve([]);
        });
      });
    });
  }

  convertNotebookCellToPlayground(cell: vscode.NotebookCell): Promise<boolean> {
    return this._playgroundController.createPlaygroundFileWithContent(
      cell.document.getText()
    );
  }

  convertNotebookToPlayground(): Promise<boolean> {
    const cells =
      vscode.window.activeNotebookEditor?.notebook?.getCells() || [];

    const content = cells
      .map((cell) => {
        if (cell.kind === vscode.NotebookCellKind.Code) {
          return cell.document.getText();
        }
        return '';
      })
      .join('\n');

    return this._playgroundController.createPlaygroundFileWithContent(content);
  }

  async openNotebook(filePath: string): Promise<boolean> {
    try {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.file(filePath),
        'mongodb-notebook'
      );

      return true;
    } catch (error) {
      void vscode.window.showErrorMessage(
        `Unable to open a notebook: ${formatError(error).message}`
      );

      return false;
    }
  }
}
