import * as util from 'util';
import {
  CompletionItemKind,
  MarkupKind,
  DiagnosticSeverity,
} from 'vscode-languageserver/node';
import type {
  CancellationToken,
  Connection,
  CompletionItem,
  MarkupContent,
  Diagnostic,
} from 'vscode-languageserver/node';
import path from 'path';
import { signatures } from '@mongosh/shell-api';
import translator from '@mongosh/i18n';
import { Worker as WorkerThreads } from 'worker_threads';
import type { Document } from '@mongosh/service-provider-core';
import { CliServiceProvider } from '@mongosh/service-provider-server';
import parseSchema from 'mongodb-schema';

import formatError from '../utils/formatError';
import { ServerCommands } from './serverCommands';
import { ExportToLanguageMode } from '../types/playgroundType';
import type {
  ShellEvaluateResult,
  PlaygroundEvaluateParams,
  ExportToLanguageNamespace,
  PlaygroundTextAndSelection,
  MongoClientOptions,
} from '../types/playgroundType';
import { Visitor } from './visitor';
import DIAGNOSTIC_CODES from './diagnosticCodes';

export const languageServerWorkerFileName = 'languageServerWorker.js';

interface ServiceProviderParams {
  connectionId: string;
  connectionString: string;
  connectionOptions: MongoClientOptions;
}

export default class MongoDBService {
  _extensionPath?: string;
  _connection: Connection;
  _connectionId?: string;
  _connectionString?: string;
  _connectionOptions?: MongoClientOptions;

  _cachedDatabases: CompletionItem[] = [];
  _cachedFields: { [namespace: string]: CompletionItem[] } = {};
  _cachedCollections: { [database: string]: CompletionItem[] } = {};
  _cachedShellSymbols: { [symbol: string]: CompletionItem[] } = {};
  _cachedTopLevelIdentifiers: CompletionItem[] = [];

  _visitor: Visitor;
  _serviceProvider?: CliServiceProvider;

  constructor(connection: Connection) {
    this._connection = connection;
    this._visitor = new Visitor(connection.console);

    this._cacheShellSymbolsCompletionItems();
    this._cacheTopLevelIdentifierCompletionItems();
  }

  /**
   * The connectionString used by LS to connect to MongoDB.
   */
  get connectionString(): string | undefined {
    return this._connectionString;
  }

  /**
   * The connectionOptions used by LS to connect to MongoDB.
   */
  get connectionOptions(): MongoClientOptions | undefined {
    return this._connectionOptions;
  }

  /**
   * The absolute file path of the directory containing the extension.
   */
  setExtensionPath(extensionPath: string): void {
    this._extensionPath = extensionPath;
  }

  /**
   * Connect to CliServiceProvider.
   */
  async connectToServiceProvider({
    connectionId,
    connectionString,
    connectionOptions,
  }: ServiceProviderParams): Promise<void> {
    // If already connected close the previous connection.
    await this.disconnectFromServiceProvider();

    this._connectionId = connectionId;
    this._connectionString = connectionString;
    this._connectionOptions = connectionOptions;
    this._serviceProvider = await CliServiceProvider.connect(
      connectionString,
      connectionOptions
    );

    try {
      // Get database names for the current connection.
      const databases = await this._getDatabases();
      // Create and cache database completion items.
      this._cacheDatabaseCompletionItems(databases);
    } catch (error) {
      this._connection.console.error(
        `LS get databases error: ${util.inspect(error)}`
      );
    }
  }

  /**
   * Disconnect from CliServiceProvider.
   */
  async disconnectFromServiceProvider(): Promise<void> {
    this._clearCachedDatabases();
    this._clearCachedCollections();
    this._clearCachedFields();

    await this._clearCurrentConnection();
  }

