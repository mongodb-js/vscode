import sinon from 'sinon';
import * as vscode from 'vscode';
import { afterEach, beforeEach } from 'mocha';
import { expect } from 'chai';

import AUTH_STRATEGY_VALUES from '../../../views/webview-app/legacy/connection-model/constants/auth-strategies';
import { StorageController, StorageVariables } from '../../../storage';
import {
  StorageLocation,
  DefaultSavingLocations,
  SecretStorageLocation,
} from '../../../storage/storageController';
import READ_PREFERENCES from '../../../views/webview-app/legacy/connection-model/constants/read-preferences';
import SSH_TUNNEL_TYPES from '../../../views/webview-app/legacy/connection-model/constants/ssh-tunnel-types';
import SSL_METHODS from '../../../views/webview-app/legacy/connection-model/constants/ssl-methods';
import { ExtensionContextStub } from '../stubs';
import {
  TEST_DATABASE_URI,
  TEST_DATABASE_URI_USER,
  TEST_USER_PASSWORD,
} from '../dbTestHelper';
import type { StoreConnectionInfo } from '../../../storage/connectionStorage';
import { ConnectionStorage } from '../../../storage/connectionStorage';

const testDatabaseConnectionName = 'localhost:27088';

const newTestConnection = (id: string) => ({
  id,
  connectionOptions: {
    connectionString: TEST_DATABASE_URI,
  },
});

