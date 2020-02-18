import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';

import ConnectionController from '../../connectionController';
import MDBExtensionController from '../../mdbExtensionController';

import { StatusView } from '../../views';

import { TestExtensionContext } from './stubs';

const testDatabaseURI = 'mongodb://localhost';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const disposables: vscode.Disposable[] = [];

  teardown(() => {
    disposables.forEach(d => d.dispose());
    disposables.length = 0;
  });

  test('commands are registered in vscode', done => {
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController();
    disposables.push(mockMDBExtension);

    mockMDBExtension.activate(mockExtensionContext);

    vscode.commands
      .getCommands()
      .then(registeredCommands => {
        const expectedCommands = [
          'mdb.connect',
          'mdb.connectWithURI',
          'mdb.disconnect',
          'mdb.removeConnection',
          'mdb.openMongoDBShell'
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

    const mockMDBExtension = new MDBExtensionController();

    mockMDBExtension.openMongoDBShell();
  });

  test('extension connections', () => {
    before(require('mongodb-runner/mocha/before'));
    after(require('mongodb-runner/mocha/after'));

    test('when the extension is deactivated, the active connection is disconnected', (done) => {
      const testConnectionController = new ConnectionController(new StatusView());

      const mockMDBExtension = new MDBExtensionController(
        testConnectionController
      );
      disposables.push(mockMDBExtension);

      const mockExtensionContext = new TestExtensionContext();
      mockMDBExtension.activate(mockExtensionContext);

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
