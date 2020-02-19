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

export {
  mockDocuments,
  mockDatabaseNames,
  mockDatabases,
  DataServiceStub,
  TestExtensionContext
};
