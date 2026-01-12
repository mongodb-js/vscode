import * as vscode from 'vscode';
import { after, before } from 'mocha';
import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

import type { CollectionTreeItem } from '../../../explorer';
import DatabaseTreeItem from '../../../explorer/databaseTreeItem';
import { DataServiceStub, mockDatabaseNames, mockDatabases } from '../stubs';
import {
  createTestDataService,
  seedTestDB,
  cleanupTestDB,
  disconnectFromTestDB,
  TEST_DB_NAME,
  TEST_DATABASE_URI,
} from '../dbTestHelper';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

function getTestDatabaseTreeItem(
  options?: Partial<ConstructorParameters<typeof DatabaseTreeItem>[0]>,
): DatabaseTreeItem {
  return new DatabaseTreeItem({
    databaseName: mockDatabaseNames[1],
    dataService: new DataServiceStub() as unknown as DataService,
    isExpanded: false,
    cacheIsUpToDate: false,
    childrenCache: {},
    ...options,
  });
}

suite('DatabaseTreeItem Test Suite', function () {
  test('its context value should be in the package json', function () {
    let databaseRegisteredCommandInPackageJson = false;

    const testDatabaseTreeItem = getTestDatabaseTreeItem();

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testDatabaseTreeItem.contextValue)) {
        databaseRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      databaseRegisteredCommandInPackageJson,
      'Expected database tree item to be registered with a command in package json',
    );
  });

  test('when not expanded it does not show collections', async function () {
    const testDatabaseTreeItem = getTestDatabaseTreeItem();

    const collections = await testDatabaseTreeItem.getChildren();
    assert.strictEqual(
      collections.length,
      0,
      `Expected no collections to be returned, received ${collections.length}`,
    );
  });

  test('when expanded shows the collections of a database in tree', async function () {
    const testDatabaseTreeItem = getTestDatabaseTreeItem();

    await testDatabaseTreeItem.onDidExpand();

    const collections = await testDatabaseTreeItem.getChildren();
    assert(
      collections.length > 0,
      `Expected more than one collection to be returned, received ${collections.length}`,
    );

    assert.strictEqual(
      collections[1].label,
      mockDatabases[mockDatabaseNames[1]].collections[1].name,
    );
  });

  test('when expanded and collapsed its collections cache their expanded documents', async function () {
    const testDatabaseTreeItem = getTestDatabaseTreeItem();

    await testDatabaseTreeItem.onDidExpand();

    const collectionTreeItems = await testDatabaseTreeItem.getChildren();

    assert.strictEqual(collectionTreeItems[1].isExpanded, false);

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
    assert.strictEqual(expectedDocs, amountOfDocs);

    testDatabaseTreeItem.onDidCollapse();
    const postCollapseCollectionTreeItems =
      await testDatabaseTreeItem.getChildren();

    assert.strictEqual(postCollapseCollectionTreeItems.length, 0);

    await testDatabaseTreeItem.onDidExpand();
    const newCollectionTreeItems = await testDatabaseTreeItem.getChildren();

    assert.strictEqual(newCollectionTreeItems[1].isExpanded, true);

    const documentsPostCollapseExpand = await newCollectionTreeItems[1]
      .getDocumentListChild()
      .getChildren();

    // It should cache that we activated show more.
    const amountOfCachedDocs = documentsPostCollapseExpand.length;
    const expectedCachedDocs = 21;
    assert.strictEqual(amountOfCachedDocs, expectedCachedDocs);
  });

  test('collections are displayed in the alphanumerical case insensitive order, with system collections last', async function () {
    const testDatabaseTreeItem = getTestDatabaseTreeItem({
      databaseName: mockDatabaseNames[2],
      isExpanded: true,
    });

    const expectedCollectionsOrder = [
      '111_abc',
      '222_abc',
      'aaa',
      'AAA',
      'zzz',
      'ZZZ',
      'system.buckets.aaa',
      'system.buckets.zzz',
      'system.views',
    ];

    const collectionTreeItems: CollectionTreeItem[] =
      await testDatabaseTreeItem.getChildren();
    assert.deepStrictEqual(
      collectionTreeItems.map(({ collectionName }) => collectionName).join(),
      expectedCollectionsOrder.join(),
      'Expected collections to be in alphanumerical order but they were not',
    );
  });

  suite('Live Database Tests', function () {
    this.timeout(5000);
    let dataService;

    before(async () => {
      dataService = await createTestDataService(TEST_DATABASE_URI);
    });

    after(async () => {
      await cleanupTestDB();
      await disconnectFromTestDB();
    });

    test('schema is cached when a database is collapsed and expanded', async function () {
      const mockDocWithThirtyFields = {
        _id: 32,
        testerObject: {
          aField: 1234567,
        },
      };

      for (let i = 0; i < 28; i++) {
        mockDocWithThirtyFields[`field${i}`] = 'some value';
      }

      await seedTestDB('ramenNoodles', [mockDocWithThirtyFields]);

      const testDatabaseTreeItem = getTestDatabaseTreeItem({
        databaseName: TEST_DB_NAME,
        dataService,
        isExpanded: true,
      });
      const collectionTreeItems: CollectionTreeItem[] =
        await testDatabaseTreeItem.getChildren();

      assert.strictEqual(collectionTreeItems[0].isExpanded, false);

      await collectionTreeItems[0].onDidExpand();
      const schemaTreeItem = collectionTreeItems[0].getSchemaChild();
      if (!schemaTreeItem) {
        assert(false, 'No schema tree item found on collection.');
      }
      await schemaTreeItem.onDidExpand();
      schemaTreeItem.onShowMoreClicked();

      const fields: any[] = await schemaTreeItem.getChildren();
      const amountOfFields = fields.length;
      const expectedFields = 30;
      assert.strictEqual(expectedFields, amountOfFields);

      assert(
        !!schemaTreeItem.childrenCache.testerObject,
        'Expected the subdocument field to be in the schema cache.',
      );

      // Expand the subdocument.
      await schemaTreeItem.childrenCache.testerObject.onDidExpand();

      testDatabaseTreeItem.onDidCollapse();
      const postCollapseCollectionTreeItems =
        await testDatabaseTreeItem.getChildren();
      assert.strictEqual(postCollapseCollectionTreeItems.length, 0);

      await testDatabaseTreeItem.onDidExpand();
      const newCollectionTreeItems = await testDatabaseTreeItem.getChildren();

      const postCollapseSchemaTreeItem =
        newCollectionTreeItems[0].getSchemaChild();
      assert.strictEqual(postCollapseSchemaTreeItem.isExpanded, true);

      const fieldsPostCollapseExpand =
        await postCollapseSchemaTreeItem.getChildren();
      // It should cache that we activated show more.
      const amountOfCachedFields = fieldsPostCollapseExpand.length;
      const expectedCachedFields = 30;
      assert.strictEqual(amountOfCachedFields, expectedCachedFields);

      const testerObjectField = fieldsPostCollapseExpand.find(
        (field) => field.fieldName === 'testerObject',
      );

      assert(
        !!testerObjectField,
        'Expected the subdocument field to still be in the schema cache.',
      );
      assert(
        testerObjectField.isExpanded,
        'Expected the subdocument field to still be expanded.',
      );
      assert.strictEqual(
        testerObjectField.collapsibleState,
        vscode.TreeItemCollapsibleState.Expanded,
      );
    });
  });
});
