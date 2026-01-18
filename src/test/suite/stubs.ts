import * as vscode from 'vscode';
import type {
  CancellationTokenSource,
  ServerOptions,
  LanguageClientOptions,
} from 'vscode-languageclient/node';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';
import { Duplex } from 'stream';
import path from 'path';
import type { Document, Filter, FindOptions } from 'mongodb';

import type { StorageController } from '../../storage';
import type { ShellEvaluateResult } from '../../types/playgroundType';

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
  _secrets: Record<string, string> = {};
  secrets;
  extension;
  languageModelAccessInformation: vscode.LanguageModelAccessInformation;

  asAbsolutePath(relativePath: string): string {
    return relativePath;
  }

  constructor() {
    this.languageModelAccessInformation = {
      onDidChange: (): any => {
        /* no-op */
      },
      canSendRequest: (): undefined => undefined,
    };
    this.globalStoragePath = '';
    this.logPath = '';
    this.subscriptions = [];
    this.secrets = {
      get: (key: string): string => {
        return this._secrets[key];
      },
      store: (key: string, value: string): void => {
        this._secrets[key] = value;
      },
      delete: (key: string): void => {
        delete this._secrets[key];
      },
    };
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
      setKeysForSync: (/* keys: string[] */): void => {
        /* no-op */
      },
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

const mockStreamProcessors = [
  {
    name: 'mockStreamProcessor1',
    state: 'STARTED',
  },
  {
    name: 'mockStreamProcessor2',
    state: 'STOPPPED',
  },
];

class DataServiceStub {
  listStreamProcessors(): Promise<any> {
    return Promise.resolve(mockStreamProcessors);
  }

  listDatabases(): Promise<any> {
    return Promise.resolve(
      mockDatabaseNames.map((dbName) => ({ name: dbName })),
    );
  }

  listCollections(databaseName: string): Promise<any> {
    return Promise.resolve(mockDatabases[databaseName].collections);
  }

  find(
    namespace: string,
    filter: Filter<Document>,
    options: FindOptions,
  ): Promise<Document[]> {
    return Promise.resolve(mockDocuments.slice(0, options.limit));
  }

  aggregate(): Promise<Document[]> {
    return Promise.resolve([{ count: mockDocuments.length }]);
  }

  estimatedCount(): Promise<number> {
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

  getWordRangeAtPosition:
    (/* position: vscode.Position, regex?: RegExp */): undefined => undefined,
  validateRange: (/* range: vscode.Range */): vscode.Range => mockRange,
  validatePosition: (/* position: vscode.Position */): vscode.Position =>
    mockPosition,
  encoding: 'utf8',
};

const mockSelection = new vscode.Selection(
  new vscode.Position(0, 0),
  new vscode.Position(0, 0),
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
  edit: (): Promise<boolean> => Promise.resolve(true),
  insertSnippet: (): Promise<boolean> => Promise.resolve(true),
  setDecorations: (): void => {
    /* no-op */
  },
  revealRange: (): void => {
    /* no-op */
  },
  show: (): void => {
    /* no-op */
  },
  hide: (): void => {
    /* no-op */
  },
};

class LanguageServerControllerStub {
  _context: ExtensionContextStub;
  _storageController?: StorageController;
  _source?: CancellationTokenSource;
  _client: LanguageClient;
  _currentConnectionId: string | null = null;
  _consoleOutputChannel =
    vscode.window.createOutputChannel('Playground output');

  constructor(
    context: ExtensionContextStub,
    storageController: StorageController,
  ) {
    this._context = context;
    this._storageController = storageController;

    const module = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'dist',
      'languageServer.js',
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
      clientOptions,
    );
  }

  startLanguageServer(): Promise<void> {
    return Promise.resolve();
  }

  deactivate(): Thenable<void> | undefined {
    return;
  }

  evaluate(/* codeToEvaluate: string */): Promise<ShellEvaluateResult> {
    return Promise.resolve({
      result: {
        namespace: undefined,
        type: undefined,
        content: 'Result',
        language: 'plaintext',
      },
    });
  }

  activeConnectionChanged(/* params: {
    connectionString?: string;
    connectionOptions?: MongoClientOptions;
    extensionPath: string;
  }*/): Promise<void> {
    return Promise.resolve();
  }

  cancelAll(): void {
    return;
  }

  updateCurrentSessionFields(): Promise<void> {
    return Promise.resolve();
  }

  resetCache(/* clear: { [name: string]: boolean } */): Promise<void> {
    return Promise.resolve();
  }
}

class StreamStub extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void): void {
    this.emit('data', chunk);
    done();
  }

  _read(): void {
    /* no-op */
  }
}

export {
  mockSelection,
  mockDocuments,
  mockTextEditor,
  mockDatabaseNames,
  mockDatabases,
  mockStreamProcessors,
  mockVSCodeTextDocument,
  DataServiceStub,
  ExtensionContextStub,
  LanguageServerControllerStub,
  StreamStub,
};
