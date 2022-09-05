import * as vscode from 'vscode';
import { CancellationTokenSource } from 'vscode-languageclient/node';
import { Duplex } from 'stream';
import path = require('path');

import { StorageController } from '../../storage';

import {
  ShellExecuteAllResult,
  ExportToLanguageMode,
  ExportToLanguageNamespace,
} from '../../types/playgroundType';

// Bare mock of the extension context for vscode.
class TestExtensionContext implements vscode.ExtensionContext {
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
      get: (key: string): any => {
        return this._workspaceState[key];
      },
      update: (key: string, value: any): Thenable<void> => {
        return new Promise<void>(() => {
          this._workspaceState[key] = value;
        });
      },
    };
    this.globalState = {
      keys: (): readonly string[] => {
        return [];
      },
      get: (key: string): any => {
        return this._globalState[key];
      },
      update: (key: string, value: any): Thenable<void> => {
        return new Promise<void>(() => {
          this._globalState[key] = value;
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
const mockDocuments: any[] = [];
const numberOfDocumentsToMock = 25;
for (let i = 0; i < numberOfDocumentsToMock; i++) {
  mockDocuments.push({
    _id: `mock_document_${i}`,
  });
}

class DataServiceStub {
  listDatabases(): Promise<any> {
    return new Promise((resolve) => {
      resolve(mockDatabaseNames.map((dbName) => ({ name: dbName })));
    });
  }

  listCollections(databaseName: string): Promise<any> {
    return new Promise((resolve) => {
      resolve(mockDatabases[databaseName].collections);
    });
  }

  find(namespace: string, filter: any, options: any, callback: any): void {
    callback(null, mockDocuments.slice(0, options.limit));
  }

  estimatedCount(namespace: string, options: any, callback: any): void {
    callback(null, mockDocuments.length);
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

class MockLanguageServerController {
  _context: TestExtensionContext;
  _storageController?: StorageController;
  _source?: CancellationTokenSource;
  _isExecutingInProgress: boolean;
  _client: any;

  constructor(
    context: TestExtensionContext,
    storageController: StorageController
  ) {
    this._context = context;
    this._storageController = storageController;
    this._client = null;
    this._isExecutingInProgress = false;
  }

  startLanguageServer(): Promise<void> {
    return Promise.resolve();
  }

  deactivate(): void {
    return;
  }

  executeAll(/* codeToEvaluate: string */): Promise<ShellExecuteAllResult> {
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
}

class TestStream extends Duplex {
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
  TestExtensionContext,
  MockLanguageServerController,
  TestStream,
};
