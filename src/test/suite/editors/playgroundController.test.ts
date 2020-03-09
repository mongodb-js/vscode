import * as vscode from 'vscode';
import ConnectionController from '../../../connectionController';
import { StatusView } from '../../../views';
import { StorageController } from '../../../storage';
import { TestExtensionContext } from '../stubs';

const chai = require('chai')
const expect = chai.expect

chai.use(require('chai-as-promised'))

import { PlaygroundController } from '../../../editors';

const sinon = require('sinon');

suite('Playground Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  suite('when connection controller is undefined', () => {
    test('evaluate should throw the missing connection controller error', async () => {
      const testPlaygroundController = new PlaygroundController();

      expect(testPlaygroundController.evaluate('1 + 1')).to.be.rejectedWith(Error, 'No connection controller.');
    });
  });

  suite('when user is not connected', () => {
    test('evaluate should throw the missing active connection error', async () => {
      const testConnectionController = new ConnectionController(
        new StatusView(mockExtensionContext),
        mockStorageController
      );
      const testPlaygroundController = new PlaygroundController();

      testPlaygroundController.activate(testConnectionController);

      expect(testPlaygroundController.evaluate('1 + 1')).to.be.rejectedWith(Error, 'Please connect to a database before running a playground.');

      testPlaygroundController.deactivate();
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
    const testPlaygroundController = new PlaygroundController();

    test('evaluate should sum numbers', async () => {
      testConnectionController.setActiveConnection(mockActiveConnection);
      testPlaygroundController.activate(testConnectionController);

      expect(await testPlaygroundController.evaluate('1 + 1')).to.be.equal('2');

      testPlaygroundController.deactivate();
    });
  });
});
