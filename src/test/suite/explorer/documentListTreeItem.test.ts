import * as assert from 'assert';

const { contributes } = require('../../../../package.json');

import DocumentListTreeItem, {
  CollectionTypes,
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
      'not_real_dataservice',
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
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
      'not_real_dataservice',
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
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

  test('when not expanded it does not show documents', (done) => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );

    testDocumentListTreeItem
      .getChildren()
      .then((collections) => {
        assert(
          collections.length === 0,
          `Expected no collections to be returned, found ${collections.length}`
        );
      })
      .then(done, done);
  });

  test('when expanded shows the documents of a collection in tree', (done) => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_1',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );
    testDocumentListTreeItem.onDidExpand();

    testDocumentListTreeItem
      .getChildren()
      .then((documents) => {
        assert(
          documents.length === 11,
          `Expected 11 documents to be returned, found ${documents.length}`
        );
        assert(
          documents[1].label === `"${mockDocuments[1]._id}"`,
          `Expected a tree item child with the label document name ${mockDocuments[1]._id} found ${documents[1].label}`
        );
      })
      .then(done, done);
  });

  test('it should show a show more item when there are more documents to show', (done) => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_2',
      'mock_db_name',
      CollectionTypes.collection,

      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );
    testDocumentListTreeItem.onDidExpand();

    testDocumentListTreeItem
      .getChildren()
      .then((documents) => {
        assert(
          documents.length === 11,
          `Expected 11 documents to be returned, found ${documents.length}`
        );
        assert(
          documents[10].label === 'Show more...',
          `Expected a tree item child with the label "show more..." found ${documents[10].label}`
        );
      })
      .then(done, done);
  });

  test('it should show more documents after the show more click handler is called', (done) => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_3',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );

    testDocumentListTreeItem.onDidExpand();
    testDocumentListTreeItem.onShowMoreClicked();

    testDocumentListTreeItem
      .getChildren()
      .then((documents) => {
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
      })
      .then(done, done);
  });

  test('it should not show a show more item when there not are more documents to show', (done) => {
    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );

    testDocumentListTreeItem.onDidExpand();

    // Increase the max to 30 ish.
    testDocumentListTreeItem.onShowMoreClicked();
    testDocumentListTreeItem.onShowMoreClicked();

    testDocumentListTreeItem
      .getChildren()
      .then((documents) => {
        assert(
          documents.length === 25,
          `Expected 25 documents to be returned, found ${documents.length}`
        );
        assert(
          documents[documents.length - 1].label !== 'Show more...',
          'Expected the last tree item to not have the label "show more..."'
        );
      })
      .then(done, done);
  });

  test('a view should show a different icon from a collection', () => {
    const testCollectionViewTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.view,
      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );

    const viewIconPath: any = testCollectionViewTreeItem.iconPath;
    assert(
      viewIconPath.light.includes('view.svg'),
      'Expected icon path to point to an svg by the name "view" with a light mode'
    );
    assert(
      viewIconPath.dark.includes('view.svg'),
      'Expected icon path to point to an svg by the name "view" a dark mode'
    );

    const testDocumentListTreeItem = new DocumentListTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      CollectionTypes.collection,
      new DataServiceStub(),
      false,
      MAX_DOCUMENTS_VISIBLE,
      null
    );

    const collectionIconPath: any = testDocumentListTreeItem.iconPath;
    assert(
      collectionIconPath.light.includes('collection.svg'),
      'Expected icon path to point to an svg by the name "collection" with a light mode'
    );
    assert(
      collectionIconPath.dark.includes('collection.svg'),
      'Expected icon path to point to an svg by the name "collection" with a light mode'
    );
  });
});
