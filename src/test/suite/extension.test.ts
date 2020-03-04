import * as assert from 'assert';
import * as vscode from 'vscode';
import { after } from 'mocha';

import MDBExtensionController from '../../mdbExtensionController';

import { TestExtensionContext } from './stubs';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const disposables: vscode.Disposable[] = [];

  after(() => {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;
  });

  test('commands are registered in vscode', (done) => {
    vscode.commands
      .getCommands()
      .then((registeredCommands) => {
        const expectedCommands = [
          'mdb.connect',
          'mdb.connectWithURI',
          'mdb.disconnect',
          'mdb.removeConnection',
          'mdb.openMongoDBShell',
          'mdb.createPlayground',
          'mdb.viewCollectionDocuments',
          'mdb.refresh',
          'mdb.reload',
          'mdb.codeLens.showMoreDocumentsClicked'
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

  test('openMongoDBShell should open a terminal', done => {
    disposables.push(vscode.window.onDidOpenTerminal(() => done()));
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController(mockExtensionContext);

    mockMDBExtension.openMongoDBShell();
  });

  test('createPlayground should create a MongoDB playground', (done) => {
    disposables.push(vscode.workspace.onDidOpenTextDocument(() => done()));
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController(mockExtensionContext);

    mockMDBExtension.createPlayground();
  });
});
