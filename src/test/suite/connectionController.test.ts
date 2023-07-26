import sinon from 'sinon';
import type { SinonStub } from 'sinon';
import util from 'util';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import assert from 'assert';
import { connect } from 'mongodb-data-service';

import AUTH_STRATEGY_VALUES from '../../views/webview-app/connection-model/constants/auth-strategies';
import ConnectionController, {
  DataServiceEventTypes,
  keytarMigrationFailedMessage,
} from '../../connectionController';
import formatError from '../../utils/formatError';
import { StorageController, StorageVariables } from '../../storage';
import {
  StorageLocation,
  DefaultSavingLocations,
  SecretStorageLocation,
} from '../../storage/storageController';
import READ_PREFERENCES from '../../views/webview-app/connection-model/constants/read-preferences';
import SSH_TUNNEL_TYPES from '../../views/webview-app/connection-model/constants/ssh-tunnel-types';
import SSL_METHODS from '../../views/webview-app/connection-model/constants/ssl-methods';
import { StatusView } from '../../views';
import TelemetryService from '../../telemetry/telemetryService';
import { ExtensionContextStub } from './stubs';
import {
  TEST_DATABASE_URI,
  TEST_DATABASE_URI_USER,
  TEST_USER_USERNAME,
  TEST_USER_PASSWORD,
} from './dbTestHelper';
import KeytarStub from './keytarStub';
import { ext } from '../../extensionConstants';
import { KeytarInterface } from '../../utils/keytar';

const testDatabaseConnectionName = 'localhost:27018';
const testDatabaseURI2WithTimeout =
  'mongodb://shouldfail?connectTimeoutMS=1000&serverSelectionTimeoutMS=1000';

const sleep = (ms: number): Promise<void> => {
  return util.promisify(setTimeout)(ms);
};

