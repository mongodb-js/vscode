import * as assert from 'assert';
import * as vscode from 'vscode';

import CollectionDocumentsProvider from '../../../editors/collectionDocumentsProvider';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { TestExtensionContext } from '../stubs';
import { StorageController } from '../../../storage';

suite('Collection Documents Provider Test Suite', () => {
  test('expected provideTextDocumentContent to parse uri and return documents in the form of a string from a find call', (done) => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        assert(
          namespace === 'my-favorite-fruit-is.pineapple',
          `Expected find namespace to be 'my-favorite-fruit-is.pineapple' found ${namespace}`
        );

        assert(
          options.limit === 10,
          `Expected find limit to be 10, found ${options.limit}`
        );

        return callback(null, ['Declaration of Independence']);
      }
    };

    const mockExtensionContext = new TestExtensionContext();
    const mockStorageController = new StorageController(mockExtensionContext);
    const mockConnectionController = new ConnectionController(new StatusView(), mockStorageController);
    mockConnectionController.setActiveConnection(mockActiveConnection);

    const testCollectionViewProvider = new CollectionDocumentsProvider(mockConnectionController);

    const uri = vscode.Uri.parse(
      'scheme:Results: filename.json?namespace=my-favorite-fruit-is.pineapple'
    );

    testCollectionViewProvider.provideTextDocumentContent(uri).then(documents => {
      assert(
        documents.includes('Declaration of Independence'),
        `Expected provideTextDocumentContent to return documents string, found ${documents}`
      );
      done();
    }).catch(done);
  });
});
