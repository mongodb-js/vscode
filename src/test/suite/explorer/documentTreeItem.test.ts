import assert from 'assert';
import type { DataService } from 'mongodb-data-service';

import DocumentTreeItem from '../../../explorer/documentTreeItem';
import { DataServiceStub } from '../stubs';

const dataServiceStub = new DataServiceStub() as unknown as DataService;

function getTestDocumentTreeItem(
  options?: Partial<ConstructorParameters<typeof DocumentTreeItem>[0]>,
): DocumentTreeItem {
  return new DocumentTreeItem({
    document: {},
    namespace: 'name.space',
    documentIndexInTree: 1,
    dataService: dataServiceStub,
    resetDocumentListCache: () => Promise.resolve(),
    ...options,
  });
}

suite('DocumentTreeItem Test Suite', function () {
  test('it makes the document _id the label of the document tree item', function () {
    const mockDocument = {
      _id: 'mock_document_id',
    };
    const testCollectionTreeItem = getTestDocumentTreeItem({
      document: mockDocument,
    });

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert.strictEqual(documentTreeItemLabel, '"mock_document_id"');
  });

  test('when the document has an object _id, it is stringified into the tree item label', function () {
    const mockDocument = {
      _id: {
        someIdField: 'mock_document_id',
        anotherIdField: 'mock_document_id_field_2',
      },
    };
    const testCollectionTreeItem = getTestDocumentTreeItem({
      document: mockDocument,
    });
    const expectedLabel = JSON.stringify(mockDocument._id);

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert.strictEqual(documentTreeItemLabel, expectedLabel);
  });

  test('when the document does not have an _id, its label is the supplied index', function () {
    const mockDocument = {
      noIdField: true,
    };
    const testCollectionTreeItem = getTestDocumentTreeItem({
      document: mockDocument,
    });
    const expectedLabel = 'Document 2';

    const documentTreeItemLabel = testCollectionTreeItem.label;
    assert.strictEqual(documentTreeItemLabel, expectedLabel);
  });
});
