import * as assert from 'assert';
import * as vscode from 'vscode';
import { after } from 'mocha';
const sinon = require('sinon');

import { CollectionTreeItem } from '../../explorer';
import { VIEW_COLLECTION_SCHEME } from '../../editors/collectionDocumentsProvider';

suite('MDBExtensionController Test Suite', () => {
  after(function () {
    sinon.restore();
  });

  test('mdb.viewCollectionDocuments command should call onViewCollectionDocuments on the editor controller with the collection namespace', (done) => {
    const mockOpenTextDocument = sinon.fake.resolves('magna carta');
    sinon.replace(vscode.workspace, 'openTextDocument', mockOpenTextDocument);

    const mockShowTextDocument = sinon.fake.resolves();
    sinon.replace(vscode.window, 'showTextDocument', mockShowTextDocument);

    const textCollectionTree = new CollectionTreeItem(
      {
        name: 'testColName'
      },
      'testDbName',
      {},
      false,
      [],
      10
    );

    vscode.commands.executeCommand('mdb.viewCollectionDocuments', textCollectionTree).then(() => {
      assert(mockOpenTextDocument.firstArg.path.indexOf('Results: testDbName.testColName') === 0);
      assert(mockOpenTextDocument.firstArg.path.includes('.json'));
      assert(mockOpenTextDocument.firstArg.scheme === VIEW_COLLECTION_SCHEME);
      assert(mockOpenTextDocument.firstArg.query.includes('namespace=testDbName.testColName'));

      assert(
        mockShowTextDocument.firstArg === 'magna carta',
        'Expected it to call vscode to show the returned documents from the provider'
      );
    }).then(done, done);
  });
});
