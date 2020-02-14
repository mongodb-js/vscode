import * as assert from 'assert';
import * as vscode from 'vscode';

import CollectionTreeItem from '../../../explorer/collectionTreeItem';

import { DataServiceStub, mockDocuments } from '../stubs';

suite('CollectionTreeItem Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('when the "show more" click handler function is called it increases the amount of documents to show by 10', function() {
    const testCollectionTreeItem = new CollectionTreeItem(
      'collectionName',
      'databaseName',
      'not_real_dataservice'
    );

    const maxDocumentsToShow = testCollectionTreeItem.getMaxDocumentsToShow();
    assert(
      maxDocumentsToShow === 10,
      `Expected max documents to show to be 20, found ${maxDocumentsToShow}.`
    );

    testCollectionTreeItem.onShowMoreClicked();

    const newMaxDocumentsToShow = testCollectionTreeItem.getMaxDocumentsToShow();
    assert(
      newMaxDocumentsToShow === 20,
      `Expected max documents to show to be 20, found ${newMaxDocumentsToShow}.`
    );
  });

  test('when not expanded it does not show documents', function(done) {
    const testCollectionTreeItem = new CollectionTreeItem(
      'mock_collection_name',
      'mock_db_name',
      new DataServiceStub()
    );

    testCollectionTreeItem
      .getChildren()
      .then((collections: any) => {
        assert(
          collections.length === 0,
          `Expected no collections to be returned, found ${collections.length}`
        );
      })
      .then(() => done(), done);
  });

  test('when expanded shows the documents of a collection in tree', function(done) {
    const testCollectionTreeItem = new CollectionTreeItem(
      'mock_collection_name_1',
      'mock_db_name',
      new DataServiceStub()
    );

    testCollectionTreeItem.onDidExpand();

    testCollectionTreeItem
      .getChildren()
      .then((documents: any) => {
        assert(
          documents.length === 11,
          `Expected 11 documents to be returned, found ${documents.length}`
        );
        assert(
          documents[1].label === `"${mockDocuments[1]._id}"`,
          `Expected a tree item child with the label document name ${mockDocuments[1]._id} found ${documents[1].label}`
        );
      })
      .then(() => done(), done);
  });

  test('it should show a show more item when there are more documents to show', function(done) {
    const testCollectionTreeItem = new CollectionTreeItem(
      'mock_collection_name_2',
      'mock_db_name',
      new DataServiceStub()
    );

    testCollectionTreeItem.onDidExpand();

    testCollectionTreeItem
      .getChildren()
      .then((documents: any) => {
        assert(
          documents.length === 11,
          `Expected 11 documents to be returned, found ${documents.length}`
        );
        assert(
          documents[10].label === 'Show more...',
          `Expected a tree item child with the label "show more..." found ${documents[10].label}`
        );
      })
      .then(() => done(), done);
  });

  test('it should show more documents after the show more click handler is called', function(done) {
    const testCollectionTreeItem = new CollectionTreeItem(
      'mock_collection_name_3',
      'mock_db_name',
      new DataServiceStub()
    );

    testCollectionTreeItem.onDidExpand();
    testCollectionTreeItem.onShowMoreClicked();

    testCollectionTreeItem
      .getChildren()
      .then((documents: any) => {
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
      .then(() => done(), done);
  });

  test('it should not show a show more item when there not are more documents to show', function(done) {
    const testCollectionTreeItem = new CollectionTreeItem(
      'mock_collection_name_4',
      'mock_db_name',
      new DataServiceStub()
    );

    testCollectionTreeItem.onDidExpand();

    // Increase the max to 30 ish.
    testCollectionTreeItem.onShowMoreClicked();
    testCollectionTreeItem.onShowMoreClicked();

    testCollectionTreeItem
      .getChildren()
      .then((documents: any) => {
        assert(
          documents.length === 25,
          `Expected 25 documents to be returned, found ${documents.length}`
        );
        assert(
          documents[documents.length - 1].label !== 'Show more...',
          'Expected the last tree item to not have the label "show more..."'
        );
      })
      .then(() => done(), done);
  });
});
