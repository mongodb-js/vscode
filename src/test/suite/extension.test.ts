import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';
import * as sinon from 'sinon';

import MDBExtensionController from '../../mdbExtensionController';

import { TestExtensionContext } from './stubs';
import { TEST_DATABASE_URI } from './dbTestHelper';
import ConnectionController from '../../connectionController';
import { StorageController } from '../../storage';
import { StatusView } from '../../views';
import TelemetryController from '../../telemetry/telemetryController';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const disposables: vscode.Disposable[] = [];
  const mockExtensionContext = new TestExtensionContext();
  const mockMDBExtension = new MDBExtensionController(mockExtensionContext);
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryController = new TelemetryController(
    mockStorageController,
    mockExtensionContext
  );
  const testConnectionController = new ConnectionController(
    new StatusView(mockExtensionContext),
    mockStorageController,
    testTelemetryController
  );
  const sandbox = sinon.createSandbox();
  let fakeShowErrorMessage: any;

  before(() => {
    sandbox.stub(vscode.window, 'showInformationMessage');
    fakeShowErrorMessage = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  after(() => {
    disposables.forEach((d) => d.dispose());
    disposables.length = 0;
    sandbox.restore();
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
    const errorMessage =
      'You need to be connected before launching the MongoDB Shell.';

    fakeShowErrorMessage.resolves(errorMessage);

    mockMDBExtension
      .openMongoDBShell()
      .then((didOpenShell) => {
        assert(didOpenShell === false);
        sinon.assert.calledWith(fakeShowErrorMessage, errorMessage);
      })
      .then(done, done);
  });

  test('openMongoDBShell should open a terminal with the active connection driver url', (done) => {
    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );

        mockMDBExtension
          .openMongoDBShell()
          .then(() => {
            const spyActiveConnectionDriverUrl = sinon.spy(
              testConnectionController,
              'getActiveConnectionDriverUrl'
            );
            const createTerminalSpy = sinon.spy(
              vscode.window,
              'createTerminal'
            );

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
                      createTerminalSpy.getCall(0).args[0].env
                        .MDB_CONNECTION_STRING
                    }`
                  );
                } catch (e) {
                  done(e);
                  return;
                }

                done();
              })
            );
          })
          .then(done, done);
      });
  });
});
