import * as vscode from 'vscode';
import { after, afterEach, before, beforeEach } from 'mocha';
import type { DataService } from 'mongodb-data-service';
import sinon from 'sinon';
import { expect } from 'chai';

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

function getTestDocumentItem(
  connectionId: string | null,
  document: any,
  format: 'shell' | 'ejson',
): {
  connectionId: string | null;
  documentId: string;
  namespace: string;
  format: 'shell' | 'ejson';
} {
  return {
    documentId: document._id,
    namespace: `${TEST_DB_NAME}.${allTypesCollection}`,
    format,
    connectionId,
  };
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

      await dataService.disconnect();
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

    test('mdb.openMongoDBDocumentFromDataBrowser opens a document with shell format (all types)', async function () {
      const testDocument = getTestDocumentItem(
        mdbTestExtension.testExtensionController._connectionController.getActiveConnectionId(),
        allBsonTypes,
        'shell',
      );

      await vscode.commands.executeCommand(
        'mdb.openMongoDBDocumentFromDataBrowser',
        testDocument,
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

      test('mdb.openMongoDBDocumentFromDataBrowser opens a document with ejson format (all types)', async function () {
        const testDocument = getTestDocumentItem(
          mdbTestExtension.testExtensionController._connectionController.getActiveConnectionId(),
          allBsonTypes,
          'ejson',
        );

        await vscode.commands.executeCommand(
          'mdb.openMongoDBDocumentFromDataBrowser',
          testDocument,
        );

        const document: vscode.TextDocument =
          showTextDocumentSpy.firstCall.args[0];
        const content = document.getText();

        expect(content).to.equal(allBSONTypesStringifiedEJSON);
      });
    });
  });
});
