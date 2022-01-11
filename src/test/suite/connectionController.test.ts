import * as sinon from 'sinon';
import * as util from 'util';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import assert from 'assert';
import { DataService } from 'mongodb-data-service';

import AUTH_STRATEGY_VALUES from '../../views/webview-app/connection-model/constants/auth-strategies';
import ConnectionController, {
  DataServiceEventTypes
} from '../../connectionController';
import { StorageController, StorageVariables } from '../../storage';
import {
  StorageLocation,
  DefaultSavingLocations
} from '../../storage/storageController';
import READ_PREFERENCES from '../../views/webview-app/connection-model/constants/read-preferences';
import SSH_TUNNEL_TYPES from '../../views/webview-app/connection-model/constants/ssh-tunnel-types';
import SSL_METHODS from '../../views/webview-app/connection-model/constants/ssl-methods';
import { StatusView } from '../../views';
import TelemetryService from '../../telemetry/telemetryService';
import { TestExtensionContext } from './stubs';
import {
  TEST_DATABASE_URI,
  TEST_DATABASE_URI_USER,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD
} from './dbTestHelper';

const testDatabaseConnectionName = 'localhost:27018';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

const sleep = (ms: number): Promise<void> => {
  return util.promisify(setTimeout)(ms);
};

suite('Connection Controller Test Suite', function () {
  this.timeout(5000);

  const mockExtensionContext = new TestExtensionContext();
  const mockStorageController = new StorageController(mockExtensionContext);
  const testTelemetryService = new TelemetryService(
    mockStorageController,
    mockExtensionContext
  );
  const testConnectionController = new ConnectionController(
    new StatusView(mockExtensionContext),
    mockStorageController,
    testTelemetryService
  );

  beforeEach(() => {
    // Here we stub the showInformationMessage process because it is too much
    // for the render process and leads to crashes while testing.
    sinon.replace(
      vscode.window,
      'showInformationMessage',
      sinon.fake.resolves(true)
    );
  });

  afterEach(async () => {
    // Reset our mock extension's state.
    mockExtensionContext._workspaceState = {};
    mockExtensionContext._globalState = {};

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    sinon.restore();
  });

  test('it connects to mongodb', async () => {
    const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    const connnectionId =
      testConnectionController.getActiveConnectionId() || '';
    const name = testConnectionController._connections[connnectionId].name;
    const dataService = testConnectionController.getActiveDataService();

    assert(
      succesfullyConnected === true,
      'Expected a successful connection response.'
    );
    assert(
      testConnectionController.getSavedConnections().length === 1,
      'Expected there to be 1 connection in the connection list.'
    );
    assert(
      name === 'localhost:27018',
      `Expected active connection to be 'localhost:27018' found ${name}`
    );
    assert(dataService !== null);
    assert(testConnectionController.isCurrentlyConnected());
  });

  test('"disconnect()" disconnects from the active connection', async () => {
    const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    assert(
      succesfullyConnected === true,
      'Expected a successful (true) connection response.'
    );
    assert(testConnectionController.getConnectionStatus() === 'CONNECTED');

    const successfullyDisconnected = await testConnectionController.disconnect();

    // Disconnecting should keep the connection contract, just disconnected.
    const connectionsCount = testConnectionController.getSavedConnections()
      .length;
    const connnectionId = testConnectionController.getActiveConnectionId();
    const dataService = testConnectionController.getActiveDataService();

    assert(testConnectionController.getConnectionStatus() === 'DISCONNECTED');
    assert(
      successfullyDisconnected === true,
      'Expected a successful (true) disconnect response.'
    );
    assert(
      connectionsCount === 1,
      `Expected the amount of connections to be 1 found ${connectionsCount}.`
    );
    assert(
      connnectionId === null,
      `Expected the active connection id to be null, found ${connnectionId}`
    );
    assert(dataService === null);
    assert(!testConnectionController.isCurrentlyConnected());
  });

  test('"removeMongoDBConnection()" returns a reject promise when there is no active connection', async () => {
    try {
      await testConnectionController.onRemoveMongoDBConnection();

      assert(false, 'Expected to error.');
    } catch (error) {
      assert(!!error, `Expected an error response, recieved ${error}.`);
    }
  });

  test('"disconnect()" fails when there is no active connection', async () => {
    const expectedMessage = 'Unable to disconnect: no active connection.';
    const fakeVscodeErrorMessage = sinon.fake();

    sinon.replace(vscode.window, 'showErrorMessage', fakeVscodeErrorMessage);

    try {
      await testConnectionController.disconnect();

      assert(
        fakeVscodeErrorMessage.firstCall.args[0] === expectedMessage,
        `Expected error message "${expectedMessage}" when disconnecting with no active connection, recieved "${fakeVscodeErrorMessage.firstCall.args[0]}"`
      );
    } catch (error) {
      assert(!!error, 'Expected an error disconnect response.');
    }
  });

  test('when adding a new connection it disconnects from the current connection', async () => {
    const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    assert(
      succesfullyConnected,
      'Expected a successful (true) connection response.'
    );

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI2WithTimeout
      );

      assert(false, 'Expected to fail the connection and succeeded.');
    } catch (error) {
      const printableError = error as { message: string };
      const expectedError = 'Failed to connect';

      assert(
        printableError.message.includes(expectedError),
        `Expected error with message: ${expectedError}, got: ${printableError.message}`
      );
      assert(
        testConnectionController.getActiveDataService() === null,
        'Expected to current connection to be null (not connected).'
      );
      assert(
        testConnectionController.getActiveConnectionId() === null,
        'Expected to current connection id to be null (not connected).'
      );
    }
  });

  test('when adding a new connection it sets the connection controller as connecting while it disconnects from the current connection', async () => {
    const succesfullyConnected = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    assert(
      succesfullyConnected,
      'Expected a successful (true) connection response.'
    );

    let wasSetToConnectingWhenDisconnecting = false;
    sinon.replace(testConnectionController, 'disconnect', () => {
      wasSetToConnectingWhenDisconnecting = true;

      return Promise.resolve(true);
    });

    const succesfullyConnected2 = await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    assert(
      succesfullyConnected2,
      'Expected a successful (true) connection response.'
    );

    assert(wasSetToConnectingWhenDisconnecting);
  });

  test('"connect()" should fire a CONNECTIONS_DID_CHANGE event', async () => {
    let isConnectionChanged = false;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        isConnectionChanged = true;
      }
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await sleep(50);

    assert(isConnectionChanged);
  });

  const expectedTimesToFire = 3;

  test(`"connect()" then "disconnect()" should fire the connections did change event ${expectedTimesToFire} times`, async () => {
    let connectionEventFiredCount = 0;

    testConnectionController.addEventListener(
      DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
      () => {
        connectionEventFiredCount++;
      }
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );
    await testConnectionController.disconnect();
    await sleep(500);

    assert(
      connectionEventFiredCount === expectedTimesToFire,
      `Expected connection event to be fired ${expectedTimesToFire} times, got ${connectionEventFiredCount}.`
    );
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    await testConnectionController.loadSavedConnections();

    const connectionsCount = testConnectionController.getSavedConnections()
      .length;

    assert(
      connectionsCount === 0,
      `Expected connections to be 0 found ${connectionsCount}`
    );
  });

  test('the connection model loads both global and workspace stored connection models', async () => {
    const expectedDriverUrl = 'mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0';

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
    assert(
      connections[Object.keys(connections)[2]].connectionOptions?.connectionString ===
      expectedDriverUrl,
      `Expected loaded connection to include driver url '${expectedDriverUrl}' found '${
        connections[Object.keys(connections)[2]].connectionOptions?.connectionString
      }'`
    );
  });

  test('when a connection is added it is saved to the global store', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert(
      Object.keys(globalStoreConnections).length === 1,
      `Expected global store connections to have 1 connection found ${
        Object.keys(globalStoreConnections).length
      }`
    );

    const id = Object.keys(globalStoreConnections)[0];

    assert(
      globalStoreConnections[id].name === testDatabaseConnectionName,
      `Expected global stored connection to have correct name '${testDatabaseConnectionName}' found ${globalStoreConnections[id].name}`
    );

    const workspaceStoreConnections = mockStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS
    );

    assert(
      workspaceStoreConnections === undefined,
      `Expected workspace store connections to be 'undefined' found ${workspaceStoreConnections}`
    );
  });

  test('when a connection is added it is saved to the workspace store', async () => {
    await testConnectionController.loadSavedConnections();
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
      StorageLocation.WORKSPACE
    );

    assert(
      Object.keys(workspaceStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${
        Object.keys(workspaceStoreConnections).length
      }`
    );

    const id = Object.keys(workspaceStoreConnections)[0];

    assert(
      workspaceStoreConnections[id].name === testDatabaseConnectionName,
      `Expected workspace stored connection to have correct name '${testDatabaseConnectionName}' found ${workspaceStoreConnections[id].name}`
    );

    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert(
      globalStoreConnections === undefined,
      `Expected global store connections to be 'undefined' found ${globalStoreConnections}`
    );
  });

  test('a connection can be connected to by id', async () => {
    testConnectionController._connections = {
      '25': {
        id: '25',
        name: 'tester',
        connectionOptions: { connectionString: TEST_DATABASE_URI },
        storageLocation: StorageLocation.NONE
      }
    };

    const successfulConnection = await testConnectionController.connectWithConnectionId(
      '25'
    );

    assert(successfulConnection);
    assert(testConnectionController.getActiveConnectionId() === '25');
  });

  test('a saved connection can be loaded and connected to workspace storage', async () => {
    await testConnectionController.loadSavedConnections();
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
      StorageLocation.WORKSPACE
    );

    assert(
      Object.keys(workspaceStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${
        Object.keys(workspaceStoreConnections).length
      }`
    );

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    assert(
      testConnectionController.getSavedConnections().length === 0,
      'Expected no connection configs.'
    );

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    assert(
      testConnectionController.getSavedConnections().length === 1,
      `Expected 1 connection config, found ${
        testConnectionController.getSavedConnections().length
      }.`
    );

    const id = testConnectionController.getSavedConnections()[0].id;

    await testConnectionController.connectWithConnectionId(id);

    const activeId = testConnectionController.getActiveConnectionId();
    const name = testConnectionController._connections[activeId || ''].name;

    assert(
      activeId === id,
      `Expected the active connection to be '${id}', found ${activeId}.`
    );
    assert(
      name === 'localhost:27018',
      `Expected the active connection name to be 'localhost:27018', found ${name}.`
    );
  });

  test('"copyConnectionStringByConnectionId" returns the driver uri of a connection', async () => {
    const expectedDriverUrl = 'mongodb://localhost:27018/';

    await testConnectionController.loadSavedConnections();
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const activeConnectionId = testConnectionController.getActiveConnectionId();

    assert(
      activeConnectionId !== null,
      'Expected active connection to not be null'
    );

    const testDriverUrl = testConnectionController.copyConnectionStringByConnectionId(
      activeConnectionId || ''
    );

    assert(
      testDriverUrl === expectedDriverUrl,
      `Expected to be returned the driver uri "${expectedDriverUrl}" found ${testDriverUrl}`
    );
  });

  test('when a connection is added and the user has set it to not save on default it is not saved', async () => {
    await testConnectionController.loadSavedConnections();

    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations['Session Only']
      );
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const objectString = JSON.stringify(undefined);
    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert(
      JSON.stringify(globalStoreConnections) === objectString,
      `Expected global store connections to be an empty object found ${globalStoreConnections}`
    );

    const workspaceStoreConnections = mockStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert(
      JSON.stringify(workspaceStoreConnections) === objectString,
      `Expected workspace store connections to be an empty object found ${JSON.stringify(
        workspaceStoreConnections
      )}`
    );
  });

  test('when a connection is removed it is also removed from workspace storage', async () => {
    await testConnectionController.loadSavedConnections();
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
      StorageLocation.WORKSPACE
    );

    assert(
      Object.keys(workspaceStoreConnections).length === 1,
      `Expected workspace store connections to have 1 connection found ${
        Object.keys(workspaceStoreConnections).length
      }`
    );

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';

    await testConnectionController.disconnect();
    await testConnectionController.removeSavedConnection(connectionId);

    const postWorkspaceStoreConnections = mockStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert(
      Object.keys(postWorkspaceStoreConnections).length === 0,
      `Expected workspace store connections to have 0 connections found ${
        Object.keys(postWorkspaceStoreConnections).length
      }`
    );
  });

  test('when a connection is removed it is also removed from global store', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = mockStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
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
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert(
      Object.keys(postGlobalStoreConnections).length === 0,
      `Expected global store connections to have 0 connections found ${
        Object.keys(postGlobalStoreConnections).length
      }`
    );
  });

  test('a saved to workspace connection can be renamed and loaded', async () => {
    await testConnectionController.loadSavedConnections();
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
      StorageLocation.WORKSPACE
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
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionId
    );

    assert(renameSuccess);

    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    assert(
      testConnectionController.getSavedConnections().length === 0,
      'Expected no saved connection.'
    );

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    assert(
      testConnectionController.getSavedConnections().length === 1,
      `Expected 1 connection config, found ${
        testConnectionController.getSavedConnections().length
      }.`
    );

    const id = testConnectionController.getSavedConnections()[0].id;
    const name = testConnectionController._connections[id || 'x'].name;

    assert(
      name === 'new connection name',
      `Expected the active connection name to be 'new connection name', found '${name}'.`
    );
  });

  test('СonnectionQuickPicks workspace connections list is displayed in the alphanumerical case insensitive order', async () => {
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

    let connections = testConnectionController._connections;
    const connectionIds = Object.keys(connections);

    assert(
      connectionIds.length === 2,
      `Expected 2 connection configurations found ${connectionIds.length}`
    );
    assert(
      connections[connectionIds[0]].name === 'localhost:27018',
      `Expected the first connection name to be 'localhost:27018', found '${
        connections[connectionIds[0]].name
      }'.`
    );
    assert(
      connections[connectionIds[1]].name === 'localhost:27018',
      `Expected the second connection name to be 'localhost:27018', found '${
        connections[connectionIds[1]].name
      }'.`
    );

    const mockInputBoxResolves = sinon.stub();

    mockInputBoxResolves.onCall(0).resolves('Lynx');
    sinon.replace(vscode.window, 'showInputBox', mockInputBoxResolves);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionIds[0]
    );

    assert(renameSuccess);

    await testConnectionController.loadSavedConnections();

    connections = testConnectionController._connections;

    assert(
      connectionIds.length === 2,
      `Expected 2 connection configurations found ${connectionIds.length}`
    );

    const connectionQuickPicks = testConnectionController.getСonnectionQuickPicks();

    assert(
      connectionQuickPicks.length === 3,
      `Expected 3 connections found ${connectionIds.length} in connectionQuickPicks`
    );
    assert(
      connectionQuickPicks[0].label === 'Add new connection',
      `Expected the first quick pick label to be 'Add new connection', found '${connectionQuickPicks[0].label}'.`
    );
    assert(
      connectionQuickPicks[1].label === 'localhost:27018',
      `Expected the second quick pick label to be 'localhost:27018', found '${connectionQuickPicks[1].label}'.`
    );
    assert(
      connectionQuickPicks[2].label === 'Lynx',
      `Expected the third quick pick labele to be 'Lynx', found '${connectionQuickPicks[2].label}'.`
    );
  });

  suite('connecting to a new connection when already connecting', () => {
    test('connects to the new connection', async () => {
      void testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI2WithTimeout
      );

      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      assert(!testConnectionController.isConnecting());

      // Ensure the first connection completes.
      await sleep(1050);

      assert(testConnectionController.isCurrentlyConnected());
      assert(
        testConnectionController.getActiveConnectionName() === 'localhost:27018'
      );
    });

    test('updates the connecting version on each new connection attempt', async () => {
      assert(testConnectionController.getConnectingVersion() === null);
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      const currentConnectingVersion = testConnectionController.getConnectingVersion();

      assert(currentConnectingVersion !== null);
      assert(
        currentConnectingVersion ===
          testConnectionController._connections[
            Object.keys(testConnectionController._connections)[0]
          ].id
      );

      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );
      assert(
        testConnectionController.getConnectingVersion() !==
          currentConnectingVersion
      );
    });

    test('it only connects to the most recent connection attempt', async () => {
      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        testConnectionController._connections[id] = {
          id,
          name: `test${i}`,
          connectionOptions: { connectionString: TEST_DATABASE_URI },
          storageLocation: StorageLocation.NONE
        };
      }

      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        void testConnectionController.connectWithConnectionId(id);
      }

      // Ensure the connections complete.
      await sleep(1000);

      assert(!testConnectionController.isConnecting());
      assert(testConnectionController.isCurrentlyConnected());
      assert(testConnectionController.getActiveConnectionName() === 'test4');
    });
  });

  test('two disconnects on one connection at once', async () => {
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    try {
      void testConnectionController.disconnect();
      void testConnectionController.disconnect();
    } catch (err) {
      assert(
        false,
        `Expected not to error when disconnecting multiple times, recieved: ${err}`
      );
    }

    // Ensure the disconnects complete.
    await sleep(100);

    assert(!testConnectionController.isCurrentlyConnected());
    assert(testConnectionController.getActiveDataService() === null);
  });

  test('a connection which fails can be removed while it is being connected to', async () => {
    const connectionId = 'skateboard';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionOptions: { connectionString: testDatabaseURI2WithTimeout },
      storageLocation: StorageLocation.NONE
    };

    void testConnectionController.connectWithConnectionId(connectionId);

    // Ensure the connection starts but doesn't time out yet.
    await sleep(250);

    assert(testConnectionController.isConnecting());
    assert(testConnectionController.getConnectionStatus() === 'CONNECTING');

    await testConnectionController.removeSavedConnection(connectionId);

    // Wait for the connection to timeout and complete (and not error in the process).
    await sleep(1000);
  });

  test('a successfully connecting connection can be removed while it is being connected to', async () => {
    const connectionId = 'skateboard2';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionOptions: { connectionString: TEST_DATABASE_URI },
      storageLocation: StorageLocation.NONE
    };

    sinon.replace(
      DataService.prototype,
      'connect',
      sinon.fake(async (callback) => {
        await sleep(50);

        return callback(null, DataService);
      })
    );

    void testConnectionController.connectWithConnectionId(connectionId);

    // Ensure the connection attempt has started.
    await sleep(10);

    assert(testConnectionController.isConnecting());

    await testConnectionController.removeSavedConnection(connectionId);

    // Wait for the connection to timeout and complete (and not error in the process).
    await sleep(250);

    assert(
      !testConnectionController.isCurrentlyConnected(),
      'Did not expect to connect to the connection which was removed.'
    );
  });

  suite('secrets', () => {
    test('_migratePreviouslySavedConnection converts an old previously saved connection model without secrets to a new connection info format', async () => {
      const oldSavedConnectionInfo = {
        id: '1d700f37-ba57-4568-9552-0ea23effea89',
        name: 'localhost:27017',
        storageLocation: StorageLocation.GLOBAL,
        connectionModel: {
          isSrvRecord: false,
          hostname: 'localhost',
          port: 27017,
          hosts: [{ host: 'localhost', port: 27017 }],
          extraOptions: {},
          connectionType: 'NODE_DRIVER',
          authStrategy: 'NONE',
          readPreference: 'primary',
          kerberosCanonicalizeHostname: false,
          sslMethod: 'NONE',
          sshTunnel: 'NONE',
          sshTunnelPort: 22
        }
      };
      const newSavedConnectionInfoWithSecrets = await testConnectionController._migratePreviouslySavedConnection(oldSavedConnectionInfo);

      assert.deepStrictEqual(
        newSavedConnectionInfoWithSecrets,
        {
          id: '1d700f37-ba57-4568-9552-0ea23effea89',
          name: 'localhost:27017',
          storageLocation: 'GLOBAL',
          connectionOptions: {
            connectionString: 'mongodb://localhost:27017/?readPreference=primary&ssl=false'
          }
        }
      );
    });

    test('_migratePreviouslySavedConnection converts an old previously saved connection model with secrets to a new connection info format', async () => {
      const oldSavedConnectionInfo = {
        id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
        name: 'host.u88dd.test.test',
        storageLocation: StorageLocation.WORKSPACE,
        connectionModel: {
          ns: 'test',
          isSrvRecord: true,
          hostname: 'compass-data-sets.e06dc.mongodb.net',
          port: 27017,
          hosts: [
            { host: 'host-shard-00-00.u88dd.test.test', port: 27017 },
            { host: 'host-shard-00-01.u88dd.test.test', port: 27017 },
            { host: 'host-shard-00-02.u88dd.test.test', port: 27017 }
          ],
          extraOptions: {},
          connectionType: 'NODE_DRIVER',
          authStrategy: 'MONGODB',
          replicaSet: 'host-shard-0',
          readPreference: 'primary',
          authSource: 'admin',
          appname: 'mongodb-vscode 0.6.14',
          mongodbUsername: 'username',
          mongodbPassword: 'password',
          mongodbDatabaseName: 'admin',
          kerberosCanonicalizeHostname: false,
          ssl: true,
          sslMethod: 'SYSTEMCA',
          sshTunnel: 'NONE',
          sshTunnelPort: 22
        }
      };

      const newSavedConnectionInfoWithSecrets = await testConnectionController._migratePreviouslySavedConnection(oldSavedConnectionInfo);

      assert.deepStrictEqual(
        newSavedConnectionInfoWithSecrets,
        {
          id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
          name: 'host.u88dd.test.test',
          storageLocation: 'WORKSPACE',
          connectionOptions: {
            connectionString: 'mongodb+srv://username:password@compass-data-sets.e06dc.mongodb.net/test?authSource=admin&replicaSet=host-shard-0&readPreference=primary&appname=mongodb-vscode+0.6.14&ssl=true'
          }
        }
      );
    });

    test('_migratePreviouslySavedConnection does not store secrets to disc', async () => {
      const oldSavedConnectionInfo = {
        id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
        name: 'host.u88dd.test.test',
        storageLocation: StorageLocation.WORKSPACE,
        connectionModel: {
          ns: 'test',
          isSrvRecord: true,
          hostname: 'compass-data-sets.e06dc.mongodb.net',
          port: 27017,
          hosts: [
            { host: 'host-shard-00-00.u88dd.test.test', port: 27017 },
            { host: 'host-shard-00-01.u88dd.test.test', port: 27017 },
            { host: 'host-shard-00-02.u88dd.test.test', port: 27017 }
          ],
          extraOptions: {},
          connectionType: 'NODE_DRIVER',
          authStrategy: 'MONGODB',
          replicaSet: 'host-shard-0',
          readPreference: 'primary',
          authSource: 'admin',
          appname: 'mongodb-vscode 0.6.14',
          mongodbUsername: TEST_USER_USERNAME,
          mongodbPassword: TEST_USER_PASSWORD,
          mongodbDatabaseName: 'admin',
          kerberosCanonicalizeHostname: false,
          ssl: true,
          sslMethod: 'SYSTEMCA',
          sshTunnel: 'NONE',
          sshTunnelPort: 22
        }
      };
      const mockSaveConnection: any = sinon.fake.resolves({
        id: 'fb210b47-f85d-4823-8552-aa6d7825156b'
      });

      sinon.replace(
        testConnectionController._storageController,
        'saveConnection',
        mockSaveConnection
      );

      await testConnectionController._migratePreviouslySavedConnection(oldSavedConnectionInfo);

      assert(
        mockSaveConnection.firstCall.args[0].connectionOptions?.connectionString.includes(TEST_USER_USERNAME) === true,
        `Expected saveConnection arg includes username found ${mockSaveConnection.firstCall.args[0].connectionOptions?.connectionString}`
      );
      assert(
        mockSaveConnection.firstCall.args[0].connectionOptions?.connectionString.includes(TEST_USER_PASSWORD) === false,
        `Expected saveConnection arg does not include password found ${mockSaveConnection.firstCall.args[0].connectionOptions?.connectionString}`
      );
    });

    test('_getConnectionInfoWithSecrets runs a migration for old connections', async () => {
      const oldSavedConnectionInfo = {
        id: '1d700f37-ba57-4568-9552-0ea23effea89',
        name: 'localhost:27017',
        storageLocation: StorageLocation.GLOBAL,
        connectionModel: {
          isSrvRecord: false,
          hostname: 'localhost',
          port: 27017,
          hosts: [{ host: 'localhost', port: 27017 }],
          extraOptions: {},
          connectionType: 'NODE_DRIVER',
          authStrategy: 'NONE',
          readPreference: 'primary',
          kerberosCanonicalizeHostname: false,
          sslMethod: 'NONE',
          sshTunnel: 'NONE',
          sshTunnelPort: 22
        }
      };
      const mockMigratePreviouslySavedConnection: any = sinon.fake.resolves({
        id: '1d700f37-ba57-4568-9552-0ea23effea89',
        name: 'localhost:27017',
        storageLocation: 'GLOBAL',
        connectionOptions: {
          connectionString: 'mongodb://localhost:27017/?readPreference=primary&ssl=false'
        }
      });

      sinon.replace(
        testConnectionController,
        '_migratePreviouslySavedConnection',
        mockMigratePreviouslySavedConnection
      );

      await testConnectionController._getConnectionInfoWithSecrets(oldSavedConnectionInfo);

      assert(
        mockMigratePreviouslySavedConnection.called === true,
        'Expected _migratePreviouslySavedConnection to be called.'
      );
    });

    test('_getConnectionInfoWithSecrets does not run a migration for new connections', async () => {
      const connectionInfo = {
        id: '1d700f37-ba57-4568-9552-0ea23effea89',
        name: 'localhost:27017',
        storageLocation: StorageLocation.GLOBAL,
        connectionOptions: {
          connectionString: 'mongodb://localhost:27017/?readPreference=primary&ssl=false'
        }
      };
      await testConnectionController._storageController.saveConnectionToStore(connectionInfo);
      await testConnectionController.loadSavedConnections();

      const connections = testConnectionController.getSavedConnections();

      assert(
        connections.length === 1,
        `Expected connections to be 1 found ${connections.length}`
      );

      const mockMigratePreviouslySavedConnection: any = sinon.fake();

      sinon.replace(
        testConnectionController,
        '_migratePreviouslySavedConnection',
        mockMigratePreviouslySavedConnection
      );

      const newSavedConnectionInfoWithSecrets = await testConnectionController._getConnectionInfoWithSecrets(connections[0]);

      assert.deepStrictEqual(
        newSavedConnectionInfoWithSecrets,
        connectionInfo
      );
      assert(
        mockMigratePreviouslySavedConnection.called === false,
        'Expected _migratePreviouslySavedConnection to not be called.'
      );
    });

    test('addNewConnectionStringAndConnect saves connection without secrets to the global store', async () => {
      const mockConnect: any = sinon.fake.resolves({ successfullyConnected: true });

      sinon.replace(
        testConnectionController,
        '_connect',
        mockConnect
      );

      await vscode.workspace
        .getConfiguration('mdb.connectionSaving')
        .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI_USER
      );

      const workspaceStoreConnections = testConnectionController._storageController.get(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS
      );

      assert(
        workspaceStoreConnections,
        `Expected workspace store has onnections found ${workspaceStoreConnections}`
      );

      const connections = Object.values(workspaceStoreConnections);

      assert(
        connections.length === 1,
        `Expected connections to be 1 found ${connections.length}`
      );
      assert(
        connections[0].connectionOptions?.connectionString.includes(TEST_USER_USERNAME) === true,
        `Expected a connection on disc includes username found ${connections[0].connectionOptions?.connectionString}`
      );
      assert(
        connections[0].connectionOptions?.connectionString.includes(TEST_USER_PASSWORD) === false,
        `Expected a connection on disc does not include password found ${connections[0].connectionOptions?.connectionString}`
      );
      assert(
        connections[0].connectionOptions?.connectionString.includes('appname=mongodb-vscode+0.0.0-dev.0') === true,
        `Expected a connection on disc has appname found ${connections[0].connectionOptions?.connectionString}`
      );
      assert(
        testConnectionController._connections[connections[0].id].connectionOptions?.connectionString.includes(TEST_USER_PASSWORD) === true,
        `Expected a connection in memory includes password found ${connections[0].connectionOptions?.connectionString}`
      );
      assert(
        testConnectionController._connections[connections[0].id].name === 'localhost:27018',
        `Expected a connection has the 'localhost:27018' name found ${testConnectionController._connections[connections[0].id].name}`
      );
    });

    test('parseNewConnection converts a connection model to a connaction info and overrides a default appname', () => {
      const connectionInfo = testConnectionController.parseNewConnection({
        _id: 'c4871b21-92c4-40e2-a2c2-fdd551cff114',
        isFavorite: false,
        name: 'Local',
        isSrvRecord: true,
        hostname: 'host.u88dd.test.test',
        port: 27017,
        hosts: [
          { host: 'host-shard-00-00.u88dd.test.test', port: 27017 },
          { host: 'host-shard-00-01.u88dd.test.test', port: 27017 },
          { host: 'host-shard-00-02.u88dd.test.test', port: 27017 }
        ],
        extraOptions: {},
        readPreference: READ_PREFERENCES.PRIMARY,
        authStrategy: AUTH_STRATEGY_VALUES.MONGODB,
        kerberosCanonicalizeHostname: false,
        sslMethod: SSL_METHODS.SYSTEMCA,
        sshTunnel: SSH_TUNNEL_TYPES.NONE,
        sshTunnelPort: 22,
        mongodbUsername: 'username',
        mongodbPassword: 'somepassword',
        mongodbDatabaseName: 'admin'
      });

      assert.deepStrictEqual(
        connectionInfo,
        {
          id: 'c4871b21-92c4-40e2-a2c2-fdd551cff114',
          connectionOptions: {
            connectionString: 'mongodb+srv://username:somepassword@host.u88dd.test.test/?authSource=admin&readPreference=primary&appname=mongodb-vscode+0.0.0-dev.0&ssl=true'
          }
        }
      );
    });

    test('getMongoClientConnectionOptions returns url and options properties', async () => {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      const mongoClientConnectionOptions = testConnectionController.getMongoClientConnectionOptions();

      assert.deepStrictEqual(
        mongoClientConnectionOptions,
        {
          url: 'mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0&directConnection=true',
          options: { monitorCommands: true }
        }
      );
    });
  });
});
