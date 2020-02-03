import * as assert from 'assert';

import * as vscode from 'vscode';

import MDBExtensionController from '../../mdb';

import { TestExtensionContext } from './stubs';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  let disposables: vscode.Disposable[] = [];

  teardown(() => {
    disposables.forEach(d => d.dispose());
    disposables.length = 0;
  });

  test('commands are registered in vscode', done => {
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController();

    mockMDBExtension.activate(mockExtensionContext);

    vscode.commands.getCommands().then(registeredCommands => {
      const expectedCommands = [
        'mdb.connect',
        'mdb.addConnection',
        'mdb.connectWithURI',
        'mdb.addConnectionWithURI',
        'mdb.removeConnection',
        'mdb.launchShell'
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

      done();
    });
  });

  test('launchMongoShell should open a terminal', done => {
    disposables.push(vscode.window.onDidOpenTerminal(() => {
      done();
    }));

    const mockExtensionContext = new TestExtensionContext();
    const mockMDBExtension = new MDBExtensionController();

    mockMDBExtension.launchMongoShell();
  });

  /**
   * Connection tests to write:
   * - Connect to a database.
   * - Connect to multiple databases.
   * - Connect to multiple databases and ensure only 1 is live.
   * - Ensure status bar shows text when connecting & disconnecting.
   * - Disconnect from a database.
   * - Disconnect from 2nd database on connection list and ensure that one dcs.
   * - Disconnect from active database connection.
   * - Try to disconnect while connecting.
   * - Try to connect while disconnecting.
   */
});
