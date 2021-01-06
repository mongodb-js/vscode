import * as vscode from 'vscode';
import assert from 'assert';

const { contributes } = require('../../../../package.json');

import DocumentListTreeItem, {
  CollectionTypes,
  formatDocCount,
  MAX_DOCUMENTS_VISIBLE
} from '../../../explorer/documentListTreeItem';

import { DataServiceStub, mockDocuments } from '../stubs';

suite('DocumentListTreeItem Test Suite', () => {
  test('its context value should be in the package json', () => {
    let documentListRegisteredCommandInPackageJson = false;
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'collectionName',
      'databaseName',
      CollectionTypes.collection,
      'not_real_dataservice' as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      null,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    contributes.menus['view/item/context'].forEach((contextItem) => {
      if (contextItem.when.includes(testDocumentListTreeItem.contextValue)) {
        documentListRegisteredCommandInPackageJson = true;
      }
    });

    assert(
      documentListRegisteredCommandInPackageJson,
      'Expected document list tree item to be registered with a command in package json'
    );
  });

  test('when the "show more" click handler is called => it increases the amount of documents to show by 10', () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'collectionName',
      'databaseName',
      CollectionTypes.collection,
      'not_real_dataservice' as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      null,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    const maxDocumentsToShow = testDocumentListTreeItem.getMaxDocumentsToShow();
    assert(
      maxDocumentsToShow === 10,
      `Expected max documents to show to be 20, found ${maxDocumentsToShow}.`
    );

    testDocumentListTreeItem.onShowMoreClicked();

    const newMaxDocumentsToShow = testDocumentListTreeItem.getMaxDocumentsToShow();
    assert(
      newMaxDocumentsToShow === 20,
      `Expected max documents to show to be 20, found ${newMaxDocumentsToShow}.`
    );
  });

  suite('when not expanded', () => {
    test('it does not show documents', async () => {
      const testDocumentListTreeItem = new DocumentListTreeItem(
        'mock_collection_name',
        'mock_db_name',
        CollectionTypes.collection,
        new DataServiceStub() as any,
        false,
        MAX_DOCUMENTS_VISIBLE,
        null,
        (): Promise<boolean> => Promise.resolve(true),
        false,
        []
      );

      const collections = await testDocumentListTreeItem.getChildren();
      assert(
        collections.length === 0,
        `Expected no collections to be returned, found ${collections.length}`
      );
    });

    test('it does not have a document count in the description', async () => {
      const testDocumentListTreeItem = new DocumentListTreeItem(
        'mock_collection_name',
        'mock_db_name',
        CollectionTypes.collection,
        new DataServiceStub() as any,
        false,
        MAX_DOCUMENTS_VISIBLE,
        null,
        (): Promise<boolean> => Promise.resolve(true),
        false,
        []
      );

      await testDocumentListTreeItem.getChildren();

      assert(
        testDocumentListTreeItem.description === undefined,
        `Expected no document count description found ${testDocumentListTreeItem.description}`
      );
    });
  });

  test('a "view" type of document list does not show a dropdown', () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name',
      'mock_db_name',
      CollectionTypes.view,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      null,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    assert(
      testDocumentListTreeItem.collapsibleState ===
      vscode.TreeItemCollapsibleState.None
    );
  });

  test('when expanded shows the documents of a collection in tree', async () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_1',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      25,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );
    await testDocumentListTreeItem.onDidExpand();

    const documents = await testDocumentListTreeItem.getChildren();

    assert(
      documents.length === 11,
      `Expected 11 documents to be returned, found ${documents.length}`
    );
    assert(
      documents[1].label === `"${mockDocuments[1]._id}"`,
      `Expected a tree item child with the label document name ${mockDocuments[1]._id} found ${documents[1].label}`
    );
  });

  test('it should show a show more item when there are more documents to show', async () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_2',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      25,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );
    await testDocumentListTreeItem.onDidExpand();

    const documents = await testDocumentListTreeItem.getChildren();

    assert(
      documents.length === 11,
      `Expected 11 documents to be returned, found ${documents.length}`
    );
    assert(
      documents[10].label === 'Show more...',
      `Expected a tree item child with the label "show more..." found ${documents[10].label}`
    );
  });

  test('it should show more documents after the show more click handler is called', async () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_3',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      25,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    await testDocumentListTreeItem.onDidExpand();
    testDocumentListTreeItem.onShowMoreClicked();

    const documents = await testDocumentListTreeItem.getChildren();
    assert(
      documents.length === 21,
      `Expected 21 documents to be returned, found ${documents.length}`
    );
    assert(
      documents[19].label === `"${mockDocuments[19]._id}"`,
      `Expected a document tree item with the label ${mockDocuments[19]._id}, found ${documents[19].label}`
    );
    assert(
      documents[20].label === 'Show more...',
      `Expected a tree item child with the label "show more..." found ${documents[10].label}`
    );
  });

  test('it should not show a show more item when there not are more documents to show', async () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      25,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    await testDocumentListTreeItem.onDidExpand();

    // Increase the max to 30 ish.
    testDocumentListTreeItem.onShowMoreClicked();
    testDocumentListTreeItem.onShowMoreClicked();

    const documents = await testDocumentListTreeItem.getChildren();

    assert(
      documents.length === 25,
      `Expected 25 documents to be returned, found ${documents.length}`
    );
    assert(
      documents[documents.length - 1].label !== 'Show more...',
      'Expected the last tree item to not have the label "show more..."'
    );
  });

  test('when expanded it updates the count of documents', async () => {
    let maxDocs;
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_1',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      maxDocs,
      (): Promise<boolean> => {
        maxDocs = 25;
        return Promise.resolve(true);
      },
      false,
      []
    );
    await testDocumentListTreeItem.onDidExpand();

    const newTestDocList = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      maxDocs,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    await newTestDocList.onDidExpand();

    const documents = await newTestDocList.getChildren();

    assert(
      documents.length === 11,
      `Expected 11 documents to be returned, found ${documents.length}`
    );
    assert(newTestDocList.description === '25');
  });

  test('it shows a documents icon', () => {
    const testCollectionViewTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.view,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      null,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    const viewIconPath: any = testCollectionViewTreeItem.iconPath;
    assert(
      viewIconPath.dark.includes('documents.svg'),
      'Expected icon path to point to an svg by the name "documents" a dark mode'
    );

    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      null,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    const collectionIconPath: any = testDocumentListTreeItem.iconPath;
    assert(
      collectionIconPath.dark.includes('documents.svg'),
      'Expected icon path to point to an svg by the name "documents" with a light mode'
    );
  });

  test('it shows the document count in the description', () => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      25,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    assert(testDocumentListTreeItem.description === '25');
  });

  test('the tooltip shows the unformated document count', () => {
    const testNewDocListItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub() as any,
      false,
      MAX_DOCUMENTS_VISIBLE,
      2200000,
      (): Promise<boolean> => Promise.resolve(true),
      false,
      []
    );

    assert(
      testNewDocListItem._documentCount === 2200000,
      `Expected document count to be '2200000' found '${testNewDocListItem._documentCount}'`
    );
    assert(testNewDocListItem.description === '2M');
    assert(testNewDocListItem.tooltip === 'Collection Documents - 2200000');
  });

  suite('formatDocCount', () => {
    test('It formats the document count when the count is 0', () => {
      const num = 0;
      const result = formatDocCount(num);
      assert(result === '0');
    });

    test('It formats the document count when the count is 10009', () => {
      const num = 10009;
      const result = formatDocCount(num);
      assert(result === '10K');
    });
  });
});
