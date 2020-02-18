import * as assert from 'assert';
import * as vscode from 'vscode';

import DatabaseTreeItem from '../../../explorer/databaseTreeItem';
import { DataServiceStub, mockDatabaseNames, mockDatabases } from '../stubs';

suite('DatabaseTreeItem Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('when not expanded it does not show collections', function (done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      {}
    );

    testDatabaseTreeItem
      .getChildren()
      .then((collections: any) => {
        assert(
          collections.length === 0,
          `Expected no collections to be returned, recieved ${collections.length}`
        );
      })
      .then(done, done);
  });

  test('when expanded shows the collections of a database in tree', function (done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      {}
    );

    testDatabaseTreeItem.onDidExpand();

    testDatabaseTreeItem
      .getChildren()
      .then((collections: any) => {
        assert(
          collections.length > 0,
          `Expected more than one collection to be returned, recieved ${collections.length}`
        );

        assert(
          collections[1].label ===
          mockDatabases[mockDatabaseNames[1]].collections[1].name,
          `Expected a tree item child with the label collection name ${mockDatabases[mockDatabaseNames[1]].collections[1].name} found ${collections[1].label}`
        );
      })
      .then(done, done);
  });

  test('when expanded and collapsed its collections cache their expanded documents', function (done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(mockDatabaseNames[1], new DataServiceStub(), false, {});

    testDatabaseTreeItem.onDidExpand();

    testDatabaseTreeItem.getChildren().then(collectionTreeItems => {
      assert(collectionTreeItems[1].isExpanded === false, 'Expected collection tree item not to be expanded on default.');
      collectionTreeItems[1].onDidExpand();
      collectionTreeItems[1].onShowMoreClicked();

      collectionTreeItems[1].getChildren().then((documents: any) => {
        assert(documents.length === 21, `Expected 21 documents to be returned, found ${documents.length}`);

        testDatabaseTreeItem.onDidCollapse();
        testDatabaseTreeItem.getChildren().then(postCollapseCollectionTreeItems => {
          assert(postCollapseCollectionTreeItems.length === 0, `Expected the database tree to return no children when collapsed, found ${collectionTreeItems.length}`);

          testDatabaseTreeItem.onDidExpand();
          testDatabaseTreeItem.getChildren().then(newCollectionTreeItems => {
            assert(newCollectionTreeItems[1].isExpanded === true, 'Expected collection tree item to be expanded from cache.');

            newCollectionTreeItems[1].getChildren().then((documentsPostCollapseExpand: any) => {
              // It should cache that we activated show more.
              assert(documentsPostCollapseExpand.length === 21, `Expected a cached 21 documents to be returned, found ${documents.length}`);
            }).then(done, done);
          });
        });
      });
    });
  });
});
