import * as vscode from 'vscode';

// Bare mock of the extension context for vscode.
class TestExtensionContext implements vscode.ExtensionContext {
  globalStoragePath: string;
  logPath: string;
  subscriptions: { dispose(): any }[];
  workspaceState: vscode.Memento;
  _workspaceState = {};
  globalState: vscode.Memento;
  _globalState = {};
  extensionPath: string;
  storagePath: string;

  asAbsolutePath(relativePath: string): string {
    return '';
  }

  constructor() {
    this.globalStoragePath = '';
    this.logPath = '';
    this.subscriptions = [];
    this.workspaceState = {
      get: (key: string): any => {
        return this._workspaceState[key];
      },
      update: (key: string, value: any): Thenable<void> => {
        return new Promise<void>(() => { this._workspaceState[key] = value; });
      }
    };
    this.globalState = {
      get: (key: string): any => {
        return this._globalState[key];
      },
      update: (key: string, value: any): Thenable<void> => {
        return new Promise<void>(() => { this._globalState[key] = value; });
      }
    };
    this.extensionPath = '';
    this.storagePath = '';
  }
}

const mockDatabases: any = {
  mockDatabase1: {
    databaseName: 'mockDatabase1',
    collections: [
      {
        name: 'mock_db_1_collection_1'
      },
      {
        name: 'mock_db_1_collection_2'
      }
    ]
  },
  mockDatabase2: {
    databaseName: 'mockDatabase2',
    collections: [
      {
        name: 'mock_db_2_collection_1'
      },
      {
        name: 'mock_db_2_collection_2'
      }
    ]
  }
};
const mockDatabaseNames = Object.keys(mockDatabases);
const mockDocuments: any[] = [];
const numberOfDocumentsToMock = 25;
for (let i = 0; i < numberOfDocumentsToMock; i++) {
  mockDocuments.push({
    _id: `mock_document_${i}`
  });
}

class DataServiceStub {
  listDatabases(callback: any) {
    callback(null, mockDatabaseNames);
  }

  listCollections(databaseName: string, filter: object, callback: any) {
    callback(null, mockDatabases[databaseName].collections);
  }

  find(namespace: string, filter: any, options: any, callback: any) {
    callback(null, mockDocuments.slice(0, options.limit));
  }
}

const mockPosition = new vscode.Position(
  0, 0
);

const mockRange = new vscode.Range(mockPosition, mockPosition);

const mockTextLine = {
  lineNumber: 0,
  text: '',
  range: mockRange,
  rangeIncludingLineBreak: mockRange,
  firstNonWhitespaceCharacterIndex: 0,
  isEmptyOrWhitespace: false
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
  save: () => Promise.resolve(true),

  // lineAt: (line: number): vscode.TextLine => mockTextLine,
  lineAt: (position: vscode.Position | number): vscode.TextLine => mockTextLine,
  offsetAt: (position: vscode.Position) => 0,
  positionAt: (offset: number) => mockPosition,
  getText: (range?: vscode.Range) => '',

  getWordRangeAtPosition: (position: vscode.Position, regex?: RegExp) => undefined,
  validateRange: (range: vscode.Range) => mockRange,

  validatePosition: (position: vscode.Position) => mockPosition
};

export {
  mockDocuments,
  mockDatabaseNames,
  mockDatabases,
  mockVSCodeTextDocument,
  DataServiceStub,
  TestExtensionContext
};
