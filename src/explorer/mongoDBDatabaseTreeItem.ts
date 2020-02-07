import * as vscode from 'vscode';

import MongoDBCollectionTreeItem from './mongoDBCollectionTreeItem';

export default class MongoDBDatabaseTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBDatabaseTreeItem> {
  _databaseName: string;
  _dataService: any;
  _isOpen: boolean;

  constructor(
    databaseName: string,
    dataService: any
  ) {
    super(databaseName, vscode.TreeItemCollapsibleState.Expanded); // collapsibleState

    this._databaseName = databaseName;
    this._dataService = dataService;
    this._isOpen = true;
  }

  get tooltip(): string {
    return 'tooltip';
  }

  get description(): string {
    return '';
  }

  getTreeItem(element: MongoDBDatabaseTreeItem): MongoDBDatabaseTreeItem {
    return element;
  }

  // TODO: Get a slightly stricter type than any.
  getChildren(): Thenable<any[]> {
    console.log('Get children of database item, _dataService', this._dataService);
    if (this._isOpen) {
      return new Promise((resolve, reject) => {
        console.log('about to list collections');
        this._dataService.listCollections(this._databaseName, {}, (err: any, collections: string[]) => {
          console.log('got collections', collections);
          if (err) {
            // TODO: Error here properly.
            return resolve([]);
          }

          if (collections) {
            return resolve(collections.map(({ name }: any) => new MongoDBCollectionTreeItem(name, this._databaseName, this._dataService)));
          }

          return resolve([]);
        });
      });
    }

    return Promise.resolve([]);
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
