import * as assert from 'assert';
import * as vscode from 'vscode';
import { after } from 'mocha';

import ConnectionController, {
  DataServiceEventTypes
} from '../../connectionController';
import { StorageController, StorageVariables } from '../../storage';
import { StorageScope, DefaultSavingLocations } from '../../storage/storageController';
import { StatusView } from '../../views';
import MDBExtensionController from '../../mdbExtensionController';

import { TestExtensionContext } from './stubs';

const testDatabaseURI = 'mongodb://localhost:27018';
const testDatabaseInstanceId = 'localhost:27018';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

suite('Connection Controller Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);

  after(() => {
    // Reset our mock extension's state.
    mockExtensionContext._workspaceState = {};
    mockExtensionContext._globalState = {};
  });

  test('it connects to mongodb', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful connection response.'
        );
        assert(
          Object.keys(testConnectionController.getConnections()).length === 1,
          'Expected there to be 1 connection in the connection list.'
        );
        const instanceId = testConnectionController.getActiveConnectionInstanceId();
        assert(
          instanceId === 'localhost:27018',
          `Expected active connection to be 'localhost:27018' found ${instanceId}`
        );
      })
      .then(done, done);
  });

  test('"disconnect()" disconnects from the active connection', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .disconnect()
          .then(successfullyDisconnected => {
            assert(
              successfullyDisconnected === true,
              'Expected a successful (true) disconnect response.'
            );
            // Disconnecting should keep the connection contract, just disconnected.
            const connectionsCount = Object.keys(
              testConnectionController.getConnections()
            ).length;
            assert(
              connectionsCount === 1,
              `Expected the amount of connections to be 1 found ${connectionsCount}.`
            );
            const instanceId = testConnectionController.getActiveConnectionInstanceId();
            assert(
              instanceId === null,
              `Expected the active connection instance id to be null, found ${instanceId}`
            );
          })
          .then(done, done);
      });
  });

  test('when the extension is deactivated, the active connection is disconnected', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    const mockMDBExtension = new MDBExtensionController(
      mockExtensionContext,
      testConnectionController
    );

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

        assert(
          testConnectionController.getActiveConnection() === null,
          'Expected active connection to be null.'
        );
      }, done).then(done, done);
  });

  test('"removeMongoDBConnection()" returns a reject promise when there is no active connection', done => {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController
      .onRemoveMongoDBConnection()
      .then(null, err => {
        assert(!!err, `Expected an error response, recieved ${err}.`);
      })
      .then(done, done);
  });

  test('"disconnect()" fails when there is no active connection', done => {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController
      .disconnect()
      .then(null, err => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('when adding a new connection it disconnects from the current connection', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .addNewConnectionAndConnect(testDatabaseURI2WithTimeout)
          .then(null, err => {
            assert(!!err, 'Expected an error promise response.');
            assert(
              testConnectionController.getActiveConnection() === null,
              'Expected to current connection to be null (not connected).'
            );
            assert(
              testConnectionController.getActiveConnectionInstanceId() === null,
              'Expected to current connection instanceId to be null (not connected).'
            );
          })
          .then(done, done);
      });
  });

  test('when adding a new connection it disconnects from the current connection', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );
    this.timeout(2000);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(succesfullyConnected => {
        assert(
          succesfullyConnected === true,
          'Expected a successful (true) connection response.'
        );

        testConnectionController
          .addNewConnectionAndConnect(testDatabaseURI2WithTimeout)
          .then(null, err => {
            assert(!!err, 'Expected an error promise response.');
            assert(
              testConnectionController.getActiveConnection() === null,
              'Expected to current connection to be null (not connected).'
            );
            assert(
              testConnectionController.getActiveConnectionInstanceId() === null,
              'Expected to current connection instanceId to be null (not connected).'
            );
          })
          .then(done, done);
      });
  });

  test('"connect()" failed when we are currently connecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setConnnecting(true);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(null, err => {
        assert(!!err, 'Expected an error promise response.');
      })
      .then(done, done);
  });

  test('"connect()" failed when we are currently disconnecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setDisconnecting(true);

    testConnectionController
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(null, err => {
        assert(!!err, 'Expected an error promise response.');
      })
      .then(done, done);
  });

  test('"disconnect()" fails when we are currently connecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setConnnecting(true);

    testConnectionController
      .disconnect()
      .then(null, err => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('"disconnect()" fails when we are currently disconnecting', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
      mockStorageController
    );

    testConnectionController.setDisconnecting(true);

    testConnectionController
      .disconnect()
      .then(null, err => {
        assert(!!err, 'Expected an error disconnect response.');
      })
      .then(done, done);
  });

  test('"connect()" should fire a CONNECTIONS_DID_CHANGE event', function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
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
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        setTimeout(function () {
          assert(
            didFireConnectionEvent === true,
            'Expected connection event to be fired.'
          );
          done();
        }, 150);
      });
  });

  const expectedTimesToFire = 3;
  test(`"connect()" then "disconnect()" should fire the connections did change event ${expectedTimesToFire} times`, function (done) {
    const testConnectionController = new ConnectionController(
      new StatusView(),
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
      .addNewConnectionAndConnect(testDatabaseURI)
      .then(() => {
        testConnectionController.disconnect().then(() => {
          setTimeout(function () {
            assert(
              connectionEventFiredCount === expectedTimesToFire,
              `Expected connection event to be fired ${expectedTimesToFire} times, got ${connectionEventFiredCount}.`
            );
            done();
          }, 150);
        });
      });
  });

  test('when there are no existing connections in the store and the connection controller is activated', function () {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();
    assert(
      Object.keys(testConnectionController.getConnections()).length === 0,
      `Expected connections to be 0 found ${Object.keys(testConnectionController.getConnections()).length}`
    );
  });

  test('When activated, the connection model loads both global and workspace stored connection models', function () {
    const testExtensionContext = new TestExtensionContext();
    // Set existing connections.
    testExtensionContext.globalState.update(
      StorageVariables.GLOBAL_CONNECTION_STRINGS,
      {
        'testGlobalConnectionModel': 'testGlobalConnectionModelDriverUrl',
        'testGlobalConnectionModel2': 'testGlobalConnectionModel2DriverUrl'
      }
    );
    testExtensionContext.workspaceState.update(
      StorageVariables.WORKSPACE_CONNECTION_STRINGS,
      {
        'testWorkspaceConnectionModel': 'testWorkspaceConnectionModel1DriverUrl',
        'testWorkspaceConnectionModel2': 'testWorkspaceConnectionModel2DriverUrl'
      }
    );
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();

    const connections = testConnectionController.getConnections();
    assert(
      Object.keys(connections).length === 4,
      `Expected 4 connection configurations found ${Object.keys(testConnectionController.getConnections()).length}`
    );
    assert(
      Object.keys(connections).includes('testGlobalConnectionModel2') === true,
      'Expected connection configurations to include \'testGlobalConnectionModel2\''
    );
    assert(
      Object.keys(connections).includes('testWorkspaceConnectionModel2') === true,
      'Expected connection configurations to include \'testWorkspaceConnectionModel2\''
    );
    assert(
      connections.testGlobalConnectionModel2.hostname === 'testglobalconnectionmodel2driverurl',
      'Expected connection configuration to include hostname \'testglobalconnectionmodel2driverurl\''
    );
  });

  test('When a connection is added it is saved to the global store', async function () {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();

    await vscode.workspace.getConfiguration('mdb.connectionSaving').update(
      'defaultConnectionSavingLocation',
      DefaultSavingLocations.Global
    );

    await testConnectionController.addNewConnectionAndConnect(testDatabaseURI);

    const globalStoreConnections = testStorageController.get(StorageVariables.GLOBAL_CONNECTION_STRINGS);
    assert(
      Object.keys(globalStoreConnections).length === 1,
      `Expected global store connections to have 1 connection found ${Object.keys(globalStoreConnections).length}`
    );
    assert(
      Object.keys(globalStoreConnections).includes(testDatabaseInstanceId),
      `Expected global store connections to have the new connection '${testDatabaseInstanceId}' found ${Object.keys(globalStoreConnections)}`
    );

    const workspaceStoreConnections = testStorageController.get(StorageVariables.WORKSPACE_CONNECTION_STRINGS);
    assert(
      workspaceStoreConnections === undefined,
      `Expected workspace store connections to be 'undefined' found ${workspaceStoreConnections}`
    );
  });

  test('When a connection is added it is saved to the workspace store', async function () {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();

    await vscode.workspace.getConfiguration('mdb.connectionSaving').update(
      'defaultConnectionSavingLocation',
      DefaultSavingLocations.Workspace
    );

    await testConnectionController.addNewConnectionAndConnect(testDatabaseURI);

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_CONNECTION_STRINGS,
      StorageScope.WORKSPACE
    );

    assert(
      Object.keys(workspaceStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${Object.keys(workspaceStoreConnections).length}`
    );
    assert(
      Object.keys(workspaceStoreConnections).includes(testDatabaseInstanceId),
      `Expected workspace store connections to have the new connection '${testDatabaseInstanceId}' found ${Object.keys(workspaceStoreConnections)}`
    );

    const globalStoreConnections = testStorageController.get(StorageVariables.GLOBAL_CONNECTION_STRINGS);
    assert(
      globalStoreConnections === undefined,
      `Expected global store connections to be 'undefined' found ${globalStoreConnections}`
    );
  });

  test('A saved connection can be loaded and connected to', function (done) {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();

    vscode.workspace.getConfiguration('mdb.connectionSaving').update(
      'defaultConnectionSavingLocation',
      DefaultSavingLocations.Workspace
    ).then(() => {
      testConnectionController
        .addNewConnectionAndConnect(testDatabaseURI)
        .then(() => {
          const workspaceStoreConnections = testStorageController.get(
            StorageVariables.WORKSPACE_CONNECTION_STRINGS,
            StorageScope.WORKSPACE
          );
          assert(
            Object.keys(workspaceStoreConnections).length === 1,
            `Expected workspace store connections to have 1 connection found ${Object.keys(workspaceStoreConnections).length}`
          );

          testConnectionController.disconnect().then(() => {
            testConnectionController.clearConnectionConfigs();
            assert(
              testConnectionController.getConnectionInstanceIds().length === 0,
              'Expected no connection configs.'
            );

            // Activate (which will load the past connection).
            testConnectionController.activate();
            assert(
              testConnectionController.getConnectionInstanceIds().length === 1,
              `Expected 1 connection config, found ${testConnectionController.getConnectionInstanceIds().length}.`
            );

            testConnectionController
              .connectWithInstanceId(testDatabaseInstanceId)
              .then(() => {
                const { instanceId } = testConnectionController.getActiveConnectionConfig().getAttributes({
                  derived: true
                });
                assert(
                  instanceId === 'localhost:27018',
                  `Expected the active connection to be 'localhost:27018', found ${instanceId}.`
                );
              }).then(done, done);
          });
        });
    });
  });

  test('When a connection is added and the user has set it to not save on default it is not saved', function (done) {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();
    // Don't save connections on default.
    vscode.workspace.getConfiguration('mdb.connectionSaving').update(
      'defaultConnectionSavingLocation',
      DefaultSavingLocations['Session Only']
    ).then(() => {
      testConnectionController
        .addNewConnectionAndConnect(testDatabaseURI)
        .then(() => {
          const objectString = JSON.stringify(undefined);
          const globalStoreConnections = testStorageController.get(
            StorageVariables.GLOBAL_CONNECTION_STRINGS
          );
          assert(
            JSON.stringify(globalStoreConnections) === objectString,
            `Expected global store connections to be an empty object found ${globalStoreConnections}`
          );

          const workspaceStoreConnections = testStorageController.get(
            StorageVariables.WORKSPACE_CONNECTION_STRINGS,
            StorageScope.WORKSPACE
          );
          assert(
            JSON.stringify(workspaceStoreConnections) === objectString,
            `Expected workspace store connections to be an empty object found ${JSON.stringify(workspaceStoreConnections)}`
          );
        }).then(done).catch(done);
    }, done);
  });

  test('When a connection is removed it is also removed from workspace storage', function (done) {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();

    vscode.workspace.getConfiguration('mdb.connectionSaving').update(
      'defaultConnectionSavingLocation',
      DefaultSavingLocations.Workspace
    ).then(() => {
      testConnectionController
        .addNewConnectionAndConnect(testDatabaseURI)
        .then(() => {
          const workspaceStoreConnections = testStorageController.get(
            StorageVariables.WORKSPACE_CONNECTION_STRINGS,
            StorageScope.WORKSPACE
          );

          assert(
            Object.keys(workspaceStoreConnections).length === 1,
            `Expected workspace store connections to have 1 connection found ${Object.keys(workspaceStoreConnections).length}`
          );

          testConnectionController.removeConnectionConfig(testDatabaseInstanceId);

          const postWorkspaceStoreConnections = testStorageController.get(
            StorageVariables.WORKSPACE_CONNECTION_STRINGS,
            StorageScope.WORKSPACE
          );
          assert(
            Object.keys(postWorkspaceStoreConnections).length === 0,
            `Expected workspace store connections to have 0 connections found ${Object.keys(postWorkspaceStoreConnections).length}`
          );
        }).then(done, done);
    });
  });

  test('When a connection is removed it is also removed from global storage', async function () {
    const testExtensionContext = new TestExtensionContext();
    const testStorageController = new StorageController(testExtensionContext);

    const testConnectionController = new ConnectionController(
      new StatusView(),
      testStorageController
    );

    testConnectionController.activate();

    await vscode.workspace.getConfiguration('mdb.connectionSaving').update(
      'defaultConnectionSavingLocation',
      DefaultSavingLocations.Global
    );

    await testConnectionController.addNewConnectionAndConnect(testDatabaseURI);
    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_CONNECTION_STRINGS
    );

    assert(
      Object.keys(globalStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${Object.keys(globalStoreConnections).length}`
    );

    testConnectionController.removeConnectionConfig(testDatabaseInstanceId);

    const postGlobalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_CONNECTION_STRINGS
    );
    assert(
      Object.keys(postGlobalStoreConnections).length === 0,
      `Expected global store connections to have 0 connections found ${Object.keys(postGlobalStoreConnections).length}`
    );
  });
});
