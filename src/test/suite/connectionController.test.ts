import assert from 'assert';
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
import { TestExtensionContext } from './stubs';
import { TEST_DATABASE_URI } from './dbTestHelper';
import { ConnectionModelType } from '../../connectionModelType';

const testDatabaseInstanceId = 'localhost:27018';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getConnection = (dbUri): Promise<ConnectionModelType> =>
  new Promise((resolve, reject) => {
    Connection.from(dbUri, (err, connectionModel) => {
      if (err) {
        return reject(err);
      }

      return resolve(connectionModel);
    });
  });

suite('Connection Controller Test Suite', function () {
  this.timeout(5000);

  const mockExtensionContext = new TestExtensionContext();
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
    const connectionModel = testConnectionController.getActiveConnectionModel();
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
    assert(connectionModel !== null);
    assert(
      connectionModel?.getAttributes({
        derived: true
      }).instanceId === 'localhost:27018'
    );
    assert(dataService !== null);
    assert(
      testConnectionController._activeConnectionModel?.appname.startsWith(
        'mongodb-vscode'
      )
    );
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
    const connectionModel = testConnectionController.getActiveConnectionModel();
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
    assert(connectionModel === null);
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
    const expectedDriverUri =
      'mongodb://localhost:27018/?readPreference=primary&ssl=false';

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
      connections[Object.keys(connections)[2]].connectionModel.driverUrl ===
        expectedDriverUri,
      `Expected loaded connection to include driver url '${expectedDriverUri}' found '${
        connections[Object.keys(connections)[2]].connectionModel.driverUrl
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

  test('a connection can be connected to by id', async () => {
    const connectionModel = await getConnection(TEST_DATABASE_URI);

    testConnectionController._connections = {
      '25': {
        id: '25',
        name: 'tester',
        connectionModel,
        storageLocation: StorageScope.NONE
      }
    };

    const successfulConnection = await testConnectionController.connectWithConnectionId(
      '25'
    );

    assert(successfulConnection);
    assert(testConnectionController.getActiveConnectionId() === '25');
  });

  test('a saved connection can be loaded and connected to', async () => {
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
      StorageScope.WORKSPACE
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

    const port =
      testConnectionController._connections[activeId || ''].connectionModel
        .port;

    assert(
      port === 27018,
      `Expected the active connection port to be '27018', found ${port}.`
    );
  });

  test('"getConnectionStringFromConnectionId" returns the driver uri of a connection', async () => {
    const expectedDriverUri =
      'mongodb://localhost:27018/?readPreference=primary&appname=mongodb-vscode%200.3.1-dev.0&ssl=false';

    await testConnectionController.loadSavedConnections();
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

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

    await testConnectionController.disconnect();
    await testConnectionController.removeSavedConnection(connectionId);

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
  });

  test('when a connection is removed it is also removed from global storage', async () => {
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

  test('a saved connection can be renamed and loaded', async () => {
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

  test('СonnectionQuickPicks list is displayed in the alphanumerical case insensitive order', async () => {
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
      `Expected the first quick pick label to be 'Add new connection', found '${connectionQuickPicks[0].name}'.`
    );
    assert(
      connectionQuickPicks[1].label === 'localhost:27018',
      `Expected the second quick pick label to be 'localhost:27018', found '${connectionQuickPicks[1].name}'.`
    );
    assert(
      connectionQuickPicks[2].label === 'Lynx',
      `Expected the third quick pick labele to be 'Lynx', found '${connectionQuickPicks[2].name}'.`
    );
  });

  suite('connecting to a new connection when already connecting', () => {
    test('connects to the new connection', async () => {
      testConnectionController.addNewConnectionStringAndConnect(
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

    test('increments the connecting version on each new connection attempt', async () => {
      testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );
      assert(testConnectionController.getConnectingVersion() === 2);
    });

    test('it only connects to the most recent connection attempt', async () => {
      const connectionModel = await getConnection(TEST_DATABASE_URI);

      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        testConnectionController._connections[id] = {
          id,
          name: `test${i}`,
          connectionModel,
          storageLocation: StorageScope.NONE
        };
      }

      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        testConnectionController.connectWithConnectionId(id);
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
      testConnectionController.disconnect();
      testConnectionController.disconnect();
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
    const connectionModel = await getConnection(testDatabaseURI2WithTimeout);

    const connectionId = 'skateboard';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionModel,
      storageLocation: StorageScope.NONE
    };

    testConnectionController.connectWithConnectionId(connectionId);

    // Ensure the connection starts but doesn't time out yet.
    await sleep(250);

    assert(testConnectionController.isConnecting());
    assert(testConnectionController.getConnectionStatus() === 'CONNECTING');

    await testConnectionController.removeSavedConnection(connectionId);

    // Wait for the connection to timeout and complete (and not error in the process).
    await sleep(1000);
  });

  test('a successfully connecting connection can be removed while it is being connected to', async () => {
    const connectionModel = await getConnection(TEST_DATABASE_URI);

    const connectionId = 'skateboard2';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionModel,
      storageLocation: StorageScope.NONE
    };

    testConnectionController.connectWithConnectionId(connectionId);

    // Ensure the connection starts but doesn't time out yet.
    await sleep(0);

    assert(testConnectionController.isConnecting());

    await testConnectionController.removeSavedConnection(connectionId);

    // Wait for the connection to timeout and complete (and not error in the process).
    await sleep(500);

    assert(
      !testConnectionController.isCurrentlyConnected(),
      'Did not expect to connect to the connection which was removed.'
    );
  });
});
