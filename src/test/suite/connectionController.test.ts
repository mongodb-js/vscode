import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import * as sinon from 'sinon';
import Connection = require('mongodb-connection-model/lib/model');
import TelemetryController from '../../telemetry/telemetryController';
import ConnectionController, {
  DataServiceEventTypes
} from '../../connectionController';
import { StorageController, StorageVariables } from '../../storage';
import {
  StorageScope,
  DefaultSavingLocations
} from '../../storage/storageController';
import { StatusView } from '../../views';
import MDBExtensionController from '../../mdbExtensionController';
import { TestExtensionContext } from './stubs';
import { TEST_DATABASE_URI } from './dbTestHelper';

const testDatabaseInstanceId = 'localhost:27018';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Connection Controller Test Suite', () => {
  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  beforeEach(async () => {
    await vscode.workspace
      .getConfiguration('mdb')
      .update('sendTelemetry', false);
    // Here we stub the showInformationMessage process because it is too much
    // for the render process and leads to crashes while testing.
    sinon.replace(vscode.window, 'showInformationMessage', sinon.stub());
  });

  afterEach(() => {
    // Reset our mock extension's state.
    mockExtensionContext._workspaceState = {};
    mockExtensionContext._globalState = {};
    sinon.restore();
  });

  test('it connects to mongodb', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );
        assert(
          testConnectionController.getSavedConnections().length === 1,
          'Expected there to be 1 connection in the connection list.'
        );
        const connnectionId =
          testConnectionController.getActiveConnectionId() || '';
        const name = testConnectionController._connections[connnectionId].name;
        assert(
          name === 'localhost:27018',
          `Expected active connection to be 'localhost:27018' found ${name}`
        );
        const connectionModel = testConnectionController.getActiveConnectionModel();
        assert(connectionModel !== null);
        assert(
          connectionModel?.getAttributes({
            derived: true
          }).instanceId === 'localhost:27018'
        );
        const dataService = testConnectionController.getActiveDataService();
        assert(dataService !== null);
        assert(
          testConnectionController._activeConnectionModel?.appname.startsWith(
            'mongodb-vscode'
          )
        );
        assert(testConnectionController.isCurrentlyConnected());
      })
      .then(done, done);
  });

  test('"disconnect()" disconnects from the active connection', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .disconnect()
          .then((successfullyDisconnected) => {
            assert(
              successfullyDisconnected === true,
              'Expected a successful (true) disconnect response.'
            );
            // Disconnecting should keep the connection contract, just disconnected.
            const connectionsCount = testConnectionController.getSavedConnections()
              .length;
            assert(
              connectionsCount === 1,
              `Expected the amount of connections to be 1 found ${connectionsCount}.`
            );
            const connnectionId = testConnectionController.getActiveConnectionId();
            assert(
              connnectionId === null,
              `Expected the active connection id to be null, found ${connnectionId}`
            );
            const connectionModel = testConnectionController.getActiveConnectionModel();
            assert(connectionModel === null);
            const dataService = testConnectionController.getActiveDataService();
            assert(dataService === null);
            assert(!testConnectionController.isCurrentlyConnected());
          })
          .then(done, done);
      });
  });

  test('when the extension is deactivated, the active connection is disconnected', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(async (succesfullyConnected) => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );
        assert(
          testConnectionController.getActiveDataService() !== null,
          'Expected active data service to not be null.'
        );
        assert(
          testConnectionController.getActiveConnectionId() !== null,
          'Expected active connection id to not be null.'
        );

        await testConnectionController.disconnect();

        assert(
          testConnectionController.getActiveDataService() === null,
          'Expected active data service to be null.'
        );
        assert(
          testConnectionController.getActiveConnectionId() === null,
          'Expected active connection id to be null.'
        );
      }, done)
      .then(done, done);
  });

  test('"removeMongoDBConnection()" returns a reject promise when there is no active connection', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController
      .onRemoveMongoDBConnection()
      .then(null, (err) => {
        assert(!!err, `Expected an error response, recieved ${err}.`);
      })
      .then(done, done);
  });

  test('"disconnect()" fails when there is no active connection', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController
      .disconnect()
      .then(null, (err) => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('it errors when disconnecting with no active connection', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );
    const fakeVscodeErrorMessage = sinon.fake();

    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    testConnectionController
      .disconnect()
      .then((disconnectSucceeded) => {
        assert(
          disconnectSucceeded === false,
          'Expected an false success disconnect response.'
        );
        const expectedMessage = 'Unable to disconnect: no active connection.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected error message "${expectedMessage}" when disconnecting with no active connection, recieved "${fakeVscodeErrorMessage.firstArg}"`
        );
      })
      .then(done, done);
  });

  test('when adding a new connection it disconnects from the current connection', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
        assert(
          succesfullyConnected,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .addNewConnectionStringAndConnect(testDatabaseURI2WithTimeout)
          .then(
            () => {
              assert(false, 'Expected rejected promise, not resolved.');
            },
            (error) => {
              const expectedError = 'Failed to connect';
              assert(
                error.message.includes(expectedError),
                `Expected error with message: ${expectedError}, got: ${error.message}`
              );
              assert(
                testConnectionController.getActiveDataService() === null,
                'Expected to current connection to be null (not connected).'
              );
              assert(
                testConnectionController.getActiveConnectionId() === null,
                'Expected to current connection instanceId to be null (not connected).'
              );
            }
          )
          .then(done, done);
      });
  });

  test('"connect()" failed when we are currently connecting', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.setConnnecting(true);

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(
        () => {
          assert(false, 'Expected rejected promise, not resolved.');
        },
        (error) => {
          const expectedMessage = 'Unable to connect: already connecting.';
          assert(
            error.message === expectedMessage,
            `Expected "${expectedMessage}" when connecting when already connecting, recieved "${error.message}"`
          );
        }
      )
      .then(done, done);
  });

  test('"connect()" failed when we are currently disconnecting', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.setDisconnecting(true);

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(
        () => {
          assert(false, 'Expected rejected promise, not resolved.');
        },
        (error) => {
          const expectedMessage = 'Unable to connect: currently disconnecting.';
          assert(
            error.message === expectedMessage,
            `Expected "${expectedMessage}" when connecting while disconnecting, recieved "${error.message}"`
          );
        }
      )
      .then(done, done);
  });

  test('"disconnect()" fails when we are currently connecting', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.setConnnecting(true);

    const fakeVscodeErrorMessage = sinon.fake();

    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    testConnectionController
      .disconnect()
      .then((disconnectSucceeded) => {
        assert(
          disconnectSucceeded === false,
          'Expected the disconnect to return a false succeeded response'
        );
        const expectedMessage =
          'Unable to disconnect: currently connecting to an instance.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected "${expectedMessage}" when disconnecting while connecting, recieved "${fakeVscodeErrorMessage.firstArg}"`
        );
      })
      .then(done, done);
  });

  test('"disconnect()" fails when we are currently disconnecting', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.setDisconnecting(true);

    const fakeVscodeErrorMessage = sinon.fake();

    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    testConnectionController
      .disconnect()
      .then((disconnectSucceeded) => {
        assert(
          disconnectSucceeded === false,
          'Expected the disconnect to return a false succeeded response'
        );
        const expectedMessage =
          'Unable to disconnect: already disconnecting from an instance.';
        assert(
          fakeVscodeErrorMessage.firstArg === expectedMessage,
          `Expected "${expectedMessage}" when disconnecting while already disconnecting, recieved "${fakeVscodeErrorMessage.firstArg}"`
        );
      })
      .then(done, done);
  });

  test('"connect()" should fire a CONNECTIONS_DID_CHANGE event', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );
    let didFireConnectionEvent = false;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        didFireConnectionEvent = true;
      }
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        setTimeout(() => {
          assert(
            didFireConnectionEvent === true,
            'Expected connection event to be fired.'
          );
          done();
        }, 150);
      });
  });

  const expectedTimesToFire = 3;

  test(`"connect()" then "disconnect()" should fire the connections did change event ${expectedTimesToFire} times`, (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );
    let connectionEventFiredCount = 0;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        connectionEventFiredCount++;
      }
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then(() => {
        testConnectionController.disconnect().then(() => {
          setTimeout(() => {
            assert(
              connectionEventFiredCount === expectedTimesToFire,
              `Expected connection event to be fired ${expectedTimesToFire} times, got ${connectionEventFiredCount}.`
            );
            done();
          }, 150);
        });
      });
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    await testConnectionController.loadSavedConnections();

    const connectionsCount = testConnectionController.getSavedConnections()
      .length;

    assert(
      connectionsCount === 0,
      `Expected connections to be 0 found ${connectionsCount}`
    );
  });

  test('The connection model loads both global and workspace stored connection models', async () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();
    await testConnectionController.loadSavedConnections();
    const connections = testConnectionController._connections;
    assert(
      Object.keys(connections).length === 4,
      `Expected 4 connection configurations found ${
        Object.keys(connections).length
      }`
    );
    assert(
      connections[Object.keys(connections)[0]].name === 'localhost:27018',
      "Expected loaded connection to include name 'localhost:27018'"
    );
    const expectedDriverUri =
      'mongodb://localhost:27018/?readPreference=primary&ssl=false';
    assert(
      connections[Object.keys(connections)[2]].driverUrl === expectedDriverUri,
      `Expected loaded connection to include driver url '${expectedDriverUri}' found '${
        connections[Object.keys(connections)[2]].driverUrl
      }'`
    );
  });

  test('When a connection is added it is saved to the global store', async () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      Object.keys(globalStoreConnections).length === 1,
      `Expected global store connections to have 1 connection found ${
        Object.keys(globalStoreConnections).length
      }`
    );
    const id = Object.keys(globalStoreConnections)[0];
    assert(
      globalStoreConnections[id].name === testDatabaseInstanceId,
      `Expected global stored connection to have correct name '${testDatabaseInstanceId}' found ${globalStoreConnections[id].name}`
    );
    const workspaceStoreConnections = mockStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS
    );
    assert(
      workspaceStoreConnections === undefined,
      `Expected workspace store connections to be 'undefined' found ${workspaceStoreConnections}`
    );
  });

  test('When a connection is added it is saved to the workspace store', async () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.loadSavedConnections();

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    const workspaceStoreConnections = mockStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageScope.WORKSPACE
    );
    assert(
      Object.keys(workspaceStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${
        Object.keys(workspaceStoreConnections).length
      }`
    );
    const id = Object.keys(workspaceStoreConnections)[0];
    assert(
      workspaceStoreConnections[id].name === testDatabaseInstanceId,
      `Expected workspace stored connection to have correct name '${testDatabaseInstanceId}' found ${workspaceStoreConnections[id].name}`
    );
    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      globalStoreConnections === undefined,
      `Expected global store connections to be 'undefined' found ${globalStoreConnections}`
    );
  });

  test('A connection can be connected to by id', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    Connection.from(TEST_DATABASE_URI, (err, connectionModel) => {
      if (err) {
        assert(false);
      }

      testConnectionController._connections = {
        '25': {
          id: '25',
          driverUrl: TEST_DATABASE_URI,
          name: 'tester',
          connectionModel,
          storageLocation: StorageScope.NONE
        }
      };

      testConnectionController
        .connectWithConnectionId('25')
        .then((successfulConnection) => {
          assert(successfulConnection);
          assert(testConnectionController.getActiveConnectionId() === '25');
          testConnectionController.disconnect();

          done();
        });
    });
  });

  test('A saved connection can be loaded and connected to', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.loadSavedConnections().then(() => {
      vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update(
          'defaultConnectionSavingLocation',
          DefaultSavingLocations.Workspace
        )
        .then(() => {
          testConnectionController
            .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
            .then(() => {
              const workspaceStoreConnections = mockStorageController.get(
                StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
                StorageScope.WORKSPACE
              );
              assert(
                Object.keys(workspaceStoreConnections).length === 1,
                `Expected workspace store connections to have 1 connection found ${
                  Object.keys(workspaceStoreConnections).length
                }`
              );

              testConnectionController
                .disconnect()
                .then(() => {
                  testConnectionController.clearAllConnections();
                  assert(
                    testConnectionController.getSavedConnections().length === 0,
                    'Expected no connection configs.'
                  );

                  // Activate (which will load the past connection).
                  testConnectionController.loadSavedConnections().then(() => {
                    assert(
                      testConnectionController.getSavedConnections().length ===
                        1,
                      `Expected 1 connection config, found ${
                        testConnectionController.getSavedConnections().length
                      }.`
                    );
                    const id = testConnectionController.getSavedConnections()[0]
                      .id;

                    testConnectionController
                      .connectWithConnectionId(id)
                      .then(() => {
                        const activeId = testConnectionController.getActiveConnectionId();
                        const name =
                          testConnectionController._connections[activeId || '']
                            .name;
                        assert(
                          activeId === id,
                          `Expected the active connection to be '${id}', found ${activeId}.`
                        );
                        assert(
                          name === 'localhost:27018',
                          `Expected the active connection name to be 'localhost:27018', found ${name}.`
                        );
                        const port =
                          testConnectionController._connections[activeId || '']
                            .connectionModel.port;
                        assert(
                          port === 27018,
                          `Expected the active connection port to be '27018', found ${port}.`
                        );
                      }, done)
                      .then(done, done);
                  });
                })
                .then(null, done);
            })
            .then(null, done);
        });
    });
  });

  test('"getConnectionStringFromConnectionId" returns the driver uri of a connection', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );
    const expectedDriverUri =
      'mongodb://localhost:27018/?readPreference=primary&ssl=false';

    testConnectionController.loadSavedConnections().then(() => {
      testConnectionController
        .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
        .then(() => {
          const activeConnectionId = testConnectionController.getActiveConnectionId();
          assert(
            activeConnectionId !== null,
            'Expected active connection to not be null'
          );
          const testDriverUri = testConnectionController.getConnectionStringFromConnectionId(
            activeConnectionId || ''
          );
          assert(
            testDriverUri === expectedDriverUri,
            `Expected to be returned the driver uri "${expectedDriverUri}" found ${testDriverUri}`
          );
        })
        .then(done, done);
    });
  });

  test('When a connection is added and the user has set it to not save on default it is not saved', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.loadSavedConnections().then(() => {
      // Don't save connections on default.
      vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update(
          'defaultConnectionSavingLocation',
          DefaultSavingLocations['Session Only']
        )
        .then(() => {
          // Updating a setting sometimes takes a bit on vscode, and it doesnt
          // return a usable promise. Timeout to ensure it sets.
          setTimeout(() => {
            testConnectionController
              .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
              .then(() => {
                const objectString = JSON.stringify(undefined);
                const globalStoreConnections = mockStorageController.get(
                  StorageVariables.GLOBAL_SAVED_CONNECTIONS
                );
                assert(
                  JSON.stringify(globalStoreConnections) === objectString,
                  `Expected global store connections to be an empty object found ${globalStoreConnections}`
                );
                const workspaceStoreConnections = mockStorageController.get(
                  StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
                  StorageScope.WORKSPACE
                );
                assert(
                  JSON.stringify(workspaceStoreConnections) === objectString,
                  `Expected workspace store connections to be an empty object found ${JSON.stringify(
                    workspaceStoreConnections
                  )}`
                );
              })
              .then(done)
              .catch(done);
          }, 50);
        }, done);
    });
  });

  test('When a connection is removed it is also removed from workspace storage', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.loadSavedConnections().then(() => {
      vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update(
          'defaultConnectionSavingLocation',
          DefaultSavingLocations.Workspace
        )
        .then(() => {
          // Updating a setting sometimes takes a bit on vscode, and it doesnt
          // return a usable promise. Timeout to ensure it sets.
          setTimeout(() => {
            testConnectionController
              .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
              .then(async () => {
                const workspaceStoreConnections = mockStorageController.get(
                  StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
                  StorageScope.WORKSPACE
                );
                assert(
                  Object.keys(workspaceStoreConnections).length === 1,
                  `Expected workspace store connections to have 1 connection found ${
                    Object.keys(workspaceStoreConnections).length
                  }`
                );
                const connectionId =
                  testConnectionController.getActiveConnectionId() || 'a';
                testConnectionController.disconnect();
                await testConnectionController.removeSavedConnection(
                  connectionId
                );
                const postWorkspaceStoreConnections = mockStorageController.get(
                  StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
                  StorageScope.WORKSPACE
                );
                assert(
                  Object.keys(postWorkspaceStoreConnections).length === 0,
                  `Expected workspace store connections to have 0 connections found ${
                    Object.keys(postWorkspaceStoreConnections).length
                  }`
                );
              })
              .then(done, done);
          }, 50);
        });
    });
  });

  test('When a connection is removed it is also removed from global storage', async () => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      Object.keys(globalStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${
        Object.keys(globalStoreConnections).length
      }`
    );
    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';
    await testConnectionController.removeSavedConnection(connectionId);
    const postGlobalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      Object.keys(postGlobalStoreConnections).length === 0,
      `Expected global store connections to have 0 connections found ${
        Object.keys(postGlobalStoreConnections).length
      }`
    );
  });

  test('A saved connection can be renamed and loaded', (done) => {
    const testTelemetryController = new TelemetryController(
      mockStorageController,
      mockExtensionContext
    );
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController,
      testTelemetryController
    );

    testConnectionController.loadSavedConnections().then(() => {
      vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update(
          'defaultConnectionSavingLocation',
          DefaultSavingLocations.Workspace
        )
        .then(() => {
          // Updating a setting sometimes takes a bit on vscode, and it doesnt
          // return a usable promise. Timeout to ensure it sets.
          setTimeout(() => {
            testConnectionController
              .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
              .then(() => {
                const workspaceStoreConnections = mockStorageController.get(
                  StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
                  StorageScope.WORKSPACE
                );
                assert(
                  Object.keys(workspaceStoreConnections).length === 1,
                  `Expected workspace store connections to have 1 connection found ${
                    Object.keys(workspaceStoreConnections).length
                  }`
                );
                const connectionId =
                  testConnectionController.getActiveConnectionId() || 'zz';
                const mockInputBoxResolves = sinon.stub();
                mockInputBoxResolves.onCall(0).resolves('new connection name');
                sinon.replace(
                  vscode.window,
                  'showInputBox',
                  mockInputBoxResolves
                );
                testConnectionController
                  .renameConnection(connectionId)
                  .then((renameSuccess) => {
                    assert(renameSuccess);

                    testConnectionController.disconnect().then(() => {
                      testConnectionController.clearAllConnections();
                      assert(
                        testConnectionController.getSavedConnections()
                          .length === 0,
                        'Expected no saved connection.'
                      );

                      // Activate (which will load the past connection).
                      testConnectionController
                        .loadSavedConnections()
                        .then(() => {
                          assert(
                            testConnectionController.getSavedConnections()
                              .length === 1,
                            `Expected 1 connection config, found ${
                              testConnectionController.getSavedConnections()
                                .length
                            }.`
                          );
                          const id = testConnectionController.getSavedConnections()[0]
                            .id;
                          const name =
                            testConnectionController._connections[id || 'x']
                              .name;
                          assert(
                            name === 'new connection name',
                            `Expected the active connection name to be 'new connection name', found '${name}'.`
                          );
                        })
                        .then(done, done);
                    }, done);
                  }, done);
              }, done);
          }, 50);
        }, done);
    });
  });
});
