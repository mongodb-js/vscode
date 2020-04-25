import { CompletionItemKind, CancellationToken } from 'vscode-languageserver';
import { Worker as WorkerThreads } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import * as util from 'util';
import { ServerCommands } from './serverCommands';

const path = require('path');
const esprima = require('esprima');
const estraverse = require('estraverse');

export default class MongoDBService {
  _serviceProvider?: CliServiceProvider;
  _runtime?: ElectronRuntime;
  _connection: any;
  _connectionString?: string;
  _connectionOptions?: object;
  _cachedFields: object;

  constructor(connection) {
    this._connection = connection;
    this._cachedFields = {};
  }

  public get connectionString(): string | undefined {
    return this._connectionString;
  }

  public get connectionOptions(): object | undefined {
    return this._connectionOptions;
  }

  public async connectToServiceProvider(params: {
    connectionString?: string;
    connectionOptions?: any;
  }): Promise<boolean> {
    this._serviceProvider = undefined;
    this._runtime = undefined;
    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions;

    if (!this._connectionString) {
      return Promise.resolve(false);
    }

    try {
      this._serviceProvider = await CliServiceProvider.connect(
        this._connectionString,
        this._connectionOptions
      );
      this._runtime = new ElectronRuntime(this._serviceProvider);

      return Promise.resolve(true);
    } catch (error) {
      this._connection.console.log(
        `MONGOSH connect error: ${util.inspect(error)}`
      );

      return Promise.resolve(false);
    }
  }

  public async disconnectFromServiceProvider(): Promise<boolean> {
    this._connectionString = undefined;
    this._connectionOptions = undefined;
    this._runtime = undefined;

    return Promise.resolve(false);
  }

