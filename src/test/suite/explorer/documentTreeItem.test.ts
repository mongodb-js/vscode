import * as assert from 'assert';
import * as vscode from 'vscode';

import DocumentTreeItem from '../../../explorer/documentTreeItem';

suite('DocumentTreeItem Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('it makes the document _id the label of the document tree item', function () {
    const mockDocument = {
      _id: 'mock_document_id'
    };

    const testCollectionTreeItem = new DocumentTreeItem(mockDocument);

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert(documentTreeItemLabel === '"mock_document_id"', `Expected tree item label to be "mock_document_id", found ${documentTreeItemLabel}.`);
  });

  test('when the document has an object _id, it is stringified into the tree item label', function () {
    const mockDocument = {
      _id: {
        someIdField: 'mock_document_id',
        anotherIdField: 'mock_document_id_field_2'
      }
    };

    const expectedLabel = JSON.stringify(mockDocument._id);

    const testCollectionTreeItem = new DocumentTreeItem(mockDocument);

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert(documentTreeItemLabel === expectedLabel, `Expected tree item label to be ${expectedLabel}, found ${documentTreeItemLabel}.`);
  });
});
