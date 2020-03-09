import * as assert from 'assert';

import { EditorsController } from '../../../editors';

suite('Editors Controller Test Suite', () => {
  test('getViewCollectionDocumentsUri builds a uri from the namespace and connection info', function () {
    const testOpId = '100011011101110011';
    const testNamespace = 'myFavoriteNamespace';
    const testConnectionId = 'alienSateliteConnection';
    const testUri = EditorsController.getViewCollectionDocumentsUri(testOpId, testNamespace, testConnectionId);

    assert(
      testUri.path === 'Results: myFavoriteNamespace.json',
      `Expected uri path ${testUri.path} to equal 'Results: myFavoriteNamespace.json'.`
    );
    assert(
      testUri.scheme === 'VIEW_COLLECTION_SCHEME',
      `Expected uri scheme ${testUri.scheme} to equal 'VIEW_COLLECTION_SCHEME'.`
    );
    assert(
      testUri.query === 'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011',
      `Expected uri query ${testUri.query} to equal 'namespace=myFavoriteNamespace&connectionId=alienSateliteConnection&operationId=100011011101110011'.`
    );
  });
});
