import * as vscode from 'vscode';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { before, after } from 'mocha';
import { openPlayground, getDocUri } from '../utils/playgroundHelper';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const CONNECTION = {
  instanceId: 'localhost:27018',
  driverUrl: 'mongodb://localhost:27018',
  driverOptions: {}
};

suite('Language Server Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
  const testConnectionController = new ConnectionController(
    new StatusView(mockExtensionContext),
    mockStorageController
  );
  const testLanguageServerController = new LanguageServerController(
    mockExtensionContext,
    mockStorageController
  );
  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    testLanguageServerController
  );

  before(async () => {
    await openPlayground(getDocUri('test.mongodb'));
    await testLanguageServerController.activate();
  });

  suite('user is connected and runs math operations in playground', () => {
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

    test('evaluate should sum numbers', async () => {
      const result = await testLanguageServerController.executeAll('1 + 1');

      expect(result).to.be.equal('2');
    });

    test('evaluate multiple commands at once', async () => {
      const result = await testLanguageServerController.executeAll(
        'const x = 1; x + 2'
      );

      expect(result).to.be.equal('3');
    });

    test('create a new playground instance for each run', async () => {
      const firstEvalResult = await testLanguageServerController.executeAll(
        'const x = 1 + 1; x'
      );

      expect(firstEvalResult).to.be.equal('2');

      const secondEvalResult = await testLanguageServerController.executeAll(
        'const x = 2 + 1; x'
      );

      expect(secondEvalResult).to.be.equal('3');
    });

    test('cancel a playground', async () => {
      testLanguageServerController.executeAll('while (1===1) {}');

      await testLanguageServerController.cancelAll();

      const result = await testLanguageServerController.executeAll('4 + 4');

      expect(result).to.be.equal('8');
    });
  });
});
