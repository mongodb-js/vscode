import * as vscode from 'vscode';
import * as path from 'path';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { ObjectId } from 'bson';
import {
  seedDataAndCreateDataService,
  cleanupTestDB
} from '../dbTestHelper';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

let doc: vscode.TextDocument;
let editor: vscode.TextEditor;

const getDocUri = (docName: string) => {
  const docPath = path.resolve(__dirname, '../../../../src/test/fixture', docName);

  return vscode.Uri.file(docPath);
};

/**
 * Opens the MongoDB playground
 */
export async function openPlayground(docUri: vscode.Uri) {
  try {
    doc = await vscode.workspace.openTextDocument(docUri);
    editor = await vscode.window.showTextDocument(doc);
  } catch (e) {
    console.error(e);
  }
}

suite('Playground Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  const sandbox = sinon.createSandbox();

  suite('when user is not connected', () => {
    test('evaluate should throw the missing active connection error', async () => {
      const testConnectionController = new ConnectionController(
        new StatusView(mockExtensionContext),
        mockStorageController
      );
      const testLanguageServerController = new LanguageServerController(mockExtensionContext, testConnectionController);
      const testPlaygroundController = new PlaygroundController(mockExtensionContext, testConnectionController, testLanguageServerController);

      expect(testPlaygroundController.evaluate('1 + 1')).to.be.rejectedWith(Error, 'Please connect to a database before running a playground.');
    });
  });

  suite('when user is connected', () => {
    const mockActiveConnection = {
      find: (namespace, filter, options, callback): void => {
        return callback(null, ['Text message']);
      },
      client: {}
    };
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );
    const testLanguageServerController = new LanguageServerController(mockExtensionContext, testConnectionController);
    testConnectionController.getActiveConnectionName = () => 'fakeName';
    testConnectionController.getActiveConnectionDriverUrl = () => 'mongodb://localhost:27018';

    const testPlaygroundController = new PlaygroundController(mockExtensionContext, testConnectionController, testLanguageServerController);

    test('evaluate should sum numbers', async function () {
      await openPlayground(getDocUri('test.mongodb'));

      testConnectionController.setActiveConnection(mockActiveConnection);

      expect(await testPlaygroundController.evaluate('1 + 1')).to.be.equal('2');
    });

    test('evaluate multiple commands at once', async () => {
      await openPlayground(getDocUri('test.mongodb'));

      testConnectionController.setActiveConnection(mockActiveConnection);

      expect(await testPlaygroundController.evaluate(`
        var x = 1;
        x + 2
      `)).to.be.equal('3');
    });

    test('evaluate interaction with a database', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f8ab'),
        example: 'field'
      };

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          await openPlayground(getDocUri('test.mongodb'));

          const actualResult = await testPlaygroundController.evaluate(`
            use('vscodeTestDatabaseAA');
            db.forest.find({})
          `);
          const expectedResult = '[\n' +
            '  {\n' +
            '    _id: \'5e32b4d67bf47f4525f2f8ab\',\n' +
            '    example: \'field\'\n' +
            '  }\n' +
            ']';

          expect(actualResult).to.be.equal(expectedResult);
        }
      ).then(done, done).finally(async () => { await cleanupTestDB() });
    });

    test('convert AggregationCursor shellApiType to aggregation telemetry type', () => {
      const res = { shellApiType: 'AggregationCursor' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'aggregation' });
    });

    test('convert BulkWriteResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'BulkWriteResult' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('convert Collection shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Collection' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('convert Cursor shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Cursor' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'query' });
    });

    test('convert Database shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Database' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('convert DeleteResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'DeleteResult' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'delete' });
    });

    test('convert InsertManyResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'InsertManyResult' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'insert' });
    });

    test('convert InsertOneResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'InsertOneResult' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'insert' });
    });

    test('convert ReplicaSet shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'ReplicaSet' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('convert Shard shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'Shard' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('convert ShellApi shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'ShellApi' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'UpdateResult' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'update' });
    });

    test('convert UpdateResult shellApiType to other telemetry type', () => {
      const res = { shellApiType: 'UpdateResult' };
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'update' });
    });

    test('return other telemetry type if evaluation returns a string', () => {
      const res = '2';
      const type = testPlaygroundController.prepareTelemetry(res);

      expect(type).to.deep.equal({ type: 'other' });
    });

    test('create a new playground instance for each run', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f777'),
        valueOfTheField: 'is not important'
      };
      const codeToEvaluate = `
        const x = 1;
        x + 1
      `;

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          await testPlaygroundController.evaluate(codeToEvaluate);

          const result = await testPlaygroundController.evaluate(codeToEvaluate);

          expect(result).to.be.equal('2');
        }
      ).then(done, done).finally(async () => { await cleanupTestDB() });
    });

    test('show a confirmation message before running commands in a playground if mdb.confirmRunAll is true', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f8ab'),
        example: 'field'
      };
      const fakeShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');

      fakeShowInformationMessage.returns('Yes');

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          await testPlaygroundController.runAllPlaygroundBlocks();

          const expectedMessage =
            'Are you sure you want to run this playground against fakeName? This confirmation can be disabled in the extension settings.';

          expect(fakeShowInformationMessage.calledOnce).to.be.true;
          expect(fakeShowInformationMessage.calledWith(expectedMessage)).to.be.true;
        }
      ).then(done, done).finally(async () => {
        sandbox.restore();
        await cleanupTestDB()
      });
    });

    test('show a confirmation message before running commands in a playground if mdb.confirmRunAll is false', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f8ab'),
        example: 'field'
      };
      const fakeShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');

      fakeShowInformationMessage.returns('Yes');

      seedDataAndCreateDataService('forest', [mockDocument]).then(
        async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          await vscode.workspace
            .getConfiguration('mdb')
            .update('confirmRunAll', false);
          await testPlaygroundController.runAllPlaygroundBlocks();

          expect(fakeShowInformationMessage.calledOnce).to.be.false;
          fakeShowInformationMessage.restore();

          await cleanupTestDB();
        }
      ).then(done, done).finally(async () => {
        sandbox.restore();
        await cleanupTestDB()
      });
    });
  });
});
