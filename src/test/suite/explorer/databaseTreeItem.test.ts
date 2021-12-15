import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import assert from 'assert';

import { CollectionTreeItem } from '../../../explorer';
import DatabaseTreeItem from '../../../explorer/databaseTreeItem';
import { DataServiceStub, mockDatabaseNames, mockDatabases } from '../stubs';
import {
  seedDataAndCreateDataService,
  cleanupTestDB,
  TEST_DB_NAME
} from '../dbTestHelper';

const { contributes } = require('../../../../package.json');

suite('DatabaseTreeItem Test Suite', () => {
  test('its context value should be in the package json', () => {
    let databaseRegisteredCommandInPackageJson = false;

    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
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

  test('when expanded shows the collections of a database in tree', async () => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      false,
      {}
    );

    void testDatabaseTreeItem.onDidExpand();

    const collections = await testDatabaseTreeItem.getChildren();
    assert(
      collections.length > 0,
      `Expected more than one collection to be returned, recieved ${collections.length}`
    );

    assert(
      collections[1].label ===
      mockDatabases[mockDatabaseNames[1]].collections[1].name,
      `Expected a tree item child with the label collection name ${mockDatabases[mockDatabaseNames[1]].collections[1].name
      } found ${collections[1].label}`
    );
  });

  test('when expanded and collapsed its collections cache their expanded documents', async () => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[1],
      new DataServiceStub(),
      false,
      false,
      {}
    );

    await testDatabaseTreeItem.onDidExpand();

    const collectionTreeItems = await testDatabaseTreeItem.getChildren();

    assert(
      collectionTreeItems[1].isExpanded === false,
      'Expected collection tree item not to be expanded on default.'
    );

    await collectionTreeItems[1].onDidExpand();
    await collectionTreeItems[1].getChildren();
    const documentListItem = collectionTreeItems[1].getDocumentListChild();
    if (!documentListItem) {
      assert(false, 'No document list tree item found on collection.');
    }
    await documentListItem.onDidExpand();
    documentListItem.onShowMoreClicked();

    const documents = await documentListItem.getChildren();
    const amountOfDocs = documents.length;
    const expectedDocs = 21;
    assert(
      expectedDocs === amountOfDocs,
      `Expected ${expectedDocs} documents, recieved ${amountOfDocs}`
    );

    testDatabaseTreeItem.onDidCollapse();
    const postCollapseCollectionTreeItems = await testDatabaseTreeItem.getChildren();

    assert(
      postCollapseCollectionTreeItems.length === 0,
      `Expected the database tree to return no children when collapsed, found ${collectionTreeItems.length}`
    );

    await testDatabaseTreeItem.onDidExpand();
    const newCollectionTreeItems = await testDatabaseTreeItem.getChildren();

    assert(
      newCollectionTreeItems[1].isExpanded === true,
      'Expected collection tree item to be expanded from cache.'
    );

    const documentsPostCollapseExpand = await newCollectionTreeItems[1]
      .getDocumentListChild()
      .getChildren();

    // It should cache that we activated show more.
    const amountOfCachedDocs = documentsPostCollapseExpand.length;
    const expectedCachedDocs = 21;
    assert(
      amountOfCachedDocs === expectedCachedDocs,
      `Expected a cached ${expectedCachedDocs} documents to be returned, found ${amountOfCachedDocs}`
    );
  });

  test('collections are displayed in the alphanumerical case insensitive order, with system collections last', async () => {
    const testDatabaseTreeItem = new DatabaseTreeItem(
      mockDatabaseNames[2],
      new DataServiceStub(),
      true,
      false,
      {}
    );

    const expectedCollectionsOrder = [
      '111_abc',
      '222_abc',
      'aaa',
      'AAA',
      'zzz',
      'ZZZ',
      'system.buckets.aaa',
      'system.buckets.zzz',
      'system.views'
    ];

    const collectionTreeItems: CollectionTreeItem[] = await testDatabaseTreeItem
      .getChildren();
    assert.deepEqual(
      collectionTreeItems
        .map(({ collectionName }) => collectionName)
        .join(),
      expectedCollectionsOrder.join(),
      'Expected collections to be in alphanumerical order but they were not'
    );
  });

  suite('Live Database Tests', function () {
    this.timeout(5000);

    afterEach(async () => {
      await cleanupTestDB();
    });

    test('schema is cached when a database is collapsed and expanded', async () => {
      const mockDocWithThirtyFields = {
        _id: 32,
        testerObject: {
          aField: 1234567
        }
      };

      for (let i = 0; i < 28; i++) {
        mockDocWithThirtyFields[`field${i}`] = 'some value';
      }

      const dataService = await seedDataAndCreateDataService('ramenNoodles', [
        mockDocWithThirtyFields
      ]);
      const testDatabaseTreeItem = new DatabaseTreeItem(
        TEST_DB_NAME,
        dataService,
        true,
        false,
        {}
      );
      const collectionTreeItems: CollectionTreeItem[] = await testDatabaseTreeItem.getChildren();

      assert(
        collectionTreeItems[0].isExpanded === false,
        'Expected collection tree item not to be expanded on default.'
      );

      void collectionTreeItems[0].onDidExpand();
      const schemaTreeItem = collectionTreeItems[0].getSchemaChild();
      if (!schemaTreeItem) {
        assert(false, 'No schema tree item found on collection.');
      }
      void schemaTreeItem.onDidExpand();
      schemaTreeItem.onShowMoreClicked();

      const fields: any[] = await schemaTreeItem.getChildren();
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
      void schemaTreeItem.childrenCache.testerObject.onDidExpand();

      testDatabaseTreeItem.onDidCollapse();
      const postCollapseCollectionTreeItems = await testDatabaseTreeItem
        .getChildren();
      assert(
        postCollapseCollectionTreeItems.length === 0,
        `Expected the database tree to return no children when collapsed, found ${collectionTreeItems.length}`
      );

      void testDatabaseTreeItem.onDidExpand();
      const newCollectionTreeItems = await testDatabaseTreeItem
        .getChildren();
      void dataService.disconnect();

      const postCollapseSchemaTreeItem = newCollectionTreeItems[0].getSchemaChild();
      assert(
        postCollapseSchemaTreeItem.isExpanded === true,
        'Expected collection tree item to be expanded from cache.'
      );

      const fieldsPostCollapseExpand = await postCollapseSchemaTreeItem
        .getChildren();
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
    });
  });
});
