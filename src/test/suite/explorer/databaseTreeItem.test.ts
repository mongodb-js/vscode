import * as assert from 'assert';

const { contributes } = require('../../../../package.json');

import DatabaseTreeItem from '../../../explorer/databaseTreeItem';
import { DataServiceStub, mockDatabaseNames, mockDatabases } from '../stubs';
import { CollectionTreeItem } from '../../../explorer';

suite('DatabaseTreeItem Test Suite', () => {
  test('its context value should be in the package json', function() {
    let databaseRegisteredCommandInPackageJson = false;

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(DatabaseTreeItem.contextValue)) {
        databaseRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      databaseRegisteredCommandInPackageJson,
      'Expected database tree item to be registered with a command in package json'
    );
  });

  test('when not expanded it does not show collections', function(done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      {}
    );

    testDatabaseTreeItem
      .getChildren()
      .then((collections) => {
        assert(
          collections.length === 0,
          `Expected no collections to be returned, recieved ${collections.length}`
        );
      })
      .then(done, done);
  });

  test('when expanded shows the collections of a database in tree', function(done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      {}
    );

    testDatabaseTreeItem.onDidExpand();

    testDatabaseTreeItem
      .getChildren()
      .then((collections) => {
        assert(
          collections.length > 0,
          `Expected more than one collection to be returned, recieved ${collections.length}`
        );

        assert(
          collections[1].label ===
            mockDatabases[mockDatabaseNames[1]].collections[1].name,
          `Expected a tree item child with the label collection name ${
            mockDatabases[mockDatabaseNames[1]].collections[1].name
          } found ${collections[1].label}`
        );
      })
      .then(done, done);
  });

  test('when expanded and collapsed its collections cache their expanded documents', function(done) {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      {}
    );

    testDatabaseTreeItem.onDidExpand();

    testDatabaseTreeItem
      .getChildren()
      .then((collectionTreeItems: CollectionTreeItem[]) => {
        assert(
          collectionTreeItems[1].isExpanded === false,
          'Expected collection tree item not to be expanded on default.'
        );

        collectionTreeItems[1].onDidExpand();
        const documentListItem = collectionTreeItems[1].getDocumentListChild();
        documentListItem.onDidExpand();
        documentListItem.onShowMoreClicked();

        documentListItem.getChildren().then((documents: any[]) => {
          const amountOfDocs = documents.length;
          const expectedDocs = 21;
          assert(
            expectedDocs === amountOfDocs,
            `Expected ${expectedDocs} documents, recieved ${amountOfDocs}`
          );

          testDatabaseTreeItem.onDidCollapse();
          testDatabaseTreeItem
            .getChildren()
            .then((postCollapseCollectionTreeItems) => {
              assert(
                postCollapseCollectionTreeItems.length === 0,
                `Expected the database tree to return no children when collapsed, found ${collectionTreeItems.length}`
              );

              testDatabaseTreeItem.onDidExpand();
              testDatabaseTreeItem
                .getChildren()
                .then((newCollectionTreeItems) => {
                  assert(
                    newCollectionTreeItems[1].isExpanded === true,
                    'Expected collection tree item to be expanded from cache.'
                  );

                  newCollectionTreeItems[1]
                    .getDocumentListChild()
                    .getChildren()
                    .then((documentsPostCollapseExpand) => {
                      // It should cache that we activated show more.
                      const amountOfCachedDocs =
                        documentsPostCollapseExpand.length;
                      const expectedCachedDocs = 21;
                      assert(
                        amountOfCachedDocs === expectedCachedDocs,
                        `Expected a cached ${expectedCachedDocs} documents to be returned, found ${amountOfCachedDocs}`
                      );
                    })
                    .then(done, done);
                });
            });
        });
      });
  });
});
