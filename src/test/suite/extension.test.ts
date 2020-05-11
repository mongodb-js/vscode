import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach } from 'mocha';
import * as sinon from 'sinon';

import MDBExtensionController from '../../mdbExtensionController';

import { TestExtensionContext } from './stubs';
import { TEST_DATABASE_URI } from './dbTestHelper';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const disposables: vscode.Disposable[] = [];

  afterEach(() => {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;

    sinon.restore();
  });

  test('commands are registered in vscode', (done) => {
    vscode.commands
      .getCommands()
      .then((registeredCommands) => {
        const expectedCommands = [
          // General / connection commands.
          'mdb.connect',
          'mdb.connectWithURI',
          'mdb.disconnect',
          'mdb.removeConnection',
          'mdb.openMongoDBShell',
          'mdb.createPlayground',
          'mdb.createNewPlaygroundFromViewAction',

          // Tree view commands.
          'mdb.addConnection',
          'mdb.addConnectionWithURI',
          'mdb.copyConnectionString',
          'mdb.treeItemRemoveConnection',
          'mdb.addDatabase',
          'mdb.refreshConnection',
          'mdb.copyDatabaseName',
          'mdb.refreshDatabase',
          'mdb.addCollection',
          'mdb.viewCollectionDocuments',
          'mdb.copyCollectionName',
          'mdb.refreshCollection',
          'mdb.refreshSchema',

          // Editor commands.
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

  test('openMongoDBShell should display an error message when not connected', (done) => {
    const mockExtensionContext = new TestExtensionContext();

    const fakeVscodeErrorMessage = sinon.fake();
    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    const mockMDBExtension = new MDBExtensionController(mockExtensionContext);

    mockMDBExtension
      .openMongoDBShell()
      .then((didOpenShell) => {
        assert(didOpenShell === false);
        assert(
          fakeVscodeErrorMessage.firstArg ===
            'You need to be connected before launching the MongoDB Shell.'
        );
      })
      .then(done, done);
  });

  test('openMongoDBShell should open a terminal with the active connection driver url', (done) => {
    const mockExtensionContext = new TestExtensionContext();

    const mockMDBExtension = new MDBExtensionController(mockExtensionContext);
    const testConnectionController = mockMDBExtension._connectionController;

    const fakeVscodeInfoMessage = sinon.fake();

    sinon.replace(
      vscode.window,
      'showInformationMessage',
      fakeVscodeInfoMessage
    );
    sinon.replace(
      testConnectionController._telemetryController,
      'track',
      () => {}
    );
    sinon.replace(testConnectionController, 'getCloudInfoFromDataService', () =>
      Promise.resolve()
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );

        const spyActiveConnectionDriverUrl = sinon.spy(
          testConnectionController,
          'getActiveConnectionDriverUrl'
        );
        const createTerminalSpy = sinon.spy(vscode.window, 'createTerminal');

        disposables.push(
          vscode.window.onDidOpenTerminal(() => {
            testConnectionController.disconnect();

            try {
              assert(spyActiveConnectionDriverUrl.called);
              assert(createTerminalSpy.called);
              const expectedUri =
                'mongodb://localhost:27018/?readPreference=primary&ssl=false';
              assert(
                createTerminalSpy.getCall(0).args[0].env
                  .MDB_CONNECTION_STRING === expectedUri,
                `Expected open terminal to set env var 'MDB_CONNECTION_STRING' to ${expectedUri} found ${
                  createTerminalSpy.getCall(0).args[0].env.MDB_CONNECTION_STRING
                }`
              );
            } catch (e) {
              done(e);
              return;
            }

            done();
          })
        );

        mockMDBExtension.openMongoDBShell();
      });
  });
});
