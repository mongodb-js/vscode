import * as vscode from 'vscode';

import MongoDBDocumentTreeItem from './mongoDBDocumentTreeItem';

export default class MongoDBCollectionTreeItem extends vscode.TreeItem implements vscode.TreeDataProvider<MongoDBCollectionTreeItem> {
  _collectionName: string;
  _databaseName: string;
  _dataService: any;
  _isOpen: boolean;

  constructor(
    collectionName: string,
    databaseName: string,
    dataService: any
  ) {
    super(collectionName, vscode.TreeItemCollapsibleState.Collapsed); // collapsibleState

    this._collectionName = collectionName;
    this._databaseName = databaseName;
    this._dataService = dataService;
    this._isOpen = true;
  }

  get tooltip(): string {
    return this._collectionName;
  }

  get description(): string {
    return '';
  }

  getTreeItem(element: MongoDBCollectionTreeItem): MongoDBCollectionTreeItem {
    return element;
  }

  getChildren(): Thenable<any[]> {
    console.log('Get connection tree item children');

    // TODO: Only show when open.

    return new Promise(resolve => {
      this._dataService.find(
        `${this._databaseName}.${this._collectionName}`,
        { /* No filter */ },
        {
          $limit: 10
        },
        (err: any, documents: any[]) => {
          if (err) {
            // TODO: Handle.
            return resolve([]);
          }

          // TODO: _id could be a different type.
          return resolve(documents.map(document => new MongoDBDocumentTreeItem(document._id)));
        }
      );
    });
  }

  // iconPath = {
  //   light: path.join(__filename, '..', '..', 'resources', 'light', 'dependency.svg'),
  //   dark: path.join(__filename, '..', '..', 'resources', 'dark', 'dependency.svg')
  // };

  contextValue = 'dependency';
}
