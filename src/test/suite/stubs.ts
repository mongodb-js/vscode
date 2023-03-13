import * as vscode from 'vscode';
import type {
  CancellationTokenSource,
  ServerOptions,
  LanguageClientOptions,
} from 'vscode-languageclient/node';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import { Duplex } from 'stream';
import path = require('path');
import type { Document, Filter, FindOptions } from 'mongodb';

import { StorageController } from '../../storage';

import {
  ShellEvaluateResult,
  ExportToLanguageMode,
  ExportToLanguageNamespace,
} from '../../types/playgroundType';

// Bare mock of the extension context for vscode.
class ExtensionContextStub implements vscode.ExtensionContext {
  globalStoragePath: string;
  logPath: string;
  subscriptions: { dispose(): any }[];
  workspaceState: vscode.Memento;
  _workspaceState = {};
  globalState: vscode.Memento & { setKeysForSync(keys: string[]): void };
  _globalState = {};
  extensionPath: string;
  storagePath: string;
  extensionUri;
  environmentVariableCollection;
  extensionMode;
  storageUri;
  globalStorageUri;
  logUri;
  secrets;
  extension;

  asAbsolutePath(relativePath: string): string {
    return relativePath;
  }

  constructor() {
    this.globalStoragePath = '';
    this.logPath = '';
    this.subscriptions = [];
    this.secrets = {};
    this.extension = '';
    this.workspaceState = {
      keys: (): readonly string[] => {
        return [];
      },
      get: <T>(key: string): T | undefined => {
        return this._workspaceState[key];
      },
      update: (key: string, value: any): Thenable<void> => {
        return new Promise<void>((resolve) => {
          this._workspaceState[key] = value;
          resolve();
        });
      },
    };
    this.globalState = {
      keys: (): readonly string[] => {
        return [];
      },
      get: <T>(key: string): T | undefined => {
        return this._globalState[key];
      },
      update: (key: string, value: any): Thenable<void> => {
        return new Promise<void>((resolve) => {
          this._globalState[key] = value;
          resolve();
        });
      },
      setKeysForSync: (/* keys: string[] */): void => {},
    };
    this.extensionPath = path.join(__dirname, '..', '..', '..');
    this.storagePath = '';
  }
}

const mockDatabases = {
  mockDatabase1: {
    databaseName: 'mockDatabase1',
    collections: [
      {
        name: 'mock_db_1_collection_1',
      },
      {
        name: 'mock_db_1_collection_2',
      },
    ],
  },
  mockDatabase2: {
    databaseName: 'mockDatabase2',
    collections: [
      {
        name: 'mock_db_2_collection_1',
      },
      {
        name: 'mock_db_2_collection_2',
      },
    ],
  },
  mockDatabase3: {
    databaseName: 'mockDatabase3',
    collections: [
      {
        name: 'ZZZ',
      },
      {
        name: 'AAA',
      },
      {
        name: '111_abc',
      },
      {
        name: '222_abc',
      },
      {
        name: 'zzz',
      },
      {
        name: 'aaa',
      },
      {
        name: 'system.views',
      },
      {
        name: 'system.buckets.zzz',
      },
      {
        name: 'system.buckets.aaa',
      },
    ],
  },
};
const mockDatabaseNames = Object.keys(mockDatabases);
const mockDocuments: { _id: string }[] = [];
const numberOfDocumentsToMock = 25;
for (let i = 0; i < numberOfDocumentsToMock; i++) {
  mockDocuments.push({
    _id: `mock_document_${i}`,
  });
}

class DataServiceStub {
  listDatabases(): Promise<any> {
    return Promise.resolve(
      mockDatabaseNames.map((dbName) => ({ name: dbName }))
    );
  }

  listCollections(databaseName: string): Promise<any> {
    return Promise.resolve(mockDatabases[databaseName].collections);
  }

  find(namespace: string, filter: Filter<Document>, options: FindOptions) {
    return Promise.resolve(mockDocuments.slice(0, options.limit));
  }

  estimatedCount() {
    return Promise.resolve(mockDocuments.length);
  }
}

const mockPosition = new vscode.Position(0, 0);

const mockRange = new vscode.Range(mockPosition, mockPosition);

const mockTextLine = {
  lineNumber: 0,
  text: '',
  range: mockRange,
  rangeIncludingLineBreak: mockRange,
  firstNonWhitespaceCharacterIndex: 0,
  isEmptyOrWhitespace: false,
};

