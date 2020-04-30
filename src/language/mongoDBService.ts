import { CompletionItemKind, CancellationToken } from 'vscode-languageserver';
import { Worker as WorkerThreads } from 'worker_threads';
import { ElectronRuntime } from '@mongosh/browser-runtime-electron';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import { signatures } from '@mongosh/shell-api';
import * as util from 'util';

import { ServerCommands, PlaygroundRunParameters } from './serverCommands';

const path = require('path');
const esprima = require('esprima');
const estraverse = require('estraverse');

export const languageServerWorkerFileName = 'languageServerWorker.js';

export default class MongoDBService {
  _serviceProvider?: CliServiceProvider;
  _runtime?: ElectronRuntime;
  _connection: any;
  _connectionString?: string;
  _connectionOptions?: object;
  _cachedFields: object;
  _cachedDatabases: [];
  _cachedCollections: object;
  _cachedShellSymbols: object;
  _extensionPath?: string;

  constructor(connection) {
    this._connection = connection;
    this._cachedFields = {};
    this._cachedDatabases = [];
    this._cachedCollections = [];
    this._cachedShellSymbols = this.getShellCompletionItems();
  }

  public get connectionString(): string | undefined {
    return this._connectionString;
  }

  public get connectionOptions(): object | undefined {
    return this._connectionOptions;
  }

  private getDatabasesCompletionItems(): void {
    const worker = new WorkerThreads(
      path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
      {
        workerData: {
          connectionString: this._connectionString,
          connectionOptions: this._connectionOptions
        }
      }
    );

    this._connection.console.log('MONGOSH get list databases...');
    worker.postMessage(ServerCommands.GET_LIST_DATABASES);

    worker.on('message', ([error, result]) => {
      if (error) {
        this._connection.console.log(
          `MONGOSH get list databases error: ${util.inspect(error)}`
        );
      }

      worker.terminate().then(() => {
        this._connection.console.log(
          `MONGOSH found ${result.length} databases`
        );
        this.updateCurrentSessionDatabases(result);
      });
    });
  }

