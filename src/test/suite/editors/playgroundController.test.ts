import * as vscode from 'vscode';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';

import { TestExtensionContext } from '../stubs';
import { before, after } from 'mocha';
import { MockLanguageServerController } from '../../helper/playgroundHelper';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const CONNECTION = {
  driverUrl: 'mongodb://localhost:27018',
  driverOptions: {}
};

suite('Playground Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    new StatusView(mockExtensionContext),
    mockStorageController
  );
  const mockLanguageServerController = new MockLanguageServerController(
    mockExtensionContext,
    mockStorageController
  );
  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    mockLanguageServerController as LanguageServerController
  );
  const sandbox = sinon.createSandbox();
  let fakeShowInformationMessage: any;
  let fakeShowErrorMessage: any;

  before(async () => {
    fakeShowInformationMessage = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );
    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  after(() => {
    sandbox.restore();
  });

  suite('user is not connected', () => {
    before(() => {
      testConnectionController.getActiveConnectionName = sinon.fake.returns('');
      testConnectionController.getActiveConnectionModel = sinon.fake.returns(
        null
      );
    });

    after(() => {
      sinon.restore();
    });

    test('runAllPlaygroundBlocks should throw the missing active connection error', async () => {
      const errorMessage =
        'Please connect to a database before running a playground.';

      fakeShowErrorMessage.resolves(errorMessage);

      await testPlaygroundController.runAllPlaygroundBlocks();

      expect(fakeShowErrorMessage.called).to.be.true;
    });
  });

  suite('user is connected and gets confirmation message', () => {
    before(async () => {
      testConnectionController.getActiveConnectionName = sinon.fake.returns(
        'fakeName'
      );
      testConnectionController.getActiveConnectionModel = sinon.fake.returns({
        appname: 'VSCode Playground Tests',
        port: 27018,
        disconnect: () => {},
        getAttributes: () => CONNECTION
      });

      await testPlaygroundController.connectToServiceProvider();
    });

    after(() => {
      sinon.restore();
    });

    test('show a confirmation message before running commands in a playground if mdb.confirmRunAll is true', async () => {
      fakeShowInformationMessage.resolves('Yes');

      const result = await testPlaygroundController.runAllPlaygroundBlocks();

      expect(result).to.be.true;
    });

    test('do not run a playground if user selected No in the confirmation message', async () => {
      fakeShowInformationMessage.resolves('No');

      const result = await testPlaygroundController.runAllPlaygroundBlocks();

      expect(result).to.be.false;
    });

    test('show a confirmation message before running commands in a playground if mdb.confirmRunAll is false', async () => {
      await vscode.workspace
        .getConfiguration('mdb')
        .update('confirmRunAll', false);

      const result = await testPlaygroundController.runAllPlaygroundBlocks();

      expect(result).to.be.true;
    });
  });

  suite('prepare telemetry types', () => {
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
  });
});