const mockVSCodeTextDocument = {
  uri: vscode.Uri.parse(''),
  fileName: '',
  isUntitled: false,
  languageId: '',
  version: 0,
  isDirty: false,
  isClosed: true,
  eol: vscode.EndOfLine.LF,
  lineCount: 20,
  save: (): Promise<boolean> => Promise.resolve(true),

  // lineAt: (line: number): vscode.TextLine => mockTextLine,
  lineAt: (/* position: vscode.Position | number */): vscode.TextLine =>
    mockTextLine,
  offsetAt: (/* position: vscode.Position */): number => 0,
  positionAt: (/* offset: number */): vscode.Position => mockPosition,
  getText: (/* range?: vscode.Range */): string => '',

  getWordRangeAtPosition: (/* position: vscode.Position, regex?: RegExp */) =>
    undefined,
  validateRange: (/* range: vscode.Range */): vscode.Range => mockRange,
  validatePosition: (/* position: vscode.Position */): vscode.Position =>
    mockPosition,
};

const mockSelection = new vscode.Selection(
  new vscode.Position(0, 0),
  new vscode.Position(0, 0)
);

const mockTextEditor = {
  document: mockVSCodeTextDocument,
  selection: mockSelection,
  selections: [mockSelection],
  visibleRanges: [new vscode.Range(0, 0, 0, 0)],
  options: {
    tabSize: '',
    insertSpaces: '',
    cursorStyle: vscode.TextEditorCursorStyle.Line,
    lineNumbers: vscode.TextEditorLineNumbersStyle.Off,
  },
  viewColumn: vscode.ViewColumn.Beside,
  edit: () => Promise.resolve(true),
  insertSnippet: () => Promise.resolve(true),
  setDecorations: () => {},
  revealRange: () => {},
  show: () => {},
  hide: () => {},
};

class LanguageServerControllerStub {
  _context: ExtensionContextStub;
  _storageController?: StorageController;
  _source?: CancellationTokenSource;
  _isExecutingInProgress: boolean;
  _client: LanguageClient;

  constructor(
    context: ExtensionContextStub,
    storageController: StorageController
  ) {
    this._context = context;
    this._storageController = storageController;

    const module = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'dist',
      'languageServer.js'
    );
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6012'] };

    const serverOptions: ServerOptions = {
      run: { module: '', transport: TransportKind.ipc },
      debug: {
        module,
        transport: TransportKind.ipc,
        options: debugOptions,
      },
    };

    const clientOptions: LanguageClientOptions = {
      documentSelector: [
        { language: 'test' },
        { language: 'test', notebook: '*' },
        { scheme: 'file', pattern: '**/.vscode/test.txt' },
      ],
      synchronize: {
        configurationSection: 'test',
      },
      diagnosticCollectionName: 'collectionName',
      initializationOptions: 'Passed to the server',
      progressOnInitialization: true,
      stdioEncoding: 'utf8',
      middleware: {
        didOpen: (document, next) => {
          return next(document);
        },
      },
      diagnosticPullOptions: {
        onTabs: true,
        onChange: true,
        match: (selector, resource) => {
          const fsPath = resource.fsPath;
          return path.extname(fsPath) === '.bat';
        },
      },
    };

    this._client = new LanguageClient(
      'test',
      'Test',
      serverOptions,
      clientOptions
    );
    this._isExecutingInProgress = false;
  }

  startLanguageServer(): Promise<void> {
    return Promise.resolve();
  }

  deactivate(): void {
    return;
  }

  evaluate(/* codeToEvaluate: string */): Promise<ShellEvaluateResult> {
    return Promise.resolve({
      outputLines: [],
      result: {
        namespace: null,
        type: null,
        content: 'Result',
        language: 'plaintext',
      },
    });
  }

  getExportToLanguageMode(/* params: PlaygroundTextAndSelection */): Promise<ExportToLanguageMode> {
    return Promise.resolve(ExportToLanguageMode.OTHER);
  }

  getNamespaceForSelection(/* params: PlaygroundTextAndSelection */): Promise<ExportToLanguageNamespace> {
    return Promise.resolve({ databaseName: null, collectionName: null });
  }

  connectToServiceProvider(/* params: {
    connectionString?: string;
    connectionOptions?: MongoClientOptions;
    extensionPath: string;
  }*/): Promise<void> {
    return Promise.resolve();
  }

  disconnectFromServiceProvider(): Promise<void> {
    return Promise.resolve();
  }

  cancelAll(): void {
    return;
  }

  updateCurrentSessionFields(): Promise<void> {
    return Promise.resolve();
  }
}

class StreamStub extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit('data', chunk);
    done();
  }

  _read() {}
}

export {
  mockSelection,
  mockDocuments,
  mockTextEditor,
  mockDatabaseNames,
  mockDatabases,
  mockVSCodeTextDocument,
  DataServiceStub,
  ExtensionContextStub,
  LanguageServerControllerStub,
  StreamStub,
};