suite('Connection Storage Test Suite', function () {
  const extensionContextStub = new ExtensionContextStub();
  const testStorageController = new StorageController(extensionContextStub);
  let testConnectionStorage: ConnectionStorage;

  const sandbox = sinon.createSandbox();

  beforeEach(function () {
    testConnectionStorage = new ConnectionStorage({
      storageController: testStorageController,
    });

    sandbox.stub(vscode.window, 'showInformationMessage');
    sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(function () {
    // Reset our mock extension's state.
    extensionContextStub._workspaceState = {};
    extensionContextStub._globalState = {};

    sandbox.restore();
  });

  test('when there are no existing connections in the store and the connection controller loads connections', async () => {
    const connections = await testConnectionStorage.loadConnections();

    const connectionsCount = connections.length;

    expect(connectionsCount).to.equal(0);
  });

  test('it loads both global and workspace stored connections', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);

    await testConnectionStorage.saveNewConnection(newTestConnection('1'));
    await testConnectionStorage.saveNewConnection(newTestConnection('2'));
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );

    await testConnectionStorage.saveNewConnection(newTestConnection('3'));
    await testConnectionStorage.saveNewConnection(newTestConnection('4'));

    const connections = await testConnectionStorage.loadConnections();

    expect(Object.keys(connections).length).to.equal(4);
    expect(connections[Object.keys(connections)[0]].name).to.equal(
      'localhost:27088'
    );
    expect(
      connections[Object.keys(connections)[2]].connectionOptions
        ?.connectionString
    ).to.equal('mongodb://localhost:27088/');
    expect(connections[Object.keys(connections)[2]].id).to.equal('3');
  });

  test('when a connection is added it is saved to the global storage', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);

    await testConnectionStorage.saveNewConnection(newTestConnection('1'));

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(globalStoreConnections).length).to.equal(1);

    const id = Object.keys(globalStoreConnections)[0];

    expect(globalStoreConnections[id].name).to.equal(
      testDatabaseConnectionName
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS
    );

    expect(workspaceStoreConnections).to.equal(undefined);
  });

  test('when a connection is added it is saved to the workspace store', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    await testConnectionStorage.saveNewConnection(newTestConnection('1'));

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    const id = Object.keys(workspaceStoreConnections)[0];

    expect(workspaceStoreConnections[id].name).to.equal(
      testDatabaseConnectionName
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(globalStoreConnections).to.equal(undefined);
  });

  test('when a connection is added and the user has set it to not save on default it is not saved', async () => {
    // Don't save connections on default.
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations['Session Only']
      );
    await testConnectionStorage.saveNewConnection(newTestConnection('1'));

    const objectString = JSON.stringify(undefined);
    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(JSON.stringify(globalStoreConnections)).to.equal(objectString);

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(JSON.stringify(workspaceStoreConnections)).to.equal(objectString);
  });

  test('when a connection is removed it is also removed from workspace store', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );
    const connectionId = 'pie';
    await testConnectionStorage.saveNewConnection(
      newTestConnection(connectionId)
    );

    const workspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );

    expect(Object.keys(workspaceStoreConnections).length).to.equal(1);

    await testConnectionStorage.removeConnection(connectionId);

    const postWorkspaceStoreConnections = testStorageController.get(
      StorageVariables.WORKSPACE_SAVED_CONNECTIONS,
      StorageLocation.WORKSPACE
    );
    expect(Object.keys(postWorkspaceStoreConnections).length).to.equal(0);
  });

  test('when a connection is removed it is also removed from global storage', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update('defaultConnectionSavingLocation', DefaultSavingLocations.Global);
    const connectionId = 'pineapple';
    await testConnectionStorage.saveNewConnection(
      newTestConnection(connectionId)
    );

    const globalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(globalStoreConnections).length).to.equal(1);

    await testConnectionStorage.removeConnection(connectionId);

    const postGlobalStoreConnections = testStorageController.get(
      StorageVariables.GLOBAL_SAVED_CONNECTIONS,
      StorageLocation.GLOBAL
    );

    expect(Object.keys(postGlobalStoreConnections).length).to.equal(0);
  });

  test('when a connection is removed, the secrets for that connection are also removed', async () => {
    const secretStorageDeleteSpy = sandbox.spy(
      testStorageController,
      'deleteSecret'
    );

    const connectionId = 'pie';
    await testConnectionStorage.saveNewConnection(
      newTestConnection(connectionId)
    );

    await testConnectionStorage.removeConnection(connectionId);
    expect(secretStorageDeleteSpy.calledOnce).to.equal(true);
  });

  test('_getConnectionInfoWithSecrets returns undefined for old connections', async () => {
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

    const connectionInfo =
      await testConnectionStorage._getConnectionInfoWithSecrets(
        oldSavedConnectionInfo
      );

    expect(connectionInfo).to.equal(undefined);
  });

  test('_getConnectionInfoWithSecrets returns the connection info with secrets', async () => {
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
    await testConnectionStorage.saveConnectionToStore(connectionInfo);
    const connections = await testConnectionStorage.loadConnections();

    expect(connections.length).to.equal(1);

    const newSavedConnectionInfoWithSecrets =
      await testConnectionStorage._getConnectionInfoWithSecrets(
        connections[0] as StoreConnectionInfo
      );

    expect(newSavedConnectionInfoWithSecrets).to.deep.equal(connectionInfo);
  });

  suite('loadConnections', () => {
    const extensionSandbox = sinon.createSandbox();
    const testSandbox = sinon.createSandbox();

    afterEach(() => {
      testSandbox.restore();
      extensionSandbox.restore();
    });

    suite('when connection secrets are already in SecretStorage', () => {
      afterEach(() => {
        testSandbox.restore();
      });

      test('should be able to load connection with its secrets', async () => {
        await testConnectionStorage.saveNewConnection(newTestConnection('1'));
        await testConnectionStorage.saveNewConnection({
          id: '2',
          connectionOptions: {
            connectionString: TEST_DATABASE_URI_USER,
          },
        });

        // By default the connection secrets are already stored in SecretStorage
        const savedConnections = await testConnectionStorage.loadConnections();
        expect(
          savedConnections.every(
            ({ secretStorageLocation }) =>
              secretStorageLocation === SecretStorageLocation.SecretStorage
          )
        ).to.equal(true);

        // Additionally make sure that we are retrieving secrets properly.
        expect(
          savedConnections[1].connectionOptions?.connectionString
        ).to.include(TEST_USER_PASSWORD);
      });
    });

    test('should ignore older unsupported secrets', async () => {
      const loadedConnection = {
        id: 'random-connection-4',
        name: 'localhost:27089',
        storageLocation: 'GLOBAL',
        secretStorageLocation: SecretStorageLocation.SecretStorage,
        connectionOptions: {
          connectionString:
            'mongodb://localhost:27080/?readPreference=primary&ssl=false',
        },
      };
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
            name: 'localhost:27017',
            storageLocation: 'GLOBAL',
            secretStorageLocation: SecretStorageLocation.KeytarSecondAttempt,
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27017/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-3': {
            id: 'random-connection-3',
            name: 'localhost:27088',
            storageLocation: 'GLOBAL',
            connectionOptions: {
              connectionString:
                'mongodb://localhost:27088/?readPreference=primary&ssl=false',
            },
          },
          'random-connection-4': loadedConnection,
        } as any;
      });

      // Clear any connections and load so we get our stubbed connections from above.
      const connections = await testConnectionStorage.loadConnections();

      expect(Object.keys(connections).length).to.equal(1);
      expect(Object.values(connections)[0]).to.deep.equal(loadedConnection);
    });
  });

  test('when there are saved workspace connections, hasSavedConnections returns true', async () => {
    await vscode.workspace
      .getConfiguration('mdb.connectionSaving')
      .update(
        'defaultConnectionSavingLocation',
        DefaultSavingLocations.Workspace
      );

    await testConnectionStorage.saveNewConnection(
      newTestConnection('pineapple')
    );

    expect(testConnectionStorage.hasSavedConnections()).to.equal(true);
  });

  test('when there are saved global connections, hasSavedConnections returns true', async () => {
    await testConnectionStorage.saveNewConnection(
      newTestConnection('pineapple')
    );

    expect(testConnectionStorage.hasSavedConnections()).to.equal(true);
  });

  test('when there are no saved connections, hasSavedConnections returns false', () => {
    expect(testConnectionStorage.hasSavedConnections()).to.equal(false);
  });
});
