import * as assert from 'assert';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import * as sinon from 'sinon';
import Connection = require('mongodb-connection-model/lib/model');

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

  beforeEach(() => {
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
        const name =
          testConnectionController._connections[connnectionId].name;
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );

    const mockMDBExtension = new MDBExtensionController(
      mockExtensionContext,
      testConnectionController
    );

    testConnectionController
      .addNewConnectionStringAndConnect(TEST_DATABASE_URI)
      .then((succesfullyConnected) => {
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

        mockMDBExtension.deactivate();

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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );

    testConnectionController
      .onRemoveMongoDBConnection()
      .then(null, (err) => {
        assert(!!err, `Expected an error response, recieved ${err}.`);
      })
      .then(done, done);
  });

  test('"disconnect()" fails when there is no active connection', (done) => {
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
    );

    testConnectionController
      .disconnect()
      .then(null, (err) => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('it errors when disconnecting with no active connection', (done) => {
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      mockStorageController
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

  test('when there are no existing connections in the store and the connection controller loads connections', () => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();
    const connectionsCount = testConnectionController.getSavedConnections()
      .length;
    assert(
      connectionsCount === 0,
      `Expected connections to be 0 found ${connectionsCount}`
    );
  });

  test('The connection model loads both global and workspace stored connection models', () => {
    const testExtensionContext = new TestExtensionContext();
    // Set existing connections.
    testExtensionContext.globalState.update(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      {
        testGlobalConnectionModel: {
          id: 'testGlobalConnectionModel',
          name: 'name1',
          connectionModel: new Connection({ port: 29999 }),
          driverUrl: 'testGlobalConnectionModelDriverUrl'
        },
        testGlobalConnectionModel2: {
          id: 'testGlobalConnectionModel2',
          name: 'name2',
          connectionModel: new Connection({ port: 30000 }),
          driverUrl: 'testGlobalConnectionModel2DriverUrl'
        }
      }
    );
    testExtensionContext.workspaceState.update(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      {
        testWorkspaceConnectionModel: {
          id: 'testWorkspaceConnectionModel',
          name: 'name3',
          connectionModel: new Connection({ port: 29999 }),

          driverUrl: 'testWorkspaceConnectionModel1DriverUrl'
        },
        testWorkspaceConnectionModel2: {
          id: 'testWorkspaceConnectionModel2',
          name: 'name4',
          connectionModel: new Connection({ port: 22345 }),
          driverUrl: 'testWorkspaceConnectionModel2DriverUrl'
        }
      }
    );
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

    const connections = testConnectionController._connections;
    assert(
      Object.keys(connections).length === 4,
      `Expected 4 connection configurations found ${
        Object.keys(connections).length
      }`
    );
    assert(
      Object.keys(connections).includes('testGlobalConnectionModel2') === true,
      "Expected connection configurations to include 'testGlobalConnectionModel2'"
    );
    assert(
      Object.keys(connections).includes('testWorkspaceConnectionModel2') ===
        true,
      "Expected connection configurations to include 'testWorkspaceConnectionModel2'"
    );
    assert(
      connections.testGlobalConnectionModel2.name === 'name2',
      "Expected loaded connection to include name 'testglobalconnectionmodel2driverurl'"
    );
    assert(
      connections.testGlobalConnectionModel2.driverUrl ===
        'testGlobalConnectionModel2DriverUrl',
      "Expected loaded connection to include driver url 'testGlobalConnectionModel2DriverUrl'"
    );
    assert(
      connections.testWorkspaceConnectionModel2.connectionModel.port === 22345,
      `Expected loaded connection to include port number 30000, found ${connections.testWorkspaceConnectionModel2.connectionModel.port}`
    );
    assert(
      connections.testGlobalConnectionModel2.connectionModel.port === 30000,
      `Expected loaded connection to include port number 30000, found ${connections.testGlobalConnectionModel2.connectionModel.port}`
    );
  });

  test('When a connection is added it is saved to the global store', async () => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = testStorageController.get(
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

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS
    );
    assert(
      workspaceStoreConnections === undefined,
      `Expected workspace store connections to be 'undefined' found ${workspaceStoreConnections}`
    );
  });

  test('When a connection is added it is saved to the workspace store', async () => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
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

    const workspaceStoreConnections = testStorageController.get(
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

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS
    );
    assert(
      globalStoreConnections === undefined,
      `Expected global store connections to be 'undefined' found ${globalStoreConnections}`
    );
  });

  test('A connection can be connected to by id', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);
    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
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
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

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
            const workspaceStoreConnections = testStorageController.get(
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
                testConnectionController.loadSavedConnections();
                assert(
                  testConnectionController.getSavedConnections().length === 1,
                  `Expected 1 connection config, found ${
                    testConnectionController.getSavedConnections().length
                  }.`
                );
                const id = testConnectionController.getSavedConnections()[0].id;

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
              })
              .then(null, done);
          })
          .then(null, done);
      });
  });

  test('"getConnectionStringFromConnectionId" returns the driver uri of a connection', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

    const expectedDriverUri =
      'mongodb://localhost:27018/?readPreference=primary&ssl=false';

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

  test('When a connection is added and the user has set it to not save on default it is not saved', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();
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
              const globalStoreConnections = testStorageController.get(
                StorageVariables.GLOBAL_SAVED_CONNECTIONS
              );
              assert(
                JSON.stringify(globalStoreConnections) === objectString,
                `Expected global store connections to be an empty object found ${globalStoreConnections}`
              );

              const workspaceStoreConnections = testStorageController.get(
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

  test('When a connection is removed it is also removed from workspace storage', (done) => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

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
              const workspaceStoreConnections = testStorageController.get(
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
              await testConnectionController.removeSavedConnection(connectionId);

              const postWorkspaceStoreConnections = testStorageController.get(
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

  test('When a connection is removed it is also removed from global storage', async () => {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    const globalStoreConnections = testStorageController.get(
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

    const postGlobalStoreConnections = testStorageController.get(
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
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(mockExtensionContext),
      testStorageController
    );

    testConnectionController.loadSavedConnections();

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
              const workspaceStoreConnections = testStorageController.get(
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

                  testConnectionController
                    .disconnect()
                    .then(() => {
                      testConnectionController.clearAllConnections();
                      assert(
                        testConnectionController.getSavedConnections()
                          .length === 0,
                        'Expected no saved connection.'
                      );

                      // Activate (which will load the past connection).
                      testConnectionController.loadSavedConnections();
                      assert(
                        testConnectionController.getSavedConnections()
                          .length === 1,
                        `Expected 1 connection config, found ${
                          testConnectionController.getSavedConnections().length
                        }.`
                      );
                      const id = testConnectionController.getSavedConnections()[0]
                        .id;

                      const name =
                        testConnectionController._connections[id || 'x']
                          .name;
                      assert(
                        name === 'new connection name',
                        `Expected the active connection name to be 'localhost:27018', found ${name}.`
                      );
                    })
                    .then(done, done);
                }, done);
            }, done);
        }, 50);
      }, done);
  });
});
