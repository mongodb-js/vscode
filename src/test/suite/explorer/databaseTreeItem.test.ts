import * as vscode from 'vscode';
import * as assert from 'assert';
import { afterEach } from 'mocha';

const { contributes } = require('../../../../package.json');

import DatabaseTreeItem from '../../../explorer/databaseTreeItem';
import { DataServiceStub, mockDatabaseNames, mockDatabases } from '../stubs';
import { CollectionTreeItem } from '../../../explorer';
import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';

suite('DatabaseTreeItem Test Suite', () => {
  test('its context value should be in the package json', () => {
    let databaseRegisteredCommandInPackageJson = false;

    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      {}
    );

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testDatabaseTreeItem.contextValue)) {
        databaseRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      databaseRegisteredCommandInPackageJson,
      'Expected database tree item to be registered with a command in package json'
    );
  });

  test('when not expanded it does not show collections', (done) => {
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

  test('when expanded shows the collections of a database in tree', (done) => {
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

  test('when expanded and collapsed its collections cache their expanded documents', (done) => {
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

  suite('Live Database Tests', () => {
    afterEach(async () => {
      await cleanupTestDB();
    });

    test('schema is cached when a database is collapsed and expanded', (done) => {
      const mockDocWithThirtyFields = {
        _id: 32,
        testerObject: {
          aField: 1234567
        }
      };
      for (let i = 0; i < 28; i++) {
        mockDocWithThirtyFields[`field${i}`] = 'some value';
      }

      seedDataAndCreateDataService('ramenNoodles', [
        mockDocWithThirtyFields
      ]).then((dataService) => {
        const testDatabaseTreeItem = new DatabaseTreeItem(
          TEST_DB_NAME,
          dataService,
          true,
          {}
        );

        testDatabaseTreeItem
          .getChildren()
          .then((collectionTreeItems: CollectionTreeItem[]) => {
            assert(
              collectionTreeItems[0].isExpanded === false,
              'Expected collection tree item not to be expanded on default.'
            );

            collectionTreeItems[0].onDidExpand();
            const schemaTreeItem = collectionTreeItems[0].getSchemaChild();
            schemaTreeItem.onDidExpand();
            schemaTreeItem.onShowMoreClicked();

            schemaTreeItem.getChildren().then((fields: any[]) => {
              const amountOfFields = fields.length;
              const expectedFields = 30;
              assert(
                expectedFields === amountOfFields,
                `Expected ${expectedFields} fields, recieved ${amountOfFields}`
              );

              assert(
                !!schemaTreeItem.childrenCache.testerObject,
                'Expected the subdocument field to be in the schema cache.'
              );
              // Expand the subdocument.
              schemaTreeItem.childrenCache.testerObject.onDidExpand();

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
                      dataService.disconnect();

                      const postCollapseSchemaTreeItem = newCollectionTreeItems[0].getSchemaChild();
                      assert(
                        postCollapseSchemaTreeItem.isExpanded === true,
                        'Expected collection tree item to be expanded from cache.'
                      );

                      postCollapseSchemaTreeItem
                        .getChildren()
                        .then((fieldsPostCollapseExpand) => {
                          // It should cache that we activated show more.
                          const amountOfCachedFields =
                            fieldsPostCollapseExpand.length;
                          const expectedCachedFields = 30;
                          assert(
                            amountOfCachedFields === expectedCachedFields,
                            `Expected a cached ${expectedCachedFields} fields to be returned, found ${amountOfCachedFields}`
                          );

                          const testerObjectField = fieldsPostCollapseExpand.find(
                            (field) => field.fieldName === 'testerObject'
                          );

                          assert(
                            !!testerObjectField,
                            'Expected the subdocument field to still be in the schema cache.'
                          );
                          assert(
                            testerObjectField.isExpanded,
                            'Expected the subdocument field to still be expanded.'
                          );
                          assert(
                            testerObjectField.collapsibleState ===
                              vscode.TreeItemCollapsibleState.Expanded,
                            `Expected the subdocument field to have an expanded state (2), found ${postCollapseSchemaTreeItem.childrenCache.testerObject.collapsibleState}.`
                          );
                        })
                        .then(done, done);
                    }, done);
                }, done);
            }, done);
          }, done);
      });
    });
  });
});
