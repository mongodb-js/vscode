import * as vscode from 'vscode';
import { PlaygroundController } from '../../../editors';
import { LanguageServerController } from '../../../language';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';
import { before, after } from 'mocha';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;

chai.use(require('chai-as-promised'));

const CONNECTION = {
  driverUrl: 'mongodb://localhost:27018',
  driverOptions: {}
};

suite('Language Server Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();

  mockExtensionContext.extensionPath = '../../';

  const mockStorageController = new StorageController(mockExtensionContext);
  const testLanguageServerController = new LanguageServerController(
    mockExtensionContext,
    mockStorageController
  );

  testLanguageServerController.activate();

  const testConnectionController = new ConnectionController(
    new StatusView(mockExtensionContext),
    mockStorageController
  );

  const testPlaygroundController = new PlaygroundController(
    mockExtensionContext,
    testConnectionController,
    testLanguageServerController
  );

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

  test('cancel a long-running script', async () => {
    testLanguageServerController.executeAll(`
      const names = [
        "flour",
        "butter",
        "water",
        "salt",
        "onions",
        "leek"
      ];
      let currentName = '';
      names.forEach((name) => {
        setTimeout(() => {
          currentName = name;
        }, 500);
      });
      currentName
    `);

    await testLanguageServerController.cancelAll();

    const result = await testLanguageServerController.executeAll('4 + 4');

    expect(result).to.be.equal('8');
  });
});