  /**
   * Evaluate code from a playground.
   */
  async evaluate(
    params: PlaygroundEvaluateParams,
    token: CancellationToken
  ): Promise<ShellEvaluateResult | undefined> {
    this._clearCachedFields();

    return new Promise((resolve) => {
      if (this._connectionId !== params.connectionId) {
        void this._connection.sendNotification(
          ServerCommands.SHOW_ERROR_MESSAGE,
          "The playground's active connection does not match the extension's active connection. Please reconnect and try again."
        );
        return resolve(undefined);
      }

      if (!this._extensionPath) {
        this._connection.console.error(
          'LS evaluate: extensionPath is undefined'
        );
        return resolve(undefined);
      }

      try {
        // We allow users to run any code in their playgrounds,
        // which includes long-running operations and even infinite loops.
        // Users can open several playgrounds simultaneously.
        // For each open playground we create a new Node.js thread.
        // We use cancelation tokens to handle users' requests to terminate
        // the current evaluation.
        // Each thread is responsible for one playground evaluation and then terminates.
        // By doing this we ensure that the CliServiceProvider connection is up-to-date,
        // and that multiple playground runs do not interfere with each other.
        //
        // There is an issue with support for `.ts` files.
        // Trying to run a `.ts` file in a worker thread returns the error:
        // `The worker script extension must be “.js” or “.mjs”. Received “.ts”`
        // As a workaround require `.js` file from the out folder.
        //
        // TODO: After webpackifying the extension replace
        // the workaround with some similar 3rd-party plugin.
        const worker = new WorkerThreads(
          path.resolve(
            this._extensionPath,
            'dist',
            languageServerWorkerFileName
          )
        );
        this._connection.console.log(
          `WORKER thread is created on path: ${this._extensionPath}`
        );

        worker?.on(
          'message',
          ({ error, data }: { data?: ShellEvaluateResult; error?: any }) => {
            if (error) {
              this._connection.console.error(
                `WORKER error: ${util.inspect(error)}`
              );
              void this._connection.sendNotification(
                ServerCommands.SHOW_ERROR_MESSAGE,
                formatError(error).message
              );
            }
            void worker.terminate().then(() => {
              resolve(data);
            });
          }
        );

        worker.postMessage({
          name: ServerCommands.EXECUTE_CODE_FROM_PLAYGROUND,
          data: {
            codeToEvaluate: params.codeToEvaluate,
            connectionString: this.connectionString,
            connectionOptions: this.connectionOptions,
          },
        });

        // Listen for cancellation request from the language server client.
        token.onCancellationRequested(async () => {
          this._connection.console.log('PLAYGROUND cancellation requested');
          void this._connection.sendNotification(
            ServerCommands.SHOW_INFO_MESSAGE,
            'The running playground operation was canceled.'
          );

          // Stop the worker and all JavaScript execution
          // in the worker thread as soon as possible.
          await worker.terminate();
          return resolve(undefined);
        });
      } catch (error) {
        this._connection.console.error(
          `LS evaluate error: ${util.inspect(error)}`
        );
        return resolve(undefined);
      }
    });
  }

  /**
   * Get database names for the current connection.
   */
  async _getDatabases(): Promise<Document[]> {
    let result: Document[] = [];

    if (!this._serviceProvider) {
      return [];
    }

    try {
      // TODO: There is a mistake in the service provider interface
      // Use `admin` as arguments to get list of dbs
      // and remove it later when `mongosh` will merge a fix.
      const documents = await this._serviceProvider.listDatabases('admin');
      result = documents.databases ?? [];
    } catch (error) {
      this._connection.console.error(`LS get databases error: ${error}`);
    }

    return result;
  }

  /**
   * Get collection names for the provided database name.
   */
  async _getCollections(databaseName: string): Promise<Document[]> {
    let result: Document[] = [];

    if (!this._serviceProvider) {
      return [];
    }

    try {
      const documents = await this._serviceProvider.listCollections(
        databaseName
      );
      result = documents ? documents : [];
    } catch (error) {
      this._connection.console.error(`LS get collections error: ${error}`);
    }

    return result;
  }

  /**
   * Get field names for the provided namespace.
   */
  async _getSchemaFields(
    databaseName: string,
    collectionName: string
  ): Promise<string[]> {
    let result: string[] = [];

    if (!this._serviceProvider) {
      return [];
    }

    try {
      // TODO: bump monogodb version in mongodb-schema.
      const documents: any = this._serviceProvider.find(
        databaseName,
        collectionName,
        {},
        // TODO: figure out if we need parseSchema for one field at all.
        // For one document we can simply get deep object keys,
        // or we could analyze the schema for at least 5-10 documents.
        // The current behaviour came from Compass when we do the same:
        // https://github.com/mongodb-js/compass/blob/main/packages/compass-field-store/src/stores/store.js#L193
        { limit: 1 }
      );

      const schema = await parseSchema(documents);
      result = schema?.fields ? schema.fields.map((item) => item.name) : [];
    } catch (error) {
      this._connection.console.error(`LS get schema fields error: ${error}`);
    }

    return result;
  }

