import * as vscode from 'vscode';
import { after, afterEach, before, beforeEach } from 'mocha';
import type { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import { expect } from 'chai';

import { DocumentTreeItem } from '../../../explorer';
import {
  allBsonTypes,
  allBsonTypesShellSyntax,
  allBSONTypesStringifiedEJSON,
} from '../../fixture/all-bson-types';
import {
  cleanupTestDB,
  createTestDataService,
  disconnectFromTestDB,
  seedTestDB,
  TEST_DATABASE_URI,
  TEST_DB_NAME,
} from '../dbTestHelper';
import { mdbTestExtension } from '../stubbableMdbExtension';

const allTypesCollection = 'test_all_types';

function getTestDocumentTreeItem({
  dataService,
  document,
}: Pick<
  ConstructorParameters<typeof DocumentTreeItem>[0],
  'dataService' | 'document'
>): DocumentTreeItem {
  return new DocumentTreeItem({
    dataService,
    document,
    documentIndexInTree: 0,
    namespace: `${TEST_DB_NAME}.${allTypesCollection}`,
    resetDocumentListCache: () => Promise.resolve(),
  });
}

suite('openMongoDBDocument Command Test Suite', function () {
  afterEach(() => {
    sinon.restore();
  });

  suite('with all types and document spys', function () {
    let showTextDocumentSpy: sinon.SinonSpy;
    let dataService: DataService;

    before(async () => {
      dataService = await createTestDataService(TEST_DATABASE_URI);

      // Add connection through the extension controller
      await mdbTestExtension.testExtensionController._connectionController.addNewConnectionStringAndConnect(
        {
          connectionString: TEST_DATABASE_URI,
        },
      );
    });

    after(async () => {
      await mdbTestExtension.testExtensionController._connectionController.disconnect();
      await disconnectFromTestDB();
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      await vscode.commands.executeCommand('notifications.clearAll');
    });

    beforeEach(async () => {
      showTextDocumentSpy = sinon.spy(vscode.window, 'showTextDocument');

      // Add the all types to the collection.
      await seedTestDB(allTypesCollection, [allBsonTypes]);
    });

    afterEach(async () => {
      // Drop the collection.
      await cleanupTestDB();
    });

    test('mdb.openMongoDBDocumentFromTree opens a document with shell format (all types)', async function () {
      const testDocumentTreeItem = getTestDocumentTreeItem({
        dataService,
        document: allBsonTypes,
      });

      await vscode.commands.executeCommand(
        'mdb.openMongoDBDocumentFromTree',
        testDocumentTreeItem,
      );

      const document: vscode.TextDocument =
        showTextDocumentSpy.firstCall.args[0];
      const content = document.getText();

      expect(content).to.equal(allBsonTypesShellSyntax);
    });

    suite('with ejson format', function () {
      let documentViewAndEditFormat;

      beforeEach(async () => {
        documentViewAndEditFormat = vscode.workspace
          .getConfiguration('mdb')
          .get('documentViewAndEditFormat');
        await vscode.workspace
          .getConfiguration('mdb')
          .update('documentViewAndEditFormat', 'ejson', true);
      });

      afterEach(async () => {
        await vscode.workspace
          .getConfiguration('mdb')
          .update('documentViewAndEditFormat', documentViewAndEditFormat, true);
      });

      test('mdb.openMongoDBDocumentFromTree opens a document with ejson format (all types)', async function () {
        const testDocumentTreeItem = getTestDocumentTreeItem({
          dataService,
          document: allBsonTypes,
        });

        await vscode.commands.executeCommand(
          'mdb.openMongoDBDocumentFromTree',
          testDocumentTreeItem,
        );

        const document: vscode.TextDocument =
          showTextDocumentSpy.firstCall.args[0];
        const content = document.getText();

        expect(content).to.equal(allBSONTypesStringifiedEJSON);
      });
    });
  });
});