  private getCollectionsCompletionItems(
    databaseName: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          workerData: {
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions,
            databaseName
          }
        }
      );

      this._connection.console.log('MONGOSH get list collections...');
      worker.postMessage(ServerCommands.GET_LIST_COLLECTIONS);

      worker.on('message', ([error, result]) => {
        if (error) {
          this._connection.console.log(
            `MONGOSH get list collections error: ${util.inspect(error)}`
          );
        }

        worker.terminate().then(() => {
          this._connection.console.log(
            `MONGOSH found ${result.length} collections`
          );
          this.updateCurrentSessionCollections(databaseName, result);

          return resolve(true);
        });
      });
    });
  }

  public async connectToServiceProvider(params: {
    connectionString?: string;
    connectionOptions?: any;
    extensionPath: string;
  }): Promise<boolean> {
    this._serviceProvider = undefined;
    this._runtime = undefined;
    this._connectionString = params.connectionString;
    this._connectionOptions = params.connectionOptions;
    this._extensionPath = params.extensionPath;

    this.clearCurrentSessionFields();
    this.clearCurrentSessionDatabases();
    this.clearCurrentSessionCollections();

    if (!this._connectionString) {
      return Promise.resolve(false);
    }

    try {
      this._serviceProvider = await CliServiceProvider.connect(
        this._connectionString,
        this._connectionOptions
      );
      this._runtime = new ElectronRuntime(this._serviceProvider);
      this.getDatabasesCompletionItems();

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
    executionParameters: PlaygroundRunParameters,
    token: CancellationToken
  ): Promise<any> {
    this.clearCurrentSessionFields();

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
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          // The workerData parameter sends data to the created worker.
          workerData: {
            codeToEvaluate: executionParameters.codeToEvaluate,
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions
          }
        }
      );

      this._connection.console.log(
        `MONGOSH execute all body: "${executionParameters.codeToEvaluate}"`
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
  private getShellCompletionItems(): object {
    const shellSymbols = {};

    Object.keys(signatures).map((symbol) => {
      shellSymbols[symbol] = Object.keys(signatures[symbol].attributes).map(
        (item) => ({
          label: item,
          kind: CompletionItemKind.Method
        })
      );
    });

    return shellSymbols;
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

  // Check if string is a valid property name
  private validPropertyName(str) {
    return /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str);
  }

  private provideCollectionsItems(
    collections: Array<any>,
    dbCallPosition: { line: number; character: number }
  ): any {
    return collections.map((item) => {
      const line = dbCallPosition.line;
      const startCharacter = dbCallPosition.character - 3;
      const endCharacter = dbCallPosition.character;

      if (this.validPropertyName(item.name)) {
        return {
          label: item.name,
          kind: CompletionItemKind.Property
        };
      }

      return {
        label: item.name,
        kind: CompletionItemKind.Property,
        filterText: `db.`,
        insertTextFormat: 2,
        textEdit: {
          range: {
            start: {
              line,
              character: startCharacter
            },
            end: {
              line,
              character: endCharacter
            }
          },
          newText: `db['${item.name}']`
        }
      };
    });
  }

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
      const isUseCallExpression = dataFromAST.isUseCallExpression;
      const isDbCallExpression = dataFromAST.isDbCallExpression;
      const dbCallPosition = dataFromAST.dbCallPosition;
      const isAggregationCursor = dataFromAST.isAggregationCursor;
      const isFindCursor = dataFromAST.isFindCursor;

      if (databaseName && !this._cachedCollections[databaseName]) {
        await this.getCollectionsCompletionItems(databaseName);
      }

      if (databaseName && collectionName) {
        const namespace = `${databaseName}.${collectionName}`;

        if (!this._cachedFields[namespace]) {
          await this.getFieldsFromSchema(databaseName, collectionName);
        }

        if (isObjectKey) {
          this._connection.console.log('ESPRIMA found field completion');

          return resolve(this._cachedFields[namespace]);
        }
      }

      if (isAggregationCursor) {
        this._connection.console.log('ESPRIMA found aggregation cursor');

        return resolve(this._cachedShellSymbols['AggregationCursor']);
      }

      if (isFindCursor) {
        this._connection.console.log('ESPRIMA found cursor');

        return resolve(this._cachedShellSymbols['Cursor']);
      }

      if (isMemberExpression && collectionName) {
        this._connection.console.log('ESPRIMA found shell completion');

        return resolve(this._cachedShellSymbols['Collection']);
      }

      if (isDbCallExpression) {
        this._connection.console.log('ESPRIMA found collection db symbol');

        let dbCompletions: any = [...this._cachedShellSymbols['Database']];

        if (databaseName) {
          this._connection.console.log(
            'ESPRIMA found collection names completion'
          );

          const collectionCompletions = this.provideCollectionsItems(
            this._cachedCollections[databaseName],
            dbCallPosition
          );

          dbCompletions = dbCompletions.concat(collectionCompletions);
        }

        return resolve(dbCompletions);
      }

      if (isUseCallExpression) {
        this._connection.console.log('ESPRIMA found database names completion');

        return resolve(this._cachedDatabases);
      }

      this._connection.console.log('ESPRIMA no completions');

      return resolve([]);
    });
  }

  private checkIsUseCall(node: any): boolean {
    if (
      node.callee.name === 'use' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === esprima.Syntax.Literal
    ) {
      return true;
    }

    return false;
  }

  private checkIsDbCall(node: any): boolean {
    if (node.expression.name === 'db') {
      return true;
    }

    return false;
  }

  private checkHasAggregationCall(node: any): boolean {
    if (node.property.name === 'aggregate') {
      return true;
    }

    return false;
  }

  private checkHasFindCall(node: any): boolean {
    if (node.property.name === 'find') {
      return true;
    }

    return false;
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
    const nodeEndLine = node.loc.end.line - 1;
    // Do not count brackets
    const nodeStartCharacter = node.loc.start.column + 1;
    const nodeEndCharacter = node.loc.end.column - 1;
    const cursorLine = currentPosition.line;
    const cursorCharacter = currentPosition.character;

    if (
      (cursorLine > nodeStartLine && cursorLine < nodeEndLine) ||
      (cursorLine === nodeStartLine &&
        cursorCharacter >= nodeStartCharacter &&
        cursorCharacter <= nodeEndCharacter)
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
    isUseCallExpression: boolean;
    isDbCallExpression: boolean;
    dbCallPosition: { line: number; character: number };
    isAggregationCursor: boolean;
    isFindCursor: boolean;
  } {
    let databaseName = null;
    let collectionName = null;
    let isObjectKey = false;
    let isMemberExpression = false;
    let isUseCallExpression = false;
    let isDbCallExpression = false;
    let isAggregationCursor = false;
    let isFindCursor = false;
    let dbCallPosition = { line: 0, character: 0 };

    try {
      this._connection.console.log(`ESPRIMA completion body: "${text}"`);

      const ast = esprima.parseScript(text, { loc: true });

      estraverse.traverse(ast, {
        enter: (node) => {
          if (node.type === esprima.Syntax.CallExpression) {
            const isCurrentNode = this.checkIsCurrentNode(node, {
              line: position.line,
              character: position.character
            });

            if (this.checkIsUseCall(node) && isCurrentNode) {
              isUseCallExpression = true;
            }

            if (this.checkHasDatabaseName(node, position)) {
              databaseName = node.arguments[0].value;
            }
          }

          if (node.type === esprima.Syntax.MemberExpression) {
            if (node.object.type === esprima.Syntax.MemberExpression) {
              if (this.checkHasAggregationCall(node)) {
                isAggregationCursor = true;
              }

              if (this.checkHasFindCall(node)) {
                isFindCursor = true;
              }
            }

            if (
              node.object.type === esprima.Syntax.Identifier &&
              this.checkHasCollectionName(node, position)
            ) {
              const isCurrentNode = this.checkIsCurrentNode(node, {
                line: position.line,
                character: position.character - 3
              });

              collectionName = node.property.name
                ? node.property.name
                : node.property.value;

              if (isCurrentNode) {
                isMemberExpression = true;
              }
            }
          }

          if (node.type === esprima.Syntax.ExpressionStatement) {
            const isCurrentNode = this.checkIsCurrentNode(node, {
              line: position.line,
              character: position.character - 2
            });

            if (this.checkIsDbCall(node) && isCurrentNode) {
              isDbCallExpression = true;
              dbCallPosition = position;
            }
          }

          if (node.type === esprima.Syntax.ObjectExpression) {
            const isCurrentNode = this.checkIsCurrentNode(node, {
              line: position.line,
              character: position.character - 1
            });

            if (isCurrentNode) {
              isObjectKey = true;
            }
          }
        }
      });
    } catch (error) {
      this._connection.console.log(`ESPRIMA error: ${util.inspect(error)}`);
    }

    return {
      databaseName,
      collectionName,
      isObjectKey,
      isMemberExpression,
      isUseCallExpression,
      isDbCallExpression,
      isAggregationCursor,
      isFindCursor,
      dbCallPosition
    };
  }

  public clearCurrentSessionFields(): void {
    this._cachedFields = {};
  }

  public updateCurrentSessionFields(
    namespace: string,
    fields: [{ label: string; kind: number }]
  ): [] {
    if (!this._cachedFields[namespace]) {
      this._cachedFields[namespace] = {};
    }

    this._cachedFields[namespace] = fields;

    return this._cachedFields[namespace];
  }

  public clearCurrentSessionDatabases(): void {
    this._cachedDatabases = [];
  }

  public updateCurrentSessionDatabases(databases: any): void {
    this._cachedDatabases = databases ? databases : [];
  }

  public clearCurrentSessionCollections(): void {
    this._cachedCollections = {};
  }

  public updateCurrentSessionCollections(
    database: string,
    collections: any
  ): [] {
    if (database) {
      this._cachedCollections[database] = collections;

      return this._cachedFields[database];
    }

    return [];
  }

  private getFieldsFromSchema(
    databaseName: string,
    collectionName: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const namespace = `${databaseName}.${collectionName}`;
      const worker = new WorkerThreads(
        path.resolve(this._extensionPath, 'dist', languageServerWorkerFileName),
        {
          workerData: {
            connectionString: this._connectionString,
            connectionOptions: this._connectionOptions,
            databaseName,
            collectionName
          }
        }
      );

      this._connection.console.log(`SCHEMA for namespace: "${namespace}"`);
      worker.postMessage(ServerCommands.GET_FIELDS_FROM_SCHEMA);

      worker.on('message', ([error, fields]) => {
        if (error) {
          this._connection.console.log(`SCHEMA error: ${util.inspect(error)}`);
        }

        worker.terminate().then(() => {
          this._connection.console.log(`SCHEMA found ${fields.length} fields`);
          this.updateCurrentSessionFields(namespace, fields);

          return resolve(true);
        });
      });
    });
  }
}