  /**
   * Return 'db' and 'use' completion items.
   */
  _cacheTopLevelIdentifierCompletionItems() {
    this._cachedTopLevelIdentifiers = [
      {
        label: 'db',
        kind: CompletionItemKind.Method,
        preselect: true,
      },
      {
        label: 'use',
        kind: CompletionItemKind.Function,
        preselect: true,
      },
    ];
  }

  /**
   * Create and cache Shell symbols completion items.
   */
  _cacheShellSymbolsCompletionItems() {
    const shellSymbols = {};

    Object.keys(signatures).map((symbol) => {
      shellSymbols[symbol] = Object.keys(
        signatures[symbol].attributes || {}
      ).map((item) => {
        const documentation =
          translator.translate(
            `shell-api.classes.${symbol}.help.attributes.${item}.description`
          ) || '';
        const link =
          translator.translate(
            `shell-api.classes.${symbol}.help.attributes.${item}.link`
          ) || '';
        const detail =
          translator.translate(
            `shell-api.classes.${symbol}.help.attributes.${item}.example`
          ) || '';

        const markdownDocumentation: MarkupContent = {
          kind: MarkupKind.Markdown,
          value: link
            ? `${documentation}\n\n[Read More](${link})`
            : documentation,
        };

        return {
          label: item,
          kind: CompletionItemKind.Method,
          documentation: markdownDocumentation,
          detail,
          preselect: true,
        };
      });
    });

    this._cachedShellSymbols = shellSymbols;
  }

  /**
   * Check if a string is a valid property name.
   */
  _isValidPropertyName(str: string): boolean {
    return /^(?![0-9])[a-zA-Z0-9$_]+$/.test(str);
  }

  /**
   * Parse code from a playground to identify
   * a context in which export to language action is being called.
   */
  getExportToLanguageMode(
    params: PlaygroundTextAndSelection
  ): ExportToLanguageMode {
    const state = this._visitor.parseAST(params);

    if (state.isArray) {
      return ExportToLanguageMode.AGGREGATION;
    }

    if (state.isObject) {
      return ExportToLanguageMode.QUERY;
    }

    return ExportToLanguageMode.OTHER;
  }

  /**
   * Parse code from a playground to identify
   * a namespace for the export to language action.
   */
  getNamespaceForSelection(
    params: PlaygroundTextAndSelection
  ): ExportToLanguageNamespace {
    try {
      const state = this._visitor.parseAST(params);
      return {
        databaseName: state.databaseName,
        collectionName: state.collectionName,
      };
    } catch (error) {
      this._connection.console.error(
        `VISITOR namespace for selection error: ${util.inspect(error)}`
      );
      return { databaseName: null, collectionName: null };
    }
  }

  /**
   * Get and cache collection and field names based on the namespace.
   */
  async _getCompletionValuesAndUpdateCache(
    textFromEditor: string,
    position: { line: number; character: number },
    currentDatabaseName: string | null,
    currentCollectionName: string | null
  ) {
    if (currentDatabaseName && !this._cachedCollections[currentDatabaseName]) {
      // Get collection names for the current database.
      const collections = await this._getCollections(currentDatabaseName);

      // Create and cache collection completion items.
      this._cacheCollectionCompletionItems(
        textFromEditor,
        position,
        currentDatabaseName,
        collections
      );
    }

    if (currentDatabaseName && currentCollectionName) {
      const namespace = `${currentDatabaseName}.${currentCollectionName}`;

      if (!this._cachedFields[namespace]) {
        // Get field names for the current namespace.
        const schemaFields = await this._getSchemaFields(
          currentDatabaseName,
          currentCollectionName
        );

        // Create and cache field completion items.
        this._cacheFieldCompletionItems(namespace, schemaFields);
      }
    }
  }

