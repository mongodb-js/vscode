import * as assert from 'assert';

import * as vscode from 'vscode';

import { registerCommands, launchMongoShell } from '../../commands';

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

    registerCommands(mockExtensionContext);

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

    launchMongoShell();
  });
});