suite('Connection Controller Test Suite', function () {
  this.timeout(5000);

  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  const testTelemetryService = new TelemetryService(
    testStorageController,
    extensionContextStub
  );
  const testConnectionController = new ConnectionController({
    statusView: new StatusView(extensionContextStub),
    storageController: testStorageController,
    telemetryService: testTelemetryService,
  });
  let showErrorMessageStub: SinonStub;
  let showInformationMessageStub: SinonStub;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    showInformationMessageStub = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );
    showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(async () => {
    // Reset our mock extension's state.
    extensionContextStub._workspaceState = {};
    extensionContextStub._globalState = {};

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    sandbox.restore();
  });

  test('it connects to mongodb', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );
    const connnectionId =
      testConnectionController.getActiveConnectionId() || '';
    const name = testConnectionController._connections[connnectionId].name;
    const dataService = testConnectionController.getActiveDataService();

    assert.strictEqual(succesfullyConnected, true);
    assert.strictEqual(
      testConnectionController.getSavedConnections().length,
      1
    );
    assert.strictEqual(name, 'localhost:27018');
    assert.strictEqual(testConnectionController.isCurrentlyConnected(), true);

    assert.notStrictEqual(dataService, null);
  });

  test('"disconnect()" disconnects from the active connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    assert.strictEqual(succesfullyConnected, true);
    assert.strictEqual(
      testConnectionController.getConnectionStatus(),
      'CONNECTED'
    );

    const successfullyDisconnected =
      await testConnectionController.disconnect();

    // Disconnecting should keep the connection contract, just disconnected.
    const connectionsCount =
      testConnectionController.getSavedConnections().length;
    const connnectionId = testConnectionController.getActiveConnectionId();
    const dataService = testConnectionController.getActiveDataService();

    assert.strictEqual(
      testConnectionController.getConnectionStatus(),
      'DISCONNECTED'
    );
    assert.strictEqual(successfullyDisconnected, true);
    assert.strictEqual(connectionsCount, 1);
    assert.strictEqual(connnectionId, null);
    assert.strictEqual(testConnectionController.isCurrentlyConnected(), false);
    assert.strictEqual(dataService, null);
  });

  test('"removeMongoDBConnection()" returns a reject promise when there is no active connection', async () => {
    const expectedMessage = 'No connections to remove.';
    const successfullyRemovedMongoDBConnection =
      await testConnectionController.onRemoveMongoDBConnection();

    assert.strictEqual(showErrorMessageStub.firstCall.args[0], expectedMessage);
    assert.strictEqual(successfullyRemovedMongoDBConnection, false);
  });

  test('"disconnect()" fails when there is no active connection', async () => {
    const expectedMessage = 'Unable to disconnect: no active connection.';
    const successfullyDisconnected =
      await testConnectionController.disconnect();

    assert.strictEqual(showErrorMessageStub.firstCall.args[0], expectedMessage);
    assert.strictEqual(successfullyDisconnected, false);
  });

  test('when adding a new connection it disconnects from the current connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    assert.strictEqual(succesfullyConnected, true);

    try {
      await testConnectionController.addNewConnectionStringAndConnect(
        testDatabaseURI2WithTimeout
      );
    } catch (error) {
      const expectedError = 'Failed to connect';

      assert.strictEqual(
        formatError(error).message.includes(expectedError),
        true
      );
      assert.strictEqual(testConnectionController.getActiveDataService(), null);
      assert.strictEqual(
        testConnectionController.getActiveConnectionId(),
        null
      );
    }
  });

  test('when adding a new connection it sets the connection controller as connecting while it disconnects from the current connection', async () => {
    const succesfullyConnected =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    assert.strictEqual(succesfullyConnected, true);

    let wasSetToConnectingWhenDisconnecting = false;
    sandbox.replace(testConnectionController, 'disconnect', () => {
      wasSetToConnectingWhenDisconnecting = true;

      return Promise.resolve(true);
    });

    const succesfullyConnected2 =
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

    assert.strictEqual(succesfullyConnected2, true);
    assert.strictEqual(wasSetToConnectingWhenDisconnecting, true);
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

    assert.strictEqual(isConnectionChanged, true);
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

    assert.strictEqual(connectionEventFiredCount, expectedTimesToFire);
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    await testConnectionController.loadSavedConnections();

    const connectionsCount =
      testConnectionController.getSavedConnections().length;

    assert.strictEqual(connectionsCount, 0);
  });

  test('the connection model loads both global and workspace stored connection models', async () => {
    const expectedDriverUrl =
      'mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0';

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

    assert.strictEqual(Object.keys(connections).length, 4);
    assert.strictEqual(
      connections[Object.keys(connections)[0]].name,
      'localhost:27018'
    );
    assert.strictEqual(
      connections[Object.keys(connections)[2]].connectionOptions
        ?.connectionString,
      expectedDriverUrl
    );
  });

  test('when a connection is added it is saved to the global storage', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert.strictEqual(Object.keys(globalStoreConnections).length, 1);

    const id = Object.keys(globalStoreConnections)[0];

    assert.strictEqual(
      globalStoreConnections[id].name,
      testDatabaseConnectionName
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS
    );

    assert.strictEqual(workspaceStoreConnections, undefined);
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

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert.strictEqual(Object.keys(workspaceStoreConnections).length, 1);

    const id = Object.keys(workspaceStoreConnections)[0];

    assert.strictEqual(
      workspaceStoreConnections[id].name,
      testDatabaseConnectionName
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert.strictEqual(globalStoreConnections, undefined);
  });

  test('a connection can be connected to by id', async () => {
    testConnectionController._connections = {
      '25': {
        id: '25',
        name: 'tester',
        connectionOptions: { connectionString: TEST_DATABASE_URI },
        storageLocation: StorageLocation.NONE,
        secretStorageLocation: SecretStorageLocation.SecretStorage,
      },
    };

    const successfulConnection =
      await testConnectionController.connectWithConnectionId('25');

    assert.strictEqual(successfulConnection, true);
    assert.strictEqual(testConnectionController.getActiveConnectionId(), '25');
  });

  test('a saved connection can be loaded and connected to workspace store', async () => {
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

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert.strictEqual(Object.keys(workspaceStoreConnections).length, 1);

    await testConnectionController.disconnect();
    testConnectionController.clearAllConnections();

    assert.strictEqual(
      testConnectionController.getSavedConnections().length,
      0
    );

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    assert.strictEqual(
      testConnectionController.getSavedConnections().length,
      1
    );

    const id = testConnectionController.getSavedConnections()[0].id;

    await testConnectionController.connectWithConnectionId(id);

    const activeId = testConnectionController.getActiveConnectionId();
    const name = testConnectionController._connections[activeId || ''].name;

    assert.strictEqual(activeId, id);
    assert.strictEqual(name, 'localhost:27018');
  });

  test('"copyConnectionStringByConnectionId" returns the driver uri of a connection', async () => {
    const expectedDriverUrl = 'mongodb://localhost:27018/';

    await testConnectionController.loadSavedConnections();
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const activeConnectionId = testConnectionController.getActiveConnectionId();

    assert.notStrictEqual(activeConnectionId, null);

    const testDriverUrl =
      testConnectionController.copyConnectionStringByConnectionId(
        activeConnectionId || ''
      );

    assert.strictEqual(testDriverUrl, expectedDriverUrl);
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
    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert.strictEqual(JSON.stringify(globalStoreConnections), objectString);

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert.strictEqual(JSON.stringify(workspaceStoreConnections), objectString);
  });

  test('when a connection is removed it is also removed from workspace store', async () => {
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

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert.strictEqual(Object.keys(workspaceStoreConnections).length, 1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';

    await testConnectionController.disconnect();
    await testConnectionController.removeSavedConnection(connectionId);

    const postWorkspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert.strictEqual(Object.keys(postWorkspaceStoreConnections).length, 0);
  });

  test('when a connection is removed it is also removed from global storage', async () => {
    await testConnectionController.loadSavedConnections();
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert.strictEqual(Object.keys(globalStoreConnections).length, 1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'a';
    await testConnectionController.removeSavedConnection(connectionId);

    const postGlobalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    assert.strictEqual(Object.keys(postGlobalStoreConnections).length, 0);
  });

  test('when a connection is removed, the secrets for that connection are also removed', async () => {
    const keytarDeleteSpy = sandbox
      .stub(ext.keytarModule as KeytarInterface, 'deletePassword')
      .resolves();
    const secretStorageDeleteSpy = sandbox.spy(
      testStorageController,
      'deleteSecret'
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI_USER
    );

    const [connection] = testConnectionController.getSavedConnections();
    await testConnectionController.removeSavedConnection(connection.id);
    assert.strictEqual(keytarDeleteSpy.calledOnce, true);
    assert.strictEqual(secretStorageDeleteSpy.calledOnce, true);
  });

  test('when a connection is removed, should be able to remove the secrets safely from SecretStorage even if keytar is not available', async () => {
    sandbox.replace(ext, 'keytarModule', null as any);
    const secretStorageDeleteSpy = sandbox.spy(
      testStorageController,
      'deleteSecret'
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI_USER
    );

    const [connection] = testConnectionController.getSavedConnections();
    await testConnectionController.removeSavedConnection(connection.id);
    assert.strictEqual(secretStorageDeleteSpy.calledOnce, true);
  });

  test('when a connection is removed, should be able to remove the secrets safely from SecretStorage even if keytar.deletePassword rejects', async () => {
    const keytarDeleteSpy = sandbox
      .stub(ext.keytarModule as KeytarInterface, 'deletePassword')
      .rejects();
    const secretStorageDeleteSpy = sandbox.spy(
      testStorageController,
      'deleteSecret'
    );

    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI_USER
    );

    const [connection] = testConnectionController.getSavedConnections();
    await assert.doesNotReject(
      testConnectionController.removeSavedConnection(connection.id)
    );
    assert.strictEqual(keytarDeleteSpy.calledOnce, true);
    assert.strictEqual(secretStorageDeleteSpy.calledOnce, true);
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

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    assert.strictEqual(Object.keys(workspaceStoreConnections).length, 1);

    const connectionId =
      testConnectionController.getActiveConnectionId() || 'zz';

    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves('new connection name');
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionId
    );

    assert.strictEqual(renameSuccess, true);

    await testConnectionController.disconnect();

    testConnectionController.clearAllConnections();

    assert.strictEqual(
      testConnectionController.getSavedConnections().length,
      0
    );

    // Activate (which will load the past connection).
    await testConnectionController.loadSavedConnections();

    assert.strictEqual(
      testConnectionController.getSavedConnections().length,
      1
    );

    const id = testConnectionController.getSavedConnections()[0].id;
    const name = testConnectionController._connections[id || 'x'].name;

    assert.strictEqual(name, 'new connection name');
  });

  test('ConnectionQuickPicks workspace connections list is displayed in the alphanumerical case insensitive order', async () => {
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
    const connectionIds = Object.keys(connections);

    assert.strictEqual(connectionIds.length, 2);
    assert.strictEqual(connections[connectionIds[0]].name, 'localhost:27018');
    assert.strictEqual(connections[connectionIds[1]].name, 'localhost:27018');

    const inputBoxResolvesStub = sandbox.stub();
    inputBoxResolvesStub.onCall(0).resolves('Lynx');
    sandbox.replace(vscode.window, 'showInputBox', inputBoxResolvesStub);

    const renameSuccess = await testConnectionController.renameConnection(
      connectionIds[0]
    );

    assert.strictEqual(renameSuccess, true);

    await testConnectionController.loadSavedConnections();

    assert.strictEqual(connectionIds.length, 2);

    const connectionQuickPicks =
      testConnectionController.getConnectionQuickPicks();

    assert.strictEqual(connectionQuickPicks.length, 3);
    assert.strictEqual(connectionQuickPicks[0].label, 'Add new connection');
    assert.strictEqual(connectionQuickPicks[1].label, 'localhost:27018');
    assert.strictEqual(connectionQuickPicks[2].label, 'Lynx');
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

      assert.strictEqual(testConnectionController.isCurrentlyConnected(), true);
      assert.strictEqual(
        testConnectionController.getActiveConnectionName(),
        'localhost:27018'
      );
    });

    test('updates the connecting version on each new connection attempt', async () => {
      assert.strictEqual(testConnectionController.getConnectingVersion(), null);

      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      const currentConnectingVersion =
        testConnectionController.getConnectingVersion();

      assert.notStrictEqual(currentConnectingVersion, null);

      const id =
        testConnectionController._connections[
          Object.keys(testConnectionController._connections)[0]
        ].id;

      assert.strictEqual(currentConnectingVersion, id);

      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI
      );

      assert.notStrictEqual(
        testConnectionController.getConnectingVersion(),
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
          storageLocation: StorageLocation.NONE,
          secretStorageLocation: SecretStorageLocation.SecretStorage,
        };
      }

      for (let i = 0; i < 5; i++) {
        const id = `${i}`;
        void testConnectionController.connectWithConnectionId(id);
      }

      // Ensure the connections complete.
      await sleep(1000);

      assert.strictEqual(testConnectionController.isConnecting(), false);
      assert.strictEqual(testConnectionController.isCurrentlyConnected(), true);
      assert.strictEqual(
        testConnectionController.getActiveConnectionName(),
        'test4'
      );
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

    assert.strictEqual(testConnectionController.isCurrentlyConnected(), false);
    assert.strictEqual(testConnectionController.getActiveDataService(), null);
  });

  test('a connection which fails can be removed while it is being connected to', async () => {
    const connectionId = 'skateboard';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionOptions: { connectionString: testDatabaseURI2WithTimeout },
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    void testConnectionController.connectWithConnectionId(connectionId);

    assert.strictEqual(testConnectionController.isConnecting(), true);
    assert.strictEqual(
      testConnectionController.getConnectionStatus(),
      'CONNECTING'
    );

    try {
      await testConnectionController.removeSavedConnection(connectionId);
    } catch (error) {
      assert.strictEqual(formatError(error), false);
    }
  });

  test('a successfully connecting connection can be removed while it is being connected to', async () => {
    const connectionId = 'skateboard2';
    testConnectionController._connections[connectionId] = {
      id: connectionId,
      name: 'asdfasdg',
      connectionOptions: { connectionString: TEST_DATABASE_URI },
      storageLocation: StorageLocation.NONE,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
    };

    sandbox.replace(
      testConnectionController,
      '_connectWithDataService',
      async (connectionOptions) => {
        await sleep(50);

        return connect({
          connectionOptions,
        });
      }
    );

    void testConnectionController.connectWithConnectionId(connectionId);

    // Ensure the connection attempt has started.
    await sleep(10);

    assert.strictEqual(testConnectionController.isConnecting(), true);

    await testConnectionController.removeSavedConnection(connectionId);

    // Wait for the connection to timeout and complete (and not error in the process).
    await sleep(250);

    assert.strictEqual(testConnectionController.isCurrentlyConnected(), false);
  });

  test('_migrateConnectionWithConnectionModel converts an old previously saved connection model without secrets to a new connection info format', async () => {
    const oldSavedConnectionInfo = {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: StorageLocation.GLOBAL,
      connectionModel: {
        _id: '1',
        isFavorite: false,
        name: 'Local 1',
        isSrvRecord: false,
        hostname: 'localhost',
        port: 27017,
        hosts: [{ host: 'localhost', port: 27017 }],
        extraOptions: {},
        connectionType: 'NODE_DRIVER',
        authStrategy: AUTH_STRATEGY_VALUES.NONE,
        readPreference: READ_PREFERENCES.PRIMARY,
        kerberosCanonicalizeHostname: false,
        sslMethod: SSL_METHODS.NONE,
        sshTunnel: SSH_TUNNEL_TYPES.NONE,
        sshTunnelPort: 22,
      },
    };
    const newSavedConnectionInfoWithSecrets =
      await testConnectionController._migrateConnectionWithConnectionModel(
        oldSavedConnectionInfo
      );

    assert.deepStrictEqual(newSavedConnectionInfoWithSecrets, {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: 'GLOBAL',
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: {
        connectionString:
          'mongodb://localhost:27017/?readPreference=primary&ssl=false&directConnection=true',
      },
    });
  });

  test('_migrateConnectionWithConnectionModel converts an old previously saved connection model with secrets to a new connection info format', async () => {
    const oldSavedConnectionInfo = {
      id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
      name: 'host.u88dd.test.test',
      storageLocation: StorageLocation.WORKSPACE,
      connectionModel: {
        _id: '2',
        isFavorite: false,
        name: 'Local 2',
        ns: 'test',
        isSrvRecord: true,
        hostname: 'compass-data-sets.e06dc.mongodb.net',
        port: 27017,
        hosts: [
          { host: 'host-shard-00-00.u88dd.test.test', port: 27017 },
          { host: 'host-shard-00-01.u88dd.test.test', port: 27017 },
          { host: 'host-shard-00-02.u88dd.test.test', port: 27017 },
        ],
        extraOptions: {},
        connectionType: 'NODE_DRIVER',
        authStrategy: AUTH_STRATEGY_VALUES.MONGODB,
        replicaSet: 'host-shard-0',
        readPreference: READ_PREFERENCES.PRIMARY,
        authSource: 'admin',
        appname: 'mongodb-vscode 0.6.14',
        mongodbUsername: 'username',
        mongodbPassword: 'password',
        mongodbDatabaseName: 'admin',
        kerberosCanonicalizeHostname: false,
        ssl: true,
        sslMethod: SSL_METHODS.SYSTEMCA,
        sshTunnel: SSH_TUNNEL_TYPES.NONE,
        sshTunnelPort: 22,
      },
    };

    const newSavedConnectionInfoWithSecrets =
      await testConnectionController._migrateConnectionWithConnectionModel(
        oldSavedConnectionInfo
      );

    assert.deepStrictEqual(newSavedConnectionInfoWithSecrets, {
      id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
      name: 'host.u88dd.test.test',
      storageLocation: 'WORKSPACE',
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: {
        connectionString:
          'mongodb+srv://username:password@compass-data-sets.e06dc.mongodb.net/test?authSource=admin&replicaSet=host-shard-0&readPreference=primary&appname=mongodb-vscode+0.6.14&ssl=true',
      },
    });
  });

  test('_migrateConnectionWithConnectionModel does not store secrets to disc', async () => {
    const oldSavedConnectionInfo = {
      id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
      name: 'host.u88dd.test.test',
      storageLocation: StorageLocation.WORKSPACE,
      connectionModel: {
        _id: '3',
        isFavorite: false,
        name: 'Local 3',
        ns: 'test',
        isSrvRecord: true,
        hostname: 'compass-data-sets.e06dc.mongodb.net',
        port: 27017,
        hosts: [
          { host: 'host-shard-00-00.u88dd.test.test', port: 27017 },
          { host: 'host-shard-00-01.u88dd.test.test', port: 27017 },
          { host: 'host-shard-00-02.u88dd.test.test', port: 27017 },
        ],
        extraOptions: {},
        connectionType: 'NODE_DRIVER',
        authStrategy: AUTH_STRATEGY_VALUES.MONGODB,
        replicaSet: 'host-shard-0',
        readPreference: READ_PREFERENCES.PRIMARY,
        authSource: 'admin',
        appname: 'mongodb-vscode 0.6.14',
        mongodbUsername: TEST_USER_USERNAME,
        mongodbPassword: TEST_USER_PASSWORD,
        mongodbDatabaseName: 'admin',
        kerberosCanonicalizeHostname: false,
        ssl: true,
        sslMethod: SSL_METHODS.SYSTEMCA,
        sshTunnel: SSH_TUNNEL_TYPES.NONE,
        sshTunnelPort: 22,
      },
    };
    const fakeSaveConnection = sandbox.fake.resolves({
      id: 'fb210b47-f85d-4823-8552-aa6d7825156b',
    });

    sandbox.replace(
      testConnectionController._storageController,
      'saveConnection',
      fakeSaveConnection
    );

    await testConnectionController._migrateConnectionWithConnectionModel(
      oldSavedConnectionInfo
    );

    const connectionString =
      fakeSaveConnection.firstCall.args[0].connectionOptions?.connectionString;

    assert.strictEqual(connectionString.includes(TEST_USER_USERNAME), true);
    assert.strictEqual(connectionString.includes(TEST_USER_PASSWORD), false);
  });

  test('_getConnectionInfoWithSecrets runs a migration for old connections', async () => {
    const oldSavedConnectionInfo = {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: StorageLocation.GLOBAL,
      connectionModel: {
        _id: '4',
        isFavorite: false,
        name: 'Local 4',
        isSrvRecord: false,
        hostname: 'localhost',
        port: 27017,
        hosts: [{ host: 'localhost', port: 27017 }],
        extraOptions: {},
        connectionType: 'NODE_DRIVER',
        authStrategy: AUTH_STRATEGY_VALUES.NONE,
        readPreference: READ_PREFERENCES.PRIMARY,
        kerberosCanonicalizeHostname: false,
        sslMethod: SSL_METHODS.NONE,
        sshTunnel: SSH_TUNNEL_TYPES.NONE,
        sshTunnelPort: 22,
      },
    };
    const fakeMigratePreviouslySavedConnection = sandbox.fake.resolves({
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: 'GLOBAL',
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: {
        connectionString:
          'mongodb://localhost:27017/?readPreference=primary&ssl=false',
      },
    });

    sandbox.replace(
      testConnectionController,
      '_migrateConnectionWithConnectionModel',
      fakeMigratePreviouslySavedConnection
    );

    await testConnectionController._getConnectionInfoWithSecrets(
      oldSavedConnectionInfo
    );

    assert.strictEqual(fakeMigratePreviouslySavedConnection.called, true);
  });

  test('_getConnectionInfoWithSecrets does not run a migration for new connections', async () => {
    const connectionInfo = {
      id: '1d700f37-ba57-4568-9552-0ea23effea89',
      name: 'localhost:27017',
      storageLocation: StorageLocation.GLOBAL,
      secretStorageLocation: SecretStorageLocation.SecretStorage,
      connectionOptions: {
        connectionString:
          'mongodb://localhost:27017/?readPreference=primary&ssl=false',
      },
    };
    await testConnectionController._storageController.saveConnectionToStore(
      connectionInfo
    );
    await testConnectionController.loadSavedConnections();

    const connections = testConnectionController.getSavedConnections();

    assert.strictEqual(connections.length, 1);

    const fakeMigratePreviouslySavedConnection = sandbox.fake();

    sandbox.replace(
      testConnectionController,
      '_migrateConnectionWithConnectionModel',
      fakeMigratePreviouslySavedConnection
    );

    const newSavedConnectionInfoWithSecrets =
      await testConnectionController._getConnectionInfoWithSecrets(
        connections[0]
      );

    assert.deepStrictEqual(newSavedConnectionInfoWithSecrets, connectionInfo);
    assert.strictEqual(fakeMigratePreviouslySavedConnection.called, false);
  });

  test('addNewConnectionStringAndConnect saves connection without secrets to the global storage', async () => {
    const fakeConnect = sandbox.fake.resolves({
      successfullyConnected: true,
    });
    sandbox.replace(testConnectionController, '_connect', fakeConnect);

    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI_USER
    );

    const workspaceStoreConnections =
      testConnectionController._storageController.get(
        StorageVariables.GLOBAL_SAVED_CONNECTIONS
      );

    assert.strictEqual(
      !!workspaceStoreConnections,
      true,
      `Expected workspace store to have connections, found ${workspaceStoreConnections}`
    );

    const connections = Object.values(workspaceStoreConnections);

    assert.strictEqual(connections.length, 1);
    assert.strictEqual(
      connections[0].connectionOptions?.connectionString.includes(
        TEST_USER_USERNAME
      ),
      true
    );
    assert.strictEqual(
      connections[0].connectionOptions?.connectionString.includes(
        TEST_USER_PASSWORD
      ),
      false
    );
    assert.strictEqual(
      connections[0].connectionOptions?.connectionString.includes(
        'appname=mongodb-vscode+0.0.0-dev.0'
      ),
      true
    );
    assert.strictEqual(
      testConnectionController._connections[
        connections[0].id
      ].connectionOptions?.connectionString.includes(TEST_USER_PASSWORD),
      true
    );
    assert.strictEqual(
      testConnectionController._connections[connections[0].id].name,
      'localhost:27018'
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
        { host: 'host-shard-00-02.u88dd.test.test', port: 27017 },
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
      mongodbDatabaseName: 'admin',
    });

    assert.deepStrictEqual(connectionInfo, {
      id: 'c4871b21-92c4-40e2-a2c2-fdd551cff114',
      connectionOptions: {
        connectionString:
          'mongodb+srv://username:somepassword@host.u88dd.test.test/?authSource=admin&readPreference=primary&appname=mongodb-vscode+0.0.0-dev.0&ssl=true',
      },
    });
  });

  test('getMongoClientConnectionOptions returns url and options properties', async () => {
    await testConnectionController.addNewConnectionStringAndConnect(
      TEST_DATABASE_URI
    );

    const mongoClientConnectionOptions =
      testConnectionController.getMongoClientConnectionOptions();

    assert(mongoClientConnectionOptions !== undefined);

    delete mongoClientConnectionOptions.options.parentHandle;

    assert.deepStrictEqual(mongoClientConnectionOptions, {
      url: 'mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0',
      options: {
        autoEncryption: undefined,
        monitorCommands: true,
        useSystemCA: undefined,
        authMechanismProperties: {},
        oidc: {
          allowedFlows: ['auth-code'],
        },
        productDocsLink:
          'https://docs.mongodb.com/mongodb-vscode/?utm_source=vscode&utm_medium=product',
        productName: 'mongodb-vscode',
      },
    });
  });

  test('_getConnectionStringWithProxy returns string with proxy options', () => {
    const expectedConnectionStringWithProxy =
      'mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0&proxyHost=localhost&proxyPassword=gwce7tr8733ujbr&proxyPort=3378&proxyUsername=test';
    const connectionString =
      testConnectionController._getConnectionStringWithProxy({
        url: 'mongodb://localhost:27018/?appname=mongodb-vscode+0.0.0-dev.0',
        options: {
          proxyHost: 'localhost',
          proxyPassword: 'gwce7tr8733ujbr',
          proxyPort: 3378,
          proxyUsername: 'test',
        },
      });
    assert.strictEqual(connectionString, expectedConnectionStringWithProxy);
  });

  suite('loadSavedConnections', () => {
    const serviceName = 'mdb.vscode.savedConnections';
    const extensionSandbox = sinon.createSandbox();
    const keytarSandbox = sinon.createSandbox();
    const testSandbox = sinon.createSandbox();
    let keytarStub: KeytarStub;

    beforeEach(() => {
      // To fake a successful auth connection
      testSandbox.replace(
        testConnectionController,
        '_connect',
        testSandbox.stub().resolves({ successfullyConnected: true })
      );
    });

    afterEach(() => {
      testSandbox.restore();
      keytarSandbox.restore();
      extensionSandbox.restore();
    });

    suite(
      'when there are connections requiring secrets migrations from Keytar',
      () => {
        beforeEach(() => {
          // Replace the storage location with keytar to have some connection
          // secrets in keytar before the tests
          keytarStub = new KeytarStub();
          keytarSandbox.replace(
            testStorageController,
            'getSecret',
            (key: string) => keytarStub.getPassword(serviceName, key)
          );
          keytarSandbox.replace(
            testStorageController,
            'setSecret',
            (key: string, value: string) =>
              keytarStub.setPassword(serviceName, key, value)
          );
          keytarSandbox.replace(
            testStorageController,
            'deleteSecret',
            (key: string) => keytarStub.deletePassword(serviceName, key)
          );

          // Also replace the saveConnection method on StorageController to remove
          // the secretStorage field while saving the connections because we are
          // initially faking that we store in keytar to actually run the
          // migration code
          const originalSaveConnectionFn =
            testStorageController.saveConnection.bind(testStorageController);
          keytarSandbox.replace(
            testStorageController,
            'saveConnection',
            (connectionInfo) => {
              const connectionInfoWithoutSecretStorage = {
                ...connectionInfo,
              };
              delete connectionInfoWithoutSecretStorage.secretStorageLocation;
              return originalSaveConnectionFn(
                connectionInfoWithoutSecretStorage
              );
            }
          );
        });

        [
          {
            name: 'should be able to migrate secrets and load a connection that does not have any credentials',
            uri: TEST_DATABASE_URI,
            expectedSecret: '{}',
          },
          {
            name: 'should be able to migrate secrets and load a connection that has credentials',
            uri: TEST_DATABASE_URI_USER,
            expectedSecret: JSON.stringify({ password: TEST_USER_PASSWORD }),
          },
        ].forEach(({ name, uri, expectedSecret }) => {
          test(name, async () => {
            // We replace the keytar module with our stub to make sure that later,
            // during migration, we are able to find the secrets in the correct
            // place
            extensionSandbox.replace(ext, 'keytarModule', keytarStub);

            await testConnectionController.addNewConnectionStringAndConnect(
              uri
            );

            // Make sure we actually saved in keytar and that there is nothing in secretStorage
            const [savedConnection] =
              testConnectionController.getSavedConnections();
            assert.strictEqual(
              await (ext.keytarModule as KeytarStub).getPassword(
                serviceName,
                savedConnection.id
              ),
              expectedSecret
            );
            assert.strictEqual(
              await testStorageController._secretStorage.get(
                savedConnection.id
              ),
              undefined
            );

            // Also assert that our connections do not have secretStorage field in them
            assert.strictEqual(
              'secretStorageLocation' in savedConnection,
              false
            );

            // Reset the modification done by the keytarSandbox
            keytarSandbox.restore();

            // Disconnect and clear the connections
            await testConnectionController.disconnect();
            testConnectionController.clearAllConnections();

            // Load all connections now, after this the migration is expected to be
            // finished
            await testConnectionController.loadSavedConnections();
            const [updatedConnection] =
              testConnectionController.getSavedConnections();

            // Assert that we have our secrets now in SecretStorage
            assert.strictEqual(
              await testStorageController.getSecret(savedConnection.id),
              expectedSecret
            );
            assert.strictEqual(
              updatedConnection.secretStorageLocation,
              SecretStorageLocation.SecretStorage
            );
          });
        });

        test('should be able to load a connection for which there was nothing found in keytar (user removed the secrets manually)', async () => {
          // We replace the keytar module with our stub to make sure that later,
          // during migration, we are able to find the secrets in the correct
          // place
          extensionSandbox.replace(ext, 'keytarModule', keytarStub);

          await testConnectionController.addNewConnectionStringAndConnect(
            TEST_DATABASE_URI_USER
          );

          const expectedSecret = JSON.stringify({
            password: TEST_USER_PASSWORD,
          });

          // Make sure we actually saved in keytar and that there is nothing in secretStorage
          const [savedConnection] =
            testConnectionController.getSavedConnections();
          assert.strictEqual(
            await (ext.keytarModule as KeytarStub).getPassword(
              serviceName,
              savedConnection.id
            ),
            expectedSecret
          );
          assert.strictEqual(
            await testStorageController._secretStorage.get(savedConnection.id),
            undefined
          );

          // Here we are manually removing the secret from keytar so that it is
          // not found during migration
          await (ext.keytarModule as KeytarStub).deletePassword(
            serviceName,
            savedConnection.id
          );

          // Reset the modification done by the keytarSandbox
          keytarSandbox.restore();

          // Disconnect and clear the connections
          await testConnectionController.disconnect();
          testConnectionController.clearAllConnections();

          // Load all connections now, after this the migration is expected to be
          // finished
          await testConnectionController.loadSavedConnections();
          const [updatedConnection] =
            testConnectionController.getSavedConnections();

          // Assert that we have an empty object as secrets now in SecretStorage
          // because we removed the original secrets above
          assert.strictEqual(
            await testStorageController.getSecret(savedConnection.id),
            '{}'
          );
          assert.strictEqual(
            updatedConnection.secretStorageLocation,
            SecretStorageLocation.SecretStorage
          );
        });

        test('should be able to load a connection (in broken state) even when keytar module is gone', async () => {
          // Here we try to mimick that the keytar module is gone away
          extensionSandbox.replace(ext, 'keytarModule', null as any);

          await testConnectionController.addNewConnectionStringAndConnect(
            TEST_DATABASE_URI_USER
          );

          // Make sure we actually saved in keytar and that there is nothing in
          // secretStorage
          const [savedConnection] =
            testConnectionController.getSavedConnections();
          assert.strictEqual(
            await keytarStub.getPassword(serviceName, savedConnection.id),
            JSON.stringify({ password: TEST_USER_PASSWORD })
          );
          assert.strictEqual(
            await testStorageController._secretStorage.get(savedConnection.id),
            undefined
          );

          // Reset the modification done by the keytarSandbox
          keytarSandbox.restore();

          // Disconnect and clear the connections
          await testConnectionController.disconnect();
          testConnectionController.clearAllConnections();

          // Load all connections now, after this the migration is expected to be
          // finished
          await testConnectionController.loadSavedConnections();
          const [updatedConnection] =
            testConnectionController.getSavedConnections();

          // Assert that we have nothing now in our SecretStorage
          assert.strictEqual(
            await testStorageController.getSecret(savedConnection.id),
            null
          );
          assert.strictEqual(
            updatedConnection.secretStorageLocation,
            SecretStorageLocation.Keytar
          );
        });

        test('should be able to load other connections even if the _migrateConnectionWithKeytarSecrets throws', async () => {
          // We replace the keytar module with our stub to make sure that later,
          // during migration, we are able to find the secrets in the correct
          // place
          extensionSandbox.replace(ext, 'keytarModule', keytarStub);

          // Adding a few connections
          await testConnectionController.addNewConnectionStringAndConnect(
            TEST_DATABASE_URI
          );
          await testConnectionController.addNewConnectionStringAndConnect(
            TEST_DATABASE_URI_USER
          );

          const [firstConnection, secondConnection] =
            testConnectionController.getSavedConnections();

          // Clearing the connection and disconnect
          await testConnectionController.disconnect();
          testConnectionController.clearAllConnections();

          // Faking the failure of _migrateConnectionWithKeytarSecrets with an
          // error thrown from keytar.getPassword
          const originalGetPasswordFn = keytarStub.getPassword.bind(keytarStub);
          testSandbox.replace(keytarStub, 'getPassword', (serviceName, key) => {
            if (key === secondConnection.id) {
              throw new Error('Something bad happened');
            }
            return originalGetPasswordFn(serviceName, key);
          });

          // Now load all connections, it should not reject
          await assert.doesNotReject(
            testConnectionController.loadSavedConnections()
          );

          assert.deepStrictEqual(testConnectionController._connections, {
            [firstConnection.id]: {
              ...firstConnection,
              secretStorageLocation: SecretStorageLocation.SecretStorage,
            },
          });
        });

        test('should be able to re-attempt migration for connections that failed in previous load and were not marked migrated', async () => {
          // We replace the keytar module with our stub to make sure that later,
          // during migration, we are able to find the secrets in the correct
          // place
          extensionSandbox.replace(ext, 'keytarModule', keytarStub);

          // Add a few connections
          await testConnectionController.addNewConnectionStringAndConnect(
            TEST_DATABASE_URI
          );
          await testConnectionController.addNewConnectionStringAndConnect(
            TEST_DATABASE_URI_USER
          );

          const [firstConnection, secondConnection] =
            testConnectionController.getSavedConnections();

          // Clear all connections and disconnect
          await testConnectionController.disconnect();
          testConnectionController.clearAllConnections();

          // Faking the failure of _migrateConnectionWithKeytarSecrets with an
          // error thrown from keytar.getPassword
          testSandbox.replace(keytarStub, 'getPassword', (service, key) => {
            if (key === firstConnection.id) {
              return Promise.resolve('{}');
            }
            throw new Error('Something bad happened');
          });

          // Now load all connections
          await testConnectionController.loadSavedConnections();

          // And only first connection should appear in our connection list
          // because we don't include connections with failed keytar migration
          assert.deepStrictEqual(testConnectionController._connections, {
            [firstConnection.id]: {
              ...firstConnection,
              secretStorageLocation: SecretStorageLocation.SecretStorage,
            },
          });

          // Now reset the keytar method to original
          testSandbox.restore();

          // Load all connections again
          await testConnectionController.loadSavedConnections();

          // Now we should be able to see the migrated connection
          assert.deepStrictEqual(testConnectionController._connections, {
            [firstConnection.id]: {
              ...firstConnection,
              secretStorageLocation: SecretStorageLocation.SecretStorage,
            },
            [secondConnection.id]: {
              ...secondConnection,
              secretStorageLocation: SecretStorageLocation.SecretStorage,
            },
          });
        });
      }
    );

    suite('when connection secrets are already in SecretStorage', () => {
      afterEach(() => {
        testSandbox.restore();
      });

      test('should be able to load connection with its secrets', async () => {
        await testConnectionController.addNewConnectionStringAndConnect(
          TEST_DATABASE_URI
        );
        await testConnectionController.addNewConnectionStringAndConnect(
          TEST_DATABASE_URI_USER
        );

        // By default the connection secrets are already stored in SecretStorage
        const savedConnections = testConnectionController.getSavedConnections();
        assert.strictEqual(
          savedConnections.every(
            ({ secretStorageLocation }) =>
              secretStorageLocation === SecretStorageLocation.SecretStorage
          ),
          true
        );

        await testConnectionController.disconnect();
        testConnectionController.clearAllConnections();

        await testConnectionController.loadSavedConnections();
        const savedConnectionsAfterFreshLoad =
          testConnectionController.getSavedConnections();
        assert.deepStrictEqual(
          savedConnections,
          testConnectionController.getSavedConnections()
        );

        // Additionally make sure that we are retrieving secrets properly
        assert.strictEqual(
          savedConnectionsAfterFreshLoad[1].connectionOptions?.connectionString.includes(
            TEST_USER_PASSWORD
          ),
          true
        );
      });
    });

    test('should fire a CONNECTIONS_DID_CHANGE event if connections are loaded successfully', async () => {
      await testConnectionController.addNewConnectionStringAndConnect(
        TEST_DATABASE_URI_USER
      );

      await testConnectionController.disconnect();
      testConnectionController.clearAllConnections();

      let isConnectionChanged = false;
      testConnectionController.addEventListener(
        DataServiceEventTypes.CONNECTIONS_DID_CHANGE,
        () => {
          isConnectionChanged = true;
        }
      );

      await testConnectionController.loadSavedConnections();
      assert.strictEqual(isConnectionChanged, true);
    });

    test('should track and also notify the users of unique failed keytar secrets migration (in the current load of extension)', async () => {
      testSandbox.replace(testStorageController, 'get', (key, storage) => {
        if (
          storage === StorageLocation.WORKSPACE ||
          key === StorageVariables.WORKSPACE_SAVED_CONNECTIONS
        ) {
          return {};
        }

        return {
          'random-connection-1': {
            id: 'random-connection-1',
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.Keytar,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-2': {
            id: 'random-connection-2',
            name: 'localhost:27018',
            storageLocation: 'GLOBAL',
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27018/?readPreference=primary&ssl=false',
            },
          },
        } as any;
      });
      testSandbox.replace(
        testConnectionController,
        '_getConnectionInfoWithSecrets',
        (connectionInfo) =>
          Promise.resolve({
            ...connectionInfo,
            secretStorageLocation: SecretStorageLocation.Keytar,
          } as any)
      );
      const trackStub = testSandbox.stub(
        testTelemetryService,
        'trackKeytarSecretsMigrationFailed'
      );

      // Clear any connections and load so we get our stubbed connections from above.
      testConnectionController.clearAllConnections();
      await testConnectionController.loadSavedConnections();

      // Notified to user
      assert.strictEqual(showInformationMessageStub.calledOnce, true);
      assert.deepStrictEqual(showInformationMessageStub.lastCall.args, [
        keytarMigrationFailedMessage(1),
      ]);

      // Tracked
      assert.strictEqual(trackStub.calledOnce, true);
      assert.deepStrictEqual(trackStub.lastCall.args, [
        {
          saved_connections: 2,
          loaded_connections: 2,
          connections_with_failed_keytar_migration: 1,
        },
      ]);
    });

    test('should neither track nor notify the user if none of the failed migrations are from current load of extension', async () => {
      testSandbox.replace(testStorageController, 'get', (key, storage) => {
        if (
          storage === StorageLocation.WORKSPACE ||
          key === StorageVariables.WORKSPACE_SAVED_CONNECTIONS
        ) {
          return {};
        }

        return {
          'random-connection-1': {
            id: 'random-connection-1',
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.Keytar,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-2': {
            id: 'random-connection-2',
            name: 'localhost:27018',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.Keytar,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27018/?readPreference=primary&ssl=false',
            },
          },
        } as any;
      });
      testSandbox.replace(
        testConnectionController,
        '_getConnectionInfoWithSecrets',
        (connectionInfo) =>
          Promise.resolve({
            ...connectionInfo,
            secretStorageLocation: SecretStorageLocation.Keytar,
          } as any)
      );
      const trackStub = testSandbox.stub(
        testTelemetryService,
        'trackKeytarSecretsMigrationFailed'
      );

      // Clear any connections and load so we get our stubbed connections from above.
      testConnectionController.clearAllConnections();
      await testConnectionController.loadSavedConnections();

      // No notification sent to the user
      assert.strictEqual(showInformationMessageStub.notCalled, true);

      // Tracks only the saved connections laoded event
      assert.strictEqual(trackStub.notCalled, true);
    });

    test('should track SAVED_CONNECTIONS_LOADED event on load of saved connections', async () => {
      testSandbox.replace(testStorageController, 'get', (key, storage) => {
        if (
          storage === StorageLocation.WORKSPACE ||
          key === StorageVariables.WORKSPACE_SAVED_CONNECTIONS
        ) {
          return {};
        }

        return {
          'random-connection-1': {
            id: 'random-connection-1',
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.SecretStorage,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-2': {
            id: 'random-connection-2',
            name: 'localhost:27018',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.SecretStorage,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27018/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-3': {
            id: 'random-connection-3',
            name: 'localhost:27018',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.Keytar,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27018/?readPreference=primary&ssl=false',
            },
          },
        } as any;
      });
      testSandbox.replace(
        testConnectionController,
        '_getConnectionInfoWithSecrets',
        (connectionInfo) => Promise.resolve(connectionInfo as any)
      );
      const trackStub = testSandbox.stub(
        testTelemetryService,
        'trackSavedConnectionsLoaded'
      );

      // Clear any connections and load so we get our stubbed connections from above.
      testConnectionController.clearAllConnections();
      await testConnectionController.loadSavedConnections();

      // Load connections tracked. Called once because in the current load of
      // migration there were no errors and hence the error tracking event won't
      // be called.
      assert.strictEqual(trackStub.calledOnce, true);
      assert.deepStrictEqual(trackStub.lastCall.args, [
        {
          connections_with_secrets_in_keytar: 1,
          connections_with_secrets_in_secret_storage: 2,
          saved_connections: 3,
          loaded_connections: 3,
        },
      ]);
    });
  });
});