  /**
   * Parse code from a playground to identify
   * where the cursor is and suggests only suitable completion items.
   */
  // eslint-disable-next-line complexity
  async provideCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number }
  ): Promise<CompletionItem[]> {
    this._connection.console.log(
      `LS current symbol position: ${util.inspect(position)}`
    );

    const state = this._visitor.parseASTWithPlaceholder(
      textFromEditor,
      position
    );
    this._connection.console.log(
      `VISITOR completion state: ${util.inspect(state)}`
    );

    await this._getCompletionValuesAndUpdateCache(
      textFromEditor,
      position,
      state.databaseName,
      state.collectionName
    );

    // We check a playground code before the current cursor position.
    // If we found 'use("db")' or 'db.collection'
    // and the current node is an object property
    // e.g. 'db.collection.find({ <trigger>})'.
    if (state.databaseName && state.collectionName && state.isObjectKey) {
      this._connection.console.log('VISITOR found field names completion');
      return this._cachedFields[
        `${state.databaseName}.${state.collectionName}`
      ];
    }

    // If the current node is 'db.collection().<trigger>'
    // or 'db["test"].<trigger>'.
    if (state.isShellMethod) {
      this._connection.console.log(
        'VISITOR found shell collection methods completion'
      );
      return this._cachedShellSymbols.Collection;
    }

    // If the current node is 'db.collection().aggregate().<trigger>'.
    if (state.isAggregationCursor) {
      this._connection.console.log(
        'VISITOR found shell aggregation cursor methods completion'
      );
      return this._cachedShellSymbols.AggregationCursor;
    }

    // If the current node is 'db.collection().find().<trigger>'.
    if (state.isFindCursor) {
      this._connection.console.log(
        'VISITOR found shell cursor methods completion'
      );
      return this._cachedShellSymbols.Cursor;
    }

    // If the current node is 'db' or 'use'.
    if (state.isTopLevelIdentifier) {
      return this._cachedTopLevelIdentifiers;
    }

    // If we found 'use("db")' and the current node is 'db.<trigger>'.
    if (state.isDbCallExpression && state.databaseName) {
      this._connection.console.log(
        'VISITOR found shell db methods and collection names completion'
      );
      return [
        ...this._cachedShellSymbols.Database,
        ...this._cachedCollections[state.databaseName],
      ];
    }

    // If the current node is 'db.<trigger>'.
    if (state.isDbCallExpression) {
      this._connection.console.log('VISITOR found shell db methods completion');
      return this._cachedShellSymbols.Database;
    }

    // If the current node can be used as a collection name
    // e.g. 'db.<trigger>.find()' or 'let a = db.<trigger>'.
    if (state.isCollectionName && state.databaseName) {
      this._connection.console.log('VISITOR found collection names completion');
      return this._cachedCollections[state.databaseName];
    }

    // If the current node is 'use("<trigger>"")'.
    if (state.isUseCallExpression) {
      this._connection.console.log('VISITOR found database names completion');
      return this._cachedDatabases;
    }

    this._connection.console.log('VISITOR no completion');
    return [];
  }

  // Highlight the usage of commands that only works inside interactive session.
  // eslint-disable-next-line complexity
  provideDiagnostics(textFromEditor: string) {
    const lines = textFromEditor.split(/\r?\n/g);
    const diagnostics: Diagnostic[] = [];
    const invalidInteractiveSyntaxes = [
      { issue: 'use', fix: "use('VALUE_TO_REPLACE')", default: 'database' },
      { issue: 'show databases', fix: 'db.getMongo().getDBs()' },
      { issue: 'show dbs', fix: 'db.getMongo().getDBs()' },
      { issue: 'show collections', fix: 'db.getCollectionNames()' },
      { issue: 'show tables', fix: 'db.getCollectionNames()' },
      {
        issue: 'show profile',
        fix: "db.getCollection('system.profile').find()",
      },
      { issue: 'show users', fix: 'db.getUsers()' },
      { issue: 'show roles', fix: 'db.getRoles({ showBuiltinRoles: true })' },
      { issue: 'show logs', fix: "db.adminCommand({ getLog: '*' })" },
      {
        issue: 'show log',
        fix: "db.adminCommand({ getLog: 'VALUE_TO_REPLACE' })",
        default: 'global',
      },
    ];

    for (const [i, line] of lines.entries()) {
      for (const item of invalidInteractiveSyntaxes) {
        const issue = item.issue; // E.g. 'use'.
        const startCharacter = line.indexOf(issue); // The start index where the issue was found in the string.

        // In case of `show logs` exclude `show log` diagnostic issue.
        if (
          issue === 'show log' &&
          line.substring(startCharacter).startsWith('show logs')
        ) {
          continue;
        }

        // In case of `user.authenticate()` do not rise a diagnostic issue.
        if (
          issue === 'use' &&
          !line.substring(startCharacter).startsWith('use ')
        ) {
          continue;
        }

        if (!line.trim().startsWith(issue)) {
          continue;
        }

        let endCharacter = startCharacter + issue.length;
        let valueToReplaceWith = item.default;
        let fix = item.fix;

        // If there is a default value, it should be used
        // instead of VALUE_TO_REPLACE placeholder of the `fix` string.
        if (valueToReplaceWith) {
          const words = line.substring(startCharacter).split(' ');

          // The index of the value for `use <value>` and `show log <value>`.
          const valueIndex = issue.split(' ').length;

          if (words[valueIndex]) {
            // The `use ('database')`, `use []`, `use .` are valid JS strings.
            if (
              ['(', '[', '.'].some((word) => words[valueIndex].startsWith(word))
            ) {
              continue;
            }

            // Get the value from a string by removing quotes if any.
            valueToReplaceWith = words[valueIndex].replace(/['";]+/g, '');

            // Add the replacement value and the space between to the total command length.
            endCharacter += words[valueIndex].length + 1;
          }

          fix = fix.replace('VALUE_TO_REPLACE', valueToReplaceWith);
        }

        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          source: 'mongodb',
          code: DIAGNOSTIC_CODES.invalidInteractiveSyntaxes,
          range: {
            start: { line: i, character: startCharacter },
            end: { line: i, character: endCharacter },
          },
          message: `Did you mean \`${fix}\`?`,
          data: { fix },
        });
      }
    }

    return diagnostics;
  }

  /**
   * Convert schema field names to Completion Items and cache them.
   */
  _cacheFieldCompletionItems(namespace: string, schemaFields: string[]): void {
    if (namespace) {
      const fields = schemaFields.map((field) => ({
        label: field,
        kind: CompletionItemKind.Field,
        preselect: true,
      }));

      this._cachedFields[namespace] = fields ? fields : [];
    }
  }

  /**
   * Convert database names to Completion Items and cache them.
   */
  _cacheDatabaseCompletionItems(databases: Document[]): void {
    this._cachedDatabases = databases.map((db) => ({
      label: (db as { name: string }).name,
      kind: CompletionItemKind.Field,
      preselect: true,
    }));
  }

  /**
   * Convert collection names to Completion Items and cache them.
   */
  _cacheCollectionCompletionItems(
    textFromEditor: string,
    position: { line: number; character: number },
    database: string,
    collections: Document[]
  ): void {
    this._cachedCollections[database] = collections.map((item) => {
      if (this._isValidPropertyName(item.name)) {
        return {
          label: item.name,
          kind: CompletionItemKind.Folder,
          preselect: true,
        };
      }

      // Convert invalid property names to array-like format.
      const filterText = textFromEditor.split('\n')[position.line];

      return {
        label: item.name,
        kind: CompletionItemKind.Folder,
        // Find the line with invalid property name.
        filterText: [
          filterText.slice(0, position.character),
          `.${item.name}`,
          filterText.slice(position.character, filterText.length),
        ].join(''),
        textEdit: {
          range: {
            start: { line: position.line, character: 0 },
            end: {
              line: position.line,
              character: filterText.length,
            },
          },
          // Replace with array-like format.
          newText: [
            filterText.slice(0, position.character - 1),
            `['${item.name}']`,
            filterText.slice(position.character, filterText.length),
          ].join(''),
          preselect: true,
        },
      };
    });
  }

  _clearCachedFields(): void {
    this._cachedFields = {};
  }

  _clearCachedDatabases(): void {
    this._cachedDatabases = [];
  }

  _clearCachedCollections(): void {
    this._cachedCollections = {};
  }

  async _clearCurrentConnection(): Promise<void> {
    this._connectionId = undefined;
    this._connectionString = undefined;
    this._connectionOptions = undefined;

    if (this._serviceProvider) {
      const serviceProvider = this._serviceProvider;
      this._serviceProvider = undefined;
      await serviceProvider.close(true);
    }
  }
}