  // Run playground scripts.
  public executeAll(
    codeToEvaluate: string,
    token: CancellationToken
  ): Promise<any> {
    this._cachedFields = {};

    return new Promise((resolve) => {
      // Use Node worker threads to run a playground to be able to cancel infinite loops.
      //
      // There is an issue with support for `.ts` files.
      // Trying to run a `.ts` file in a worker thread returns the error:
      // `The worker script extension must be “.js” or “.mjs”. Received “.ts”`
      // As a workaround require `.js` file from the out folder.
      //
      // TODO: After webpackifying the extension replace
      // the workaround with some similar 3rd-party plugin.
      const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
        // The workerData parameter sends data to the created worker.
        workerData: {
          codeToEvaluate: codeToEvaluate,
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions
        }
      });

      this._connection.console.log(
        `MONGOSH execute all body: "${codeToEvaluate}"`
      );

      // Evaluate runtime in the worker thread.
      worker.postMessage(ServerCommands.EXECUTE_ALL_FROM_PLAYGROUND);

      // Listen for results from the worker thread.
      worker.on('message', ([error, result]) => {
        if (error) {
          this._connection.console.log(
            `MONGOSH execute all error: ${util.inspect(error)}`
          );
          this._connection.sendNotification('showErrorMessage', error.message);
        }

        worker.terminate().then(() => {
          return resolve(result);
        });
      });

      // Listen for cancellation request from the language server client.
      token.onCancellationRequested(() => {
        this._connection.console.log('PLAYGROUND cancellation requested');
        this._connection.sendNotification(
          'showInformationMessage',
          'The running playground operation was canceled.'
        );

        // If there is a situation that mongoClient is unresponsive,
        // try to close mongoClient after each runtime evaluation
        // and after the cancelation of the runtime
        // to make sure that all resources are free and can be used with a new request.
        //
        // (serviceProvider as any)?.mongoClient.close(false);
        //
        // The mongoClient.close method closes the underlying connector,
        // which in turn closes all open connections.
        // Once called, this mongodb instance can no longer be used.
        //
        // See: https://github.com/mongodb-js/vscode/pull/54

        // Stop the worker and all JavaScript execution
        // in the worker thread as soon as possible.
        worker.terminate().then((status) => {
          this._connection.console.log(
            `PLAYGROUND canceled with status: ${status}`
          );

          return resolve([]);
        });
      });
    });
  }

  // Get shell API symbols/methods completion from mongosh.
  protected getShellCompletionItems(expression: string): Promise<[]> {
    return new Promise(async (resolve) => {
      let mongoshCompletions: any;

      if (!this._runtime) {
        return resolve([]);
      }

      try {
        this._connection.console.log(
          `MONGOSH completion body: "${expression}"`
        );
        mongoshCompletions = await this._runtime?.getCompletions(expression);
      } catch (error) {
        this._connection.console.log(
          `MONGOSH completion error: ${util.inspect(error)}`
        );

        return resolve([]);
      }

      if (
        !mongoshCompletions ||
        !Array.isArray(mongoshCompletions) ||
        mongoshCompletions.length === 0
      ) {
        return resolve([]);
      }

      // Convert Completion[] format returned by `mongosh`
      // to CompletionItem[] format required by VSCode.
      mongoshCompletions = mongoshCompletions.map((item) => {
        // The runtime.getCompletions() function returns complitions including the user input.
        // Slice the user input and show only suggested keywords to complete the query.
        const index = item.completion.indexOf(expression);
        const newTextToComplete = `${item.completion.slice(
          0,
          index
        )}${item.completion.slice(index + expression.length)}`;
        const label: string =
          index === -1 ? item.completion : newTextToComplete;

        return {
          label,
          kind: CompletionItemKind.Field
        };
      });

      return resolve(mongoshCompletions);
    });
  }

  private removeSymbolByIndex = (text: string, index: number): string => {
    if (index === 0) {
      return text.slice(1);
    }

    return `${text.slice(0, index - 1)}${text.slice(index)}`;
  };

  // Esprima parser requires finished blocks of code to build AST.
  // In this case, the `db.collection.` text will throw a parsing error.
  // Find and remove trigger dots from the text before sending it to esprima
  private findAndRemoveTriggerDot = (
    textFromEditor: string,
    position: { line: number; character: number }
  ): string => {
    const textForEsprima: Array<string> = [];

    textFromEditor.split('\n').forEach((line, index) => {
      if (index === position.line) {
        const currentSymbol = line[position.character - 1];

        textForEsprima.push(
          currentSymbol === '.'
            ? this.removeSymbolByIndex(line, position.character)
            : line
        );
      } else {
        textForEsprima.push(line);
      }
    });

    return textForEsprima.join('\n');
  };

  public provideCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number }
  ): Promise<[]> {
    return new Promise(async (resolve) => {
      this._connection.console.log(
        `LS current symbol position: ${util.inspect(position)}`
      );

      const textForEsprima = this.findAndRemoveTriggerDot(
        textFromEditor,
        position
      );
      const dataFromAST = this.parseAST(textForEsprima, position);
      const databaseName = dataFromAST.databaseName;
      const collectionName = dataFromAST.collectionName;
      const isObjectKey = dataFromAST.isObjectKey;
      const isMemberExpression = dataFromAST.isMemberExpression;

      if (isObjectKey && databaseName && collectionName) {
        this._connection.console.log(
          'ESPRIMA response: "Found ObjectExpression"'
        );

        const namespace = `${databaseName}.${collectionName}`;

        if (!this._cachedFields[namespace]) {
          this._cachedFields[namespace] = await this.getFieldsFromSchema(
            databaseName,
            collectionName
          );
        }

        return resolve(this._cachedFields[namespace]);
      }

      if (isMemberExpression && collectionName) {
        this._connection.console.log(
          'ESPRIMA response: "Found MemberExpression"'
        );

        const shellCompletion = await this.getShellCompletionItems(
          `db.${collectionName}.`
        );

        return resolve(shellCompletion);
      }

      this._connection.console.log('ESPRIMA response: "No completion"');

      return resolve([]);
    });
  }

  private checkHasDatabaseName(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkHasCollectionName(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    if (
      node.object.name === 'db' &&
      (currentPosition.line >= node.loc.start.line ||
        (currentPosition.line === node.loc.start.line - 1 &&
          currentPosition.character > node.loc.end.column))
    ) {
      return true;
    }

    return false;
  }

  private checkIsCurrentNode(
    node: any,
    currentPosition: { line: number; character: number }
  ): boolean {
    // Esprima counts lines from 1, when vscode counts position starting from 0
    const nodeStartLine = node.loc.start.line - 1;
    const nodeStartCharacter = node.loc.start.column;
    const nodeEndLine = node.loc.end.line - 1;
    const nodeEndCharacter = node.loc.start.column;

    if (
      (currentPosition.line > nodeStartLine &&
        currentPosition.line < nodeEndLine) ||
      (currentPosition.line === nodeStartLine &&
        currentPosition.character >= nodeStartCharacter) ||
      (currentPosition.line === nodeEndLine &&
        currentPosition.character <= nodeEndCharacter)
    ) {
      return true;
    }

    return false;
  }

  private parseAST(
    text: string,
    position: { line: number; character: number }
  ): {
    databaseName: string | null;
    collectionName: string | null;
    isObjectKey: boolean;
    isMemberExpression: boolean;
  } {
    let databaseName = null;
    let collectionName = null;
    let isObjectKey = false;
    let isMemberExpression = false;

    try {
      this._connection.console.log(`ESPRIMA completion body: "${text}"`);

      const ast = esprima.parseScript(text, { loc: true });

      estraverse.traverse(ast, {
        enter: (node) => {
          if (
            node.type === esprima.Syntax.CallExpression &&
            this.checkHasDatabaseName(node, position)
          ) {
            databaseName = node.arguments[0].value;
          }

          if (
            node.type === esprima.Syntax.MemberExpression &&
            this.checkHasCollectionName(node, position)
          ) {
            collectionName = node.property.name
              ? node.property.name
              : node.property.value;

            if (
              this.checkIsCurrentNode(node, {
                line: position.line,
                character: position.character - 2
              })
            ) {
              isMemberExpression = true;
            }
          }

          if (
            node.type === esprima.Syntax.ObjectExpression &&
            this.checkIsCurrentNode(node, position)
          ) {
            isObjectKey = true;
          }
        }
      });
    } catch (error) {
      this._connection.console.log(`ESPRIMA error: ${util.inspect(error)}`);
    }

    return { databaseName, collectionName, isObjectKey, isMemberExpression };
  }

  public updatedCurrentSessionFields(fields: {
    [key: string]: [{ label: string; kind: number }];
  }): void {
    this._cachedFields = fields ? fields : {};
  }

  private getFieldsFromSchema(
    databaseName: string,
    collectionName: string
  ): Promise<[]> {
    return new Promise((resolve) => {
      const namespace = `${databaseName}.${collectionName}`;
      const worker = new WorkerThreads(path.resolve(__dirname, 'worker.js'), {
        // The workerData parameter sends data to the created worker
        workerData: {
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions,
          databaseName,
          collectionName
        }
      });

      this._connection.console.log(`SCHEMA for namespace: "${namespace}"`);

      // Evaluate runtime in the worker thread
      worker.postMessage(ServerCommands.GET_FIELDS_FROM_SCHEMA);

      // Listen for results from the worker thread
      worker.on('message', ([error, fields]) => {
        if (error) {
          this._connection.console.log(`SCHEMA error: ${util.inspect(error)}`);
        } else {
          this._connection.console.log(
            `SCHEMA response: "Found ${fields.length} fields"`
          );
        }

        worker.terminate().then(() => {
          return resolve(fields ? fields : []);
        });
      });
    });
  }
}
