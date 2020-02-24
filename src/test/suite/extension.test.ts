import * as assert from 'assert';
import * as vscode from 'vscode';

import ConnectionController from '../../connectionController';
import MDBExtensionController from '../../mdbExtensionController';
import { StorageController } from '../../storage';
import { StatusView } from '../../views';

import { TestExtensionContext } from './stubs';

const testDatabaseURI = 'mongodb://localhost:27018';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const disposables: vscode.Disposable[] = [];

  teardown(() => {
    disposables.forEach(d => d.dispose());
    disposables.length = 0;
  });

  test('commands are registered in vscode', done => {
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController(mockExtensionContext);
    disposables.push(mockMDBExtension);

    mockMDBExtension.activate();

    vscode.commands
      .getCommands()
      .then(registeredCommands => {
        const expectedCommands = [
          'mdb.connect',
          'mdb.connectWithURI',
          'mdb.disconnect',
          'mdb.removeConnection',
          'mdb.openMongoDBShell',
          'mdb.viewCollectionDocuments'
        ];

        for (let i = 0; i < expectedCommands.length; i++) {
          try {
            assert.notEqual(
              registeredCommands.indexOf(expectedCommands[i]),
              -1,
              `command ${expectedCommands[i]} not registered and was expected`
            );
          } catch (e) {
            done(e);
            return;
          }
        }
      })
      .then(() => done(), done);
  });

  test('launchMongoShell should open a terminal', done => {
    disposables.push(vscode.window.onDidOpenTerminal(() => done()));
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController(mockExtensionContext);

    mockMDBExtension.openMongoDBShell();
  });

  test('extension connections', () => {
    test('when the extension is deactivated, the active connection is disconnected', (done) => {
      const mockExtensionContext = new TestExtensionContext();
      const mockStorageController = new StorageController(mockExtensionContext);
      const testConnectionController = new ConnectionController(
        new StatusView(),
        mockStorageController
      );

      const mockMDBExtension = new MDBExtensionController(
        mockExtensionContext,
        testConnectionController
      );
      disposables.push(mockMDBExtension);

      mockMDBExtension.activate();

      testConnectionController
        .addNewConnectionAndConnect(testDatabaseURI)
        .then(succesfullyConnected => {
          assert(
            succesfullyConnected === true,
            'Expected a successful (true) connection response.'
          );
          assert(
            testConnectionController.getActiveConnection() !== null,
            'Expected active connection to not be null.'
          );

          mockMDBExtension.deactivate();

          setTimeout(() => {
            assert(
              testConnectionController.getActiveConnection() === null,
              'Expected active connection to be null.'
            );
            done();
          }, 300);
        }, () => {
          assert(false, 'Did not expect extension connection to fail.');
        });
    });
  });
});
