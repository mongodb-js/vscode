import * as vscode from 'vscode';
import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { contributes } = require('../../../../package.json');

import DocumentListTreeItem, {
  CollectionType,
  formatDocCount,
  MAX_DOCUMENTS_VISIBLE,
} from '../../../explorer/documentListTreeItem';

import { DataServiceStub, mockDocuments } from '../stubs';

const dataServiceStub = new DataServiceStub() as unknown as DataService;

function getTestDocumentListTreeItem(
  options?: Partial<ConstructorParameters<typeof DocumentListTreeItem>[0]>,
): DocumentListTreeItem {
  return new DocumentListTreeItem({
    collectionName: 'collectionName',
    databaseName: 'mock_db_name',
    type: CollectionType.collection,
    dataService: dataServiceStub as unknown as DataService,
    isExpanded: false,
    maxDocumentsToShow: MAX_DOCUMENTS_VISIBLE,
    cachedDocumentCount: null,
    refreshDocumentCount: (): Promise<number> => Promise.resolve(25),
    cacheIsUpToDate: false,
    childrenCache: [],
    ...options,
  });
}

suite('DocumentListTreeItem Test Suite', function () {
  test('its context value should be in the package json', function () {
    let documentListRegisteredCommandInPackageJson = false;
    const testDocumentListTreeItem = getTestDocumentListTreeItem();

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testDocumentListTreeItem.contextValue)) {
        documentListRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      documentListRegisteredCommandInPackageJson,
      'Expected document list tree item to be registered with a command in package json',
    );
  });

  test('when the "show more" click handler is called => it increases the amount of documents to show by 10', function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem();

    const maxDocumentsToShow = testDocumentListTreeItem.getMaxDocumentsToShow();
    assert.strictEqual(maxDocumentsToShow, 10);

    testDocumentListTreeItem.onShowMoreClicked();

    const newMaxDocumentsToShow =
      testDocumentListTreeItem.getMaxDocumentsToShow();
    assert.strictEqual(newMaxDocumentsToShow, 20);
  });

  suite('when not expanded', function () {
    test('it does not show documents', async function () {
      const testDocumentListTreeItem = getTestDocumentListTreeItem();

      const collections = await testDocumentListTreeItem.getChildren();
      assert.strictEqual(collections.length, 0);
    });

    test('it does not have a document count in the description', async function () {
      const testDocumentListTreeItem = getTestDocumentListTreeItem();

      await testDocumentListTreeItem.getChildren();

      assert.strictEqual(testDocumentListTreeItem.description, undefined);
    });
  });

  test('a "view" type of document list does not show a dropdown', function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      type: CollectionType.view,
    });

    assert.strictEqual(
      testDocumentListTreeItem.collapsibleState,
      vscode.TreeItemCollapsibleState.None,
    );
  });

  test('when expanded shows the documents of a collection in tree', async function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_1',
      cachedDocumentCount: 25,
    });

    await testDocumentListTreeItem.onDidExpand();

    const documents = await testDocumentListTreeItem.getChildren();

    assert.strictEqual(documents.length, 11);
    assert.strictEqual(documents[1].label, `"${mockDocuments[1]._id}"`);
  });

  test('it should show a show more item when there are more documents to show', async function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_2',
      cachedDocumentCount: 25,
    });
    await testDocumentListTreeItem.onDidExpand();

    const documents = await testDocumentListTreeItem.getChildren();

    assert.strictEqual(documents.length, 11);
    assert.strictEqual(documents[10].label, 'Show more...');
  });

  test('it should show more documents after the show more click handler is called', async function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_3',
      cachedDocumentCount: 25,
    });

    await testDocumentListTreeItem.onDidExpand();
    testDocumentListTreeItem.onShowMoreClicked();

    const documents = await testDocumentListTreeItem.getChildren();
    assert.strictEqual(documents.length, 21);
    assert.strictEqual(documents[19].label, `"${mockDocuments[19]._id}"`);
    assert.strictEqual(documents[20].label, 'Show more...');
  });

  test('it should not show a show more item when there not are more documents to show', async function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_4',
    });

    await testDocumentListTreeItem.onDidExpand();

    // Increase the max to 30 ish.
    testDocumentListTreeItem.onShowMoreClicked();
    testDocumentListTreeItem.onShowMoreClicked();

    const documents = await testDocumentListTreeItem.getChildren();

    assert.strictEqual(documents.length, 25);
    assert.notStrictEqual(
      documents[documents.length - 1].label,
      'Show more...',
    );
  });

  test('when expanded it updates the count of documents', async function () {
    let maxDocs;
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_1',
      cachedDocumentCount: maxDocs,
      refreshDocumentCount: (): Promise<number> => {
        maxDocs = 25;
        return Promise.resolve(25);
      },
    });
    await testDocumentListTreeItem.onDidExpand();

    const newTestDocList = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_4',
      cachedDocumentCount: maxDocs,
    });

    await newTestDocList.onDidExpand();

    const documents = await newTestDocList.getChildren();

    assert.strictEqual(documents.length, 11);
    assert.strictEqual(newTestDocList.description, '25');
  });

  test('it shows a documents icon', function () {
    const testCollectionViewTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_4',
      type: CollectionType.view,
    });

    const viewIconPath = testCollectionViewTreeItem.iconPath;
    assert(
      viewIconPath.dark.toString().includes('documents.svg'),
      'Expected icon path to point to an svg by the name "documents" a dark mode',
    );

    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      collectionName: 'mock_collection_name_4',
      type: CollectionType.collection,
    });

    const collectionIconPath = testDocumentListTreeItem.iconPath;
    assert(
      collectionIconPath.dark.toString().includes('documents.svg'),
      'Expected icon path to point to an svg by the name "documents" with a light mode',
    );
  });

  test('it shows the document count in the description', function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      cachedDocumentCount: 25,
    });

    assert.strictEqual(testDocumentListTreeItem.description, '25');
  });

  test('the tooltip shows the unformatted document count', function () {
    const testDocumentListTreeItem = getTestDocumentListTreeItem({
      cachedDocumentCount: 2200000,
    });

    assert.strictEqual(testDocumentListTreeItem._documentCount, 2200000);
    assert.strictEqual(testDocumentListTreeItem.description, '2M');
    assert.strictEqual(
      testDocumentListTreeItem.tooltip,
      'Collection Documents - 2200000',
    );
  });

  suite('formatDocCount', function () {
    test('It formats the document count when the count is 0', function () {
      const num = 0;
      const result = formatDocCount(num);
      assert.strictEqual(result, '0');
    });

    test('It formats the document count when the count is 10009', function () {
      const num = 10009;
      const result = formatDocCount(num);
      assert.strictEqual(result, '10K');
    });
  });
});
