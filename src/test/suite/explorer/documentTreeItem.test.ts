import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

import DocumentTreeItem from '../../../explorer/documentTreeItem';
import { DataServiceStub } from '../stubs';

const dataServiceStub = new DataServiceStub() as any as DataService;

suite('DocumentTreeItem Test Suite', () => {
  test('it makes the document _id the label of the document tree item', function () {
    const mockDocument = {
      _id: 'mock_document_id',
    };

    const testCollectionTreeItem = new DocumentTreeItem(
      mockDocument,
      'namespace',
      1,
      {} as DataService,
      () => Promise.resolve()
    );

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert(
      documentTreeItemLabel === '"mock_document_id"',
      `Expected tree item label to be "mock_document_id", found ${documentTreeItemLabel}.`
    );
  });

  test('when the document has an object _id, it is stringified into the tree item label', function () {
    const mockDocument = {
      _id: {
        someIdField: 'mock_document_id',
        anotherIdField: 'mock_document_id_field_2',
      },
    };

    const expectedLabel = JSON.stringify(mockDocument._id);

    const testCollectionTreeItem = new DocumentTreeItem(
      mockDocument,
      'namespace',
      1,
      dataServiceStub,
      () => Promise.resolve()
    );

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert(
      documentTreeItemLabel === expectedLabel,
      `Expected tree item label to be ${expectedLabel}, found ${documentTreeItemLabel}.`
    );
  });

  test('when the document does not have an _id, its label is the supplied index', function () {
    const mockDocument = {
      noIdField: true,
    };

    const expectedLabel = 'Document 2';

    const testCollectionTreeItem = new DocumentTreeItem(
      mockDocument,
      'namespace',
      1,
      dataServiceStub,
      () => Promise.resolve()
    );

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert(
      documentTreeItemLabel === expectedLabel,
      `Expected tree item label to be ${expectedLabel}, found ${documentTreeItemLabel}.`
    );
  });
});
