import * as assert from 'assert';
import * as vscode from 'vscode';

import DatabaseTreeItem from '../../../explorer/databaseTreeItem';
import { DataServiceStub, mockDatabaseNames, mockDatabases } from '../stubs';

suite('DatabaseTreeItem Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('when not expanded it does not show collections', function (done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(mockDatabaseNames[1], new DataServiceStub());

    testDatabaseTreeItem.getChildren().then((collections: any) => {
      assert(collections.length === 0, `Expected no collections to be returned, recieved ${collections.length}`);
    }).then(() => done(), done);
  });

  test('when expanded shows the collections of a database in tree', function (done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(mockDatabaseNames[1], new DataServiceStub());

    testDatabaseTreeItem.onDidExpand();

    testDatabaseTreeItem.getChildren().then((collections: any) => {
      assert(collections.length > 0, `Expected more than one collection to be returned, recieved ${collections.length}`);

      assert(collections[1].label === mockDatabases[mockDatabaseNames[1]].collections[1].name, `Expected a tree item child with the label collection name ${mockDatabases[mockDatabaseNames[1]].collections[1].name} found ${collections[1].label}`);
    }).then(() => done(), done);
  });
});
