import * as vscode from 'vscode';
import * as path from 'path';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { ObjectId } from 'bson';
import { seedDataAndCreateDataService, cleanupTestDB } from '../dbTestHelper';
import { beforeEach, afterEach } from 'mocha';
import { ConnectionModelType } from '../../../connectionModelType';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const getDocUri = (docName: string): vscode.Uri => {
  const docPath = path.resolve(
    __dirname,
    '../../../../src/test/fixture',
    docName
  );

  return vscode.Uri.file(docPath);
};

// Opens the MongoDB playground.
async function openPlayground(docUri: vscode.Uri): Promise<any> {
  try {
    const doc = await vscode.workspace.openTextDocument(docUri);

    await vscode.window.showTextDocument(doc);
  } catch (error) {
    expect(error).to.be.equal(null);
  }
}

suite('Playground Controller Test Suite', async () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  const sandbox = sinon.createSandbox();

  mockExtensionContext.extensionPath = '../../';

  await openPlayground(getDocUri('test.mongodb'));

  suite('when user is not connected', function () {
    afterEach(() => {
      sinon.restore();
    });

    test('runAllPlaygroundBlocks should throw the missing active connection error', async () => {
      const testConnectionController = new ConnectionController(
        new StatusView(mockExtensionContext),
        mockStorageController
      );

      testConnectionController.getActiveConnectionName = (): string => '';
      testConnectionController.getActiveConnectionModel = (): ConnectionModelType | null =>
        null;

      const testLanguageServerController = new LanguageServerController(
        mockExtensionContext
      );
      const testPlaygroundController = new PlaygroundController(
        mockExtensionContext,
        testConnectionController,
        testLanguageServerController
      );
      const fakeVscodeErrorMessage = sinon.fake();

      testLanguageServerController.activate();

      sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

      await testPlaygroundController.runAllPlaygroundBlocks();

      expect(fakeVscodeErrorMessage.firstArg).to.be.equal(
        'Please connect to a database before running a playground.'
      );
    });
  });

  suite('test confirmation message', async () => {
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );

    testConnectionController.getActiveConnectionName = (): string => 'fakeName';
    testConnectionController.getActiveConnectionModel = (): ConnectionModelType => ({
      appname: 'VSCode Playground Tests',
      port: 27018,
      disconnect: () => {},
      getAttributes: () => ({
        driverUrl: 'mongodb://localhost:27018',
        driverOptions: {},
        instanceId: 'localhost:27018'
      })
    });

    const testLanguageServerController = new LanguageServerController(
      mockExtensionContext
    );

    testLanguageServerController.cancelAll = (): Promise<boolean> => {
      return Promise.resolve(false);
    };
    testLanguageServerController.executeAll = (): Promise<boolean> => {
      return Promise.resolve(true);
    };
    testLanguageServerController.activate();

    const testPlaygroundController = new PlaygroundController(
      mockExtensionContext,
      testConnectionController,
      testLanguageServerController
    );
    let fakeShowInformationMessage;

    beforeEach(() => {
      fakeShowInformationMessage = sandbox.stub(
        vscode.window,
        'showInformationMessage'
      );
    });

    afterEach(async () => {
      sandbox.restore();
      await cleanupTestDB();
    });

    test('show a confirmation message before running commands in a playground if mdb.confirmRunAll is true', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f833'),
        example: 'field'
      };

      fakeShowInformationMessage.resolves('Yes');

      seedDataAndCreateDataService('forest', [mockDocument])
        .then(async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          const result = await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.true;
        })
        .then(done, done);
    });

    test('do not run a playground if user selected No in the confirmation message', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f756'),
        example: 'field'
      };

      fakeShowInformationMessage.resolves('No');

      seedDataAndCreateDataService('forest', [mockDocument])
        .then(async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          const result = await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.false;
        })
        .then(done, done);
    });

    test('show a confirmation message before running commands in a playground if mdb.confirmRunAll is false', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f844'),
        example: 'field'
      };

      seedDataAndCreateDataService('forest', [mockDocument])
        .then(async (dataService) => {
          testConnectionController.setActiveConnection(dataService);
          await vscode.workspace
            .getConfiguration('mdb')
            .update('confirmRunAll', false);

          const result = await testPlaygroundController.runAllPlaygroundBlocks();

          expect(result).to.be.true;
        })
        .then(done, done);
    });
  });

  suite('when user is connected', async () => {
    afterEach(async () => {
      await cleanupTestDB();
    });

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );

    testConnectionController.getActiveConnectionName = (): string => 'fakeName';
    testConnectionController.getActiveConnectionModel = (): ConnectionModelType | null => ({
      appname: 'VSCode Playground Tests',
      port: 27018,
      disconnect: () => {},
      getAttributes: () => ({
        driverUrl: 'mongodb://localhost:27018',
        driverOptions: {},
        instanceId: 'localhost:27018'
      })
    });

    const testLanguageServerController = new LanguageServerController(
      mockExtensionContext
    );

    testLanguageServerController.activate();

    const testPlaygroundController = new PlaygroundController(
      mockExtensionContext,
      testConnectionController,
      testLanguageServerController
    );

    test('evaluate should sum numbers', async function () {
      const mockActiveConnection = {
        find: (namespace, filter, options, callback): void => {
          return callback(null, ['Text message']);
        },
        client: {
          _id: new ObjectId('5e32b4d67bf47f4525f2f841'),
          example: 'field'
        }
      };

      testConnectionController.setActiveConnection(mockActiveConnection);

      expect(await testPlaygroundController.evaluate('1 + 1')).to.be.equal('2');
    });

    test('evaluate multiple commands at once', async () => {
      const mockActiveConnection = {
        find: (namespace, filter, options, callback): void => {
          return callback(null, ['Text message']);
        },
        client: {
          _id: new ObjectId('5e32b4d67bf47f4525f2f842'),
          example: 'field'
        }
      };

      testConnectionController.setActiveConnection(mockActiveConnection);

      expect(
        await testPlaygroundController.evaluate(`
        var x = 1;
        x + 2
      `)
      ).to.be.equal('3');
    });

    test('evaluate interaction with a database', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f811'),
        example: 'field'
      };

      seedDataAndCreateDataService('forest', [mockDocument])
        .then(async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          const actualResult = await testPlaygroundController.evaluate(`
            use('vscodeTestDatabaseAA');
            db.forest.find({})
          `);
          const expectedResult =
            '[\n' +
            '  {\n' +
            '    _id: 5e32b4d67bf47f4525f2f811,\n' +
            "    example: 'field'\n" +
            '  }\n' +
            ']';

          expect(actualResult).to.be.equal(expectedResult);
        })
        .then(done, done);
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
        _id: new ObjectId('5e32b4d67bf47f4525f2f722'),
        valueOfTheField: 'is not important'
      };

      seedDataAndCreateDataService('forest', [mockDocument])
        .then(async (dataService) => {
          testConnectionController.setActiveConnection(dataService);

          const firstEvalResult = await testPlaygroundController.evaluate(
            'const x = 1 + 1; x'
          );

          expect(firstEvalResult).to.be.equal('2');

          const secondEvalResult = await testPlaygroundController.evaluate(
            'const x = 2 + 1; x'
          );

          expect(secondEvalResult).to.be.equal('3');
        })
        .then(done, done);
    });

    test('cancel a playground', (done) => {
      const mockDocument = {
        _id: new ObjectId('5e32b4d67bf47f4525f2f729'),
        field: 'sample'
      };

      seedDataAndCreateDataService('forest', [mockDocument])
        .then(async (dataService) => {
          testConnectionController.setActiveConnection(dataService);
          testLanguageServerController.executeAll('while (1===1) {}');

          await testLanguageServerController.cancelAll();

          const result = await testLanguageServerController.executeAll('4 + 4');

          expect(result).to.be.equal('8');
        })
        .then(done, done);
    });
  });
});
